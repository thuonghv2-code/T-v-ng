import { buildWordItemsFromPreset, CURRICULUM_PRESETS } from "../data/presets";
import { CompletedGameSession, GameConfig } from "../types/game";

const CONFIG_STORAGE_KEY = "pronunciation_challenge_config_v1";
const HISTORY_STORAGE_KEY = "pronunciation_challenge_history_v1";

export function getDefaultGameConfig(): GameConfig {
  const defaultPreset = CURRICULUM_PRESETS[0];
  return {
    id: "default-game",
    title: defaultPreset.title,
    accent: "American",
    correctPoints: 10,
    incorrectPoints: 5,
    maxAttempts: 2,
    passingThreshold: 80,
    words: buildWordItemsFromPreset(defaultPreset, "American"),
  };
}

export function loadSavedGameConfig(): GameConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return getDefaultGameConfig();
    const parsed = JSON.parse(raw) as Partial<GameConfig>;
    if (!parsed || !Array.isArray(parsed.words) || parsed.words.length !== 10) {
      return getDefaultGameConfig();
    }
    return {
      id: typeof parsed.id === "string" ? parsed.id : "custom-game",
      title: typeof parsed.title === "string" ? parsed.title : "Pronunciation Challenge",
      accent: parsed.accent === "British" ? "British" : "American",
      correctPoints:
        typeof parsed.correctPoints === "number" && parsed.correctPoints >= 1
          ? Math.round(parsed.correctPoints)
          : 10,
      incorrectPoints:
        typeof parsed.incorrectPoints === "number" && parsed.incorrectPoints >= 0
          ? Math.round(parsed.incorrectPoints)
          : 5,
      maxAttempts:
        typeof parsed.maxAttempts === "number" && parsed.maxAttempts >= 1
          ? Math.min(5, Math.round(parsed.maxAttempts))
          : 2,
      passingThreshold:
        typeof parsed.passingThreshold === "number" && parsed.passingThreshold >= 40
          ? Math.min(100, Math.round(parsed.passingThreshold))
          : 80,
      words: parsed.words.slice(0, 10).map((w, idx) => ({
        id: typeof w.id === "string" ? w.id : `word-${idx + 1}`,
        word: typeof w.word === "string" ? w.word : "",
        ipa: typeof w.ipa === "string" ? w.ipa : "",
      })),
    };
  } catch {
    return getDefaultGameConfig();
  }
}

export function saveGameConfig(config: GameConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadGameHistory(): CompletedGameSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as CompletedGameSession[];
  } catch {
    return [];
  }
}

export function saveCompletedSession(session: CompletedGameSession): CompletedGameSession[] {
  // Strip transient blob URLs before persisting to localStorage
  const serializable: CompletedGameSession = {
    ...session,
    wordResults: session.wordResults.map((wr) => ({
      ...wr,
      attempts: wr.attempts.map((att) => ({
        ...att,
        audioUrl: "",
      })),
    })),
  };

  const existing = loadGameHistory();
  const updated = [serializable, ...existing].slice(0, 50);
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}

export function clearGameHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? "");
  // Prevent CSV formula injection when opened in Excel / Google Sheets
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function exportSessionsToCsv(sessions: CompletedGameSession[]): void {
  const headers = [
    "Date",
    "Game Title",
    "Student Name",
    "Accent",
    "Total Score",
    "Correct Words",
    "Incorrect Words",
    "Average Pronunciation Score",
    "Accuracy (%)",
    "Word",
    "IPA",
    "Word Score",
    "Word Result",
    "Main Mistake",
    "Teacher Notes",
  ];

  const rows: string[] = [headers.map(escapeCsvCell).join(",")];

  for (const session of sessions) {
    const dateStr = new Date(session.completedAt).toLocaleString();
    for (const wr of session.wordResults) {
      rows.push(
        [
          dateStr,
          session.gameTitle,
          session.studentName || "Anonymous Student",
          session.accent,
          session.totalScore,
          session.correctCount,
          session.incorrectCount,
          session.averagePronunciationScore,
          session.accuracyPercentage,
          wr.targetWord,
          wr.ipa,
          wr.bestScore,
          wr.finalResult,
          wr.mainMistake,
          wr.teacherNotes,
        ]
          .map(escapeCsvCell)
          .join(",")
      );
    }
  }

  const csvContent = "\uFEFF" + rows.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pronunciation-challenge-results-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
