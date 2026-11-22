import { useState } from "react";
import { FinalResults } from "./components/FinalResults";
import { Header } from "./components/Header";
import { StudentGame } from "./components/StudentGame";
import { TeacherSetup } from "./components/TeacherSetup";
import { buildCompletedSession } from "./services/scoringEngine";
import {
  clearGameHistory,
  exportSessionsToCsv,
  loadGameHistory,
  loadSavedGameConfig,
  saveCompletedSession,
  saveGameConfig,
} from "./services/storageService";
import {
  AppScreen,
  CompletedGameSession,
  GameConfig,
  TeacherSection,
  WordGameResult,
} from "./types/game";

export default function App() {
  const [config, setConfig] = useState<GameConfig>(() => loadSavedGameConfig());
  const [history, setHistory] = useState<CompletedGameSession[]>(() => loadGameHistory());
  const [screen, setScreen] = useState<AppScreen>("teacher");
  const [teacherSection, setTeacherSection] = useState<TeacherSection>("setup");
  const [studentName, setStudentName] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [gameRunId, setGameRunId] = useState(1);
  const [latestSession, setLatestSession] = useState<CompletedGameSession | null>(null);

  const canStartGame = config.words.filter((w) => w.word.trim().length > 0).length === 10;

  const revokeSessionAudioUrls = (session: CompletedGameSession | null) => {
    if (!session) return;
    session.wordResults.forEach((wr) => {
      wr.attempts.forEach((att) => {
        if (att.audioUrl) {
          URL.revokeObjectURL(att.audioUrl);
        }
      });
    });
  };

  const handleUpdateConfig = (next: GameConfig) => {
    setConfig(next);
    saveGameConfig(next);
  };

  const handleStartGame = () => {
    if (!canStartGame) return;
    // Normalize trimmed words before starting
    const cleanedConfig: GameConfig = {
      ...config,
      words: config.words.map((w) => ({
        ...w,
        word: w.word.trim(),
        ipa: w.ipa.trim(),
      })),
    };
    handleUpdateConfig(cleanedConfig);
    revokeSessionAudioUrls(latestSession);
    setLatestSession(null);
    setGameRunId((prev) => prev + 1);
    setScreen("game");
  };

  const handleCompleteGame = (wordResults: WordGameResult[], totalScore: number) => {
    const completed = buildCompletedSession(config, studentName, wordResults, totalScore);
    // Keep audioUrls in memory for immediate Final Results playback, while persisting clean copy to localStorage
    const updatedHistory = saveCompletedSession(completed);
    setHistory(updatedHistory);
    setLatestSession(completed);
    setScreen("results");
  };

  const handlePlayAgain = () => {
    revokeSessionAudioUrls(latestSession);
    setLatestSession(null);
    setGameRunId((prev) => prev + 1);
    setScreen("game");
  };

  const handleNavigateTeacher = (section: TeacherSection) => {
    setTeacherSection(section);
    setScreen("teacher");
  };

  const handleClearHistory = () => {
    clearGameHistory();
    setHistory([]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f8fc] text-slate-900">
      <Header
        currentScreen={screen}
        teacherSection={teacherSection}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        onNavigateTeacher={handleNavigateTeacher}
        onStartGame={handleStartGame}
        canStartGame={canStartGame}
      />

      <div className="flex-1">
        {screen === "teacher" && (
          <TeacherSetup
            config={config}
            history={history}
            activeSection={teacherSection}
            onChangeSection={setTeacherSection}
            onUpdateConfig={handleUpdateConfig}
            onStartGame={handleStartGame}
            onExportCsv={() => exportSessionsToCsv(history)}
            onClearHistory={handleClearHistory}
          />
        )}

        {screen === "game" && (
          <StudentGame
            key={gameRunId}
            config={config}
            studentName={studentName}
            soundEnabled={soundEnabled}
            onChangeStudentName={setStudentName}
            onCompleteGame={handleCompleteGame}
          />
        )}

        {screen === "results" && latestSession && (
          <FinalResults
            session={latestSession}
            soundEnabled={soundEnabled}
            onPlayAgain={handlePlayAgain}
            onReturnToDashboard={() => handleNavigateTeacher("setup")}
          />
        )}
      </div>
    </div>
  );
}
