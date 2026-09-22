import { z } from "zod";

const evaluationSchema = z.object({
  syntax_errors: z.number().int().min(0),
  logical_errors: z.number().int().min(0),
  logic_correct: z.boolean(),
  output_correct: z.boolean(),
  feedback: z.string().min(1),
});

type EvaluationInput = {
  question: string;
  language: string;
  starterCode?: string;
  expectedAnswer: string;
  testCases: string | null;
  answer: string;
};

export type Evaluation = z.infer<typeof evaluationSchema>;

const round1EvaluationSchema = z.object({
  score: z.number().int().min(0).max(10),
  feedback: z.string().min(1),
});

type Round1EvaluationInput = {
  code: string;
  expectedLine: string;
  expectedDescription: string;
  participantLine: string;
  participantDescription: string;
};

export type Round1Evaluation = z.infer<typeof round1EvaluationSchema>;

function extractJson(text: string) {
  const withoutFence = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const objectStart = withoutFence.indexOf("{");
  const objectEnd = withoutFence.lastIndexOf("}");

  if (objectStart < 0 || objectEnd < objectStart) {
    throw new Error("Gemini returned no JSON evaluation object.");
  }

  return withoutFence.slice(objectStart, objectEnd + 1);
}

// Smart key cooldown tracker — marks a key as cooling and picks the best available one
const keyCooldowns = new Map<string, number>();

function getAvailableKey(keys: string[]): { key: string; waitMs: number } {
  const now = Date.now();
  // Find a key that is not cooling down
  for (const key of keys) {
    const coolUntil = keyCooldowns.get(key) ?? 0;
    if (now >= coolUntil) return { key, waitMs: 0 };
  }
  // All keys are cooling — pick the one that cools down soonest
  let soonestKey = keys[0];
  let soonestTime = keyCooldowns.get(keys[0]) ?? 0;
  for (const key of keys) {
    const coolUntil = keyCooldowns.get(key) ?? 0;
    if (coolUntil < soonestTime) { soonestKey = key; soonestTime = coolUntil; }
  }
  return { key: soonestKey, waitMs: Math.max(0, soonestTime - now) };
}

function parseRetryAfterMs(errorMessage: string): number {
  const match = errorMessage.match(/Please retry in ([0-9.]+)s/);
  if (match) return (parseFloat(match[1]) + 2) * 1000; // add 2s buffer
  return 65000; // default 65 second fallback
}


