export class HttpError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export function empty() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export function notFound(): never {
  throw new HttpError(404, "Resource not found.");
}

export function methodNotAllowed(methods: string[]) {
  const response = json({ message: "Method not allowed." }, 405);
  response.headers.set("Allow", methods.join(", "));
  return response;
}

export async function readObject(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    throw new HttpError(415, "Use application/json.");
  }
  const value: unknown = await request.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Provide a JSON object.");
  }
  return value as Record<string, unknown>;
}

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function integerId(value: string) {
  const id = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !Number.isInteger(id) || id > 2147483647) {
    throw new HttpError(400, "Invalid numeric ID.");
  }
  return id;
}
