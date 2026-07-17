import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

// Pin the workspace root to THIS folder. Without this, Next.js sees the
// lockfiles in C:\Users\user\ and guesses the wrong root, which makes the
// dev server 404 the /api/* route handlers.
const projectRoot = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    // Not needed while `unoptimized` is true (next/image renders a plain <img>
    // and skips host validation) — declared now so that dropping `unoptimized`
    // later doesn't silently break every uploaded product photo. Derived from
    // the env var so it follows the project rather than hardcoding a ref.
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: 'https',
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
  },
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
}

export default nextConfig
