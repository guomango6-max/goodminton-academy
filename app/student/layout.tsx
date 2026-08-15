import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '学员档案',
  description: 'Goodminton Academy 学员训练档案登录入口。',
  alternates: {
    canonical: '/student',
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function StudentLayout({ children }: { children: ReactNode }) {
  return children;
}
