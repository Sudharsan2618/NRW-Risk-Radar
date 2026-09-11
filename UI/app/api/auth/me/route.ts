import { NextResponse } from 'next/server';

// Mock of the Azure Static Web Apps /.auth/me endpoint for local development.
// In production this is served by Azure itself. The dev user's email must
// exist in the backend users table for /api/me to resolve a profile.
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only available on Azure Static Web Apps' }, { status: 404 });
  }
  return NextResponse.json({
    clientPrincipal: {
      userId: 'dev-user-id',
      userDetails: process.env.NEXT_PUBLIC_HR_USER_EMAIL || 'dev@agamxts.com',
      userRoles: ['anonymous', 'authenticated'],
      identityProvider: 'aad',
    },
  });
}
