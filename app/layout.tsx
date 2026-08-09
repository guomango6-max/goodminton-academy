import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { LangProvider } from "./components/LangContext";
import { buildLocalBusinessJsonLd, buildWebSiteJsonLd, siteProfile } from "../lib/site-profile";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const siteUrl = new URL("https://goodminton.fi");
// 中文描述以「城市 + 服务」开头，不以品牌名开头：搜的人不知道品牌名，
// 他搜的是「赫尔辛基羽毛球教练」。品牌名往后放，标题里已经有了。
const siteDescription =
  "赫尔辛基、埃斯波、万塔的羽毛球训练：成人与青少年课程，中文与英文教学，20 年以上执教经验。学员成长图谱、课后反馈与比赛复盘。";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    // 这是**中文页**的标题——中文页是 x-default，主力客群是在芬兰的华人。
    // 原来这里是一行纯英文，等于让搜「赫尔辛基羽毛球教练」的人看到一行读不出
    // 需求的英文。英文版的标题在 app/en 自己覆盖，不受这里影响。
    default: "赫尔辛基羽毛球教练 | 成人与青少年培训 | Goodminton Academy",
    template: "%s | Goodminton Academy",
  },
  description: siteDescription,
  applicationName: "Goodminton Academy",
  // 关键词按「有需求的人实际会怎么问」来排，而不是按业务名词。
  // 本地服务被检索到的入口是「城市 + 服务」，中英文都要有——主力客群是
  // 在芬兰的华人，他们搜中文；本地人和 AI 英文问答走英文。
  keywords: [
    "Goodminton Academy",
    "goodminton.fi",
    `badminton coach ${siteProfile.city}`,
    `badminton lessons ${siteProfile.city}`,
    `badminton training ${siteProfile.city}`,
    "badminton coaching Finland",
    "private badminton coaching",
    "junior badminton training",
    "sulkapallovalmennus",
    "sulkapallo valmentaja Helsinki",
    "赫尔辛基羽毛球",
    "赫尔辛基羽毛球教练",
    "芬兰羽毛球教练",
    "芬兰羽毛球培训",
    "芬兰华人羽毛球",
    "羽毛球私教",
    "青少年羽毛球训练",
    "AI badminton training",
    "student training record",
  ],
  authors: [{ name: "Goodminton Academy", url: siteUrl }],
  creator: "Goodminton Academy",
  publisher: "Goodminton Academy",
  alternates: {
    canonical: "/",
    // 中英是两个独立页面，各自 canonical 指向自己，再用 hreflang 互指。
    // x-default 给中文：主力客群是在芬兰的华人。
    languages: {
      "zh-CN": "/",
      en: "/en",
      "x-default": "/",
    },
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
      <head>
        {/* 结构化数据。搜索引擎和 AI 判断「这是不是一个在某地教羽毛球的机构」
            靠的是这个，不是正文里的形容词。缺的字段在 lib/site-profile 里填，
            未填的会被自动省略而不是输出空值。 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildLocalBusinessJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildWebSiteJsonLd()) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
