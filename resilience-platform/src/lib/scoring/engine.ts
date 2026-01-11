import prisma from '@/lib/db';
import type { Prisma } from '@prisma/client';

// Scale maximums
const SCALE_MAX: Record<string, number> = {
  likert_5: 5,
  likert_7: 7,
};

export interface RawResponse {
  questionId: string;
  value: number;
}

export interface QuestionConfig {
  id: string;
  resilienceAreaId: string;
  questionType: string;
  isReverseScored: boolean;
  weight: Prisma.Decimal | number;
}

export interface SubAreaScore {
  subAreaId: string;
  subAreaSlug: string;
  subAreaName: string;
  score: number;
  levelCode: string;
  levelName: string;
  colorHex?: string;
}

export interface AreaScore {
  areaId: string;
  areaSlug: string;
  areaName: string;
  score: number;
  level: {
    name: string;
    code: string;
    color: string;
  };
  feedback: {
    summary: string;
    strengths: string;
    growthAreas: string;
    recommendations: string;
  };
  subAreaScores: SubAreaScore[];
  conditionalFeedback?: string; // HTML from matched feedback rule
}

export interface ScoringResult {
  overallScore: number;
  overallLevel: {
    name: string;
    code: string;
    color: string;
  };
  overallFeedback: {
    summary: string;
    strengths: string;
    recommendations: string;
  };
  areaScores: AreaScore[];
}

/**
 * Calculate scores for a completed assessment
 */
export async function calculateScores(sessionId: string): Promise<ScoringResult> {
  // Get all responses for this session
  const responses = await prisma.response.findMany({
    where: { assessmentSessionId: sessionId },
    include: {
      question: {
        include: {
          resilienceArea: true,
          subAreas: {
            include: {
              subArea: true,
            },
          },
        },
      },
    },
  });

  // Get all active questions grouped by area
  const questions = await prisma.question.findMany({
    where: { isActive: true },
    include: {
      resilienceArea: true,
      subAreas: {
        include: {
          subArea: true,
        },
      },
    },
  });

  // Get score ranges and feedback content
  const scoreRanges = await prisma.scoreRange.findMany({
    include: {
      feedbackContent: {
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      },
      resilienceArea: true,
    },
  });

  // Get sub-area score ranges
  const subAreaScoreRanges = await prisma.subAreaScoreRange.findMany({
    include: {
      subArea: true,
    },
  });

  // Get feedback rules for conditional feedback
  const feedbackRules = await prisma.areaFeedbackRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'asc' },
    include: {
      conditions: {
        include: {
          subArea: true,
        },
      },
    },
  });

  // Get overall feedback content
  const overallFeedback = await prisma.overallFeedbackContent.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  });

  // Build question lookup map
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // Group responses by area
  const responsesByArea = new Map<string, RawResponse[]>();
  for (const response of responses) {
    const question = questionMap.get(response.questionId);
    if (!question) continue;

    const areaId = question.resilienceAreaId;
    if (!responsesByArea.has(areaId)) {
      responsesByArea.set(areaId, []);
    }
    responsesByArea.get(areaId)!.push({
      questionId: response.questionId,
      value: response.responseValue,
    });
  }

  // Calculate score for each area
  const areaScores: AreaScore[] = [];

  for (const [areaId, areaResponses] of responsesByArea) {
    const areaScore = calculateAreaScore(areaResponses, questionMap);
    const area = questions.find((q) => q.resilienceAreaId === areaId)?.resilienceArea;

    if (!area) continue;

    // Find matching score range for the area
    const range = scoreRanges.find(
      (r) =>
        r.resilienceAreaId === areaId &&
        areaScore >= Number(r.minScore) &&
        areaScore < Number(r.maxScore)
    );

    // Fallback to highest range if score is exactly 100
    const effectiveRange =
      range ||
      scoreRanges
        .filter((r) => r.resilienceAreaId === areaId)
        .sort((a, b) => Number(b.maxScore) - Number(a.maxScore))[0];

    // Get feedback content for the area level
    const feedback = getFeedbackForRange(effectiveRange?.feedbackContent || []);

    // Calculate sub-area scores
    const subAreaScores = calculateSubAreaScores(
      areaId,
      areaResponses,
      questionMap,
      subAreaScoreRanges
    );

    // Match conditional feedback rule
    const conditionalFeedback = matchFeedbackRule(
      areaId,
      subAreaScores,
      feedbackRules
    );

    areaScores.push({
      areaId,
      areaSlug: area.slug,
      areaName: area.name,
      score: Math.round(areaScore * 100) / 100,
      level: {
        name: effectiveRange?.levelName || 'Unknown',
        code: effectiveRange?.levelCode || 'unknown',
        color: effectiveRange?.colorHex || '#888888',
      },
      feedback,
      subAreaScores,
      conditionalFeedback,
    });
  }

  // Sort by display order
  const areaOrder = await prisma.resilienceArea.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  });
  const orderMap = new Map(areaOrder.map((a, i) => [a.id, i]));
  areaScores.sort((a, b) => (orderMap.get(a.areaId) || 0) - (orderMap.get(b.areaId) || 0));

  // Calculate overall score (average of area scores)
  const overallScore =
    areaScores.length > 0
      ? areaScores.reduce((sum, a) => sum + a.score, 0) / areaScores.length
      : 0;

  // Find overall level and feedback
  const overallFeedbackGrouped = getOverallFeedback(overallFeedback, overallScore);

  return {
    overallScore: Math.round(overallScore * 100) / 100,
    overallLevel: {
      name: getLevelNameForScore(overallScore),
      code: getLevelCodeForScore(overallScore),
      color: getLevelColorForScore(overallScore),
    },
    overallFeedback: overallFeedbackGrouped,
    areaScores,
  };
}

