import { NextResponse } from 'next/server';

// Mock Azure AD login for local development. In production, Azure Static Web
// Apps serves /.auth/login/aad directly; the dev rewrite in next.config.mjs
// maps /.auth/* here so the flow is testable locally.
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available on Azure Static Web Apps' }, { status: 404 });
  }
  const url = new URL(request.url);
  // Azure redirects to post_login_redirect_uri after auth. That value is our
  // /auth/callback page, which then processes /.auth/me and routes onward.
  const dest =
    url.searchParams.get('post_login_redirect_uri') ||
    url.searchParams.get('post_login_redirect_url') ||
    '/auth/callback';
  return NextResponse.redirect(new URL(dest, url.origin));
}
