import { Type } from "@google/genai";
import { getGeminiClient } from "./geminiClient.ts";

export type AccentType = "British" | "American";

export interface EvaluatePronunciationInput {
  audioBase64: string;
  mimeType: string;
  targetWord: string;
  ipa?: string;
  accent: AccentType;
  passingThreshold: number;
}

export interface PronunciationEvaluationResponse {
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

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/aac",
  "audio/flac",
]);

const MODEL_NAME = "gemini-4-hydrogen";

export function normalizeMimeType(rawMimeType: string): string {
  const base = rawMimeType.split(";")[0]?.trim().toLowerCase() || "";
  if (base === "audio/wave" || base === "audio/x-wav") return "audio/wav";
  return base;
}

export function validateEvaluationInput(body: unknown): EvaluatePronunciationInput {
  if (!body || typeof body !== "object") {
    throw new InputValidationError("Invalid request payload.");
  }

  const payload = body as Record<string, unknown>;
  const targetWord = typeof payload.targetWord === "string" ? payload.targetWord.trim() : "";
  if (!targetWord || targetWord.length > 60) {
    throw new InputValidationError("Target word must be between 1 and 60 characters.");
  }

  const ipa = typeof payload.ipa === "string" ? payload.ipa.trim().slice(0, 80) : "";
  const accent: AccentType = payload.accent === "British" ? "British" : "American";

  const rawThreshold = typeof payload.passingThreshold === "number" ? payload.passingThreshold : 80;
  const passingThreshold = Math.min(100, Math.max(40, Math.round(rawThreshold)));

  const rawMimeType = typeof payload.mimeType === "string" ? payload.mimeType : "";
  const mimeType = normalizeMimeType(rawMimeType);
  if (!ALLOWED_AUDIO_MIME_TYPES.has(mimeType)) {
    throw new InputValidationError(`Unsupported audio format: ${mimeType || "unknown"}.`);
  }

  const audioBase64 = typeof payload.audioBase64 === "string" ? payload.audioBase64.trim() : "";
  if (!audioBase64 || audioBase64.length < 100) {
    throw new InputValidationError("Recording appears empty. Please record your voice clearly.");
  }
  // ~10MB base64 ceiling
  if (audioBase64.length > 14_000_000) {
    throw new InputValidationError("Audio recording is too large. Please keep recordings under 15 seconds.");
  }

  return {
    audioBase64,
    mimeType,
    targetWord,
    ipa,
    accent,
    passingThreshold,
  };
}

export class InputValidationError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}

