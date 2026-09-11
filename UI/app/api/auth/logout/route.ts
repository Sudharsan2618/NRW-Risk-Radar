import { NextResponse } from 'next/server';

// Mock of the Azure Static Web Apps /.auth/logout endpoint for local
// development. In production Azure handles /.auth/logout directly.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirect = url.searchParams.get('post_logout_redirect_uri') || '/login';
  return NextResponse.redirect(new URL(redirect, url.origin));
}
