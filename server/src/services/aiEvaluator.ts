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
  expectedAnswer: string;
  testCases: string | null;
  answer: string;
};

export type Evaluation = z.infer<typeof evaluationSchema>;

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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured; round 2 was not evaluated.");
  }

  const models = [process.env.GEMINI_MODEL, "gemini-3.6-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"].filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);
  const prompt = `You are a strict programming competition evaluator.

Question: ${input.question}
Language: ${input.language}
Expected behavior: ${input.expectedAnswer}
Test cases: ${input.testCases ?? "None provided"}
Participant code:
---
${input.answer}
---

Judge whether the algorithm is logically correct and whether it produces the expected output for the test cases. Return only JSON with this exact shape:
{"syntax_errors": 0, "logical_errors": 0, "logic_correct": true, "output_correct": true, "feedback": "short explanation"}
Do not use markdown. Syntax errors cost 2 points each and logical errors cost 10 points each from a base of 25.`;

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
        if (response.status === 404 || response.status === 400) continue;
        throw new Error(lastError);
      }
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini returned an empty evaluation.");
      return evaluationSchema.parse(JSON.parse(extractJson(text)));
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(`${lastError}. Set GEMINI_MODEL to a model enabled for your API key.`);
}