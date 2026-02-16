const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mode standalone uniquement pour build production Docker
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,
  experimental: {
    // LOT 1: Fix module resolution - remove parent directory tracing
    outputFileTracingRoot: path.join(__dirname),
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
  // FIX Docker build: skip static generation for data-dependent pages
  skipTrailingSlashRedirect: true,
  // Force all routes to be dynamic (no static generation during build)
  generateBuildId: async () => {
    return 'docker-build-' + Date.now();
  },
};

module.exports = nextConfig;
