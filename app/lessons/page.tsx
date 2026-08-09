import type { Metadata } from 'next';
import LessonsLanding from '../components/LessonsLanding';
import { localizedMetadata } from '../../lib/article-routes.ts';

export const metadata: Metadata = localizedMetadata({
  lang: 'zh',
  title: '羽毛球训练课｜赫尔辛基、埃斯波、万塔',
  description:
    '面向成人与青少年的羽毛球课：私教 40 €／60 分钟，小班 25 €／90 分钟。中文或英文授课，20 年以上执教经验，每节课书面反馈。每天 10:00–20:00 可约。',
  zhPath: '/lessons',
  enPath: '/en/lessons',
});

export default function LessonsPage() {
  return <LessonsLanding lang="zh" />;
}
