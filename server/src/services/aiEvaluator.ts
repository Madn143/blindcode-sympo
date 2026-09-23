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
const groqCooldowns = new Map<string, number>();

function getAvailableKey(keys: string[]): { key: string; waitMs: number } {
  const now = Date.now();
  for (const key of keys) {
    const coolUntil = keyCooldowns.get(key) ?? 0;
    if (now >= coolUntil) return { key, waitMs: 0 };
  }
  let soonestKey = keys[0];
  let soonestTime = keyCooldowns.get(keys[0]) ?? 0;
  for (const key of keys) {
    const coolUntil = keyCooldowns.get(key) ?? 0;
    if (coolUntil < soonestTime) { soonestKey = key; soonestTime = coolUntil; }
  }
  return { key: soonestKey, waitMs: Math.max(0, soonestTime - now) };
}

function getAvailableGroqKey(keys: string[]): string | null {
  const now = Date.now();
  // Try to find an available (non-cooling) key, shuffled for load balancing
  const shuffled = [...keys].sort(() => Math.random() - 0.5);
  for (const key of shuffled) {
    const coolUntil = groqCooldowns.get(key) ?? 0;
    if (now >= coolUntil) return key;
  }
  return null; // All Groq keys are cooling — fall back to Gemini
}

function parseRetryAfterMs(errorMessage: string): number {
  const match = errorMessage.match(/Please retry in ([0-9.]+)s/);
  if (match) return (parseFloat(match[1]) + 2) * 1000;
  return 65000;
}


