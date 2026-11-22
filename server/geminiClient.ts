import { GoogleGenAI } from "@google/genai";

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new GeminiConfigError(
      "Gemini API key is not configured on the server. Please set GEMINI_API_KEY in Settings > Secrets."
    );
  }

  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  return cachedClient;
}

export class GeminiConfigError extends Error {
  statusCode = 503;
  constructor(message: string) {
    super(message);
    this.name = "GeminiConfigError";
  }
}

export function mapGeminiError(error: unknown): { status: number; message: string } {
  if (error instanceof GeminiConfigError) {
    return { status: error.statusCode, message: error.message };
  }

  const errObj = error as { status?: number; message?: string; code?: string } | undefined;
  const rawMessage = errObj?.message || "Unexpected AI evaluation error.";
  const status = typeof errObj?.status === "number" ? errObj.status : 500;

  if (status === 401 || status === 403 || rawMessage.includes("PERMISSION_DENIED") || rawMessage.includes("API_KEY_INVALID")) {
    return {
      status: 403,
      message: "Gemini API key was rejected. Please verify GEMINI_API_KEY in Settings > Secrets.",
    };
  }

  if (status === 429 || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "AI evaluation quota is temporarily busy. Please wait a few seconds and try again.",
    };
  }

  if (status === 400) {
    return {
      status: 400,
      message: "The audio format or request could not be processed. Please try recording again.",
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: "Unable to complete AI pronunciation evaluation right now. Please try again.",
  };
}
