import { Router } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "../config/firebaseAdmin.js";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middleware/auth.js";
import { evaluateRound1Answer, evaluateRound2Answer } from "../services/aiEvaluator.js";

const router = Router();
const submissionSchema = z.object({
  questionId: z.string().min(1),
  correctedLine: z.string().trim().min(1),
  description: z.string().trim().min(1),
});
const round2Schema = z.object({ questionId: z.string().min(1), answer: z.string().trim().min(1) });
const settingsRef = db.collection("event_settings").doc("current");

function normalizeCode(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
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

router.get("/questions/:round", requireAuth, async (request: AuthenticatedRequest, response) => {
  const collection = request.params.round === "round1" ? "round1_questions" :
    request.params.round === "round2" ? "round2_questions" : null;
  if (!collection) {
    response.status(400).json({ error: "Round must be round1 or round2." });
    return;
  }

  try {
    const snapshot = await db.collection(collection).orderBy("questionNo").get();
    const questions: Array<{ id: string; questionNo?: number; [key: string]: unknown }> = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    const seed = Array.from(String(request.user?.uid ?? "")).reduce((total, character) => total + character.charCodeAt(0), 0) + new Date().getUTCFullYear();
    questions.sort((left, right) => ((seed * Number(left.questionNo ?? 0) + 17) % 997) - ((seed * Number(right.questionNo ?? 0) + 17) % 997));
    response.json(questions);
  } catch (error) {
    console.error("Failed to load questions", error);
    response.status(500).json({ error: "Unable to load questions." });
  }
});

router.get("/me/event", requireAuth, async (request: AuthenticatedRequest, response) => {
  if (!request.user) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const [settingsSnapshot, profileSnapshot, round1Snapshot, round2Snapshot] = await Promise.all([
      settingsRef.get(),
      db.collection("users").doc(request.user.uid).get(),
      db.collection("round1_answers").where("userId", "==", request.user.uid).get(),
      db.collection("round2_answers").where("userId", "==", request.user.uid).get(),
    ]);
    const round1Answers: Array<{ id: string; score?: number; [key: string]: unknown }> = round1Snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    const round2Answers: Array<{ id: string; score?: number; [key: string]: unknown }> = round2Snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    
    const settingsData = settingsSnapshot.data() ?? { round1Started: true, round2Started: false, round1Finished: false, round2Finished: false };
    
    // Scrub scores if rounds are not finished
    const scrubAnswer = (answer: any, isFinished: boolean) => {
      if (isFinished) return answer;
      const { score, feedback, aiFeedback, syntaxErrors, logicalErrors, logicCorrect, outputCorrect, syntaxPenalty, logicalPenalty, ...rest } = answer;
      return rest;
    };

    const r1Answers = round1Answers.map(a => scrubAnswer(a, settingsData.round1Finished === true));
    const r2Answers = round2Answers.map(a => scrubAnswer(a, settingsData.round2Finished === true));

    const round1Score = settingsData.round1Finished === true ? round1Answers.reduce((total, answer) => total + Math.max(0, Number(answer.score ?? 0)), 0) : 0;
    const round2Score = settingsData.round2Finished === true ? round2Answers.reduce((total, answer) => total + Math.max(0, Number(answer.score ?? 0)), 0) : 0;

    response.json({
      settings: settingsData,
      profile: profileSnapshot.data() ?? { name: request.user.email ?? "Participant", collegeName: "" },
      round1Answers: r1Answers,
      round2Answers: r2Answers,
      scores: { round1: round1Score, round2: round2Score, total: round1Score + round2Score },
    });
  } catch (error) {
    console.error("Failed to load participant event", error);
    response.status(500).json({ error: "Unable to load participant event." });
  }
});

