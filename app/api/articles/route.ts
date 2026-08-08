import { NextResponse } from 'next/server';
import { getHomeArticleCards } from '../../../lib/articles.ts';

// 解析和取舍都收进了 lib/articles：首页、文章页、sitemap 和这个接口现在读的是
// 同一份数据。这个接口保留下来是为了不打断已有调用方，首页自身已经不再用它。
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await getHomeArticleCards());
  } catch {
    return NextResponse.json({ zh: [], en: [] });
  }
}
