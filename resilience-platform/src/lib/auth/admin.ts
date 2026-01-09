import prisma from '@/lib/db';
import { verifyPassword } from './password';
import {
  createAdminToken,
  createAdminRefreshToken,
  verifyAdminToken,
  verifyAdminRefreshToken,
  createMfaPendingToken,
  verifyMfaPendingToken,
  setAdminCookies,
  clearAdminCookies,
  getAdminTokenFromCookie,
  getAdminRefreshTokenFromCookie,
  AdminTokenPayload,
} from './jwt';
import { AuditEvents } from '@/lib/audit/logger';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

export interface LoginResult {
  success: boolean;
  requiresMfa?: boolean;
  pendingToken?: string;
  error?: string;
}

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'platform_owner' | 'org_admin' | 'cohort_viewer';
  organizationId: string | null;
}

/**
 * Attempt to log in an admin user
 */
export async function loginAdmin(email: string, password: string): Promise<LoginResult> {
  // Find admin user
  const admin = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!admin) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Check if account is locked
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    const remainingMinutes = Math.ceil(
      (admin.lockedUntil.getTime() - Date.now()) / (1000 * 60)
    );
    return {
      success: false,
      error: `Account is locked. Please try again in ${remainingMinutes} minutes.`,
    };
  }

  // Check if account is active
  if (!admin.isActive) {
    return { success: false, error: 'Account is deactivated. Please contact support.' };
  }

  // Verify password
  const passwordValid = await verifyPassword(password, admin.passwordHash);

  if (!passwordValid) {
    // Increment failed attempts
    const failedAttempts = admin.failedLoginAttempts + 1;
    const updateData: { failedLoginAttempts: number; lockedUntil?: Date } = {
      failedLoginAttempts: failedAttempts,
    };

    // Lock account if max attempts exceeded
    if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    }

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: updateData,
    });

    await AuditEvents.adminLogin(admin.id, admin.email, false, 'Invalid password');

    return { success: false, error: 'Invalid email or password' };
  }

  // Reset failed attempts on successful password
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  // Check if MFA is required
  if (admin.mfaEnabled) {
    const pendingToken = await createMfaPendingToken(admin.id);
    return {
      success: true,
      requiresMfa: true,
      pendingToken,
    };
  }

  // Create session
  await createAdminSession(admin);
  await AuditEvents.adminLogin(admin.id, admin.email, true);

  return { success: true };
}

/**
 * Create admin session and set cookies
 */
async function createAdminSession(admin: {
  id: string;
  email: string;
  role: string;
  organizationId: string | null;
}) {
  // Create tokens
  const accessToken = await createAdminToken({
    adminId: admin.id,
    role: admin.role as AdminTokenPayload['role'],
    organizationId: admin.organizationId || undefined,
  });

  const refreshToken = await createAdminRefreshToken(admin.id);

  // Update last login
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  // Set cookies
  await setAdminCookies(accessToken, refreshToken);
}

/**
 * Verify MFA code and complete login
 */
export async function verifyMfa(pendingToken: string, code: string): Promise<LoginResult> {
  // Verify pending token
  const pending = await verifyMfaPendingToken(pendingToken);
  if (!pending) {
    return { success: false, error: 'Invalid or expired MFA session' };
  }

  // Get admin
  const admin = await prisma.adminUser.findUnique({
    where: { id: pending.adminId },
  });

  if (!admin || !admin.mfaSecretEncrypted) {
    return { success: false, error: 'MFA not configured' };
  }

  // TODO: Implement TOTP verification
  // For now, this is a placeholder - you would use a library like 'otpauth'
  // to verify the TOTP code against the decrypted secret

  // Create session
  await createAdminSession(admin);
  await AuditEvents.adminMfaVerified(admin.id, admin.email);

  return { success: true };
}

/**
 * Get current authenticated admin from cookies
 */
export async function getAuthenticatedAdmin(): Promise<AuthenticatedAdmin | null> {
  const token = await getAdminTokenFromCookie();

  if (!token) {
    // Try to refresh
    const refreshToken = await getAdminRefreshTokenFromCookie();
    if (!refreshToken) return null;

    const refreshPayload = await verifyAdminRefreshToken(refreshToken);
    if (!refreshPayload) return null;

    // Get admin and create new access token
    const admin = await prisma.adminUser.findUnique({
      where: { id: refreshPayload.adminId },
    });

    if (!admin || !admin.isActive) return null;

    // Create new session
    await createAdminSession(admin);

    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role as AuthenticatedAdmin['role'],
      organizationId: admin.organizationId,
    };
  }

  const payload = await verifyAdminToken(token);
  if (!payload) {
    // Token expired, try refresh
    return getAuthenticatedAdmin();
  }

  // Get admin details
  const admin = await prisma.adminUser.findUnique({
    where: { id: payload.adminId },
  });

  if (!admin || !admin.isActive) return null;

  return {
    id: admin.id,
    email: admin.email,
    firstName: admin.firstName,
    lastName: admin.lastName,
    role: admin.role as AuthenticatedAdmin['role'],
    organizationId: admin.organizationId,
  };
}

/**
 * Log out admin
 */
export async function logoutAdmin(): Promise<void> {
  const admin = await getAuthenticatedAdmin();
  if (admin) {
    await AuditEvents.adminLogout(admin.id, admin.email);
  }
  await clearAdminCookies();
}

/**
 * Check if admin has required role
 */
export function hasRole(
  admin: AuthenticatedAdmin,
  requiredRoles: AuthenticatedAdmin['role'][]
): boolean {
  return requiredRoles.includes(admin.role);
}

/**
 * Check if admin has access to organization
 */
export function hasOrgAccess(admin: AuthenticatedAdmin, organizationId: string): boolean {
  if (admin.role === 'platform_owner') return true;
  return admin.organizationId === organizationId;
}
