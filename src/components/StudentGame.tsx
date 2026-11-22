import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mic,
  Play,
  RotateCcw,
  Square,
  User,
  Volume2,
  XCircle,
} from "lucide-react";
import {
  isRecordingSupported,
  MicrophoneRecorder,
  playRetryTone,
  playSuccessChime,
} from "../services/audioRecorder";
import { evaluatePronunciationAudio } from "../services/pronunciationApi";
import { buildWordResult, decideAttemptOutcome } from "../services/scoringEngine";
import {
  AttemptRecord,
  GameConfig,
  WordGameResult,
} from "../types/game";

interface StudentGameProps {
  config: GameConfig;
  studentName: string;
  soundEnabled: boolean;
  onChangeStudentName: (name: string) => void;
  onCompleteGame: (wordResults: WordGameResult[], totalScore: number) => void;
}

type WordPhase = "ready" | "recording" | "analyzing" | "evaluated";

export function StudentGame({
  config,
  studentName,
  soundEnabled,
  onChangeStudentName,
  onCompleteGame,
}: StudentGameProps) {
  const [wordIndex, setWordIndex] = useState(0);
  const [phase, setPhase] = useState<WordPhase>("ready");
  const [totalScore, setTotalScore] = useState(0);
  const [scoreDeltaAnim, setScoreDeltaAnim] = useState<{
    key: number;
    delta: number;
  } | null>(null);

  const [currentAttempts, setCurrentAttempts] = useState<AttemptRecord[]>([]);
  const [wordResults, setWordResults] = useState<WordGameResult[]>([]);
  const [wordFinalized, setWordFinalized] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPlayingBack, setIsPlayingBack] = useState(false);

  const recorderRef = useRef<MicrophoneRecorder | null>(null);
  const phaseRef = useRef<WordPhase>("ready");
  const levelRafRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const scoredAttemptIdsRef = useRef<Set<string>>(new Set());
  const finalizedWordsRef = useRef<Set<number>>(new Set());

  const setWordPhase = (next: WordPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const currentWordItem = config.words[wordIndex];
  const latestAttempt = currentAttempts[currentAttempts.length - 1] ?? null;
  const scoredAttemptsCount = currentAttempts.filter((a) => a.outcome !== "unclear").length;
  const attemptsRemaining = Math.max(0, config.maxAttempts - scoredAttemptsCount);
  const browserSupported = isRecordingSupported();

  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
      if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current);
      if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  const stopRecordingVisuals = () => {
    if (levelRafRef.current) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setAudioLevel(0);
  };

  const handleStartRecording = async () => {
    if (
      !browserSupported ||
      phaseRef.current === "recording" ||
      phaseRef.current === "analyzing" ||
      wordFinalized
    ) {
      return;
    }
    setErrorMsg("");

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlayingBack(false);
    }

    const recorder = new MicrophoneRecorder();
    recorderRef.current = recorder;

    try {
      await recorder.start();
      setWordPhase("recording");
      setRecordingSeconds(0);

      const startedAt = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startedAt) / 1000);
        setRecordingSeconds(secs);
        // Auto-stop after 12 seconds so single-word recordings stay crisp
        if (secs >= 12) {
          void handleStopRecording();
        }
      }, 200);

      const updateLevel = () => {
        if (recorderRef.current && phaseRef.current === "recording") {
          setAudioLevel(recorderRef.current.getVolumeLevel());
          levelRafRef.current = requestAnimationFrame(updateLevel);
        }
      };
      levelRafRef.current = requestAnimationFrame(updateLevel);
    } catch (err) {
      stopRecordingVisuals();
      setWordPhase(latestAttempt ? "evaluated" : "ready");
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Unable to start microphone recording."
      );
    }
  };

  const handleStopRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder || phaseRef.current !== "recording") return;

    stopRecordingVisuals();
    setWordPhase("analyzing");
    setErrorMsg("");

    try {
      const recording = await recorder.stop();
      recorderRef.current = null;

      const evaluation = await evaluatePronunciationAudio({
        audioBlob: recording.uploadBlob,
        mimeType: recording.mimeType,
        targetWord: currentWordItem.word,
        ipa: currentWordItem.ipa,
        accent: config.accent,
        passingThreshold: config.passingThreshold,
      });

      const attemptId = `att-${wordIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const nextAttemptNumber =
        evaluation.audio_quality_ok && evaluation.confidence >= 0.55
          ? scoredAttemptsCount + 1
          : scoredAttemptsCount;

      const decision = decideAttemptOutcome(
        evaluation,
        Math.max(1, nextAttemptNumber),
        config
      );

      // Guard against duplicate scoring for the same attempt or already finalized word
      let appliedPoints = 0;
      if (
        !scoredAttemptIdsRef.current.has(attemptId) &&
        !finalizedWordsRef.current.has(wordIndex)
      ) {
        scoredAttemptIdsRef.current.add(attemptId);
        appliedPoints = decision.pointsDelta;
        if (appliedPoints !== 0) {
          setTotalScore((prev) => prev + appliedPoints);
          setScoreDeltaAnim({ key: Date.now(), delta: appliedPoints });
        }
        if (decision.wordFinalized) {
          finalizedWordsRef.current.add(wordIndex);
          setWordFinalized(true);
        }
      }

      const record: AttemptRecord = {
        attemptId,
        attemptNumber: currentAttempts.length + 1,
        audioUrl: recording.playbackUrl,
        evaluation,
        pointsApplied: appliedPoints,
        outcome: decision.outcome,
        timestamp: new Date().toISOString(),
      };

      const updatedAttempts = [...currentAttempts, record];
      setCurrentAttempts(updatedAttempts);
      setWordPhase("evaluated");

      if (soundEnabled) {
        if (decision.outcome === "correct") {
          playSuccessChime();
        } else if (
          decision.outcome === "incorrect" ||
          decision.outcome === "retry_available"
        ) {
          playRetryTone();
        }
      }
    } catch (err) {
      recorderRef.current = null;
      setWordPhase(latestAttempt ? "evaluated" : "ready");
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Pronunciation evaluation failed. Please try again."
      );
    }
  };

  const handlePlayMyRecording = (url: string) => {
    if (!url) return;
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      if (isPlayingBack) {
        setIsPlayingBack(false);
        return;
      }
    }
    const audio = new Audio(url);
    audioPlayerRef.current = audio;
    setIsPlayingBack(true);
    audio.onended = () => setIsPlayingBack(false);
    audio.onerror = () => setIsPlayingBack(false);
    audio.play().catch(() => setIsPlayingBack(false));
  };

  const handleRetryWord = () => {
    if (wordFinalized || phase === "recording" || phase === "analyzing") return;
    setErrorMsg("");
    void handleStartRecording();
  };

  const handleNextWord = () => {
    if (!latestAttempt || phase === "recording" || phase === "analyzing") return;

    let updatedTotalScore = totalScore;
    let finalOutcome: "Correct" | "Incorrect" =
      latestAttempt.outcome === "correct" ? "Correct" : "Incorrect";
    let pointsForWord = currentAttempts.reduce((sum, a) => sum + a.pointsApplied, 0);

    // If student chooses to skip after a retryable incorrect attempt, apply the penalty once now
    if (!finalizedWordsRef.current.has(wordIndex)) {
      finalizedWordsRef.current.add(wordIndex);
      if (latestAttempt.outcome === "retry_available") {
        const penalty = -Math.abs(config.incorrectPoints);
        updatedTotalScore = totalScore + penalty;
        pointsForWord += penalty;
        setTotalScore(updatedTotalScore);
      }
      finalOutcome = "Incorrect";
    }

    const result = buildWordResult(
      wordIndex,
      currentWordItem.word,
      currentWordItem.ipa,
      currentAttempts,
      finalOutcome,
      pointsForWord
    );

    const nextResults = [...wordResults, result];

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlayingBack(false);
    }

    if (wordIndex + 1 >= config.words.length) {
      onCompleteGame(nextResults, updatedTotalScore);
      return;
    }

    setWordResults(nextResults);
    setWordIndex((prev) => prev + 1);
    setCurrentAttempts([]);
    setWordFinalized(false);
    setWordPhase("ready");
    setErrorMsg("");
  };

  const progressRatio = (wordIndex + (wordFinalized ? 1 : 0)) / config.words.length;
  const waveBars = [0.35, 0.65, 1, 0.8, 0.55, 0.9, 0.45];

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Top Game HUD */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-500 flex flex-wrap items-center gap-2">
              <span className="truncate max-w-xs">{config.title || "Pronunciation Challenge"}</span>
              <span aria-hidden="true">·</span>
              <span>{config.accent} English</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">Pass ≥ {config.passingThreshold}%</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-display text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
                WORD {String(wordIndex + 1).padStart(2, "0")} / {String(config.words.length).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* Optional Student Name + Score Display */}
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                aria-label="Student Name"
                value={studentName}
                onChange={(e) => onChangeStudentName(e.target.value)}
                placeholder="Student name (optional)"
                maxLength={40}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 w-44"
              />
            </div>

            <div className="relative text-right">
              <div className="text-xs font-semibold text-slate-500">SCORE</div>
              <div className="font-display text-2xl font-extrabold text-indigo-700 tabular-nums leading-tight">
                {totalScore}
              </div>

              <AnimatePresence>
                {scoreDeltaAnim && (
                  <motion.div
                    key={scoreDeltaAnim.key}
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: -26, scale: 1 }}
                    exit={{ opacity: 0, y: -40 }}
                    transition={{ duration: 0.45 }}
                    className={`absolute right-0 top-0 whitespace-nowrap font-display text-xs font-extrabold px-2 py-0.5 rounded-md pointer-events-none ${
                      scoreDeltaAnim.delta > 0
                        ? "bg-emerald-600 text-white"
                        : "bg-rose-600 text-white"
                    }`}
                  >
                    {scoreDeltaAnim.delta > 0
                      ? `+${scoreDeltaAnim.delta} POINTS!`
                      : `${scoreDeltaAnim.delta} POINTS!`}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-transform duration-300 ease-out origin-left"
            style={{ transform: `scaleX(${Math.max(0.04, progressRatio)})` }}
          />
        </div>
      </div>

      {/* Main Word Stage */}
      <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 text-center">
        {/* Mobile Student Name Field */}
        <div className="sm:hidden mb-4">
          <input
            type="text"
            aria-label="Student Name"
            value={studentName}
            onChange={(e) => onChangeStudentName(e.target.value)}
            placeholder="Enter student name (optional)"
            maxLength={40}
            className="w-full max-w-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-center font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentWordItem.id + wordIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 break-words text-balance">
              {currentWordItem.word}
            </h1>

            {currentWordItem.ipa && (
              <p className="mt-3 text-xl sm:text-2xl text-slate-500 font-medium">
                {currentWordItem.ipa}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Browser Support or Mic Error Alert */}
        {(!browserSupported || errorMsg) && (
          <div className="mt-6 max-w-lg mx-auto flex items-start gap-2.5 text-left rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
            <span>
              {!browserSupported
                ? "Audio recording is not supported in this browser. Please open Pronunciation Challenge in Chrome, Edge, Firefox, or Safari."
                : errorMsg}
            </span>
          </div>
        )}

        {/* Recording & Microphone Controls */}
        <div className="mt-8 flex flex-col items-center">
          {phase === "ready" && (
            <>
              <p className="text-sm font-medium text-slate-500 mb-5">
                Press the microphone button and pronounce the word clearly
              </p>
              <button
                type="button"
                onClick={handleStartRecording}
                disabled={!browserSupported}
                aria-label="Start recording pronunciation"
                className="w-24 h-24 rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white flex items-center justify-center border-b-4 border-indigo-800 disabled:bg-slate-300 disabled:border-slate-400 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
              >
                <Mic className="w-10 h-10" aria-hidden="true" />
              </button>
              <span className="mt-3 text-xs font-semibold text-indigo-700">
                TAP TO SPEAK
              </span>
            </>
          )}

          {phase === "recording" && (
            <>
              <p className="text-sm font-semibold text-rose-600 mb-4 tabular-nums">
                Recording... {recordingSeconds}s · Press Stop when finished
              </p>

              {/* Live Audio Level Bars */}
              <div className="flex items-center justify-center gap-1.5 h-10 mb-5" aria-hidden="true">
                {waveBars.map((weight, i) => {
                  const scale = 0.25 + Math.min(1, audioLevel * weight * 1.4) * 0.75;
                  return (
                    <span
                      key={i}
                      className="w-2 h-8 rounded-full bg-rose-500 transition-transform duration-75"
                      style={{ transform: `scaleY(${scale})` }}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => void handleStopRecording()}
                aria-label="Stop recording"
                className="w-24 h-24 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center border-b-4 border-rose-800 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-300"
              >
                <Square className="w-8 h-8 fill-current" aria-hidden="true" />
              </button>
              <span className="mt-3 text-xs font-semibold text-rose-700">
                TAP TO STOP
              </span>
            </>
          )}

          {phase === "analyzing" && (
            <div className="py-6 flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Loader2 className="w-9 h-9 animate-spin" aria-hidden="true" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-800">
                Your pronunciation is being evaluated...
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Listening to phonemes, ending sounds, and word stress
              </p>
            </div>
          )}
        </div>

        {/* AI Evaluation Feedback Card */}
        {phase === "evaluated" && latestAttempt && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-6 max-w-xl mx-auto text-left"
          >
            {/* Playback of Student's Own Recording */}
            {latestAttempt.audioUrl && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 mb-4">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Volume2 className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <span>Listen to your recording (Attempt #{latestAttempt.attemptNumber})</span>
                </div>
                <button
                  type="button"
                  onClick={() => handlePlayMyRecording(latestAttempt.audioUrl)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span>{isPlayingBack ? "Stop Audio" : "Play Recording"}</span>
                </button>
              </div>
            )}

            {/* Status & Score Box */}
            <div
              className={`rounded-2xl border p-5 ${
                latestAttempt.outcome === "correct"
                  ? "bg-emerald-50/70 border-emerald-200"
                  : latestAttempt.outcome === "unclear"
                    ? "bg-amber-50/70 border-amber-200"
                    : "bg-rose-50/70 border-rose-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  {latestAttempt.outcome === "correct" && (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" aria-hidden="true" />
                  )}
                  {latestAttempt.outcome === "unclear" && (
                    <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" aria-hidden="true" />
                  )}
                  {(latestAttempt.outcome === "incorrect" ||
                    latestAttempt.outcome === "retry_available") && (
                    <XCircle className="w-6 h-6 text-rose-600 shrink-0" aria-hidden="true" />
                  )}

                  <div>
                    <div
                      className={`font-display text-lg font-bold ${
                        latestAttempt.outcome === "correct"
                          ? "text-emerald-900"
                          : latestAttempt.outcome === "unclear"
                            ? "text-amber-900"
                            : "text-rose-900"
                      }`}
                    >
                      {latestAttempt.outcome === "correct" && "Excellent pronunciation!"}
                      {latestAttempt.outcome === "retry_available" &&
                        `Try again! (${attemptsRemaining} ${attemptsRemaining === 1 ? "attempt" : "attempts"} left)`}
                      {latestAttempt.outcome === "incorrect" && "Needs a little more practice"}
                      {latestAttempt.outcome === "unclear" && "Recording unclear — no points lost"}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {latestAttempt.outcome === "correct" &&
                        `+${config.correctPoints} points awarded`}
                      {latestAttempt.outcome === "retry_available" &&
                        "Retry now before any points are deducted"}
                      {latestAttempt.outcome === "incorrect" &&
                        `-${config.incorrectPoints} points deducted`}
                      {latestAttempt.outcome === "unclear" &&
                        "0 points · Please record closer to the microphone"}
                    </div>
                  </div>
                </div>

                {latestAttempt.outcome !== "unclear" && (
                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold text-slate-500">SCORE</div>
                    <div className="font-display text-2xl font-extrabold text-slate-900 tabular-nums">
                      {latestAttempt.evaluation.pronunciation_score}
                      <span className="text-sm font-semibold text-slate-500">/100</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Short, Encouraging Student Feedback */}
              <p className="mt-3.5 text-sm font-medium text-slate-800 leading-relaxed">
                {latestAttempt.evaluation.student_feedback ||
                  latestAttempt.evaluation.suggestion}
              </p>

              {latestAttempt.outcome !== "unclear" && (
                <div className="mt-3 pt-3 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-700">
                  <div>
                    <span className="font-semibold text-slate-900">Sounds: </span>
                    {latestAttempt.evaluation.phoneme_feedback}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Word Stress: </span>
                    {latestAttempt.evaluation.stress_feedback}
                  </div>
                </div>
              )}
            </div>

            {/* Step 6 Action Controls */}
            <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              {latestAttempt.outcome === "unclear" && (
                <button
                  type="button"
                  onClick={handleRetryWord}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-display font-bold text-white bg-indigo-600 hover:bg-indigo-700 border-b-4 border-indigo-800 transition-all cursor-pointer"
                >
                  <Mic className="w-5 h-5" aria-hidden="true" />
                  <span>RECORD AGAIN</span>
                </button>
              )}

              {latestAttempt.outcome === "retry_available" && (
                <>
                  <button
                    type="button"
                    onClick={handleRetryWord}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-display font-bold text-white bg-indigo-600 hover:bg-indigo-700 border-b-4 border-indigo-800 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-5 h-5" aria-hidden="true" />
                    <span>TRY AGAIN ({attemptsRemaining} LEFT)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextWord}
                    className="inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl font-display font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    <span>
                      {wordIndex + 1 >= config.words.length ? "FINISH" : "NEXT WORD"}
                    </span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </>
              )}

              {(latestAttempt.outcome === "correct" ||
                latestAttempt.outcome === "incorrect") && (
                <button
                  type="button"
                  onClick={handleNextWord}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-display font-bold text-white bg-emerald-600 hover:bg-emerald-700 border-b-4 border-emerald-800 transition-all cursor-pointer"
                >
                  <span>
                    {wordIndex + 1 >= config.words.length
                      ? "VIEW FINAL RESULTS"
                      : "NEXT WORD"}
                  </span>
                  <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </section>
    </main>
  );
}
