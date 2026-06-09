import type { Metadata } from "next";
import { LangProvider } from "./components/LangContext";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://goodminton.fi"),
  title: {
    default: "Goodminton Academy",
    template: "%s | Goodminton Academy",
  },
  description:
    "羽毛球训练反馈、学员成长图谱和 AI 辅助咨询入口。",
  applicationName: "Goodminton Academy",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Goodminton Academy",
    description: "羽毛球训练反馈、学员成长图谱和 AI 辅助咨询入口。",
    url: "/",
    siteName: "Goodminton Academy",
    images: [{ url: "/badminton-hero.png", width: 1776, height: 900 }],
    locale: "zh_CN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
