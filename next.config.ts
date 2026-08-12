import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // bbs.goodminton.fi → 论坛。Vercel 面板上的域名重定向是保留路径的
        // （bbs.../x → goodminton.fi/x），所以裸域会落到首页而不是论坛；
        // 要精确落到 /forum 就得在这里按 host 判断。
        //
        // 有意做成跳转而不是重写：重写会让地址栏停在 bbs 子域上，而
        // sessionStorage 按 origin 隔离——学员在主域登录的凭据在子域上读不到，
        // 交流讨论和球友约球会直接发不出帖。跳转落回主域，凭据完好。
        //
        // 307 而非 301：301 会被浏览器永久缓存，将来若要把 bbs 独立部署，
        // 学员本地那条缓存会一直把他们弹回主域，很难清。
        source: "/",
        has: [{ type: "host", value: "bbs.goodminton.fi" }],
        destination: "https://goodminton.fi/forum",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        // 全站基础安全头。此前线上只有 HSTS（Vercel 默认给的），这几条都没有。
        // 有 /coach 教练台和 /student 学员页，点击劫持和 MIME 嗅探是实打实的面。
        // 故意不加 CSP：这站有内联样式和第三方脚本面，CSP 配错会直接白屏，
        // 要单独一轮按 report-only 先跑数据再上。
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        source: "/student",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
          {
            key: "Clear-Site-Data",
            value: '"cache"',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
