const DEFAULT_FEED_URL = 'https://blog.goodminton.fi/badminton.json';
const BADMINTON_TAG = /羽毛球|badminton|sulkapallo/i;

export type BadmintonBlogPost = {
  title: string;
  description: string;
  pubDate: string;
  published: true;
  tags: string[];
  lang: 'zh' | 'en';
  href: string;
};

type FeedPayload = { articles?: unknown };

function isBlogPost(value: unknown): value is BadmintonBlogPost {
  if (!value || typeof value !== 'object') return false;
  const post = value as Record<string, unknown>;
  return (
    typeof post.title === 'string' &&
    typeof post.description === 'string' &&
    typeof post.pubDate === 'string' &&
    !Number.isNaN(Date.parse(post.pubDate)) &&
    post.published === true &&
    Array.isArray(post.tags) &&
    post.tags.every((tag) => typeof tag === 'string') &&
    post.tags.some((tag) => BADMINTON_TAG.test(tag)) &&
    (post.lang === 'zh' || post.lang === 'en') &&
    typeof post.href === 'string' &&
    /^https:\/\/blog\.goodminton\.fi\/blog\//.test(post.href)
  );
}

/** Validate the public blog feed before it reaches the homepage. */
export function parseBadmintonBlogFeed(payload: FeedPayload): BadmintonBlogPost[] {
  if (!Array.isArray(payload?.articles)) return [];
  return payload.articles
    .filter(isBlogPost)
    .sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate));
}

/**
 * The blog deploy and the main-site deploy are independent. The five-minute
 * revalidation window lets a new tagged blog post appear without rebuilding
 * goodminton.fi. A feed outage keeps the existing local homepage articles.
 */
export async function getBadmintonBlogPosts(): Promise<BadmintonBlogPost[]> {
  const feedUrl = process.env.GOODMINTON_BADMINTON_FEED_URL || DEFAULT_FEED_URL;
  try {
    const response = await fetch(feedUrl, { next: { revalidate: 300 } });
    if (!response.ok) return [];
    return parseBadmintonBlogFeed((await response.json()) as FeedPayload);
  } catch {
    return [];
  }
}
