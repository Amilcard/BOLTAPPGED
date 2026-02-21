const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' retiré — spécifique VPS/PM2, incompatible avec Vercel
  experimental: {
    outputFileTracingRoot: path.join(__dirname),
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // TS strict activé — requis pour build Vercel zero-error
    ignoreBuildErrors: false,
  },
  images: { unoptimized: true },
  skipTrailingSlashRedirect: true,
  // generateBuildId retiré — spécifique Docker, inutile sur Vercel
};

module.exports = nextConfig;
