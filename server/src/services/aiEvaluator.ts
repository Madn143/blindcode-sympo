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

export async function evaluateRound2Answer(input: EvaluationInput): Promise<Evaluation> {
  const apiKeys = process.env.GEMINI_API_KEY?.split(",").map(k => k.trim()).filter(Boolean);
  if (!apiKeys || apiKeys.length === 0) {
    throw new Error("GEMINI_API_KEY is not configured; round 2 was not evaluated.");
  }
  const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

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
  const apiKeys = process.env.GEMINI_API_KEY?.split(",").map(k => k.trim()).filter(Boolean);
  if (!apiKeys || apiKeys.length === 0) {
    throw new Error("GEMINI_API_KEY is not configured; round 1 was not evaluated.");
  }
  const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];

  const models = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-3.6-flash"].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);
  const prompt = `You are a strict programming competition evaluator grading a code debugging round.

Original Buggy Code:
---
${input.code}
---

Expected Corrected Line: ${input.expectedLine}
Expected Explanation: ${input.expectedDescription}

Participant's Submitted Line: ${input.participantLine}
Participant's Submitted Explanation: ${input.participantDescription}

Evaluate the participant's submission out of 10 total marks.
- Up to 7 marks for the corrected line. Award 7 marks ONLY if the code completely fixes the bug and is 100% syntactically valid in C.
  CRITICAL: If the code still contains a syntax error (like a missing semicolon), award 0 marks for this section. Do NOT give partial credit for missing semicolons.
- Up to 3 marks for the explanation. Award 3 marks ONLY if they correctly identify the root cause of the error. If the explanation is empty or irrelevant, award 0 marks for this section.

Return only JSON with this exact shape:
{"score": 0, "feedback": "short explanation"}
Do not use markdown.`;

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
        if (response.status === 404 || (response.status === 400 && !payload.error?.message?.includes("API key"))) continue;
        throw new Error(lastError);
      }
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini returned an empty evaluation.");
      const parsed = round1EvaluationSchema.parse(JSON.parse(extractJson(text)));
      console.log(`[Round1 Eval] model=${model} score=${parsed.score} feedback="${parsed.feedback}"`);
      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(`${lastError}. Set GEMINI_MODEL to a model enabled for your API key.`);
}