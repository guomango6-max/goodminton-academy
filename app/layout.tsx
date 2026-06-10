import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { LangProvider } from "./components/LangContext";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const siteUrl = new URL("https://goodminton.fi");
const siteDescription =
  "Goodminton Academy 提供芬兰羽毛球训练、学员成长图谱、课后反馈追踪、比赛复盘和 AI 辅助问答。";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Goodminton Academy | Badminton Coaching in Finland",
    template: "%s | Goodminton Academy",
  },
  description: siteDescription,
  applicationName: "Goodminton Academy",
  keywords: [
    "Goodminton Academy",
    "goodminton.fi",
    "羽毛球训练",
    "羽毛球教练",
    "芬兰羽毛球",
    "badminton coaching Finland",
    "badminton training Helsinki",
    "AI badminton training",
    "student training record",
  ],
  authors: [{ name: "Goodminton Academy", url: siteUrl }],
  creator: "Goodminton Academy",
  publisher: "Goodminton Academy",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Goodminton Academy | Badminton Coaching in Finland",
    description: siteDescription,
    url: "/",
    siteName: "Goodminton Academy",
    images: [
      {
        url: "/badminton-hero.png",
        width: 1776,
        height: 900,
        alt: "Goodminton Academy badminton training and student progress system",
      },
    ],
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Goodminton Academy | Badminton Coaching in Finland",
    description: siteDescription,
    images: ["/badminton-hero.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
