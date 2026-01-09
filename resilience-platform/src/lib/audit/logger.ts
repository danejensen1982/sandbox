import prisma from '@/lib/db';
import { headers } from 'next/headers';

export type EventCategory = 'authentication' | 'data_access' | 'configuration' | 'export';
export type ActorType = 'admin' | 'system' | 'assessment_taker';

export interface AuditEventInput {
  eventType: string;
  eventCategory: EventCategory;
  actorType: ActorType;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  eventDescription: string;
  eventData?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Log an audit event for SOC 2 compliance
 * NEVER include PII or sensitive data in eventData
 */
export async function logAuditEvent(event: AuditEventInput): Promise<void> {
  // Get request context if available
  let ipAddress: string | null = null;
  let userAgent: string | null = null;

  try {
    const headersList = await headers();
    ipAddress = headersList.get('x-forwarded-for')?.split(',')[0] || headersList.get('x-real-ip');
    userAgent = headersList.get('user-agent');
  } catch {
    // Headers not available (e.g., in non-request context)
  }

  await prisma.auditLog.create({
    data: {
      eventType: event.eventType,
      eventCategory: event.eventCategory,
      actorType: event.actorType,
      actorId: event.actorId,
      actorIpAddress: ipAddress,
      actorUserAgent: userAgent,
      targetType: event.targetType,
      targetId: event.targetId,
      eventDescription: event.eventDescription,
      eventData: event.eventData,
      success: event.success ?? true,
      errorMessage: event.errorMessage,
    },
  });
}

// =============================================
// Pre-defined audit event helpers
// =============================================

export const AuditEvents = {
  // Authentication events
  adminLogin: (adminId: string, email: string, success: boolean, errorMessage?: string) =>
    logAuditEvent({
      eventType: 'admin_login',
      eventCategory: 'authentication',
      actorType: 'admin',
      actorId: adminId,
      eventDescription: success ? `Admin logged in: ${email}` : `Failed login attempt: ${email}`,
      eventData: { email },
      success,
      errorMessage,
    }),

  adminLogout: (adminId: string, email: string) =>
    logAuditEvent({
      eventType: 'admin_logout',
      eventCategory: 'authentication',
      actorType: 'admin',
      actorId: adminId,
      eventDescription: `Admin logged out: ${email}`,
      eventData: { email },
    }),

  adminMfaVerified: (adminId: string, email: string) =>
    logAuditEvent({
      eventType: 'admin_mfa_verified',
      eventCategory: 'authentication',
      actorType: 'admin',
      actorId: adminId,
      eventDescription: `MFA verified for: ${email}`,
      eventData: { email },
    }),

  // Assessment events
  assessmentStarted: (codeId: string, sessionId: string, cohortId: string) =>
    logAuditEvent({
      eventType: 'assessment_started',
      eventCategory: 'data_access',
      actorType: 'assessment_taker',
      actorId: codeId,
      targetType: 'assessment_session',
      targetId: sessionId,
      eventDescription: 'Assessment started',
      eventData: { cohortId },
    }),

  assessmentCompleted: (codeId: string, sessionId: string, cohortId: string) =>
    logAuditEvent({
      eventType: 'assessment_completed',
      eventCategory: 'data_access',
      actorType: 'assessment_taker',
      actorId: codeId,
      targetType: 'assessment_session',
      targetId: sessionId,
      eventDescription: 'Assessment completed',
      eventData: { cohortId },
    }),

  resultsViewed: (codeId: string, sessionId: string) =>
    logAuditEvent({
      eventType: 'results_viewed',
      eventCategory: 'data_access',
      actorType: 'assessment_taker',
      actorId: codeId,
      targetType: 'assessment_session',
      targetId: sessionId,
      eventDescription: 'Results viewed',
    }),

  resultsPdfDownloaded: (codeId: string, sessionId: string) =>
    logAuditEvent({
      eventType: 'results_pdf_downloaded',
      eventCategory: 'export',
      actorType: 'assessment_taker',
      actorId: codeId,
      targetType: 'assessment_session',
      targetId: sessionId,
      eventDescription: 'Results PDF downloaded',
    }),

  // Admin configuration events
  cohortCreated: (adminId: string, cohortId: string, cohortName: string) =>
    logAuditEvent({
      eventType: 'cohort_created',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: adminId,
      targetType: 'cohort',
      targetId: cohortId,
      eventDescription: `Cohort created: ${cohortName}`,
      eventData: { cohortName },
    }),

  cohortUpdated: (adminId: string, cohortId: string, cohortName: string, changes: string[]) =>
    logAuditEvent({
      eventType: 'cohort_updated',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: adminId,
      targetType: 'cohort',
      targetId: cohortId,
      eventDescription: `Cohort updated: ${cohortName}`,
      eventData: { cohortName, fieldsChanged: changes },
    }),

  codesGenerated: (adminId: string, cohortId: string, count: number) =>
    logAuditEvent({
      eventType: 'codes_generated',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: adminId,
      targetType: 'cohort',
      targetId: cohortId,
      eventDescription: `Generated ${count} assessment codes`,
      eventData: { count },
    }),

  retakeAllowed: (adminId: string, codeId: string, reason?: string) =>
    logAuditEvent({
      eventType: 'retake_allowed',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: adminId,
      targetType: 'assessment_code',
      targetId: codeId,
      eventDescription: 'Retake allowed for assessment code',
      eventData: { reason },
    }),

  analyticsViewed: (adminId: string, cohortId: string, metricsRequested: string[]) =>
    logAuditEvent({
      eventType: 'analytics_viewed',
      eventCategory: 'data_access',
      actorType: 'admin',
      actorId: adminId,
      targetType: 'cohort',
      targetId: cohortId,
      eventDescription: 'Viewed aggregate analytics',
      eventData: { metricsRequested },
    }),

  analyticsExported: (adminId: string, cohortId: string, format: string) =>
    logAuditEvent({
      eventType: 'analytics_exported',
      eventCategory: 'export',
      actorType: 'admin',
      actorId: adminId,
      targetType: 'cohort',
      targetId: cohortId,
      eventDescription: `Analytics exported as ${format}`,
      eventData: { format },
    }),

  // Platform owner events
  questionCreated: (adminId: string, questionId: string, areaName: string) =>
    logAuditEvent({
      eventType: 'question_created',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: adminId,
      targetType: 'question',
      targetId: questionId,
      eventDescription: `Question created in ${areaName}`,
      eventData: { areaName },
    }),

  questionUpdated: (adminId: string, questionId: string, changes: string[]) =>
    logAuditEvent({
      eventType: 'question_updated',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: adminId,
      targetType: 'question',
      targetId: questionId,
      eventDescription: 'Question updated',
      eventData: { fieldsChanged: changes },
    }),

  feedbackContentUpdated: (adminId: string, contentId: string, areaName: string) =>
    logAuditEvent({
      eventType: 'feedback_content_updated',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: adminId,
      targetType: 'feedback_content',
      targetId: contentId,
      eventDescription: `Feedback content updated for ${areaName}`,
      eventData: { areaName },
    }),

  organizationCreated: (adminId: string, orgId: string, orgName: string) =>
    logAuditEvent({
      eventType: 'organization_created',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: adminId,
      targetType: 'organization',
      targetId: orgId,
      eventDescription: `Organization created: ${orgName}`,
      eventData: { orgName },
    }),

  adminUserCreated: (creatorAdminId: string, newAdminId: string, email: string, role: string) =>
    logAuditEvent({
      eventType: 'admin_user_created',
      eventCategory: 'configuration',
      actorType: 'admin',
      actorId: creatorAdminId,
      targetType: 'admin_user',
      targetId: newAdminId,
      eventDescription: `Admin user created: ${email} (${role})`,
      eventData: { email, role },
    }),
};
