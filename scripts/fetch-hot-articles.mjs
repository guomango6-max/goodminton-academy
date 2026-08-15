#!/usr/bin/env node
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const defaultSourcesPath = path.join(root, 'scripts', 'hot-article-sources.json');
const defaultOutDir = path.join(root, 'content', 'articles', '_candidates');
const topicImages = ['/article-free.svg', '/article-chat.png', '/article-megaphone.svg'];

const topicProfiles = [
  {
    id: 'ai-feedback',
    keywords: ['ai', 'smartwatch', 'sensor', 'wearable', 'evaluation', 'feedback', 'analysis', 'data'],
    zhCategory: 'AI训练',
    enCategory: 'AI coaching',
    zhTitle: 'AI训练热点：把挥拍反馈变成下一次重点',
    enTitle: 'AI training trend: turning stroke feedback into the next focus',
    zhDirection: '适合写成“AI不是替代教练，而是把课堂反馈、动作证据和下次训练目标连起来”。',
    enDirection: 'Use this as a coaching note on AI as a feedback layer, not a replacement for the coach.',
  },
  {
    id: 'summer-training',
    keywords: ['summer', 'camp', 'youth', 'junior', 'academy', 'program', '暑期', '夏训', '青少年'],
    zhCategory: '青少年训练',
    enCategory: 'Youth training',
    zhTitle: '夏训热点：从兴趣营走向可追踪训练',
    enTitle: 'Summer training trend: from camp energy to trackable progress',
    zhDirection: '适合写给家长和青少年学员：怎么判断暑期训练有没有目标、反馈和复盘。',
    enDirection: 'Use this as a guide for parents and teen players evaluating structured summer training.',
  },
  {
    id: 'doubles-first-three',
    keywords: ['doubles', 'serve', 'return', 'rotation', 'positioning', 'communication', '前三拍', '双打', '接发'],
    zhCategory: '双打战术',
    enCategory: 'Doubles tactics',
    zhTitle: '双打热点：发接发后的前三拍怎么练',
    enTitle: 'Doubles trend: training the first three shots after serve and return',
    zhDirection: '适合拆成接发站位、回球目标、同伴补位和前三拍后的站位重置。',
    enDirection: 'Use this for serve-return pressure, partner coverage, and rotation reset drills.',
  },
  {
    id: 'smash-defence',
    keywords: ['smash', 'defence', 'defense', 'block', 'lift', 'drive', '接杀', '防守', '杀球'],
    zhCategory: '接杀防守',
    enCategory: 'Smash defence',
    zhTitle: '防守热点：接杀不是挡回去，而是挡到位',
    enTitle: 'Defence trend: returning smashes with purpose, not panic',
    zhDirection: '适合转成课堂练习：挡网、挑后场、抽挡和下一拍恢复。',
    enDirection: 'Use this for block, lift, drive defence, and recovery standards.',
  },
  {
    id: 'footwork',
    keywords: ['footwork', 'split step', 'lunge', 'recovery', 'movement', '步法', '启动', '回位'],
    zhCategory: '步法训练',
    enCategory: 'Footwork',
    zhTitle: '步法热点：启动、到位和回位要一起练',
    enTitle: 'Footwork trend: training start, arrival, and recovery together',
    zhDirection: '适合写成从 split step 到击球后回位的完整链条。',
    enDirection: 'Use this as a movement-chain note from split step to recovery.',
  },
];

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function escapeYaml(value) {
  return String(value).replaceAll('"', '\\"');
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeXml(value) {
  return stripHtml(value);
}

function matchAll(content, regex) {
  return Array.from(content.matchAll(regex));
}

function parseRss(xml, source) {
  const itemMatches = matchAll(xml, /<item[\s\S]*?<\/item>/gi);
  return itemMatches.slice(0, source.maxItems || 10).map((match) => {
    const item = match[0];
    return {
      title: decodeXml(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1]),
      url: decodeXml(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1]),
      summary: decodeXml(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1]),
      publishedAt: decodeXml(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]),
      source: source.name,
      sourceWeight: source.weight || 1,
    };
  });
}

function parseArxiv(xml, source) {
  const entryMatches = matchAll(xml, /<entry[\s\S]*?<\/entry>/gi);
  return entryMatches.slice(0, source.maxItems || 8).map((match) => {
    const entry = match[0];
    const id = decodeXml(entry.match(/<id>([\s\S]*?)<\/id>/i)?.[1]);
    return {
      title: decodeXml(entry.match(/<title>([\s\S]*?)<\/title>/i)?.[1]),
      url: id,
      summary: decodeXml(entry.match(/<summary>([\s\S]*?)<\/summary>/i)?.[1]),
      publishedAt: decodeXml(entry.match(/<published>([\s\S]*?)<\/published>/i)?.[1]),
      source: source.name,
      sourceWeight: source.weight || 1,
    };
  });
}

function parseReddit(json, source) {
  const children = json?.data?.children || [];
  return children.slice(0, source.maxItems || 12).map(({ data }) => ({
    title: data.title,
    url: `https://www.reddit.com${data.permalink}`,
    summary: data.selftext || '',
    publishedAt: data.created_utc ? new Date(data.created_utc * 1000).toISOString() : '',
    score: Number(data.score || 0) + Number(data.num_comments || 0) * 1.5,
    source: source.name,
    sourceWeight: source.weight || 1,
  }));
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: {
      accept: source.type === 'reddit' ? 'application/json' : 'application/xml,text/xml,text/html;q=0.8,*/*;q=0.5',
      'user-agent': 'GoodmintonAcademyHotArticleBot/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`${source.name}: HTTP ${response.status}`);
  }

  if (source.type === 'reddit') return parseReddit(await response.json(), source);
  const text = await response.text();
  if (source.type === 'arxiv') return parseArxiv(text, source);
  return parseRss(text, source);
}

