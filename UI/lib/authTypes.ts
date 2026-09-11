// ──────────────────────────────────────────────────────────────────────────
// Shared auth types. Mirrors the backend's DbUser shape (route/protected.py)
// and the frontend-derived User assembled from the JWT / Azure principal.
// ──────────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  username?: string;
  name?: string;
  companyName?: string;
  location?: string;
  role?: string;
  auth_provider?: string;
  identityProvider?: string; // Azure AD uses 'aad' for internal users
}

export interface DbUser {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  designation: string | null;
  location: string | null;
  role: string;
  status: string;
  auth_provider: string;
  created_at: string | null;
  last_login_at: string | null;
}

export interface TokenResponse {
  success?: boolean;
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}
