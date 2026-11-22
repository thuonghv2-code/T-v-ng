import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapGeminiError } from "./server/geminiClient.ts";
import {
  evaluatePronunciation,
  InputValidationError,
  lookupIpaBatch,
  validateEvaluationInput,
} from "./server/pronunciationService.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "16mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/evaluate-pronunciation", async (req, res) => {
    try {
      const validated = validateEvaluationInput(req.body);
      const evaluation = await evaluatePronunciation(validated);
      res.json(evaluation);
    } catch (error) {
      if (error instanceof InputValidationError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      const mapped = mapGeminiError(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  app.post("/api/lookup-ipa", async (req, res) => {
    try {
      const body = req.body as { words?: unknown; accent?: unknown } | undefined;
      if (!body || !Array.isArray(body.words)) {
        res.status(400).json({ error: "Provide an array of words." });
        return;
      }
      const words = body.words
        .filter((w): w is string => typeof w === "string")
        .map((w) => w.trim())
        .filter(Boolean)
        .slice(0, 10);

      if (words.length === 0) {
        res.status(400).json({ error: "No valid words provided." });
        return;
      }

      const accent = body.accent === "British" ? "British" : "American";
      const items = await lookupIpaBatch(words, accent);
      res.json({ items });
    } catch (error) {
      const mapped = mapGeminiError(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true",
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*splat}", (_req, res) => {
      const indexFile = path.join(distDir, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Application build not found.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Pronunciation Challenge server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
