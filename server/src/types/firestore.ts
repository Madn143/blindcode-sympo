import type { Timestamp } from "firebase-admin/firestore";

export type UserProfile = {
  name: string;
  collegeName: string;
  email: string;
  role: "user";
  createdAt: Timestamp;
};

export type QuestionBase = {
  questionNo: number;
  language: string;
  createdAt: Timestamp;
};

export type Round1Question = QuestionBase & {
  code: string;
  correctLine: string;
  correctedLine: string;
  description: string;
};

export type Round2Question = QuestionBase & {
  question: string;
  starterCode: string;
  expectedAnswer: string;
  testCases: string | null;
};

export type Round1Answer = {
  userId: string;
  questionId: string;
  errorLine: string;
  correctedLine: string;
  description: string;
  score: number;
  submittedAt: Timestamp;
};

export type Round2Answer = {
  userId: string;
  questionId: string;
  answer: string;
  syntaxErrors: number;
  logicalErrors: number;
  syntaxPenalty: number;
  logicalPenalty: number;
  score: number;
  aiFeedback: string | null;
  evaluated: boolean;
  submittedAt: Timestamp;
  evaluatedAt: Timestamp | null;
};

export type EventSettings = {
  round1Started: boolean;
  round2Started: boolean;
  round1Finished: boolean;
  round2Finished: boolean;
  updatedAt: Timestamp;
};