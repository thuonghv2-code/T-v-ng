import { useEffect, useRef, useState } from "react";
import {
  Award,
  CheckCircle2,
  LayoutDashboard,
  Play,
  RotateCcw,
  Volume2,
  XCircle,
} from "lucide-react";
import { playVictoryFanfare } from "../services/audioRecorder";
import { CompletedGameSession } from "../types/game";

interface FinalResultsProps {
  session: CompletedGameSession;
  soundEnabled: boolean;
  onPlayAgain: () => void;
  onReturnToDashboard: () => void;
}

export function FinalResults({
  session,
  soundEnabled,
  onPlayAgain,
  onReturnToDashboard,
}: FinalResultsProps) {
  const [showMistakesModal, setShowMistakesModal] = useState(false);
  const [playingWordIdx, setPlayingWordIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (soundEnabled) {
      playVictoryFanfare();
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [soundEnabled]);

  const mistakes = session.wordResults.filter(
    (wr) => wr.finalResult === "Incorrect" || wr.bestScore < session.passingThreshold
  );

  const handlePlayWordAudio = (wordIndex: number, url: string) => {
    if (!url) return;
    if (audioRef.current) {
      audioRef.current.pause();
      if (playingWordIdx === wordIndex) {
        setPlayingWordIdx(null);
        return;
      }
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingWordIdx(wordIndex);
    audio.onended = () => setPlayingWordIdx(null);
    audio.onerror = () => setPlayingWordIdx(null);
    audio.play().catch(() => setPlayingWordIdx(null));
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Celebratory Score Summary */}
      <section className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
          <Award className="w-8 h-8" aria-hidden="true" />
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
          {session.accuracyPercentage >= 70 ? "CONGRATULATIONS!" : "GREAT EFFORT!"}
        </h1>

        <p className="text-sm text-slate-500 mt-1.5">
          {session.studentName ? `${session.studentName} · ` : ""}
          {session.gameTitle} · {session.accent} English
        </p>

        <div className="mt-6">
          <div className="text-xs font-semibold text-slate-500">YOUR FINAL SCORE</div>
          <div className="font-display text-5xl sm:text-6xl font-extrabold text-indigo-700 tabular-nums mt-1">
            {session.totalScore} POINTS
          </div>
        </div>

        {/* 4-Column Metric Strip */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500">Correct Words</div>
            <div className="font-display text-2xl font-bold text-emerald-700 tabular-nums mt-1">
              {session.correctCount}/10
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500">Incorrect Words</div>
            <div className="font-display text-2xl font-bold text-rose-700 tabular-nums mt-1">
              {session.incorrectCount}/10
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500">Avg Pronunciation</div>
            <div className="font-display text-2xl font-bold text-slate-900 tabular-nums mt-1">
              {session.averagePronunciationScore}/100
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500">Performance</div>
            <div className="font-display text-2xl font-bold text-indigo-700 tabular-nums mt-1">
              {session.accuracyPercentage}%
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-display font-bold text-white bg-indigo-600 hover:bg-indigo-700 border-b-4 border-indigo-800 transition-all cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>PLAY AGAIN</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMistakesModal((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-display font-bold text-slate-800 bg-amber-100 hover:bg-amber-200 border-b-4 border-amber-300 transition-all cursor-pointer whitespace-nowrap"
          >
            <Volume2 className="w-4 h-4" aria-hidden="true" />
            <span>
              {showMistakesModal
                ? "HIDE MISTAKE REVIEW"
                : `REVIEW MISTAKES (${mistakes.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={onReturnToDashboard}
            className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-display font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
            <span>RETURN TO TEACHER DASHBOARD</span>
          </button>
        </div>
      </section>

      {/* Focused Mistake Review Panel */}
      {showMistakesModal && (
        <section className="mt-6 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
          <h2 className="font-display text-xl font-bold text-slate-900">
            Words to Practice Next
          </h2>
          {mistakes.length === 0 ? (
            <p className="text-sm text-emerald-700 font-medium mt-2">
              Outstanding! Every single word scored {session.passingThreshold}/100 or higher.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-200">
              {mistakes.map((wr) => {
                const lastAudio = wr.attempts[wr.attempts.length - 1]?.audioUrl;
                return (
                  <div
                    key={wr.wordIndex}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-lg font-bold text-slate-900">
                          {wr.targetWord}
                        </span>
                        {wr.ipa && (
                          <span className="text-sm text-slate-500">{wr.ipa}</span>
                        )}
                        <span className="text-sm font-mono font-semibold text-rose-700 tabular-nums">
                          · {wr.bestScore}/100
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 mt-1">
                        {wr.studentFeedback || wr.teacherNotes}
                      </p>
                      {wr.mainMistake && (
                        <p className="text-xs font-medium text-rose-700 mt-1">
                          Focus point: {wr.mainMistake}
                        </p>
                      )}
                    </div>
                    {lastAudio && (
                      <button
                        type="button"
                        onClick={() => handlePlayWordAudio(wr.wordIndex, lastAudio)}
                        className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer shrink-0"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                        <span>
                          {playingWordIdx === wr.wordIndex ? "Stop" : "Hear Attempt"}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Individual Word Results Table */}
      <section className="mt-6 bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Word-by-Word Performance Report
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
              <tr>
                <th className="py-3 px-5">Word</th>
                <th className="py-3 px-4">Pronunciation Score</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-5">Recording</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {session.wordResults.map((wr) => {
                const audioUrl = wr.attempts[wr.attempts.length - 1]?.audioUrl;
                return (
                  <tr key={wr.wordIndex} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-900 capitalize">
                        {wr.targetWord}
                      </div>
                      {wr.ipa && (
                        <div className="text-xs text-slate-400">{wr.ipa}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800 tabular-nums">
                      {wr.bestScore}
                    </td>
                    <td className="py-3.5 px-4">
                      {wr.finalResult === "Correct" ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                          <span>Correct</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700">
                          <XCircle className="w-4 h-4" aria-hidden="true" />
                          <span>Incorrect</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5">
                      {audioUrl ? (
                        <button
                          type="button"
                          onClick={() => handlePlayWordAudio(wr.wordIndex, audioUrl)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                          <span>
                            {playingWordIdx === wr.wordIndex ? "Stop" : "Listen"}
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
