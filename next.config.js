/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const { withSentryConfig } = require('@sentry/nextjs');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // CSP retiré temporairement — à réintégrer après audit complet des dépendances externes
];

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
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'iirfvndgzutbxwfdwawu.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  skipTrailingSlashRedirect: true,
  // generateBuildId retiré — spécifique Docker, inutile sur Vercel
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  // Source maps uploadés silencieusement au build (nécessite SENTRY_AUTH_TOKEN)
  silent: true,
  // Désactiver si SENTRY_AUTH_TOKEN absent (ex: dev local)
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
});
