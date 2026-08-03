// 英文版的机器翻译层。
//
// 站点的界面文案是双语写死的，但内容不是：学员写的总结、教练的导读和点评、
// 课次名，全是中文，切到英文版之后原样露出来。这些内容没有人工英文版，
// 数量也在持续增长，所以走机翻。
//
// 三条设计约束：
//
// 1. 只翻含中日韩字符的串。英文、数字、日期、比分（21-18）原样返回——
//    既省 token，也避免模型把「C1」之类的等级标签「翻译」掉。
// 2. 缓存按原文哈希，不按位置。同一句课次名在十几条记录里重复出现，
//    翻一次就够；缓存命中的部分根本不进请求。
// 3. 一次调用翻一批。逐条调用在一屏十几条内容上会慢到没法看。
//
// 缓存是进程内的（每个 serverless 实例一份），和本项目其它限流/缓存的做法
// 一致。冷启动会重翻一次，代价可接受；要更省就换成持久化存储。

import { createHash } from 'node:crypto';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

// 单次请求的上限。一屏论坛内容大约 3-5k 字符，留足余量又不至于让一次
// 失败的调用烧掉太多配额。
const MAX_TEXTS_PER_REQUEST = 80;
const MAX_CHARS_PER_REQUEST = 12_000;
const MAX_CHARS_PER_TEXT = 2_000;

type TranslationCache = Map<string, string>;

declare global {
  var __goodmintonTranslationCache: TranslationCache | undefined;
}

const cache = globalThis.__goodmintonTranslationCache || new Map<string, string>();
globalThis.__goodmintonTranslationCache = cache;

// 缓存不设过期：同一句中文的英文翻译不会隔天就变。只在条目过多时整体清空，
// 避免长期运行的实例把内存吃满。
const MAX_CACHE_ENTRIES = 5_000;

function cacheKey(text: string) {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

export function hasCjk(value: string) {
  // 中日韩统一表意文字 + 假名 + 中文标点。只要出现其一就认为需要翻译。
  return /[　-〿぀-ヿ㐀-䶿一-鿿＀-￯]/.test(value);
}

function translatable(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && hasCjk(value);
}

const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: DEEPSEEK_BASE_URL,
});

const SYSTEM_PROMPT = `You translate Chinese badminton coaching content into English for a coaching website.

Rules:
- Translate meaning, not word order. The result must read like a coach or player wrote it in English.
- Keep badminton terminology accurate: 封网 = net blocking / covering the net, 搓放 = net spin / hairpin, 劈吊 = slice drop, 高远球 = clear, 平抽 = drive, 挑球 = lift, 接杀 = smash defence, 还原 = recover to base, 步法 = footwork, 分腿垫步 = split step, 前三拍 = first three shots.
- Leave untouched: player levels (C1, C2, A2, B1), scores (21-18), dates, numbers, URLs, and anything already in English.
- Keep it about the same length. These are short cards and list rows; do not add explanation.
- No quotes around the result, no commentary, no markdown.`;

async function translateBatch(texts: string[]): Promise<string[]> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }

  // 用编号包住每一条，让模型不能把多条合并或漏掉。比让它输出 JSON 更耐受
  // 内容里本身带引号和换行的情况。
  const numbered = texts.map((text, index) => `[${index + 1}]\n${text}`).join('\n\n');

  const { text } = await generateText({
    model: deepseek(DEEPSEEK_MODEL),
    system: SYSTEM_PROMPT,
    prompt: `Translate each numbered item into English. Reply with exactly ${texts.length} items in the same [n] format, same order, nothing else.\n\n${numbered}`,
    temperature: 0.2,
  });

  const parsed = new Map<number, string>();
  // 按 [n] 切块，逐块取正文。模型偶尔会多写一行前言，按编号取就不受影响。
  const pattern = /\[(\d+)\]\s*\n?([\s\S]*?)(?=\n\s*\[\d+\]|$)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const index = Number(match[1]) - 1;
    const value = match[2].trim();
    if (index >= 0 && index < texts.length && value) parsed.set(index, value);
  }

  // 任何一条没解析出来就退回原文。宁可这一条还是中文，也不能串位——
  // 串位会把 A 的总结安到 B 的卡片上。
  return texts.map((original, index) => parsed.get(index) ?? original);
}

/**
 * 翻一组字符串，返回 原文 → 译文 的映射。
 * 不需要翻的（无中文、空串、超长）不会出现在结果里，调用方按原文兜底即可。
 */
export async function translateToEnglish(inputs: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  // 去重后再算要不要翻：一屏里重复的课次名只该算一次。
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of inputs) {
    if (!translatable(value) || value.length > MAX_CHARS_PER_TEXT) continue;
    if (seen.has(value)) continue;
    seen.add(value);

    const cached = cache.get(cacheKey(value));
    if (cached) {
      result[value] = cached;
      continue;
    }
    unique.push(value);
  }

  if (unique.length === 0) return result;

  const pending = unique.slice(0, MAX_TEXTS_PER_REQUEST);
  let budget = MAX_CHARS_PER_REQUEST;
  const batch: string[] = [];
  for (const value of pending) {
    if (budget - value.length < 0) break;
    budget -= value.length;
    batch.push(value);
  }
  if (batch.length === 0) return result;

  const translated = await translateBatch(batch);

  if (cache.size > MAX_CACHE_ENTRIES) cache.clear();
  batch.forEach((original, index) => {
    const value = translated[index];
    if (!value || value === original) return;
    cache.set(cacheKey(original), value);
    result[original] = value;
  });

  return result;
}

export function clearTranslationCacheForTests() {
  cache.clear();
}