export async function evaluateRound2Answer(input: EvaluationInput): Promise<Evaluation> {
  const apiKeys = process.env.GEMINI_API_KEY?.split(",").map(k => k.trim()).filter(Boolean);
  const groqKeys = process.env.GROQ_API_KEY?.split(",").map(k => k.trim()).filter(Boolean) ?? [];

  const prompt = `You are a programming competition judge evaluating a student's code submission for a BLIND CODING event (students type without seeing the screen, so minor formatting differences are expected).

Question / Task: ${input.question}
${input.starterCode ? `Reference / Starter Code (${input.language}):\n---\n${input.starterCode}\n---\n` : ""}What the correct solution should accomplish (logic description): ${input.expectedAnswer}

Student's submitted code:
---
${input.answer}
---

Your job is to judge LOGIC and SYNTAX only:

SYNTAX ERRORS (each costs 2 marks):
- Unclosed parentheses, brackets, or braces
- Unclosed string literals
- Missing semicolons in C/C++/Java/JavaScript where required
- Using 'return' outside a function
- Truly broken syntax that prevents compilation/execution
- DO NOT count indentation as a syntax error (students type blind)
- DO NOT count missing colons if they are clearly present in the code

LOGICAL ERRORS (each costs 10 marks):
- Wrong algorithm or mathematical approach
- The code cannot produce the correct result for any input
- Completely missing the required logic

CRITICAL RULES:
- Accept ANY programming language
- DO NOT penalise for output string casing differences (e.g. "even" vs "Even" is NOT an error)
- DO NOT penalise for extra print statements or minor formatting
- DO NOT compare against the exact wording of expected output — judge whether the ALGORITHM is correct
- If the logic is fundamentally correct, set logical_errors=0 even if output formatting differs
- If the submission is completely empty or clearly not an attempt, set logical_errors=10

Scoring: start from 25, subtract (syntax_errors * 2) + (logical_errors * 10). Minimum score is 0.

Return ONLY a JSON object (no markdown):
{"syntax_errors": 0, "logical_errors": 0, "logic_correct": true, "output_correct": true, "feedback": "Brief feedback on the logic and any real errors found."}`;

  // --- Try Groq FIRST (faster, higher limits, smart key rotation) ---
  if (groqKeys.length > 0) {
    const groqKey = getAvailableGroqKey(groqKeys);
    if (groqKey) {
      try {
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: "qwen/qwen3.8-27b",
            messages: [{ role: "user", content: prompt }],
            temperature: 0,
            max_tokens: 250,
          }),
          signal: AbortSignal.timeout(30_000),
        });
        const groqPayload = await groqResponse.json() as any;
        if (groqResponse.ok && groqPayload.choices?.[0]?.message?.content) {
          const r2parsed = evaluationSchema.parse(JSON.parse(extractJson(groqPayload.choices[0].message.content)));
          console.log(`[Round2 Eval] Groq: syntax_errors=${r2parsed.syntax_errors} logical_errors=${r2parsed.logical_errors}`);
          return r2parsed;
        }
        if (groqResponse.status === 429) {
          groqCooldowns.set(groqKey, Date.now() + 65000);
          console.warn(`[Round2 Eval] Groq key rate limited, cooling for 65s, falling back to Gemini...`);
        } else {
          console.warn(`[Round2 Eval] Groq failed (${groqResponse.status}), falling back to Gemini...`);
        }
      } catch (groqError) {
        console.warn(`[Round2 Eval] Groq error, falling back to Gemini...`, groqError instanceof Error ? groqError.message : groqError);
      }
    } else {
      console.warn(`[Round2 Eval] All Groq keys cooling, falling back to Gemini...`);
    }
  }

  // --- Fallback: Gemini ---
  if (!apiKeys || apiKeys.length === 0) {
    throw new Error("No AI API keys configured; round 2 was not evaluated.");
  }
  const { key: apiKey, waitMs } = getAvailableKey(apiKeys);
  if (waitMs > 0) {
    console.log(`[Round2 Eval] All Gemini keys cooling, waiting ${Math.ceil(waitMs/1000)}s for soonest key...`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  const models = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-3.6-flash"].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);
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
  const normalize = (s: string) => s.replace(/\s/g, "").toLowerCase();
  const codeScore = normalize(input.participantLine) === normalize(input.expectedLine) ? 7 : 0;
  console.log(`[Round1 Eval] Code score: ${codeScore}/7 (local comparison)`);

  // --- STEP 2: Gemini call ONLY for explanation (3 marks) ---
  // Skip API call if explanation is empty
  if (!input.participantDescription || input.participantDescription.trim().length < 3) {
    const totalScore = codeScore + 0;
    return { score: totalScore, feedback: codeScore === 7 ? "Correct fix! No explanation provided." : "Incorrect fix and no explanation." };
  }

  const apiKeys = process.env.GEMINI_API_KEY?.split(",").map(k => k.trim()).filter(Boolean);
  const groqKeys = process.env.GROQ_API_KEY?.split(",").map(k => k.trim()).filter(Boolean) ?? [];

  const explanationPrompt = `You are grading a programming competition answer. Award 0, 1, 2 or 3 marks for the explanation.

Expected explanation: ${input.expectedDescription}
Student's explanation: ${input.participantDescription}

Award 3 marks if the student correctly identifies the root cause of the bug.
Award 1-2 marks for a partially correct explanation.
Award 0 marks if the explanation is irrelevant or wrong.

Return ONLY JSON: {"explanation_score": 0, "feedback": "one sentence"}`;

  // --- Try Groq FIRST (10x faster, smart key rotation) ---
  if (groqKeys.length > 0) {
    const groqKey = getAvailableGroqKey(groqKeys);
    if (groqKey) {
      try {
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: "qwen/qwen3.8-27b",
            messages: [{ role: "user", content: explanationPrompt }],
            temperature: 0,
            max_tokens: 150,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        const groqPayload = await groqResponse.json() as any;
        if (groqResponse.ok && groqPayload.choices?.[0]?.message?.content) {
          const raw = JSON.parse(extractJson(groqPayload.choices[0].message.content));
          const explanationScore = Math.min(3, Math.max(0, Number(raw.explanation_score ?? 0)));
          const totalScore = codeScore + explanationScore;
          console.log(`[Round1 Eval] Groq: codeScore=${codeScore} explanationScore=${explanationScore} total=${totalScore}`);
          return { score: totalScore, feedback: `Code (${codeScore}/7): ${codeScore === 7 ? "Correct fix." : "Incorrect fix."} Explanation (${explanationScore}/3): ${raw.feedback ?? ""}` };
        }
        if (groqResponse.status === 429) {
          groqCooldowns.set(groqKey, Date.now() + 65000);
          console.warn(`[Round1 Eval] Groq key rate limited, cooling for 65s, trying next key or falling back to Gemini...`);
        } else {
          console.warn(`[Round1 Eval] Groq failed (${groqResponse.status}), falling back to Gemini...`);
        }
      } catch (groqError) {
        console.warn(`[Round1 Eval] Groq error, falling back to Gemini...`, groqError instanceof Error ? groqError.message : groqError);
      }
    } else {
      console.warn(`[Round1 Eval] All Groq keys cooling, falling back to Gemini...`);
    }
  }

  // --- Fallback: Gemini ---
  if (!apiKeys || apiKeys.length === 0) {
    return { score: codeScore, feedback: codeScore === 7 ? "Correct fix! (Explanation not evaluated — no API key configured)" : "Incorrect fix." };
  }
  const { key: apiKey, waitMs } = getAvailableKey(apiKeys);
  if (waitMs > 0) {
    console.log(`[Round1 Eval] All Gemini keys cooling, waiting ${Math.ceil(waitMs/1000)}s for soonest key...`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  const models = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-3.6-flash"].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);


  let lastError = "Gemini returned no usable evaluation.";
  // Try each API key independently — stop on 429 and move to next key
  for (const tryKey of apiKeys) {
    const coolUntil = keyCooldowns.get(tryKey) ?? 0;
    if (Date.now() < coolUntil) continue; // Skip cooling keys

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(tryKey)}`,
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
            // Mark this key as cooling and immediately try the next key
            keyCooldowns.set(tryKey, Date.now() + parseRetryAfterMs(payload.error?.message ?? ""));
            break; // Break model loop → try next key
          }
          if (response.status === 404 || (response.status === 400 && !payload.error?.message?.includes("API key"))) continue;
          break; // Other errors → try next key
        }
        const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Gemini returned an empty evaluation.");
        const raw = JSON.parse(extractJson(text));
        const explanationScore = Math.min(3, Math.max(0, Number(raw.explanation_score ?? 0)));
        const totalScore = codeScore + explanationScore;
        const feedback = raw.feedback ?? "";
        console.log(`[Round1 Eval] key=...${tryKey.slice(-6)} model=${model} codeScore=${codeScore} explanationScore=${explanationScore} total=${totalScore}`);
        return { score: totalScore, feedback: `Code (${codeScore}/7): ${codeScore === 7 ? "Correct fix." : "Incorrect fix."} Explanation (${explanationScore}/3): ${feedback}` };
      } catch (error) {
        lastError = error instanceof Error ? error.message : lastError;
      }
    }
  }
  // All keys exhausted — still return code score so student isn't penalised
  console.warn(`[Round1 Eval] Explanation API failed (reason: ${lastError}), returning code score only: ${codeScore}/7`);
  return { score: codeScore, feedback: codeScore === 7 ? "Correct fix! (Explanation could not be evaluated due to API issues.)" : "Incorrect fix. (Explanation could not be evaluated due to API issues.)" };
}