import {
  AttemptRecord,
  CompletedGameSession,
  GameConfig,
  PronunciationEvaluation,
  WordGameResult,
} from "../types/game";

export interface AttemptEvaluationDecision {
  outcome: "correct" | "incorrect" | "retry_available" | "unclear";
  pointsDelta: number;
  wordFinalized: boolean;
}

const MIN_CONFIDENCE_FOR_SCORING = 0.55;

/**
 * Evaluates a single attempt against game rules and prevents duplicate scoring.
 * - Unclear audio or low AI confidence -> 0 points, does not finalize the word.
 * - Score >= threshold (and confident) -> +correctPoints, finalizes word as Correct.
 * - Incorrect & attempts remain -> 0 points yet, lets student retry (or finalize on skip).
 * - Incorrect & no attempts remain -> -incorrectPoints, finalizes word as Incorrect.
 */
export function decideAttemptOutcome(
  evaluation: PronunciationEvaluation,
  attemptNumber: number,
  config: GameConfig
): AttemptEvaluationDecision {
  if (!evaluation.audio_quality_ok || evaluation.confidence < MIN_CONFIDENCE_FOR_SCORING) {
    return {
      outcome: "unclear",
      pointsDelta: 0,
      wordFinalized: false,
    };
  }

  const passed =
    evaluation.is_correct && evaluation.pronunciation_score >= config.passingThreshold;

  if (passed) {
    return {
      outcome: "correct",
      pointsDelta: config.correctPoints,
      wordFinalized: true,
    };
  }

  if (attemptNumber < config.maxAttempts) {
    return {
      outcome: "retry_available",
      pointsDelta: 0,
      wordFinalized: false,
    };
  }

  return {
    outcome: "incorrect",
    pointsDelta: -Math.abs(config.incorrectPoints),
    wordFinalized: true,
  };
}

export function buildWordResult(
  wordIndex: number,
  targetWord: string,
  ipa: string,
  attempts: AttemptRecord[],
  finalResult: "Correct" | "Incorrect",
  pointsEarned: number
): WordGameResult {
  const scoredAttempts = attempts.filter((a) => a.outcome !== "unclear");
  const latestAttempt = scoredAttempts[scoredAttempts.length - 1] ?? attempts[attempts.length - 1];
  const bestScore = scoredAttempts.reduce(
    (max, item) => Math.max(max, item.evaluation.pronunciation_score),
    0
  );
  const finalScore = latestAttempt ? latestAttempt.evaluation.pronunciation_score : 0;

  return {
    wordIndex,
    targetWord,
    ipa,
    attempts,
    bestScore,
    finalScore,
    finalResult,
    pointsEarned,
    mainMistake: latestAttempt?.evaluation.main_mistake ?? "",
    teacherNotes: latestAttempt?.evaluation.teacher_notes ?? "",
    studentFeedback: latestAttempt?.evaluation.student_feedback ?? "",
  };
}

export function buildCompletedSession(
  config: GameConfig,
  studentName: string,
  wordResults: WordGameResult[],
  totalScore: number
): CompletedGameSession {
  const correctCount = wordResults.filter((r) => r.finalResult === "Correct").length;
  const incorrectCount = wordResults.length - correctCount;
  const avgScore =
    wordResults.length > 0
      ? Math.round(
          wordResults.reduce((sum, r) => sum + r.bestScore, 0) / wordResults.length
        )
      : 0;
  const accuracyPercentage =
    wordResults.length > 0 ? Math.round((correctCount / wordResults.length) * 100) : 0;

  return {
    sessionId: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    gameTitle: config.title.trim() || "Classroom Pronunciation Challenge",
    studentName: studentName.trim(),
    accent: config.accent,
    completedAt: new Date().toISOString(),
    totalScore,
    correctCount,
    incorrectCount,
    averagePronunciationScore: avgScore,
    accuracyPercentage,
    passingThreshold: config.passingThreshold,
    correctPoints: config.correctPoints,
    incorrectPoints: config.incorrectPoints,
    wordResults,
  };
}
