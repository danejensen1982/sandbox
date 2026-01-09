import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';

// JWT secret keys - must be at least 256 bits
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  return new TextEncoder().encode(secret);
};

const getRefreshSecret = () => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not defined');
  return new TextEncoder().encode(secret);
};

// Token expiry times
const ASSESSMENT_SESSION_DURATION = parseInt(process.env.ASSESSMENT_SESSION_DURATION || '14400'); // 4 hours
const ADMIN_SESSION_DURATION = parseInt(process.env.ADMIN_SESSION_DURATION || '900'); // 15 minutes
const REFRESH_TOKEN_DURATION = 60 * 60 * 24 * 7; // 7 days

// =============================================
// ASSESSMENT SESSION TOKENS
// =============================================

export interface AssessmentTokenPayload extends JWTPayload {
  type: 'assessment';
  codeId: string;       // assessment_code_id
  sessionId: string;    // assessment_session_id
  cohortId: string;
}

export async function createAssessmentToken(payload: Omit<AssessmentTokenPayload, 'type'>): Promise<string> {
  const token = await new SignJWT({ ...payload, type: 'assessment' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ASSESSMENT_SESSION_DURATION}s`)
    .sign(getJwtSecret());

  return token;
}

export async function verifyAssessmentToken(token: string): Promise<AssessmentTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.type !== 'assessment') return null;
    return payload as AssessmentTokenPayload;
  } catch {
    return null;
  }
}

// =============================================
// ADMIN SESSION TOKENS
// =============================================

export interface AdminTokenPayload extends JWTPayload {
  type: 'admin';
  adminId: string;
  role: 'platform_owner' | 'org_admin' | 'cohort_viewer';
  organizationId?: string;
}

export async function createAdminToken(payload: Omit<AdminTokenPayload, 'type'>): Promise<string> {
  const token = await new SignJWT({ ...payload, type: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_DURATION}s`)
    .sign(getJwtSecret());

  return token;
}

export async function createAdminRefreshToken(adminId: string): Promise<string> {
  const token = await new SignJWT({ adminId, type: 'admin_refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_DURATION}s`)
    .sign(getRefreshSecret());

  return token;
}

export async function verifyAdminToken(token: string): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.type !== 'admin') return null;
    return payload as AdminTokenPayload;
  } catch {
    return null;
  }
}

export async function verifyAdminRefreshToken(token: string): Promise<{ adminId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getRefreshSecret());
    if (payload.type !== 'admin_refresh') return null;
    return { adminId: payload.adminId as string };
  } catch {
    return null;
  }
}

// =============================================
// MFA PENDING TOKENS (short-lived)
// =============================================

export interface MfaPendingPayload extends JWTPayload {
  type: 'mfa_pending';
  adminId: string;
}

export async function createMfaPendingToken(adminId: string): Promise<string> {
  const token = await new SignJWT({ adminId, type: 'mfa_pending' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m') // 5 minutes to complete MFA
    .sign(getJwtSecret());

  return token;
}

export async function verifyMfaPendingToken(token: string): Promise<{ adminId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.type !== 'mfa_pending') return null;
    return { adminId: payload.adminId as string };
  } catch {
    return null;
  }
}

// =============================================
// COOKIE HELPERS
// =============================================

export async function setAdminCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();

  cookieStore.set('admin_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_SESSION_DURATION,
    path: '/',
  });

  cookieStore.set('admin_refresh', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_DURATION,
    path: '/',
  });
}

export async function clearAdminCookies() {
  const cookieStore = await cookies();
  cookieStore.delete('admin_token');
  cookieStore.delete('admin_refresh');
}

export async function getAdminTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('admin_token')?.value || null;
}

export async function getAdminRefreshTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('admin_refresh')?.value || null;
}
