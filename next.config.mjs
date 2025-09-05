import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep default .next for compatibility, while setting tracing root
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
