import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Goodminton Academy",
    short_name: "Goodminton",
    description:
      "Goodminton Academy 提供芬兰羽毛球训练、学员成长图谱、课后反馈追踪和 AI 辅助问答。",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf6",
    theme_color: "#14bf96",
    lang: "zh-CN",
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      {
        src: "/favicon.ico",
        type: "image/x-icon",
        sizes: "48x48",
      },
    ],
  };
}
