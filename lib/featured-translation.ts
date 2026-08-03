// 精选内容的英文版：字段选择 + 翻译组装。
//
// 只翻公开可见的那几个字段。学员姓名、student_id、等级标签（C1/A2）、
// 日期、比分都不进翻译——前两个根本不出现在墙上，后三个翻了只会翻坏。

// 相对路径而不是 @/ 别名：回填脚本用 node 直接 import 这个文件，
// 而 @/ 只在 Next 的打包里认。
import { translateToEnglish, hasCjk } from './translate.ts';

export type FeaturedTranslation = {
  title?: string;
  angle?: string;
  coachFeedback?: string;
  excerpt?: Record<string, string>;
};

export type FeaturedSource = {
  title?: string;
  angle?: string;
  coachFeedback?: string;
  excerpt?: Record<string, unknown>;
};

// excerpt 里 score 是比分（21-18 / 17-21），match 常常是「周末双打练习赛」
// 这类需要翻的短语。score 单独排除，其余交给 hasCjk 判断。
const EXCERPT_SKIP_KEYS = new Set(['score']);

function collectStrings(source: FeaturedSource): string[] {
  const out: string[] = [];
  for (const value of [source.title, source.angle, source.coachFeedback]) {
    if (typeof value === 'string' && hasCjk(value)) out.push(value);
  }
  for (const [key, value] of Object.entries(source.excerpt || {})) {
    if (EXCERPT_SKIP_KEYS.has(key)) continue;
    if (typeof value === 'string' && hasCjk(value)) out.push(value);
  }
  return out;
}

/**
 * 翻一条精选记录，返回可以直接存进 featured_en 的对象。
 * 一个字段都没翻出来时返回 null——存一个空壳只会让读取方以为翻过了。
 */
export async function buildFeaturedTranslation(
  source: FeaturedSource,
): Promise<FeaturedTranslation | null> {
  const texts = collectStrings(source);
  if (texts.length === 0) return null;

  const map = await translateToEnglish(texts);
  if (Object.keys(map).length === 0) return null;

  const result: FeaturedTranslation = {};
  if (source.title && map[source.title]) result.title = map[source.title];
  if (source.angle && map[source.angle]) result.angle = map[source.angle];
  if (source.coachFeedback && map[source.coachFeedback]) {
    result.coachFeedback = map[source.coachFeedback];
  }

  const excerpt: Record<string, string> = {};
  for (const [key, value] of Object.entries(source.excerpt || {})) {
    if (EXCERPT_SKIP_KEYS.has(key)) continue;
    if (typeof value === 'string' && map[value]) excerpt[key] = map[value];
  }
  if (Object.keys(excerpt).length > 0) result.excerpt = excerpt;

  return Object.keys(result).length > 0 ? result : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/** 把库里读出来的 featured_en 收成可信的形状。库里可能是任何东西。 */
export function parseFeaturedTranslation(value: unknown): FeaturedTranslation | null {
  if (!isObject(value)) return null;
  const out: FeaturedTranslation = {};
  for (const key of ['title', 'angle', 'coachFeedback'] as const) {
    const field = value[key];
    if (typeof field === 'string' && field.trim()) out[key] = field.trim();
  }
  if (isObject(value.excerpt)) {
    const excerpt: Record<string, string> = {};
    for (const [key, field] of Object.entries(value.excerpt)) {
      if (typeof field === 'string' && field.trim()) excerpt[key] = field.trim();
    }
    if (Object.keys(excerpt).length > 0) out.excerpt = excerpt;
  }
  return Object.keys(out).length > 0 ? out : null;
}