/**
 * Calculate score for a single area
 */
function calculateAreaScore(
  responses: RawResponse[],
  questionMap: Map<string, QuestionConfig & { questionType: string; resilienceArea: { slug: string; name: string } }>
): number {
  let totalWeightedScore = 0;
  let totalMaxPossible = 0;

  for (const response of responses) {
    const question = questionMap.get(response.questionId);
    if (!question) continue;

    const maxValue = SCALE_MAX[question.questionType] || 5;
    const weight = Number(question.weight);

    // Apply reverse scoring if needed
    let adjustedValue = response.value;
    if (question.isReverseScored) {
      adjustedValue = maxValue + 1 - response.value;
    }

    // Apply weight
    totalWeightedScore += adjustedValue * weight;
    totalMaxPossible += maxValue * weight;
  }

  // Return as percentage
  return totalMaxPossible > 0 ? (totalWeightedScore / totalMaxPossible) * 100 : 0;
}

/**
 * Calculate sub-area scores for an area
 */
function calculateSubAreaScores(
  areaId: string,
  responses: RawResponse[],
  questionMap: Map<
    string,
    QuestionConfig & {
      questionType: string;
      resilienceArea: { slug: string; name: string };
      subAreas: Array<{ subArea: { id: string; slug: string; name: string } }>;
    }
  >,
  subAreaScoreRanges: Array<{
    subAreaId: string;
    minScore: Prisma.Decimal;
    maxScore: Prisma.Decimal;
    levelName: string;
    levelCode: string;
    colorHex: string | null;
  }>
): SubAreaScore[] {
  // Build map of subAreaId -> responses
  const responsesBySubArea = new Map<string, RawResponse[]>();
  const subAreaInfo = new Map<string, { slug: string; name: string }>();

  for (const response of responses) {
    const question = questionMap.get(response.questionId);
    if (!question) continue;

    // Add response to each sub-area the question belongs to
    for (const qa of question.subAreas) {
      const subAreaId = qa.subArea.id;
      if (!responsesBySubArea.has(subAreaId)) {
        responsesBySubArea.set(subAreaId, []);
        subAreaInfo.set(subAreaId, {
          slug: qa.subArea.slug,
          name: qa.subArea.name,
        });
      }
      responsesBySubArea.get(subAreaId)!.push(response);
    }
  }

  // Calculate score for each sub-area
  const subAreaScores: SubAreaScore[] = [];

  for (const [subAreaId, subAreaResponses] of responsesBySubArea) {
    const score = calculateAreaScore(subAreaResponses, questionMap);
    const info = subAreaInfo.get(subAreaId);

    if (!info) continue;

    // Find matching score range
    const ranges = subAreaScoreRanges.filter((r) => r.subAreaId === subAreaId);
    const matchingRange = ranges.find(
      (r) => score >= Number(r.minScore) && score < Number(r.maxScore)
    );

    // Fallback to highest range if score is exactly 100
    const effectiveRange =
      matchingRange ||
      ranges.sort((a, b) => Number(b.maxScore) - Number(a.maxScore))[0];

    subAreaScores.push({
      subAreaId,
      subAreaSlug: info.slug,
      subAreaName: info.name,
      score: Math.round(score * 100) / 100,
      levelCode: effectiveRange?.levelCode || 'unknown',
      levelName: effectiveRange?.levelName || 'Unknown',
      colorHex: effectiveRange?.colorHex || undefined,
    });
  }

  return subAreaScores;
}

/**
 * Match a feedback rule based on sub-area score levels
 */
