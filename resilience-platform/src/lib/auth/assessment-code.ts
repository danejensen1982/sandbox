import { randomBytes } from 'crypto';
import { hash } from './encryption';
import prisma from '@/lib/db';
import { createAssessmentToken, verifyAssessmentToken, AssessmentTokenPayload } from './jwt';
import type { Prisma } from '@prisma/client';

// Characters that are easy to read and type (no confusing chars like 0/O, 1/I/L)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generate a short, human-readable code: RES-XXXX-XXXX
 */
export function generateShortCode(): string {
  const segment = (length: number) => {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return result;
  };

  return `RES-${segment(4)}-${segment(4)}`;
}

/**
 * Generate a secure token for URL-based access: res_tk_<random>
 */
export function generateToken(): string {
  const randomPart = randomBytes(24).toString('base64url');
  return `res_tk_${randomPart}`;
}

/**
 * Generate assessment codes for a cohort
 */
export async function generateAssessmentCodes(
  cohortId: string,
  count: number,
  options?: {
    expiresAt?: Date;
    metadata?: Prisma.InputJsonValue;
  }
): Promise<Array<{ code: string; token: string; link: string }>> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const results: Array<{ code: string; token: string; link: string }> = [];

  // Generate codes in batch
  const codesToCreate: Prisma.AssessmentCodeCreateManyInput[] = [];
  for (let i = 0; i < count; i++) {
    const code = generateShortCode();
    const token = generateToken();
    const tokenHash = hash(token);

    codesToCreate.push({
      code,
      tokenHash,
      cohortId,
      expiresAt: options?.expiresAt,
      metadata: options?.metadata ?? {},
    });

    results.push({
      code,
      token,
      link: `${baseUrl}/assess/${token}`,
    });
  }

  // Insert all codes in a transaction
  await prisma.$transaction(
    codesToCreate.map((data) =>
      prisma.assessmentCode.create({ data })
    )
  );

  return results;
}

/**
 * Validate an assessment code (short code or token)
 * Returns the assessment code record if valid
 */
export async function validateAssessmentCode(input: string): Promise<{
  valid: boolean;
  code?: Awaited<ReturnType<typeof prisma.assessmentCode.findUnique>> & {
    cohort: Awaited<ReturnType<typeof prisma.cohort.findUnique>>;
  };
  error?: string;
  completedSession?: Awaited<ReturnType<typeof prisma.assessmentSession.findFirst>>;
}> {
  let assessmentCode;

  // Determine if input is a short code or token
  if (input.startsWith('res_tk_')) {
    // Token-based lookup
    const tokenHash = hash(input);
    assessmentCode = await prisma.assessmentCode.findUnique({
      where: { tokenHash },
      include: {
        cohort: {
          include: { organization: true },
        },
        assessmentSessions: {
          orderBy: { attemptNumber: 'desc' },
          take: 1,
        },
      },
    });
  } else {
    // Short code lookup (normalize: uppercase, no spaces)
    const normalizedCode = input.toUpperCase().replace(/\s/g, '');
    assessmentCode = await prisma.assessmentCode.findUnique({
      where: { code: normalizedCode },
      include: {
        cohort: {
          include: { organization: true },
        },
        assessmentSessions: {
          orderBy: { attemptNumber: 'desc' },
          take: 1,
        },
      },
    });
  }

  if (!assessmentCode) {
    return { valid: false, error: 'Invalid assessment code' };
  }

  // Check if code is expired
  if (assessmentCode.expiresAt && assessmentCode.expiresAt < new Date()) {
    return { valid: false, error: 'This assessment code has expired' };
  }

  // Check if cohort is active
  if (!assessmentCode.cohort.isActive) {
    return { valid: false, error: 'This assessment is no longer available' };
  }

  // Check cohort access dates
  const now = new Date();
  if (assessmentCode.cohort.accessStartDate && assessmentCode.cohort.accessStartDate > now) {
    return { valid: false, error: 'This assessment is not yet available' };
  }
  if (assessmentCode.cohort.accessEndDate && assessmentCode.cohort.accessEndDate < now) {
    return { valid: false, error: 'This assessment access period has ended' };
  }

  // Check for completed sessions
  const lastSession = assessmentCode.assessmentSessions[0];
  if (lastSession?.isComplete) {
    // Check if retakes are allowed
    if (!assessmentCode.cohort.allowRetakes) {
      // Return the completed session so user can view results
      return {
        valid: true,
        code: assessmentCode,
        completedSession: lastSession,
      };
    }

    // Check retake limits
    if (
      assessmentCode.cohort.maxRetakes > 0 &&
      assessmentCode.timesUsed >= assessmentCode.cohort.maxRetakes
    ) {
      return {
        valid: true,
        code: assessmentCode,
        completedSession: lastSession,
        error: 'Maximum retake limit reached',
      };
    }

    // Check cooldown period
    if (assessmentCode.cohort.retakeCooldownDays > 0 && lastSession.completedAt) {
      const cooldownEnd = new Date(lastSession.completedAt);
      cooldownEnd.setDate(cooldownEnd.getDate() + assessmentCode.cohort.retakeCooldownDays);
      if (cooldownEnd > now) {
        return {
          valid: true,
          code: assessmentCode,
          completedSession: lastSession,
          error: `You can retake this assessment after ${cooldownEnd.toLocaleDateString()}`,
        };
      }
    }

    // Retakes allowed with no restrictions - still return completedSession for UI choice
    return {
      valid: true,
      code: assessmentCode,
      completedSession: lastSession,
    };
  }

  return { valid: true, code: assessmentCode };
}

