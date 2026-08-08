import type { Metadata } from 'next';
import ChatRoom from '../components/ChatRoom';

// 这一页此前没有自己的 metadata，于是从根 layout 继承了 canonical: "/"——
// 等于对搜索引擎声明「我就是首页」，而它同时又躺在 sitemap 里。两个信号打架，
// 结果通常是这一页被折叠掉不收。
export const metadata: Metadata = {
  title: '球友咨询',
  description: '反手、发接发、杀球、双打轮转到比赛策略：把最常见的卡点先聊清楚。',
  alternates: { canonical: '/friend' },
};

export default function FriendPage() {
  return (
    <ChatRoom
      role="friend"
      accentColor="emerald"
      title="Goodminton Academy"
      copy={{
        zh: {
          subtitle: '球友咨询 — 一起把球打得更好',
          welcomeTitle: '嘿，球友',
          welcomeDesc: '从反手、发接发、杀球、双打轮转到比赛策略，把最常见的卡点先聊清楚。',
          prompts: [
            { icon: '01', text: '反手后场总是打不远，被连续压反手，先改哪一步？' },
            { icon: '02', text: '双打接发总是被扑，发接发前三拍怎么设计？' },
            { icon: '03', text: '杀球很用力但不重，还容易下网，问题通常在哪里？' },
            { icon: '04', text: '双打轮转总乱：什么时候上网、什么时候退后场？' },
            { icon: '05', text: '步法总慢半拍，尤其后场两底角，怎么练更有效？' },
            { icon: '06', text: '打比赛一紧张就失误，领先也守不住，怎么稳住节奏？' },
            { icon: '07', text: '对手一直吊网前和打空当，我该怎么预判和站位？' },
            { icon: '08', text: '想从“会打”进阶到“会赢”，下一阶段该重点练什么？' },
          ],
        },
        en: {
          subtitle: 'Player room - get better together',
          welcomeTitle: 'Hey, player',
          welcomeDesc: 'Start with the common sticking points: backhand, serve-return, smash quality, doubles rotation, footwork, and match plans.',
          prompts: [
            { icon: '01', text: 'My rear-court backhand keeps getting exposed. What should I fix first?' },
            { icon: '02', text: 'I keep getting punished on serve return in doubles. How should I plan the first three shots?' },
            { icon: '03', text: 'My smash feels hard but not heavy, and it often hits the net. What is usually wrong?' },
            { icon: '04', text: 'Our doubles rotation is messy. When should I move forward or cover the rear court?' },
            { icon: '05', text: 'My footwork is always late, especially to the two rear corners. What should I train?' },
            { icon: '06', text: 'I make errors under pressure and lose leads. How can I stabilize my match rhythm?' },
            { icon: '07', text: 'Opponents keep using drops and empty spaces. How should I read and position better?' },
            { icon: '08', text: 'I can rally, but I do not know how to win points. What should I focus on next?' },
          ],
        },
      }}
    />
  );
}