function classifyItem(item) {
  const haystack = `${item.title} ${item.summary}`.toLowerCase();
  const ranked = topicProfiles
    .map((topic) => ({
      topic,
      score: topic.keywords.reduce((total, keyword) => total + (haystack.includes(keyword.toLowerCase()) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[0].score > 0 ? ranked[0].topic : topicProfiles[2];
}

function scoreItem(item) {
  const publishedTime = Date.parse(item.publishedAt || '');
  const ageDays = Number.isFinite(publishedTime) ? Math.max(0, (Date.now() - publishedTime) / 86400000) : 21;
  const recencyScore = Math.max(0, 30 - ageDays);
  return recencyScore + (item.score || 0) / 5 + item.sourceWeight * 3;
}

function formatZhDate(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatEnDate(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function buildExcerpt(topic, items) {
  // 两种语言的顿号不一样。此前只 join 了一次就同时喂给中英两版，于是英文
  // 摘要里长期挂着一个「、」。
  const sources = [...new Set(items.map((item) => item.source))].slice(0, 3);
  return {
    zh: `今天的相关来源集中在${sources.join('、')}。适合整理成训练目标、课堂口令和课后复盘动作。`,
    en: `Today sources cluster around ${sources.join(', ')}. Turn it into training goals, coach cues, and review actions.`,
  };
}

function buildMarkdown(topic, items, index, date) {
  const slug = `hot-${slugify(topic.id)}-${date.toISOString().slice(0, 10)}`;
  const excerpt = buildExcerpt(topic, items);
  const sources = items
    .slice(0, 4)
    .map((item) => `- ${item.source}: [${item.title}](${item.url})`)
    .join('\n');

  return {
    filename: `${slug}.md`,
    content: `---\nautoHotArticle: true\ncandidateOwner: Growth\ncandidateStatus: inbox\nslug: ${slug}\ndate: ${date.toISOString().slice(0, 10)}\nimage: ${topicImages[index % topicImages.length]}\nhref: "#student-portal"\nzhTitle: ${topic.zhTitle}\nenTitle: "${escapeYaml(topic.enTitle)}"\nzhDate: ${formatZhDate(date)}\nenDate: ${formatEnDate(date)}\nzhCategory: ${topic.zhCategory}\nenCategory: ${topic.enCategory}\nzhExcerpt: ${excerpt.zh}\nenExcerpt: ${excerpt.en}\n---\n\n自动抓取来源：\n\n${sources}\n\n中文写作方向：${topic.zhDirection}\n\nEnglish angle: ${topic.enDirection}\n`,
  };
}

async function removeExistingAutoHotFiles(outDir, datePrefix) {
  const files = await readdir(outDir).catch(() => []);
  await Promise.all(
    files
      .filter((file) => file.endsWith('.md') && file.startsWith('hot-') && file.endsWith(`${datePrefix}.md`))
      .map(async (file) => {
        const filePath = path.join(outDir, file);
        const content = await readFile(filePath, 'utf8').catch(() => '');
        if (content.includes('autoHotArticle: true')) {
          await rm(filePath, { force: true });
        }
      }),
  );
}

async function main() {
  const outDir = path.resolve(root, getArg('--out', defaultOutDir));
  const sourcesPath = path.resolve(root, getArg('--sources', defaultSourcesPath));
  const limit = Number(getArg('--limit', '3'));
  const dryRun = hasArg('--dry-run');
  const sourceConfig = JSON.parse(await readFile(sourcesPath, 'utf8'));
  const enabledSources = (sourceConfig.sources || []).filter((source) => source.enabled !== false);

  const settled = await Promise.allSettled(enabledSources.map(fetchSource));
  const items = settled
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .filter((item) => item.title && item.url)
    .map((item) => ({ ...item, topic: classifyItem(item), hotScore: scoreItem(item) }))
    .sort((a, b) => b.hotScore - a.hotScore);

  const grouped = new Map();
  for (const item of items) {
    const current = grouped.get(item.topic.id) || [];
    current.push(item);
    grouped.set(item.topic.id, current);
  }

  const selected = [...grouped.values()]
    .map((group) => ({ topic: group[0].topic, items: group.slice(0, 4), score: group.reduce((total, item) => total + item.hotScore, 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (!selected.length) {
    throw new Error('No hot article candidates found. Check source URLs or network access.');
  }

  const date = new Date();
  const files = selected.map((entry, index) => buildMarkdown(entry.topic, entry.items, index, date));

  if (dryRun) {
    console.log(JSON.stringify(files.map(({ filename }) => filename), null, 2));
    return;
  }

  await mkdir(outDir, { recursive: true });
  await removeExistingAutoHotFiles(outDir, date.toISOString().slice(0, 10));
  await Promise.all(files.map((file) => writeFile(path.join(outDir, file.filename), file.content, 'utf8')));

  console.log(`Wrote ${files.length} hot article files to ${outDir}`);
  for (const file of files) console.log(`- ${file.filename}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
