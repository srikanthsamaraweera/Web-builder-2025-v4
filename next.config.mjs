import path from "node:path";
import { fileURLToPath } from "node:url";
import { URL as NodeURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new NodeURL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig = {
  // Keep default .next for compatibility, while setting tracing root
  outputFileTracingRoot: __dirname,
  images: {
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
};

export default nextConfig;