/**
 * Start or resume an assessment session
 */
export async function startAssessmentSession(
  assessmentCodeId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<{
  session: Awaited<ReturnType<typeof prisma.assessmentSession.findUnique>>;
  token: string;
  isNew: boolean;
}> {
  // Check for existing incomplete session
  let session = await prisma.assessmentSession.findFirst({
    where: {
      assessmentCodeId,
      isComplete: false,
    },
    orderBy: { attemptNumber: 'desc' },
  });

  let isNew = false;

  if (!session) {
    // Get the latest attempt number
    const lastSession = await prisma.assessmentSession.findFirst({
      where: { assessmentCodeId },
      orderBy: { attemptNumber: 'desc' },
    });

    const attemptNumber = (lastSession?.attemptNumber || 0) + 1;

    // Create new session
    session = await prisma.assessmentSession.create({
      data: {
        assessmentCodeId,
        attemptNumber,
        userAgent,
        ipAddressHash: ipAddress ? hash(ipAddress) : null,
      },
    });

    isNew = true;
  }

  // Update assessment code access timestamps
  const updateData: Record<string, unknown> = {
    lastAccessedAt: new Date(),
    status: 'started',
  };

  // Only set firstAccessedAt if not already set
  const code = await prisma.assessmentCode.findUnique({
    where: { id: assessmentCodeId },
  });

  if (!code?.firstAccessedAt) {
    updateData.firstAccessedAt = new Date();
  }

  await prisma.assessmentCode.update({
    where: { id: assessmentCodeId },
    data: updateData,
  });

  // Get cohort for token
  const assessmentCode = await prisma.assessmentCode.findUnique({
    where: { id: assessmentCodeId },
    select: { cohortId: true },
  });

  // Create JWT token
  const token = await createAssessmentToken({
    codeId: assessmentCodeId,
    sessionId: session.id,
    cohortId: assessmentCode!.cohortId,
  });

  return { session, token, isNew };
}

/**
 * Get the current session from a token
 */
export async function getSessionFromToken(token: string): Promise<{
  valid: boolean;
  payload?: AssessmentTokenPayload;
  session?: Awaited<ReturnType<typeof prisma.assessmentSession.findUnique>>;
}> {
  const payload = await verifyAssessmentToken(token);
  if (!payload) {
    return { valid: false };
  }

  const session = await prisma.assessmentSession.findUnique({
    where: { id: payload.sessionId },
    include: {
      assessmentCode: {
        include: {
          cohort: true,
        },
      },
      responses: true,
    },
  });

  if (!session) {
    return { valid: false };
  }

  return { valid: true, payload, session };
}
