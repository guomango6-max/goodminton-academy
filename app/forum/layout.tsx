import type { Metadata } from 'next';
import { localizedMetadata } from '@/lib/article-routes';

// /forum 是 client component（要读 sessionStorage 里的学员凭据），client
// component 不能导出 metadata。所以标题和描述放在这层 server layout 上。
// 在此之前它继承首页的 title，搜索结果里两条一模一样。
export const metadata: Metadata = localizedMetadata({
  lang: 'zh',
  title: '学员精华墙｜课后总结与比赛复盘',
  description:
    'Goodminton Academy 学员的课后总结与比赛复盘精选，附教练点评：真实的卡点、纠错和想通的瞬间，看别人怎么练。',
  zhPath: '/forum',
  enPath: '/forum',
});

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return children;
}