router.post("/submissions/round1", requireAuth, async (request: AuthenticatedRequest, response) => {
  const parsed = submissionSchema.safeParse(request.body);
  if (!parsed.success || !request.user) {
    response.status(400).json({ error: "Invalid round 1 submission." });
    return;
  }

  try {
    console.log(`[Round1 Submit] questionId=${parsed.data.questionId} correctedLine="${parsed.data.correctedLine}"`);
    const questionSnapshot = await db.collection("round1_questions").doc(parsed.data.questionId).get();
    if (!questionSnapshot.exists) {
      response.status(404).json({ error: "Round 1 question not found." });
      return;
    }

    const question = questionSnapshot.data()!;
    // 1. SAVE IMMEDIATELY to prevent data loss and give instant feedback
    const answerRef = db.collection("round1_answers").doc(`${request.user.uid}_${parsed.data.questionId}`);
    await answerRef.set({ 
      ...parsed.data, 
      userId: request.user.uid, 
      score: -1, // -1 indicates pending evaluation
      feedback: "Evaluation pending...",
      submittedAt: FieldValue.serverTimestamp() 
    }, { merge: true });

    // 2. RETURN INSTANTLY to the frontend
    response.status(201).json({ submitted: true });

    // 3. EVALUATE IN BACKGROUND — two phases
    (async () => {
      // Phase 1: Save code score INSTANTLY (no API needed)
      const normalize = (s: string) => s.replace(/\s/g, "").toLowerCase();
      const codeScore = normalize(parsed.data.correctedLine) === normalize(String(question.correctedLine)) ? 7 : 0;
      await answerRef.set({
        score: codeScore,
        feedback: codeScore === 7 ? "Code correct! Explanation being evaluated..." : "Code incorrect. Explanation being evaluated...",
      }, { merge: true });
      console.log(`[Background Eval] Phase 1 done — code score ${codeScore}/7 saved instantly for question ${parsed.data.questionId}`);

      // Phase 2: Retry explanation scoring until API succeeds (could take minutes if quota is hit)
      if (!parsed.data.description || parsed.data.description.trim().length < 3) {
        await answerRef.set({ feedback: codeScore === 7 ? "Code correct! No explanation provided." : "Code incorrect. No explanation provided." }, { merge: true });
        return;
      }
      let explanationDone = false;
      while (!explanationDone) {
        try {
          const evaluation = await evaluateRound1Answer({
            code: String(question.code),
            expectedLine: String(question.correctedLine),
            expectedDescription: String(question.description),
            participantLine: parsed.data.correctedLine,
            participantDescription: parsed.data.description,
          });
          // Only update if explanation actually got evaluated (not just code fallback)
          if (evaluation.feedback.includes("Explanation could not be evaluated")) {
            console.log(`[Background Eval] Explanation still failing for ${parsed.data.questionId}, retrying in 65s...`);
            await new Promise(resolve => setTimeout(resolve, 65000));
          } else {
            await answerRef.set({ score: evaluation.score, feedback: evaluation.feedback }, { merge: true });
            console.log(`[Background Eval] Phase 2 done — full score ${evaluation.score}/10 saved for question ${parsed.data.questionId}`);
            explanationDone = true;
          }
        } catch (e: any) {
          console.error(`[Background Eval] Phase 2 error for ${parsed.data.questionId}, retrying in 65s...`, e.message);
          await new Promise(resolve => setTimeout(resolve, 65000));
        }
      }
    })();

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

  const MAX_ATTEMPTS = 2;

  try {
    const settingsSnapshot = await settingsRef.get();
    const profileSnapshot = await db.collection("users").doc(request.user.uid).get();
    const settings = settingsSnapshot.data();
    if (settings?.round2Started !== true) {
      response.status(409).json({ error: "Round 2 has not been started by the administrator." });
      return;
    }
    if (profileSnapshot.data()?.round1Qualified !== true) {
      response.status(403).json({ error: "You must pass Round 1 before entering Round 2." });
      return;
    }

    // Check timer has not expired
    if (settings?.round2StartedAt && settings?.round2DurationMinutes) {
      const elapsed = (Date.now() - settings.round2StartedAt) / 60000;
      if (elapsed > settings.round2DurationMinutes) {
        response.status(409).json({ error: "Round 2 time has expired. No more submissions are allowed." });
        return;
      }
    }

    const questionSnapshot = await db.collection("round2_questions").doc(parsed.data.questionId).get();
    if (!questionSnapshot.exists) {
      response.status(404).json({ error: "Round 2 question not found." });
      return;
    }

    const answerRef = db.collection("round2_answers").doc(`${request.user.uid}_${parsed.data.questionId}`);
    const existingAnswer = await answerRef.get();
    const currentCount = Number(existingAnswer.data()?.submissionCount ?? 0);

    if (currentCount >= MAX_ATTEMPTS) {
      response.status(409).json({ error: `Maximum ${MAX_ATTEMPTS} submissions per question reached.` });
      return;
    }

    const question = questionSnapshot.data()!;
    let evaluation;
    try {
      evaluation = await evaluateRound2Answer({
        question: String(question.question),
        language: String(question.language),
        starterCode: question.starterCode ? String(question.starterCode) : undefined,
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
    
    // Save the submission only AFTER a successful evaluation
    await answerRef.set({
      userId: request.user.uid,
      questionId: parsed.data.questionId,
      answer: parsed.data.answer,
      submissionCount: currentCount + 1,
      submittedAt: FieldValue.serverTimestamp(),
      syntaxErrors: evaluation.syntax_errors,
      logicalErrors: evaluation.logical_errors,
      syntaxPenalty,
      logicalPenalty,
      score,
      aiFeedback: evaluation.feedback,
      logicCorrect: evaluation.logic_correct,
      outputCorrect: evaluation.output_correct,
      evaluated: true,
      evaluatedAt: Timestamp.now(),
    }, { merge: true });
    // Hide score details until round is finished — only reveal attempt count
    const round2Finished = settings?.round2Finished === true;
    response.status(201).json({
      submitted: true,
      submissionCount: currentCount + 1,
      maxAttempts: MAX_ATTEMPTS,
      ...(round2Finished ? { score, ...evaluation, syntaxPenalty, logicalPenalty, evaluated: true } : {}),
    });
  } catch (error) {
    console.error("Failed to submit round 2 answer", error);
    response.status(500).json({ error: "Unable to save round 2 submission." });
  }
});


router.post("/submissions/round1/complete", requireAuth, async (request: AuthenticatedRequest, response) => {
  if (!request.user) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const [questionsSnapshot, answersSnapshot] = await Promise.all([
      db.collection("round1_questions").get(),
      db.collection("round1_answers").where("userId", "==", request.user.uid).get(),
    ]);
    const requiredQuestionIds = new Set(questionsSnapshot.docs.map((question) => question.id));
    const answers = answersSnapshot.docs.map((answer) => answer.data());
    const answeredQuestionIds = new Set(answers.map((answer) => String(answer.questionId)));
    if (answeredQuestionIds.size < requiredQuestionIds.size || [...requiredQuestionIds].some((id) => !answeredQuestionIds.has(id))) {
      response.status(409).json({ error: "Submit an answer for every Round 1 question before completing the round." });
      return;
    }
    const score = answers.reduce((total, answer) => total + Number(answer.score ?? 0), 0);
    const qualified = score > 40;
    await db.collection("users").doc(request.user.uid).set({
      round1Completed: true,
      round1Score: score,
      round1Qualified: qualified,
      round1CompletedAt: Timestamp.now(),
    }, { merge: true });
    response.json({ score, qualified, threshold: 40 });
  } catch (error) {
    console.error("Failed to complete round 1", error);
    response.status(500).json({ error: "Unable to complete Round 1." });
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

router.get("/admin/leaderboard", requireAuth, requireRole("admin"), async (_request, response) => {
  try {
    const [usersSnapshot, round1Snapshot, round2Snapshot] = await Promise.all([
      db.collection("users").get(),
      db.collection("round1_answers").get(),
      db.collection("round2_answers").get(),
    ]);
    const scores = new Map<string, { round1: number; round2: number }>();
    for (const answer of round1Snapshot.docs) {
      const data = answer.data();
      const current = scores.get(String(data.userId)) ?? { round1: 0, round2: 0 };
      current.round1 += Math.max(0, Number(data.score ?? 0));
      scores.set(String(data.userId), current);
    }
    for (const answer of round2Snapshot.docs) {
      const data = answer.data();
      const current = scores.get(String(data.userId)) ?? { round1: 0, round2: 0 };
      current.round2 += Math.max(0, Number(data.score ?? 0));
      scores.set(String(data.userId), current);
    }
    const participants = usersSnapshot.docs.map((document) => {
      const data = document.data();
      const score = scores.get(document.id) ?? { round1: 0, round2: 0 };
      return { id: document.id, name: data.name ?? data.email ?? "Participant", collegeName: data.collegeName ?? "", ...score, total: score.round1 + score.round2 };
    }).sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));
    response.json(participants);
  } catch (error) {
    console.error("Failed to load leaderboard", error);
    response.status(500).json({ error: "Unable to load leaderboard." });
  }
});

router.get("/admin/participants/:userId/answers", requireAuth, requireRole("admin"), async (request, response) => {
  try {
    const userId = String(request.params.userId);
    const [r1Snap, r2Snap, r1QSnap, r2QSnap] = await Promise.all([
      db.collection("round1_answers").where("userId", "==", userId).get(),
      db.collection("round2_answers").where("userId", "==", userId).get(),
      db.collection("round1_questions").orderBy("questionNo").get(),
      db.collection("round2_questions").orderBy("questionNo").get(),
    ]);
    const r1Map = new Map(r1Snap.docs.map(d => [d.data().questionId, d.data()]));
    const r2Map = new Map(r2Snap.docs.map(d => [d.data().questionId, d.data()]));
    const round1 = r1QSnap.docs.map((q, i) => {
      const ans = r1Map.get(q.id);
      return {
        questionNo: i + 1,
        questionId: q.id,
        correctedLine: ans?.correctedLine ?? null,
        score: ans?.score ?? null,
        feedback: ans?.feedback ?? null,
        status: !ans ? "not_answered" : ans.score === -1 ? "pending" : "evaluated",
      };
    });
    const round2 = r2QSnap.docs.map((q, i) => {
      const ans = r2Map.get(q.id);
      return {
        questionNo: i + 1,
        questionId: q.id,
        answer: ans?.answer ?? null,
        score: ans?.score ?? null,
        aiFeedback: ans?.aiFeedback ?? null,
        status: !ans ? "not_answered" : ans.evaluated ? "evaluated" : "pending",
      };
    });
    response.json({ round1, round2 });
  } catch (error) {
    console.error("Failed to load participant answers", error);
    response.status(500).json({ error: "Unable to load participant answers." });
  }
});

router.get("/admin/qualifiers", requireAuth, requireRole("admin"), async (_request, response) => {
  try {
    const snapshot = await db.collection("users").where("round1Qualified", "==", true).get();
    response.json(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
  } catch (error) {
    console.error("Failed to load Round 1 qualifiers", error);
    response.status(500).json({ error: "Unable to load Round 1 qualifiers." });
  }
});

const round1QuestionUpdate = z.object({
  questionNo: z.number().int().positive().optional(), language: z.string().trim().min(1).optional(),
  code: z.string().optional(), correctedLine: z.string().optional(), description: z.string().optional(),
});
const round2QuestionUpdate = z.object({
  questionNo: z.number().int().positive().optional(), language: z.string().trim().min(1).optional(),
  question: z.string().optional(), starterCode: z.string().optional(), expectedAnswer: z.string().optional(),
});

router.patch("/admin/questions/:round/:questionId", requireAuth, requireRole("admin"), async (request, response) => {
  const collection = request.params.round === "round1" ? "round1_questions" : request.params.round === "round2" ? "round2_questions" : null;
  const schema = request.params.round === "round1" ? round1QuestionUpdate : round2QuestionUpdate;
  const parsed = schema.safeParse(request.body);
  if (!collection || !parsed.success) {
    response.status(400).json({ error: "Invalid question update." });
    return;
  }
  try {
    const questionId = String(request.params.questionId);
    const questionRef = db.collection(collection).doc(questionId);
    if (!(await questionRef.get()).exists) {
      response.status(404).json({ error: "Question not found." });
      return;
    }
    await questionRef.set({ ...parsed.data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    response.json({ id: questionId, ...parsed.data });
  } catch (error) {
    console.error("Failed to update question", error);
    response.status(500).json({ error: "Unable to update question." });
  }
});

router.patch("/admin/event", requireAuth, requireRole("admin"), async (request, response) => {
  const parsed = z.object({
    round1Started: z.boolean().optional(), round2Started: z.boolean().optional(),
    round1Finished: z.boolean().optional(), round2Finished: z.boolean().optional(),
    round2DurationMinutes: z.number().int().positive().optional(),
  }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid event settings." });
    return;
  }

  try {
    if (parsed.data.round2Started === true) {
      const qualifiersSnapshot = await db.collection("users").where("round1Qualified", "==", true).limit(1).get();
      if (qualifiersSnapshot.empty) {
        response.status(409).json({ error: "Round 2 cannot start until at least one participant passes Round 1." });
        return;
      }
    }
    const extra: Record<string, unknown> = {};
    if (parsed.data.round2Started === true) {
      // Record exact timestamp in ms so client can compute countdown
      extra.round2StartedAt = Date.now();
    }
    await settingsRef.set({ ...parsed.data, ...extra, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    response.json({ ...parsed.data, ...extra });
  } catch (error) {
    console.error("Failed to update event settings", error);
    response.status(500).json({ error: "Unable to update event settings." });
  }
});

export default router;