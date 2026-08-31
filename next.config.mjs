import path from "node:path";
import { fileURLToPath } from "node:url";
import { URL as NodeURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new NodeURL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;
const supabaseOrigin = supabaseHost ? `https://${supabaseHost}` : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin} https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseHost ? `wss://${supabaseHost}` : ""} https://challenges.cloudflare.com https://api.bigdatacloud.net https://*.googlesyndication.com https://*.doubleclick.net`.replace(/\s+/g, " ").trim(),
  "frame-src https://challenges.cloudflare.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const nextConfig = {
  // Keep default .next for compatibility, while setting tracing root
  outputFileTracingRoot: __dirname,
  images: {
    // Disable on-the-fly image optimization on Netlify free to avoid functions usage
    // Images will be served directly from the origin (Supabase) via the browser
    unoptimized: true,
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/site-assets/**",
          },
        ]
      : [],
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value:
          "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      {
        key: "Content-Security-Policy-Report-Only",
        value: contentSecurityPolicy,
      },
    ];

    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
