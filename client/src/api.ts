import { getIdToken } from "firebase/auth";
import { clientAuth } from "./lib/firebase";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = clientAuth.currentUser ? await getIdToken(clientAuth.currentUser) : undefined;
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Request failed.");
  return body as T;
}