function matchFeedbackRule(
  areaId: string,
  subAreaScores: SubAreaScore[],
  feedbackRules: Array<{
    id: string;
    resilienceAreaId: string;
    feedbackContent: string;
    priority: number;
    isActive: boolean;
    conditions: Array<{
      subAreaId: string;
      levelCodes: string[];
    }>;
  }>
): string | undefined {
  // Get rules for this area, ordered by priority
  const areaRules = feedbackRules
    .filter((r) => r.resilienceAreaId === areaId && r.isActive)
    .sort((a, b) => a.priority - b.priority);

  // Build lookup of subAreaId -> levelCode
  const levelCodeMap = new Map(subAreaScores.map((s) => [s.subAreaId, s.levelCode]));

  // Find first matching rule
  for (const rule of areaRules) {
    let allConditionsMatch = true;

    for (const condition of rule.conditions) {
      const currentLevel = levelCodeMap.get(condition.subAreaId);

      if (currentLevel === undefined) {
        // Sub-area not in scores - condition doesn't match
        allConditionsMatch = false;
        break;
      }

      // Empty levelCodes = wildcard (any level matches)
      if (condition.levelCodes.length > 0) {
        if (!condition.levelCodes.includes(currentLevel)) {
          allConditionsMatch = false;
          break;
        }
      }
    }

    if (allConditionsMatch) {
      return rule.feedbackContent;
    }
  }

  return undefined;
}

/**
 * Get feedback content for a score range
 */
function getFeedbackForRange(
  content: Array<{ contentType: string; contentBody: string }>
): AreaScore['feedback'] {
  return {
    summary: content.find((c) => c.contentType === 'summary')?.contentBody || '',
    strengths: content.find((c) => c.contentType === 'strengths')?.contentBody || '',
    growthAreas: content.find((c) => c.contentType === 'growth_areas')?.contentBody || '',
    recommendations: content.find((c) => c.contentType === 'recommendations')?.contentBody || '',
  };
}

/**
 * Get overall feedback based on score
 */
function getOverallFeedback(
  content: Array<{
    minOverallScore: Prisma.Decimal;
    maxOverallScore: Prisma.Decimal;
    contentType: string;
    contentBody: string;
  }>,
  score: number
): ScoringResult['overallFeedback'] {
  const matchingContent = content.filter(
    (c) => score >= Number(c.minOverallScore) && score < Number(c.maxOverallScore)
  );

  return {
    summary: matchingContent.find((c) => c.contentType === 'summary')?.contentBody || '',
    strengths: matchingContent.find((c) => c.contentType === 'strengths')?.contentBody || '',
    recommendations:
      matchingContent.find((c) => c.contentType === 'recommendations')?.contentBody || '',
  };
}

/**
 * Get level name for overall score
 */
function getLevelNameForScore(score: number): string {
  if (score >= 80) return 'Exceptional';
  if (score >= 60) return 'Strong';
  if (score >= 40) return 'Emerging';
  return 'Developing';
}

function getLevelCodeForScore(score: number): string {
  if (score >= 80) return 'exceptional';
  if (score >= 60) return 'strong';
  if (score >= 40) return 'emerging';
  return 'developing';
}

function getLevelColorForScore(score: number): string {
  if (score >= 80) return '#2ECC71';
  if (score >= 60) return '#4ECDC4';
  if (score >= 40) return '#FFE66D';
  return '#FF6B6B';
}

/**
 * Store calculated scores in the session
 */
export async function storeScores(sessionId: string, scores: ScoringResult): Promise<void> {
  // Build area scores JSON (includes sub-area scores)
  const areaScoresJson: Record<string, number | { score: number; subAreas?: Record<string, number> }> = {};
  for (const area of scores.areaScores) {
    if (area.subAreaScores.length > 0) {
      const subAreas: Record<string, number> = {};
      for (const subArea of area.subAreaScores) {
        subAreas[subArea.subAreaSlug] = subArea.score;
      }
      areaScoresJson[area.areaSlug] = {
        score: area.score,
        subAreas,
      };
    } else {
      areaScoresJson[area.areaSlug] = area.score;
    }
  }

  await prisma.assessmentSession.update({
    where: { id: sessionId },
    data: {
      isComplete: true,
      completedAt: new Date(),
      overallScore: scores.overallScore,
      areaScores: areaScoresJson,
    },
  });

  // Update assessment code status
  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    select: { assessmentCodeId: true },
  });

  if (session) {
    await prisma.assessmentCode.update({
      where: { id: session.assessmentCodeId },
      data: {
        status: 'completed',
        timesUsed: { increment: 1 },
      },
    });
  }
}

/**
 * Get stored results for a completed session
 */
export async function getStoredResults(sessionId: string): Promise<ScoringResult | null> {
  const session = await prisma.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
      responses: {
        include: {
          question: {
            include: { resilienceArea: true },
          },
        },
      },
    },
  });

  if (!session || !session.isComplete) {
    return null;
  }

  // Recalculate scores to get full feedback (we only store the scores, not feedback)
  return calculateScores(sessionId);
}
