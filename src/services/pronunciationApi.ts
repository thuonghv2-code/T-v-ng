import { AccentOption, PronunciationEvaluation } from "../types/game";
import { blobToBase64 } from "./audioRecorder";

export interface EvaluateRequestParams {
  audioBlob: Blob;
  mimeType: string;
  targetWord: string;
  ipa: string;
  accent: AccentOption;
  passingThreshold: number;
}

export async function evaluatePronunciationAudio(
  params: EvaluateRequestParams
): Promise<PronunciationEvaluation> {
  const audioBase64 = await blobToBase64(params.audioBlob);

  const response = await fetch("/api/evaluate-pronunciation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioBase64,
      mimeType: params.mimeType,
      targetWord: params.targetWord,
      ipa: params.ipa,
      accent: params.accent,
      passingThreshold: params.passingThreshold,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as
    | (PronunciationEvaluation & { error?: string })
    | { error?: string };

  if (!response.ok) {
    throw new Error(data.error || `Evaluation request failed (${response.status}).`);
  }

  if (!isValidEvaluationResponse(data)) {
    throw new Error("Received an incomplete evaluation from the AI engine. Please try again.");
  }

  return data;
}

function isValidEvaluationResponse(data: unknown): data is PronunciationEvaluation {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.target_word === "string" &&
    typeof obj.pronunciation_score === "number" &&
    typeof obj.is_correct === "boolean" &&
    typeof obj.confidence === "number" &&
    typeof obj.audio_quality_ok === "boolean" &&
    typeof obj.suggestion === "string"
  );
}

export async function lookupIpaForWords(
  words: string[],
  accent: AccentOption
): Promise<Array<{ word: string; ipa: string }>> {
  const response = await fetch("/api/lookup-ipa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ words, accent }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    items?: Array<{ word: string; ipa: string }>;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || "Could not look up IPA transcriptions.");
  }

  return Array.isArray(data.items) ? data.items : [];
}
