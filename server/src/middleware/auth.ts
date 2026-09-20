import type { NextFunction, Request, Response } from "express";
import { adminAuth } from "../config/firebaseAdmin.js";

export type AuthenticatedRequest = Request & {
  user?: {
    uid: string;
    role?: string;
    email?: string;
  };
};

export async function requireAuth(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction
) {
  try {
    const authorization = request.header("authorization");
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : undefined;

    if (!token) {
      response.status(401).json({ error: "A Firebase ID token is required." });
      return;
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    request.user = {
      uid: decodedToken.uid,
      role: typeof decodedToken.role === "string" ? decodedToken.role : undefined,
      email: decodedToken.email,
    };
    next();
  } catch (error) {
    console.error("Authentication failed", error);
    response.status(401).json({ error: "Invalid or expired authentication token." });
  }
}

export function requireRole(role: "admin" | "user") {
  return (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    if (request.user?.role !== role) {
      response.status(403).json({ error: "You do not have permission for this action." });
      return;
    }
    next();
  };
}