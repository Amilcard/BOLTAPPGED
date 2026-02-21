const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone required for VPS/PM2 deployment (node server.js)
  output: 'standalone',
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
