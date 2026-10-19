import { GoogleGenAI } from "@google/genai";

export type GeminiPart = { kind: "text"; text: string } | { kind: "video"; url: string };
export interface GeminiRequest { system: string; parts: GeminiPart[]; schema?: Record<string, unknown> }
export interface GeminiClient { generate(req: GeminiRequest): Promise<string> }

/** Provider failure. `transient` means retrying later may help (429, 5xx, timeout). */
export class GeminiError extends Error {
  constructor(message: string, readonly status: number | null, readonly transient: boolean) { super(message); }
}

const TIMEOUT_MS = 120_000;

/** Spaces out request starts so the whole project stays under GEMINI_MAX_RPM (the free tier is per project). */
class Pacer {
  private next = 0;
  constructor(private rpm: number) {}
  async wait() {
    const gap = 60_000 / this.rpm, now = Date.now();
    const at = Math.max(now, this.next);
    this.next = at + gap;
    if (at > now) await new Promise((r) => setTimeout(r, at - now));
  }
}

export class RealGeminiClient implements GeminiClient {
  private ai: GoogleGenAI;
  private pacer: Pacer;
  constructor(apiKey: string, private model: string, maxRpm: number) {
    this.ai = new GoogleGenAI({ apiKey });
    this.pacer = new Pacer(maxRpm);
  }

  async generate(req: GeminiRequest): Promise<string> {
    await this.pacer.wait();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const parts = req.parts.map((p) => (p.kind === "text" ? { text: p.text } : { fileData: { fileUri: p.url } }));
      const res = await this.ai.models.generateContent({
        model: this.model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: req.system,
          temperature: 0.3,
          abortSignal: ctrl.signal,
          ...(req.schema ? { responseMimeType: "application/json", responseJsonSchema: req.schema } : {}),
        },
      });
      const text = res.text;
      if (!text) throw new GeminiError("Empty model response", null, true);
      return text;
    
    } catch (e) {
      if (e instanceof GeminiError) throw e;

      if (ctrl.signal.aborted) {
        throw new GeminiError("Model request timed out", null, true);
      }

      const err = e as {
        status?: number;
        code?: number | string;
        message?: string;
        name?: string;
      };

      const status =
        typeof err.status === "number"
          ? err.status
          : typeof err.code === "number"
            ? err.code
            : null;

      // Temporary diagnostic logging. Never log the API key.
      console.error("[Gemini API error]", {
        name: err.name,
        status,
        message: err.message,
        model: this.model,
      });

      const transient =
        status === 429 ||
        (status !== null && status >= 500);

      throw new GeminiError(
        `Gemini request failed${status ? ` (${status})` : ""}: ${err.message ?? "Unknown provider error"}`,
        status,
        transient,
      );
    } finally {
      clearTimeout(timer);
    }

  }
}
