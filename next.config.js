const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: path.join(__dirname),
    outputFileTracingExcludes: {
      '*': ['supabase/**/*'],
    },
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
