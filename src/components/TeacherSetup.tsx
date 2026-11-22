import { useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardPaste,
  Download,
  History,
  Play,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { buildWordItemsFromPreset, CURRICULUM_PRESETS } from "../data/presets";
import { lookupIpaForWords } from "../services/pronunciationApi";
import {
  AccentOption,
  CompletedGameSession,
  GameConfig,
  TeacherSection,
  WordItem,
} from "../types/game";

interface TeacherSetupProps {
  config: GameConfig;
  history: CompletedGameSession[];
  activeSection: TeacherSection;
  onChangeSection: (section: TeacherSection) => void;
  onUpdateConfig: (next: GameConfig) => void;
  onStartGame: () => void;
  onExportCsv: () => void;
  onClearHistory: () => void;
}

export function TeacherSetup({
  config,
  history,
  activeSection,
  onChangeSection,
  onUpdateConfig,
  onStartGame,
  onExportCsv,
  onClearHistory,
}: TeacherSetupProps) {
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [ipaLoading, setIpaLoading] = useState(false);
  const [ipaMessage, setIpaMessage] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    history[0]?.sessionId ?? null
  );

  const filledWordCount = config.words.filter((w) => w.word.trim().length > 0).length;
  const allTenReady = filledWordCount === 10;

  const handleWordChange = (index: number, field: "word" | "ipa", value: string) => {
    const nextWords = config.words.map((item, idx) =>
      idx === index ? { ...item, [field]: value } : item
    );
    onUpdateConfig({ ...config, words: nextWords });
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = CURRICULUM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onUpdateConfig({
      ...config,
      title: preset.title,
      words: buildWordItemsFromPreset(preset, config.accent),
    });
    setIpaMessage("");
  };

  const handleAccentChange = (accent: AccentOption) => {
    // If current words match a preset, also switch their IPA between British/American
    const matchedPreset = CURRICULUM_PRESETS.find(
      (p) =>
        p.words.length === config.words.length &&
        p.words.every(
          (pw, i) => pw.word.toLowerCase() === config.words[i]?.word.trim().toLowerCase()
        )
    );
    if (matchedPreset) {
      onUpdateConfig({
        ...config,
        accent,
        words: buildWordItemsFromPreset(matchedPreset, accent),
      });
    } else {
      onUpdateConfig({ ...config, accent });
    }
  };

  const handleParsePastedList = () => {
    setPasteError("");
    const rawLines = pasteText
      .split(/\r?\n|,/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (rawLines.length === 0) {
      setPasteError("Paste up to 10 English words (one per line or separated by commas).");
      return;
    }

    const parsedWords: WordItem[] = [];
    for (let i = 0; i < 10; i++) {
      const raw = rawLines[i] || "";
      if (!raw) {
        parsedWords.push({
          id: `word-${i + 1}`,
          word: "",
          ipa: "",
        });
        continue;
      }

      // Support formats like: "environment /ɪnˈvaɪ.rən.mənt/" or "environment - /ɪnˈvaɪ.rən.mənt/"
      const ipaMatch = raw.match(/^(.*?)\s*(?:[-–—|:]\s*)?(\/[^/]+\/)$/);
      if (ipaMatch) {
        parsedWords.push({
          id: `word-${i + 1}-${ipaMatch[1].trim()}`,
          word: ipaMatch[1].trim(),
          ipa: ipaMatch[2].trim(),
        });
      } else {
        parsedWords.push({
          id: `word-${i + 1}-${raw}`,
          word: raw,
          ipa: "",
        });
      }
    }

    onUpdateConfig({ ...config, words: parsedWords });
    setShowPasteBox(false);
    setPasteText("");
  };

  const handleAutoFillIpa = async () => {
    const wordsToLookup = config.words.map((w) => w.word.trim()).filter(Boolean);
    if (wordsToLookup.length === 0) {
      setIpaMessage("Enter at least one English word before generating IPA.");
      return;
    }
    setIpaLoading(true);
    setIpaMessage("");
    try {
      const results = await lookupIpaForWords(wordsToLookup, config.accent);
      const mapByWord = new Map(results.map((r) => [r.word.toLowerCase(), r.ipa]));
      const nextWords = config.words.map((item) => {
        const key = item.word.trim().toLowerCase();
        const foundIpa = mapByWord.get(key);
        return foundIpa ? { ...item, ipa: foundIpa } : item;
      });
      onUpdateConfig({ ...config, words: nextWords });
      setIpaMessage(`Updated ${config.accent} IPA transcriptions.`);
    } catch (err) {
      setIpaMessage(err instanceof Error ? err.message : "Could not look up IPA.");
    } finally {
      setIpaLoading(false);
    }
  };

  // Collect mistakes across all completed sessions
  const mistakeRecords = history.flatMap((session) =>
    session.wordResults
      .filter((wr) => wr.finalResult === "Incorrect" || wr.bestScore < session.passingThreshold)
      .map((wr) => ({
        sessionId: session.sessionId,
        completedAt: session.completedAt,
        gameTitle: session.gameTitle,
        studentName: session.studentName || "Anonymous Student",
        accent: session.accent,
        ...wr,
      }))
  );

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Intro Hero & Mobile Section Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-sm font-semibold text-indigo-600 mb-1">
            Classroom Pronunciation Studio
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance">
            Speak Clearly. Score Higher. Have Fun!
          </h1>
          <p className="text-slate-600 mt-2 max-w-2xl">
            Prepare 10 English words for your class, choose British or American standards, and let students compete with real-time AI audio feedback.
          </p>
        </div>

        {/* Workspace Section Switcher */}
        <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-xl self-start shrink-0">
          <button
            type="button"
            onClick={() => onChangeSection("setup")}
            className={`whitespace-nowrap shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeSection === "setup"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            10-Word Setup
          </button>
          <button
            type="button"
            onClick={() => onChangeSection("history")}
            className={`whitespace-nowrap shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeSection === "history"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Results ({history.length})
          </button>
          <button
            type="button"
            onClick={() => onChangeSection("mistakes")}
            className={`whitespace-nowrap shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeSection === "mistakes"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Mistakes ({mistakeRecords.length})
          </button>
        </div>
      </div>

      {activeSection === "setup" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: 10-Word Curriculum Editor */}
          <section className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Target Word List (10 Words)
                </h2>
                <p className="text-sm text-slate-500 mt-0.5 tabular-nums">
                  {filledWordCount}/10 words configured · IPA transcription is optional
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteBox((prev) => !prev)}
                  className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Paste 10 Words</span>
                </button>
                <button
                  type="button"
                  onClick={handleAutoFillIpa}
                  disabled={ipaLoading || filledWordCount === 0}
                  className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{ipaLoading ? "Looking up IPA..." : `Auto-Fill ${config.accent} IPA`}</span>
                </button>
              </div>
            </div>

            {ipaMessage && (
              <div className="mt-4 px-3.5 py-2.5 rounded-lg bg-indigo-50 text-indigo-800 text-sm">
                {ipaMessage}
              </div>
            )}

            {/* Quick Presets */}
            <div className="mt-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Load Vietnamese High School Practice Set</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {CURRICULUM_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.id)}
                    className="text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors cursor-pointer"
                  >
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {preset.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {preset.levelLabel}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Paste Drawer */}
            {showPasteBox && (
              <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <label
                  htmlFor="paste-words-input"
                  className="block text-sm font-semibold text-slate-800 mb-1"
                >
                  Paste 10 Words (one per line or comma-separated)
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Optional IPA format: <code className="font-mono">environment /ɪnˈvaɪ.rən.mənt/</code>
                </p>
                <textarea
                  id="paste-words-input"
                  rows={5}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"family\nschool\nenvironment\nrenewable\ntemperature\nbiodiversity\natmosphere\npollution\nsustainable\nprotect"}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
                {pasteError && (
                  <p className="text-xs text-rose-600 mt-1.5">{pasteError}</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleParsePastedList}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                  >
                    Apply Pasted List
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPasteBox(false)}
                    className="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Game Title Input */}
            <div className="mt-5">
              <label
                htmlFor="game-title"
                className="block text-sm font-semibold text-slate-700 mb-1.5"
              >
                Game Title
              </label>
              <input
                id="game-title"
                type="text"
                value={config.title}
                onChange={(e) => onUpdateConfig({ ...config, title: e.target.value })}
                placeholder="e.g., Grade 11 Unit 4 Pronunciation Battle"
                maxLength={80}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            {/* 10 Word Rows */}
            <div className="mt-5 space-y-2.5">
              <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-slate-500 px-1">
                <div className="col-span-1">#</div>
                <div className="col-span-6">English Word</div>
                <div className="col-span-5">IPA Transcription (Optional)</div>
              </div>

              {config.words.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-12 gap-2.5 items-center">
                  <div className="col-span-1 text-sm font-mono font-semibold text-slate-400 tabular-nums pl-1">
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div className="col-span-6">
                    <input
                      type="text"
                      aria-label={`Word ${idx + 1}`}
                      value={item.word}
                      onChange={(e) => handleWordChange(idx, "word", e.target.value)}
                      placeholder={`Word ${idx + 1}`}
                      maxLength={60}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                  <div className="col-span-5">
                    <input
                      type="text"
                      aria-label={`IPA for word ${idx + 1}`}
                      value={item.ipa}
                      onChange={(e) => handleWordChange(idx, "ipa", e.target.value)}
                      placeholder="/ipa/"
                      maxLength={80}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Right Column: Rules, Accent, Scoring & Launch */}
          <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Game Rules & Scoring
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Customize classroom scoring and accent target
              </p>
            </div>

            {/* Accent Selector */}
            <div>
              <span className="block text-sm font-semibold text-slate-700 mb-2">
                Pronunciation Standard
              </span>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                {(["American", "British"] as const).map((accent) => (
                  <button
                    key={accent}
                    type="button"
                    onClick={() => handleAccentChange(accent)}
                    className={`py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                      config.accent === accent
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {accent}
                  </button>
                ))}
              </div>
            </div>

            {/* Points & Attempts Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="correct-points"
                  className="block text-xs font-semibold text-slate-600 mb-1.5"
                >
                  Correct Points (+)
                </label>
                <input
                  id="correct-points"
                  type="number"
                  min={1}
                  max={100}
                  value={config.correctPoints}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      correctPoints: Math.max(1, Number(e.target.value) || 10),
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-emerald-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label
                  htmlFor="incorrect-points"
                  className="block text-xs font-semibold text-slate-600 mb-1.5"
                >
                  Incorrect Penalty (-)
                </label>
                <input
                  id="incorrect-points"
                  type="number"
                  min={0}
                  max={100}
                  value={config.incorrectPoints}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      incorrectPoints: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-rose-700 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="max-attempts"
                  className="block text-xs font-semibold text-slate-600 mb-1.5"
                >
                  Attempts / Word
                </label>
                <select
                  id="max-attempts"
                  value={config.maxAttempts}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      maxAttempts: Number(e.target.value) || 2,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value={1}>1 attempt</option>
                  <option value={2}>2 attempts</option>
                  <option value={3}>3 attempts</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="passing-threshold"
                  className="block text-xs font-semibold text-slate-600 mb-1.5"
                >
                  Pass Threshold
                </label>
                <select
                  id="passing-threshold"
                  value={config.passingThreshold}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      passingThreshold: Number(e.target.value) || 80,
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value={65}>65 / 100 (Starter)</option>
                  <option value={75}>75 / 100 (Standard)</option>
                  <option value={80}>80 / 100 (Default)</option>
                  <option value={85}>85 / 100 (Strict)</option>
                  <option value={90}>90 / 100 (Mastery)</option>
                </select>
              </div>
            </div>

            {/* Scoring Summary Box */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center justify-between">
                <span>Correct pronunciation</span>
                <span className="font-semibold text-emerald-700 tabular-nums">
                  +{config.correctPoints} pts
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Incorrect after {config.maxAttempts} {config.maxAttempts === 1 ? "try" : "tries"}</span>
                <span className="font-semibold text-rose-700 tabular-nums">
                  -{config.incorrectPoints} pts
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Unclear mic / noise</span>
                <span className="font-semibold text-slate-700 tabular-nums">
                  0 pts (Free retry)
                </span>
              </div>
            </div>

            {!allTenReady && (
              <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Please fill in all 10 English words ({filledWordCount}/10 entered) to start the classroom challenge.
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={onStartGame}
              disabled={!allTenReady}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl font-display text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:translate-y-0.5 border-b-4 border-indigo-800 disabled:bg-slate-300 disabled:border-slate-400 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" aria-hidden="true" />
              <span>START GAME</span>
            </button>
          </aside>
        </div>
      )}

      {activeSection === "history" && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Previous Game Results
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Saved locally in this browser for classroom review and CSV export
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onExportCsv}
                disabled={history.length === 0}
                className="whitespace-nowrap shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                <span>Export CSV</span>
              </button>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {history.length === 0 ? (
            <div className="py-14 text-center">
              <History className="w-10 h-10 text-slate-300 mx-auto mb-3" aria-hidden="true" />
              <h3 className="font-display text-lg font-semibold text-slate-800">
                No completed games yet
              </h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Play a 10-word pronunciation round with a student to see their score report and exportable breakdown here.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-2.5">
                {history.map((session) => {
                  const active =
                    (selectedSessionId ?? history[0]?.sessionId) === session.sessionId;
                  return (
                    <button
                      key={session.sessionId}
                      type="button"
                      onClick={() => setSelectedSessionId(session.sessionId)}
                      className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                        active
                          ? "border-indigo-600 bg-indigo-50/50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 truncate">
                          {session.studentName || "Classroom Student"}
                        </span>
                        <span className="font-display font-bold text-indigo-700 tabular-nums shrink-0">
                          {session.totalScore} pts
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span className="truncate">{session.gameTitle}</span>
                        <span aria-hidden="true">·</span>
                        <span className="shrink-0 tabular-nums">
                          {session.correctCount}/10 correct
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 tabular-nums">
                        {new Date(session.completedAt).toLocaleString()} · {session.accent}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="lg:col-span-7">
                {(() => {
                  const detail =
                    history.find((s) => s.sessionId === selectedSessionId) ?? history[0];
                  if (!detail) return null;
                  return (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {detail.studentName || "Classroom Student"} — {detail.gameTitle}
                          </div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            Avg Score: {detail.averagePronunciationScore}/100 · Accuracy:{" "}
                            {detail.accuracyPercentage}% · {detail.accent} English
                          </div>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-white border-b border-slate-200 text-xs text-slate-500">
                            <tr>
                              <th className="py-2.5 px-4 font-semibold">Word</th>
                              <th className="py-2.5 px-3 font-semibold">Score</th>
                              <th className="py-2.5 px-3 font-semibold">Result</th>
                              <th className="py-2.5 px-4 font-semibold">Teacher Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {detail.wordResults.map((wr) => (
                              <tr key={`${detail.sessionId}-${wr.wordIndex}`}>
                                <td className="py-2.5 px-4 font-medium text-slate-900">
                                  <div>{wr.targetWord}</div>
                                  {wr.ipa && (
                                    <div className="text-xs text-slate-400">{wr.ipa}</div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 tabular-nums">
                                  {wr.bestScore}
                                </td>
                                <td className="py-2.5 px-3">
                                  {wr.finalResult === "Correct" ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                      <span>Correct</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-rose-700 font-semibold text-xs">
                                      <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                      <span>Incorrect</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-xs text-slate-600 max-w-xs">
                                  {wr.teacherNotes || wr.studentFeedback}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </section>
      )}

      {activeSection === "mistakes" && (
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
          <div className="pb-5 border-b border-slate-200">
            <h2 className="font-display text-xl font-bold text-slate-900">
              Pronunciation Mistake Review
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Detailed phonetic diagnostics for words needing extra classroom coaching
            </p>
          </div>

          {mistakeRecords.length === 0 ? (
            <div className="py-14 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" aria-hidden="true" />
              <h3 className="font-display text-lg font-semibold text-slate-800">
                No pronunciation mistakes logged yet
              </h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Words that fall below the passing score threshold will appear here with phonetic and stress insights for teacher review.
              </p>
            </div>
          ) : (
            <div className="mt-5 divide-y divide-slate-200">
              {mistakeRecords.map((item, idx) => (
                <div
                  key={`${item.sessionId}-${item.wordIndex}-${idx}`}
                  className="py-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-lg font-bold text-slate-900">
                        {item.targetWord}
                      </span>
                      {item.ipa && (
                        <span className="text-sm text-slate-500">{item.ipa}</span>
                      )}
                      <span className="text-xs text-slate-400">
                        · {item.studentName} · {item.accent} English
                      </span>
                    </div>
                    {item.mainMistake && (
                      <p className="text-sm font-medium text-rose-700">
                        Key Issue: {item.mainMistake}
                      </p>
                    )}
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">Phonetics Note: </span>
                      {item.teacherNotes || item.studentFeedback}
                    </p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <div className="font-mono text-lg font-bold text-rose-700 tabular-nums">
                      {item.bestScore}/100
                    </div>
                    <div className="text-xs text-slate-400 tabular-nums">
                      {new Date(item.completedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