export async function evaluatePronunciation(
  input: EvaluatePronunciationInput
): Promise<PronunciationEvaluationResponse> {
  const ai = getGeminiClient();

  const accentLabel = input.accent === "British" ? "British English (RP)" : "American English (General American)";
  const ipaLine = input.ipa ? `Target IPA: ${input.ipa}` : "Target IPA: (not provided; use standard dictionary IPA for the selected accent)";

  const systemInstruction = `You are a specialist English phonetics coach and encouraging ESL teacher evaluating high school students in Vietnam.

Your job is to listen carefully to the student's ACTUAL audio recording and evaluate how accurately they pronounced the single target English word.

CRITICAL EVALUATION RULES:
1. Analyze the ACTUAL audio waveform and phonemes spoken — never assume the pronunciation is correct merely because you can guess the intended word.
2. Evaluate these dimensions:
   - Phoneme accuracy (vowels, diphthongs, consonants)
   - Final consonant sounds and consonant clusters (especially important for Vietnamese learners, e.g., final /t/, /d/, /s/, /z/, /k/, /p/, /v/, /f/, /θ/, /ð/, /ʃ/, /tʃ/, /dʒ/)
   - Word stress placement and syllable count (neither dropping syllables nor inserting extra vowel epenthesis)
   - Overall intelligibility within ${accentLabel}
3. Fairness to Vietnamese learners:
   - Accept reasonable pronunciation variation within ${accentLabel}.
   - Do NOT penalize harmless accent coloring when the word is clearly intelligible and the required phonemes and word stress are produced accurately.
   - Do NOT invent phonetic errors that are not present in the audio.
4. Distinguish audio/microphone issues from pronunciation mistakes:
   - If the audio is silent, contains only background noise/static, is clipped beyond recognition, or cuts off before speech finishes so you cannot hear the word fairly: set "audio_quality_ok": false, "confidence": 0.25, "pronunciation_score": 0, "is_correct": false, "recognized_word": "", "main_mistake": "Audio unclear or too quiet", "student_feedback": "We couldn't hear you clearly. Please check your microphone and record again.", "suggestion": "Hold the mic a bit closer and speak clearly after pressing record."
   - If you are genuinely uncertain about a subtle sound, reflect lower confidence (< 0.6) instead of guessing errors.
5. Feedback style:
   - "student_feedback": 1–2 short, warm, encouraging, easy-to-understand sentences for a high school student (no dense IPA jargon).
   - "teacher_notes": 1–2 concise, specific phonetic observations for the teacher (can reference specific vowels, consonants, stress, or final sounds).
   - "phoneme_feedback": short clear note on vowel/consonant quality.
   - "stress_feedback": short clear note on syllable stress.
   - "main_mistake": empty string "" if score >= ${input.passingThreshold}, otherwise the single highest-impact fix.
   - "suggestion": short actionable tip or praise (e.g., "Excellent pronunciation!" or "Try stressing the second syllable and pronouncing the final /t/.").`;

  const prompt = `Target English word: "${input.targetWord}"
${ipaLine}
Selected accent standard: ${accentLabel}
Passing score threshold: ${input.passingThreshold}/100

Listen carefully to the attached audio recording of the student saying "${input.targetWord}" and return your structured JSON evaluation.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: input.mimeType,
            data: input.audioBase64,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          target_word: { type: Type.STRING },
          recognized_word: { type: Type.STRING },
          pronunciation_score: { type: Type.INTEGER },
          is_correct: { type: Type.BOOLEAN },
          confidence: { type: Type.NUMBER },
          phoneme_feedback: { type: Type.STRING },
          stress_feedback: { type: Type.STRING },
          main_mistake: { type: Type.STRING },
          suggestion: { type: Type.STRING },
          audio_quality_ok: { type: Type.BOOLEAN },
          student_feedback: { type: Type.STRING },
          teacher_notes: { type: Type.STRING },
        },
        required: [
          "target_word",
          "recognized_word",
          "pronunciation_score",
          "is_correct",
          "confidence",
          "phoneme_feedback",
          "stress_feedback",
          "main_mistake",
          "suggestion",
          "audio_quality_ok",
          "student_feedback",
          "teacher_notes",
        ],
      },
    },
  });

  const rawText = (response.text ?? "").trim();
  if (!rawText) {
    throw new Error("Empty response received from Gemini evaluation model.");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    throw new Error("Failed to parse structured evaluation JSON from AI model.");
  }

  return normalizeAndValidateResult(parsed, input);
}

function normalizeAndValidateResult(
  raw: Record<string, unknown>,
  input: EvaluatePronunciationInput
): PronunciationEvaluationResponse {
  const audioQualityOk = typeof raw.audio_quality_ok === "boolean" ? raw.audio_quality_ok : true;
  const rawScore = typeof raw.pronunciation_score === "number" && Number.isFinite(raw.pronunciation_score)
    ? Math.round(raw.pronunciation_score)
    : 0;
  const pronunciationScore = Math.min(100, Math.max(0, rawScore));

  const rawConfidence = typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
    ? raw.confidence
    : 0.75;
  const confidence = Math.min(1, Math.max(0, Number(rawConfidence.toFixed(2))));

  // Enforce passing threshold + confidence + audio quality gate deterministically
  const meetsQualityAndConfidence = audioQualityOk && confidence >= 0.55;
  const isCorrect = meetsQualityAndConfidence && pronunciationScore >= input.passingThreshold;

  const cleanStr = (val: unknown, fallback = ""): string =>
    typeof val === "string" ? val.trim().slice(0, 320) : fallback;

  return {
    target_word: input.targetWord,
    recognized_word: cleanStr(raw.recognized_word, ""),
    pronunciation_score: audioQualityOk ? pronunciationScore : 0,
    is_correct: isCorrect,
    confidence,
    phoneme_feedback: cleanStr(raw.phoneme_feedback, isCorrect ? "Clear vowel and consonant sounds." : "Review the key vowel and consonant sounds."),
    stress_feedback: cleanStr(raw.stress_feedback, isCorrect ? "Accurate word stress." : "Check which syllable carries primary stress."),
    main_mistake: isCorrect ? "" : cleanStr(raw.main_mistake, ""),
    suggestion: cleanStr(
      raw.suggestion,
      !audioQualityOk
        ? "Audio was unclear. Please record again in a quiet spot."
        : isCorrect
          ? "Excellent pronunciation!"
          : "Good effort! Try speaking slowly and emphasizing the stressed syllable."
    ),
    audio_quality_ok: audioQualityOk,
    student_feedback: cleanStr(
      raw.student_feedback,
      !audioQualityOk
        ? "We couldn't hear the word clearly. Please try recording again!"
        : isCorrect
          ? "Great job! Your pronunciation is clear and accurate."
          : "Nice try! Listen closely to the stress and ending sound, then try again."
    ),
    teacher_notes: cleanStr(
      raw.teacher_notes,
      cleanStr(raw.phoneme_feedback, "Evaluated by AI phonetics engine.")
    ),
  };
}

export async function lookupIpaBatch(
  words: string[],
  accent: AccentType
): Promise<Array<{ word: string; ipa: string }>> {
  const cleanWords = words
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && w.length <= 60)
    .slice(0, 10);

  if (cleanWords.length === 0) {
    return [];
  }

  const ai = getGeminiClient();
  const accentLabel = accent === "British" ? "British English (RP)" : "General American English";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Provide accurate IPA transcriptions (enclosed in slashes like /ˈfæm.əl.i/) in ${accentLabel} for these English words: ${cleanWords.join(", ")}`,
    config: {
      systemInstruction:
        "You are an English phonetics lexicographer. Return accurate standard dictionary IPA transcriptions enclosed in forward slashes for each word in the requested accent.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            ipa: { type: Type.STRING },
          },
          required: ["word", "ipa"],
        },
      },
    },
  });

  const text = (response.text ?? "[]").trim();
  try {
    const parsed = JSON.parse(text) as Array<{ word?: unknown; ipa?: unknown }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item.word === "string" && typeof item.ipa === "string")
      .map((item) => ({
        word: (item.word as string).trim(),
        ipa: (item.ipa as string).trim(),
      }));
  } catch {
    return [];
  }
}
