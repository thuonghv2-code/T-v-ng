import { Mic, Volume2, VolumeX } from "lucide-react";
import { AppScreen, TeacherSection } from "../types/game";

interface HeaderProps {
  currentScreen: AppScreen;
  teacherSection: TeacherSection;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onNavigateTeacher: (section: TeacherSection) => void;
  onStartGame: () => void;
  canStartGame: boolean;
}

export function Header({
  currentScreen,
  teacherSection,
  soundEnabled,
  onToggleSound,
  onNavigateTeacher,
  onStartGame,
  canStartGame,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigateTeacher("setup")}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-lg py-1"
        >
          <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Mic className="w-4 h-4" aria-hidden="true" />
          </span>
          <span className="font-display font-bold text-lg tracking-tight text-slate-900">
            Pronunciation Challenge
          </span>
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => onNavigateTeacher("setup")}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              currentScreen === "teacher" && teacherSection === "setup"
                ? "border-indigo-600 text-slate-900 font-semibold"
                : "border-transparent hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            Teacher Setup
          </button>
          <button
            type="button"
            onClick={() => onNavigateTeacher("history")}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              currentScreen === "teacher" && teacherSection === "history"
                ? "border-indigo-600 text-slate-900 font-semibold"
                : "border-transparent hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            Past Results
          </button>
          <button
            type="button"
            onClick={() => onNavigateTeacher("mistakes")}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              currentScreen === "teacher" && teacherSection === "mistakes"
                ? "border-indigo-600 text-slate-900 font-semibold"
                : "border-transparent hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            Mistake Review
          </button>
          <button
            type="button"
            onClick={onToggleSound}
            aria-label={soundEnabled ? "Mute game sound effects" : "Enable game sound effects"}
            className="whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 py-1 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" aria-hidden="true" />
            ) : (
              <VolumeX className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{soundEnabled ? "Sound On" : "Muted"}</span>
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          {currentScreen === "teacher" ? (
            <button
              type="button"
              onClick={onStartGame}
              disabled={!canStartGame}
              className="whitespace-nowrap shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Start Game
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigateTeacher("setup")}
              className="whitespace-nowrap shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Teacher Setup
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
