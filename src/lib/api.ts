import { useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string> = {}) {
    super(message);
  }
}

export async function api<T>(path: string, options: {
  method?: "GET" | "POST" | "PATCH" | "DELETE"; data?: Record<string, unknown>;
  signal?: AbortSignal; authForm?: boolean;
} = {}): Promise<T> {
  const { method = "GET", data, signal, authForm = false } = options;
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      method, signal,
      headers: data ? { "Content-Type": "application/json" } : undefined,
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.");
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (response.ok) return body as T;
  if (response.status === 401 && !authForm && path !== "/auth/session" && !signal?.aborted) {
    window.dispatchEvent(new Event("session-expired"));
  }
  throw new ApiError(response.status, body.message ?? "The request could not be completed.", body.fields);
}

type Query<T> = { path: string; version: number; data?: T; error?: string };

export function useQuery<T>(path: string) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Query<T>>();
  useEffect(() => {
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) setResult({ path, version, data }); },
      (error: Error) => { if (!controller.signal.aborted) setResult({ path, version, error: error.message }); },
    );
    return () => controller.abort();
  }, [path, version]);

  const current = result?.path === path ? result : undefined;
  return { data: current?.data, error: current?.version === version ? current.error : undefined,
    loading: current?.version !== version, reload: () => setVersion((value) => value + 1) };
}