export async function evaluateRound2Answer(input: EvaluationInput): Promise<Evaluation> {
  const apiKeys = process.env.GEMINI_API_KEY?.split(",").map(k => k.trim()).filter(Boolean);
  if (!apiKeys || apiKeys.length === 0) {
    throw new Error("GEMINI_API_KEY is not configured; round 2 was not evaluated.");
  }
  const { key: apiKey, waitMs } = getAvailableKey(apiKeys);
  if (waitMs > 0) {
    console.log(`[Round2 Eval] All keys cooling, waiting ${Math.ceil(waitMs/1000)}s for soonest key...`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  const models = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-3.6-flash"].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);
  const prompt = `You are an extremely strict and unforgiving programming competition judge evaluating a student's code submission.

Question / Task: ${input.question}
${input.starterCode ? `Reference / Starter Code (${input.language}):\n---\n${input.starterCode}\n---\n` : ""}What a correct solution should do: ${input.expectedAnswer}

Student's submitted code:
---
${input.answer}
---

Your job is to act like a compiler and a strict logic judge:
1. Identify the programming language the student used (any language is acceptable).
2. Look for SYNTAX ERRORS (e.g., missing colons in Python, missing quotes, unclosed parentheses, missing semicolons in C/JS, indentation errors, using 'return' outside a function). EVERY SINGLE syntax error costs 2 marks. Be extremely strict. If it won't compile or run, you MUST count the syntax errors!
3. Look for LOGICAL ERRORS (wrong algorithm, wrong mathematical approach, incorrect result). Each logical error costs 10 marks.
4. Judge whether the student's approach correctly solves the described problem.

Scoring: start from 25, subtract (syntax_errors * 2) + (logical_errors * 10). Minimum score is 0.

CRITICAL RULES:
- Accept ANY programming language. Do NOT penalise for using a different language.
- DO NOT be lenient on syntax. If a colon is missing in Python (e.g., 'else' instead of 'else:'), that is a syntax error. If a string is unclosed (e.g., "Even), that is a syntax error.
- If the code contains syntax errors that would prevent it from running, you MUST count them in 'syntax_errors'.
- If the submission is completely empty or clearly not an attempt, set syntax_errors=0, logical_errors=10.
- Do NOT penalise for style or variable naming.

Return ONLY a JSON object with this exact shape (no markdown):
{"syntax_errors": 0, "logical_errors": 0, "logic_correct": true, "output_correct": true, "feedback": "Strict feedback on what is broken, especially pointing out syntax errors if any."}`;
  let lastError = "Gemini returned no usable evaluation.";
  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(60_000),
        }
      );
      const payload = (await response.json()) as { error?: { message?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      if (!response.ok || payload.error) {
        lastError = `Gemini API error (${model}): ${payload.error?.message ?? response.statusText}`;
        if (response.status === 429) {
          keyCooldowns.set(apiKey, Date.now() + parseRetryAfterMs(payload.error?.message ?? ""));
          throw new Error(lastError);
        }
        if (response.status === 404 || (response.status === 400 && !payload.error?.message?.includes("API key"))) continue;
        throw new Error(lastError);
      }
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini returned an empty evaluation.");
      const r2parsed = evaluationSchema.parse(JSON.parse(extractJson(text)));
      console.log(`[Round2 Eval] model=${model} syntax_errors=${r2parsed.syntax_errors} logical_errors=${r2parsed.logical_errors} feedback="${r2parsed.feedback}"`);
      return r2parsed;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(`${lastError}. Set GEMINI_MODEL to a model enabled for your API key.`);
}

export async function evaluateRound1Answer(input: Round1EvaluationInput): Promise<Round1Evaluation> {
  // --- STEP 1: Instant local code comparison (7 marks, zero API calls) ---
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const codeScore = normalize(input.participantLine) === normalize(input.expectedLine) ? 7 : 0;
  console.log(`[Round1 Eval] Code score: ${codeScore}/7 (local comparison)`);

  // --- STEP 2: Gemini call ONLY for explanation (3 marks) ---
  // Skip API call if explanation is empty
  if (!input.participantDescription || input.participantDescription.trim().length < 3) {
    const totalScore = codeScore + 0;
    return { score: totalScore, feedback: codeScore === 7 ? "Correct fix! No explanation provided." : "Incorrect fix and no explanation." };
  }

  const apiKeys = process.env.GEMINI_API_KEY?.split(",").map(k => k.trim()).filter(Boolean);
  if (!apiKeys || apiKeys.length === 0) {
    // If no API key, just skip explanation marks
    return { score: codeScore, feedback: codeScore === 7 ? "Correct fix! (Explanation not evaluated — no API key configured)" : "Incorrect fix." };
  }
  const { key: apiKey, waitMs } = getAvailableKey(apiKeys);
  if (waitMs > 0) {
    console.log(`[Round1 Eval] All keys cooling, waiting ${Math.ceil(waitMs/1000)}s for soonest key...`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  const models = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-3.6-flash"].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);

  // Minimal prompt — just grade the explanation out of 3
  const explanationPrompt = `You are grading a programming competition answer. Award 0, 1, 2 or 3 marks for the explanation.

Expected explanation: ${input.expectedDescription}
Student's explanation: ${input.participantDescription}

Award 3 marks if the student correctly identifies the root cause of the bug.
Award 1-2 marks for a partially correct explanation.
Award 0 marks if the explanation is irrelevant or wrong.

Return ONLY JSON: {"explanation_score": 0, "feedback": "one sentence"}`;

  let lastError = "Gemini returned no usable evaluation.";
  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: explanationPrompt }] }],
            generationConfig: { temperature: 0, responseMimeType: "application/json" },
          }),
          signal: AbortSignal.timeout(30_000),
        }
      );
      const payload = (await response.json()) as { error?: { message?: string }; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      if (!response.ok || payload.error) {
        lastError = `Gemini API error (${model}): ${payload.error?.message ?? response.statusText}`;
        if (response.status === 429) {
          keyCooldowns.set(apiKey, Date.now() + parseRetryAfterMs(payload.error?.message ?? ""));
          throw new Error(lastError);
        }
        if (response.status === 404 || (response.status === 400 && !payload.error?.message?.includes("API key"))) continue;
        throw new Error(lastError);
      }
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini returned an empty evaluation.");
      const raw = JSON.parse(extractJson(text));
      const explanationScore = Math.min(3, Math.max(0, Number(raw.explanation_score ?? 0)));
      const totalScore = codeScore + explanationScore;
      const feedback = raw.feedback ?? "";
      console.log(`[Round1 Eval] model=${model} codeScore=${codeScore} explanationScore=${explanationScore} total=${totalScore}`);
      return { score: totalScore, feedback: `Code (${codeScore}/7): ${codeScore === 7 ? "Correct fix." : "Incorrect fix."} Explanation (${explanationScore}/3): ${feedback}` };
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  // If Gemini fails for explanation, still return the code score
  console.warn(`[Round1 Eval] Explanation API failed, returning code score only: ${codeScore}/7`);
  return { score: codeScore, feedback: codeScore === 7 ? "Correct fix! (Explanation could not be evaluated due to API issues.)" : "Incorrect fix. (Explanation could not be evaluated due to API issues.)" };
}