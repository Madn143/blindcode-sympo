import { Router } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "../config/firebaseAdmin.js";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middleware/auth.js";
import { evaluateRound2Answer } from "../services/aiEvaluator.js";

const router = Router();
const submissionSchema = z.object({
  questionId: z.string().min(1),
  errorLine: z.string().trim().min(1),
  correctedLine: z.string().trim().min(1),
  description: z.string().trim().min(1),
});
const round2Schema = z.object({ questionId: z.string().min(1), answer: z.string().trim().min(1) });
const settingsRef = db.collection("event_settings").doc("current");

function normalizeCode(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

router.get("/event", async (_request, response) => {
  try {
    const snapshot = await settingsRef.get();
    response.json(snapshot.exists ? snapshot.data() : {
      round1Started: false,
      round2Started: false,
      round1Finished: false,
      round2Finished: false,
    });
  } catch (error) {
    console.error("Failed to load event settings", error);
    response.status(500).json({ error: "Unable to load event settings." });
  }
});

router.put("/profile", requireAuth, async (request: AuthenticatedRequest, response) => {
  const parsed = z.object({ name: z.string().trim().min(1), collegeName: z.string().trim().min(1) }).safeParse(request.body);
  if (!parsed.success || !request.user) {
    response.status(400).json({ error: "Name and college are required." });
    return;
  }

  try {
    await db.collection("users").doc(request.user.uid).set({
      ...parsed.data,
      email: request.user.email ?? null,
      role: request.user.role === "admin" ? "admin" : "user",
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    response.status(201).json(parsed.data);
  } catch (error) {
    console.error("Failed to save user profile", error);
    response.status(500).json({ error: "Unable to save profile." });
  }
});

router.get("/questions/:round", requireAuth, async (request, response) => {
  const collection = request.params.round === "round1" ? "round1_questions" :
    request.params.round === "round2" ? "round2_questions" : null;
  if (!collection) {
    response.status(400).json({ error: "Round must be round1 or round2." });
    return;
  }

  try {
    const snapshot = await db.collection(collection).orderBy("questionNo").get();
    response.json(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
  } catch (error) {
    console.error("Failed to load questions", error);
    response.status(500).json({ error: "Unable to load questions." });
  }
});

router.post("/submissions/round1", requireAuth, async (request: AuthenticatedRequest, response) => {
  const parsed = submissionSchema.safeParse(request.body);
  if (!parsed.success || !request.user) {
    response.status(400).json({ error: "Invalid round 1 submission." });
    return;
  }

  try {
    const questionSnapshot = await db.collection("round1_questions").doc(parsed.data.questionId).get();
    if (!questionSnapshot.exists) {
      response.status(404).json({ error: "Round 1 question not found." });
      return;
    }

    const question = questionSnapshot.data()!;
    const score = (parsed.data.errorLine.trim() === String(question.correctLine).trim() ? 5 : 0) +
      (normalizeCode(parsed.data.correctedLine) === normalizeCode(String(question.correctedLine)) ? 5 : 0);
    const answerRef = db.collection("round1_answers").doc(`${request.user.uid}_${parsed.data.questionId}`);
    await answerRef.set({ ...parsed.data, userId: request.user.uid, score, submittedAt: FieldValue.serverTimestamp() }, { merge: true });
    response.status(201).json({ score });
  } catch (error) {
    console.error("Failed to submit round 1 answer", error);
    response.status(500).json({ error: "Unable to save round 1 submission." });
  }
});

router.post("/submissions/round2", requireAuth, async (request: AuthenticatedRequest, response) => {
  const parsed = round2Schema.safeParse(request.body);
  if (!parsed.success || !request.user) {
    response.status(400).json({ error: "Invalid round 2 submission." });
    return;
  }

  try {
    const settingsSnapshot = await settingsRef.get();
    if (settingsSnapshot.data()?.round2Started !== true) {
      response.status(409).json({ error: "Round 2 has not been started by the administrator." });
      return;
    }

    const questionSnapshot = await db.collection("round2_questions").doc(parsed.data.questionId).get();
    if (!questionSnapshot.exists) {
      response.status(404).json({ error: "Round 2 question not found." });
      return;
    }

    const answerRef = db.collection("round2_answers").doc(`${request.user.uid}_${parsed.data.questionId}`);
    await answerRef.set({
      userId: request.user.uid,
      questionId: parsed.data.questionId,
      answer: parsed.data.answer,
      evaluated: false,
      aiFeedback: null,
      submittedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const question = questionSnapshot.data()!;
    let evaluation;
    try {
      evaluation = await evaluateRound2Answer({
        question: String(question.question),
        language: String(question.language),
        expectedAnswer: String(question.expectedAnswer),
        testCases: question.testCases ? String(question.testCases) : null,
        answer: parsed.data.answer,
      });
    } catch (error) {
      console.error("Round 2 AI evaluation failed", error);
      response.status(503).json({ error: error instanceof Error ? error.message : "Round 2 evaluation failed." });
      return;
    }

    const syntaxPenalty = evaluation.syntax_errors * 2;
    const logicalPenalty = evaluation.logical_errors * 10;
    const score = Math.max(0, 25 - syntaxPenalty - logicalPenalty);
    await answerRef.update({
      syntaxErrors: evaluation.syntax_errors,
      logicalErrors: evaluation.logical_errors,
      syntaxPenalty,
      logicalPenalty,
      score,
      aiFeedback: evaluation.feedback,
      evaluated: true,
      evaluatedAt: Timestamp.now(),
    });
    response.status(201).json({ score, ...evaluation, syntaxPenalty, logicalPenalty, evaluated: true });
  } catch (error) {
    console.error("Failed to submit round 2 answer", error);
    response.status(500).json({ error: "Unable to save round 2 submission." });
  }
});

router.get("/admin/event", requireAuth, requireRole("admin"), async (_request, response) => {
  try {
    const snapshot = await settingsRef.get();
    response.json(snapshot.data() ?? {});
  } catch (error) {
    console.error("Failed to load admin settings", error);
    response.status(500).json({ error: "Unable to load event settings." });
  }
});

router.patch("/admin/event", requireAuth, requireRole("admin"), async (request, response) => {
  const parsed = z.object({
    round1Started: z.boolean().optional(), round2Started: z.boolean().optional(),
    round1Finished: z.boolean().optional(), round2Finished: z.boolean().optional(),
  }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid event settings." });
    return;
  }

  try {
    await settingsRef.set({ ...parsed.data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    response.json({ ...parsed.data });
  } catch (error) {
    console.error("Failed to update event settings", error);
    response.status(500).json({ error: "Unable to update event settings." });
  }
});

export default router;