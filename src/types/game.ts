export type AccentOption = "British" | "American";

export interface WordItem {
  id: string;
  word: string;
  ipa: string;
}

export interface GameConfig {
  id: string;
  title: string;
  accent: AccentOption;
  correctPoints: number;
  incorrectPoints: number;
  maxAttempts: number;
  passingThreshold: number;
  words: WordItem[];
}

export interface PronunciationEvaluation {
  target_word: string;
  recognized_word: string;
  pronunciation_score: number;
  is_correct: boolean;
  confidence: number;
  phoneme_feedback: string;
  stress_feedback: string;
  main_mistake: string;
  suggestion: string;
  audio_quality_ok: boolean;
  student_feedback: string;
  teacher_notes: string;
}

export interface AttemptRecord {
  attemptId: string;
  attemptNumber: number;
  audioUrl: string;
  evaluation: PronunciationEvaluation;
  pointsApplied: number;
  outcome: "correct" | "incorrect" | "retry_available" | "unclear";
  timestamp: string;
}

export interface WordGameResult {
  wordIndex: number;
  targetWord: string;
  ipa: string;
  attempts: AttemptRecord[];
  bestScore: number;
  finalScore: number;
  finalResult: "Correct" | "Incorrect";
  pointsEarned: number;
  mainMistake: string;
  teacherNotes: string;
  studentFeedback: string;
}

export interface CompletedGameSession {
  sessionId: string;
  gameTitle: string;
  studentName: string;
  accent: AccentOption;
  completedAt: string;
  totalScore: number;
  correctCount: number;
  incorrectCount: number;
  averagePronunciationScore: number;
  accuracyPercentage: number;
  passingThreshold: number;
  correctPoints: number;
  incorrectPoints: number;
  wordResults: WordGameResult[];
}

export type AppScreen = "teacher" | "game" | "results";
export type TeacherSection = "setup" | "history" | "mistakes";
