/* eslint-disable @typescript-eslint/no-require-imports */
const { withSentryConfig } = require('@sentry/nextjs');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.sentry.io",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://iirfvndgzutbxwfdwawu.supabase.co",
      "connect-src 'self' https://iirfvndgzutbxwfdwawu.supabase.co https://api.stripe.com https://*.sentry.io https://*.ingest.sentry.io",
      "frame-src 'self' https://js.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  eslint: {
    ignoreDuringBuilds: false,
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
