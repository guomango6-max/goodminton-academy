import { createOpenAI } from '@ai-sdk/openai';
import { APICallError, streamText, convertToModelMessages, UIMessage } from 'ai';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { NextResponse } from 'next/server';

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

// Lightweight abuse guards. Protects the open chat endpoint from burning
// DeepSeek quota and spamming ntfy. In-process only (per serverless instance);
// good enough for current traffic, swap for a shared store if it scales.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;
const MAX_TOTAL_CHARS = 8_000;

const rateLimitBuckets = new Map<string, number[]>();

function getClientId(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(clientId: string) {
  const now = Date.now();
  const recent = (rateLimitBuckets.get(clientId) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitBuckets.set(clientId, recent);
    return true;
  }
  recent.push(now);
  rateLimitBuckets.set(clientId, recent);

  // Opportunistic cleanup so the map does not grow unbounded.
  if (rateLimitBuckets.size > 5_000) {
    for (const [key, stamps] of rateLimitBuckets) {
      if (stamps.every((ts) => now - ts >= RATE_LIMIT_WINDOW_MS)) rateLimitBuckets.delete(key);
    }
  }
  return false;
}

function totalMessageChars(messages: ChatRequestMessage[]) {
  let total = 0;
  for (const message of messages) {
    if (typeof message.content === 'string') total += message.content.length;
    if (Array.isArray(message.parts)) {
      for (const part of message.parts) {
        if (part && part.type === 'text' && typeof (part as { text?: string }).text === 'string') {
          total += (part as { text: string }).text.length;
        }
      }
    }
  }
  return total;
}

const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: DEEPSEEK_BASE_URL,
});

type ChatRequestMessage = UIMessage & {
  content?: string;
};

function normalizeChatMessages(messages: ChatRequestMessage[]) {
  return messages.map((message, index) => {
    if (Array.isArray(message.parts) && message.parts.length > 0) {
      return message as UIMessage;
    }

    if (typeof message.content === 'string' && message.content.trim()) {
      return {
        ...message,
        id: message.id || `message-${index}`,
        parts: [{ type: 'text' as const, text: message.content }],
      } as UIMessage;
    }

    return message as UIMessage;
  });
}

function getLastUserText(messages: UIMessage[]) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  if (!lastUserMessage) return '';

  const textFromParts = lastUserMessage.parts
    ?.filter((part) => part.type === 'text')
    .map((part) => (part as { type: 'text'; text: string }).text)
    .join('')
    .trim();

  return textFromParts || (lastUserMessage as unknown as { content?: string }).content || '';
}

function toMarkdownQuote(text: string) {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n');
}

async function appendFeedbackMarkdown({
  time,
  role,
  lang,
  lastUserText,
}: {
  time: string;
  role: string;
  lang: string;
  lastUserText: string;
}) {
  const feedbackPath = process.env.GOODMINTON_FEEDBACK_MD_PATH;
  if (!feedbackPath) return;

  const entry = [
    '',
    `## ${time}`,
    '',
    `- role: ${role}`,
    `- lang: ${lang}`,
    '- source: Goodminton Academy chat',
    '',
    toMarkdownQuote(lastUserText),
    '',
  ].join('\n');

  await mkdir(dirname(feedbackPath), { recursive: true });
  await appendFile(feedbackPath, entry, 'utf8');
}

const NTFY_TOPIC = process.env.NTFY_TOPIC || 'goodminton-feedback-ef27280b6181';

async function sendFeedbackNtfy({
  time,
  role,
  lang,
  lastUserText,
}: {
  time: string;
  role: string;
  lang: string;
  lastUserText: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        title: `[${role}/${lang}] Goodminton feedback`,
        tags: 'badminton,speech_balloon',
      },
      body: `${lastUserText}\n\n— ${time}`,
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`ntfy failed: ${response.status} ${response.statusText} ${body}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function logFeedback({ messages, role, lang }: { messages: UIMessage[]; role: string; lang: string }) {
  const lastUserText = getLastUserText(messages);
  if (!lastUserText) return;

  const time = new Date().toISOString();

  console.log('[goodminton-feedback]', {
    time,
    role,
    lang,
    lastUserText,
  });

  try {
    await appendFeedbackMarkdown({ time, role, lang, lastUserText });
  } catch (error) {
    console.error('[goodminton-feedback-md-error]', error);
  }

  try {
    await sendFeedbackNtfy({ time, role, lang, lastUserText });
  } catch (error) {
    console.error('[goodminton-feedback-ntfy-error]', error);
  }
}

function getDeepSeekErrorMessage(error: unknown, lang: 'zh' | 'en') {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401) {
      return lang === 'zh'
        ? 'DeepSeek API Key 无效或未生效，请检查 Vercel 环境变量 DEEPSEEK_API_KEY。'
        : 'DeepSeek API key is invalid. Please check the DEEPSEEK_API_KEY environment variable.';
    }

    if (error.statusCode === 402) {
      return lang === 'zh'
        ? 'DeepSeek 免费额度或余额不足，请在 DeepSeek 控制台检查额度。'
        : 'DeepSeek quota or balance is insufficient. Please check your DeepSeek console.';
    }

    if (error.statusCode === 429) {
      return lang === 'zh'
        ? 'DeepSeek 请求太频繁，请稍等一会儿再试。'
        : 'DeepSeek is rate limiting requests. Please try again shortly.';
    }

    if (error.statusCode && error.statusCode >= 500) {
      return lang === 'zh'
        ? 'DeepSeek 服务暂时繁忙，请稍后再试。'
        : 'DeepSeek is temporarily unavailable. Please try again later.';
    }
  }

  return lang === 'zh'
    ? '聊天服务暂时不可用，请稍后再试。'
    : 'Chat service is temporarily unavailable. Please try again later.';
}

const systemPrompts = {
  student: {
    zh: `你是 Goodminton Academy 的学员反馈顾问。学员来这里主要是**反馈**——课程感受、训练进度、困惑、建议。

你的任务：
1. **认真倾听** — 让学员感觉被听见，不敷衍
2. **挖深反馈** — 追问细节，把模糊的感受变成具体信息（"哪个动作？什么情况下？")
3. **给一个实际回应** — 简单解释或给一个当下能用的小建议
4. **记录洞察** — 把学员说的话当作改进课程的原材料

