import type { MetadataRoute } from "next";

const siteUrl = "https://goodminton.fi";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /forum renders student submissions. They are anonymized — no name, no
      // studentId, only a level tier — but in a community this small a tier
      // plus a specific stuck point is often enough for a classmate to place
      // someone. Students wrote these expecting other students to read them,
      // not a search engine, so the page stays out of the index until that is
      // an explicit product decision.
      disallow: ["/student", "/forum", "/coach", "/api/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
