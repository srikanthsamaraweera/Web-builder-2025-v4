import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid conflicts with a locked .next folder on Windows
  distDir: ".next-local",
  // Silence the workspace root warning and constrain file tracing
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