说话风格：真诚、直接、有温度，像一个认真的教练助理，不像客服机器人。用中文回复，简洁有力。`,

    en: `You are the student feedback advisor for Goodminton Academy. Students come here mainly to give **feedback** — how sessions felt, training progress, confusion, suggestions.

Your tasks:
1. **Listen carefully** — make students feel heard, not brushed off
2. **Dig deeper** — ask follow-up questions to turn vague feelings into specific information ("Which shot? In what situation?")
3. **Give a practical response** — a brief explanation or one actionable tip they can use right away
4. **Note the insight** — treat what students say as raw material for improving future classes

Tone: genuine, direct, warm — like a thoughtful coaching assistant, not a customer service bot. Reply in English, concise and clear.`,
  },

  friend: {
    zh: `你是 Goodminton Academy 的羽毛球顾问，专门服务球友（非正式学员）的技术**咨询**。

你的任务：
1. **诊断问题** — 根据球友描述，判断核心技术或战术问题所在
2. **给具体建议** — 不说废话，直接给可执行的改进方向
3. **拓展思维** — 帮球友看到自己没想到的维度（对手分析、节奏控制、体能等）
4. **保持对话** — 问清楚情况再给建议，避免泛泛而谈

说话风格：专业但轻松，像一个懂球的老球友在认真帮你分析，不说官话。用中文回复，简洁有力。`,

    en: `You are the badminton consultant for Goodminton Academy, serving recreational players (not enrolled students) with technical **advice**.

Your tasks:
1. **Diagnose the problem** — based on what the player describes, identify the core technical or tactical issue
2. **Give specific advice** — skip the fluff, give directly actionable improvement directions
3. **Expand their thinking** — help them see angles they haven't considered (opponent analysis, tempo control, fitness, etc.)
4. **Keep the conversation going** — clarify the situation before giving advice; avoid vague generalisations

Tone: professional but relaxed, like a knowledgeable playing partner giving you a real analysis, not corporate speak. Reply in English, concise and clear.`,
  },
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    messages?: ChatRequestMessage[];
    role?: string;
    lang?: string;
  } | null;

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: 'messages must be a non-empty array.' }, { status: 400 });
  }

  if (isRateLimited(getClientId(req))) {
    return NextResponse.json(
      { error: '请求太频繁，请稍等一会儿再试。' },
      { status: 429, headers: { 'retry-after': '60' } },
    );
  }

  if (totalMessageChars(body.messages) > MAX_TOTAL_CHARS) {
    return NextResponse.json({ error: '消息内容过长，请精简后再发送。' }, { status: 413 });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: 'Chat service is not configured.' }, { status: 503 });
  }

  const { messages, role, lang } = body;
  const normalizedMessages = normalizeChatMessages(messages);
  const modelMessages = await convertToModelMessages(normalizedMessages).catch((error) => {
    console.error('[chat-message-format-error]', error);
    return null;
  });

  if (!modelMessages) {
    return NextResponse.json({ error: 'messages are not in a supported format.' }, { status: 400 });
  }

  const langKey = lang === 'en' ? 'en' : 'zh';
  const roleKey = role === 'friend' ? 'friend' : 'student';
  await logFeedback({ messages: normalizedMessages, role: roleKey, lang: langKey });
  const systemPrompt = systemPrompts[roleKey][langKey];

  try {
    const result = streamText({
      model: deepseek.chat(DEEPSEEK_MODEL),
      system: systemPrompt,
      messages: modelMessages,
      maxRetries: 1,
      onError({ error }) {
        console.error('[deepseek-chat-stream-error]', {
          model: DEEPSEEK_MODEL,
          statusCode: APICallError.isInstance(error) ? error.statusCode : undefined,
          message: error instanceof Error ? error.message : String(error),
        });
      },
    });

    return result.toUIMessageStreamResponse({
      onError(error) {
        return getDeepSeekErrorMessage(error, langKey);
      },
    });
  } catch (error) {
    console.error('[deepseek-chat-error]', error);
    return NextResponse.json({ error: getDeepSeekErrorMessage(error, langKey) }, { status: 502 });
  }
}
