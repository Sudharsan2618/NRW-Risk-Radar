/** @type {import('next').NextConfig} */

// PostHog ingestion is proxied through our own origin (/ingest/*). A direct
// request to *.i.posthog.com is a well-known tracker URL and gets blocked by
// browser extensions and some corporate networks, which silently loses events;
// a same-origin path does not. NEXT_PUBLIC_POSTHOG_HOST must stay pointed at
// /ingest for this to be used (see lib/analytics.ts).
const POSTHOG_REGION_HOST =
  process.env.POSTHOG_INGEST_HOST || 'https://us.i.posthog.com';
const POSTHOG_ASSET_HOST =
  process.env.POSTHOG_ASSET_HOST || 'https://us-assets.i.posthog.com';

const nextConfig = {
  reactStrictMode: true,
  // Required for the /ingest proxy: PostHog's API is hosted on a different
  // domain, and rewrites to an external host need this enabled.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const rules = [
      // Order matters: the static-asset rule must precede the catch-all.
      { source: '/ingest/static/:path*', destination: `${POSTHOG_ASSET_HOST}/static/:path*` },
      { source: '/ingest/:path*', destination: `${POSTHOG_REGION_HOST}/:path*` },
    ];

    // In development, route /.auth/* to the mock endpoints under /api/auth/*.
    // In production, Azure Static Web Apps serves /.auth/* directly.
    if (process.env.NODE_ENV === 'development') {
      rules.push({ source: '/.auth/:path*', destination: '/api/auth/:path*' });
    }
    return rules;
  },
};

export default nextConfig;
