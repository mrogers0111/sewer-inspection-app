import type { SQL } from "bun";
import { authRequest, session } from "./auth";
import { HttpError, json, notFound } from "./http";
import { organizationsRequest } from "./resources";

export function createApi(db: SQL, options: { secure?: boolean; origin?: string } = {}) {
  const { secure = false, origin } = options;

  return async function api(request: Request) {
    try {
      const url = new URL(request.url);
      const [, , scope, ...path] = url.pathname.replace(/\/$/, "").split("/");
      if (scope !== "organizations" && (scope !== "auth" || path.length !== 1)) notFound();
      if (["POST", "PATCH", "DELETE"].includes(request.method)
          && request.headers.get("Origin") !== (origin ?? url.origin)) {
        throw new HttpError(403, "Request origin is not allowed.");
      }
      if (scope === "auth") return await authRequest(db, request, path[0]!, secure);
      const active = await session(db, request);
      const response = await organizationsRequest(db, active.user.id, request, path);
      return active.refresh(response, secure);
    } catch (error) {
      if (error instanceof HttpError) return json({ message: error.message, fields: error.fields }, error.status);
      if (error && typeof error === "object") {
        if (("errno" in error && error.errno === 1062) || ("code" in error && error.code === "ER_DUP_ENTRY")) {
          return json({ message: "A record with that email or identifier already exists." }, 409);
        }
      }
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      console.error("API request failed", { method: request.method, code });
      return json({ message: "The server could not complete the request. Try again." }, 500);
    }
  };
}
