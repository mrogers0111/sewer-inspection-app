import type { SQL } from "bun";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { User } from "../domain";
import { empty, HttpError, json, methodNotAllowed, notFound, readObject } from "./http";
import { parseFields, string } from "./schema";

const cookieName = "sewer_session";
const sessionSeconds = 15 * 60;
const organizationSuffix = "'s Organization";
const sha256 = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");

function sessionToken(request: Request) {
  const value = new Bun.CookieMap(request.headers.get("Cookie") ?? "").get(cookieName);
  return value && /^[a-f0-9]{64}$/.test(value) ? sha256(value) : undefined;
}

export function sessionCookie(response: Response, token: string, secure: boolean, maxAge = sessionSeconds) {
  const value = new Bun.Cookie(cookieName, token, { path: "/", httpOnly: true, sameSite: "lax", secure, maxAge });
  response.headers.append("Set-Cookie", value.serialize());
  return response;
}

export async function session(db: SQL, request: Request) {
  const token = sessionToken(request);
  if (!token) throw new HttpError(401, "Sign in to continue.");
  const user = await db.begin(async (transaction) => {
    const [user] = await transaction<User[]>`
      SELECT CAST(u.Id AS CHAR) AS id, u.Email AS email
      FROM BunSessions s JOIN Users u ON u.Id = s.UserId
      WHERE s.TokenHash = ${token} AND s.ExpiresAt > UTC_TIMESTAMP()
      FOR UPDATE
    `;
    if (user) {
      await transaction`
        UPDATE BunSessions SET ExpiresAt = TIMESTAMPADD(SECOND, ${sessionSeconds}, UTC_TIMESTAMP())
        WHERE TokenHash = ${token}
      `;
    }
    return user;
  });
  if (!user) throw new HttpError(401, "Your session has expired. Sign in again.");
  return { user, refresh(response: Response, secure: boolean) {
    return sessionCookie(response, new Bun.CookieMap(request.headers.get("Cookie") ?? "").get(cookieName)!, secure);
  } };
}

async function credentials(request: Request, registering: boolean) {
  const body = await readObject(request);
  const readEmail = string(registering ? 255 - organizationSuffix.length : 255, { trim: true, required: true });
  const readPassword = string(1024, { required: true });
  const fields = {
    email: {
      column: "email",
      parse: (value: unknown) => {
        const email = readEmail(value);
        return typeof email === "string" && (!registering || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ? email : undefined;
      },
      error: registering ? `Enter a valid email up to ${255 - organizationSuffix.length} characters.` : "Enter your email.",
    },
    password: {
      column: "password",
      parse: (value: unknown) => {
        const password = readPassword(value);
        return typeof password === "string" && (!registering || [...password].length >= 8) ? password : undefined;
      },
      error: registering ? "Enter 8 to 1024 characters." : "Enter your password.",
    },
    ...(registering ? {
      confirmPassword: {
        column: "confirmPassword",
        parse: (value: unknown) => typeof value === "string" && value === body.password ? value : undefined,
        error: "Passwords must match.",
      },
    } : {}),
  };
  const values = parseFields(fields, body, false);
  return { email: String(values.email), password: String(values.password) };
}

async function register(db: SQL, request: Request) {
  const { email, password } = await credentials(request, true);
  const hash = await Bun.password.hash(password, "argon2id");
  const userId = crypto.randomUUID();
  const organizationId = crypto.randomUUID();
  await db.begin(async (transaction) => {
    await transaction`INSERT INTO Users (Id, Email, Password) VALUES (${userId}, ${email}, ${hash})`;
    await transaction`INSERT INTO Organizations (Id, Name) VALUES (${organizationId}, ${email + organizationSuffix})`;
    await transaction`INSERT INTO UserOrganizations (UserId, OrganizationId) VALUES (${userId}, ${organizationId})`;
  });
  return json({ message: "Account created. You can now sign in." }, 201);
}

// Keep the verification cost similar for unknown and known accounts.
let dummyHash: Promise<string> | undefined;

async function login(db: SQL, request: Request, secure: boolean) {
  const { email, password } = await credentials(request, false);
  const [user] = await db<(User & { hash: string })[]>`
    SELECT CAST(Id AS CHAR) AS id, Email AS email, Password AS hash FROM Users WHERE Email = ${email}
  `;
  const invalid = () => new HttpError(401, "Email or password is incorrect.");
  const legacy = user && /^[a-f0-9]{64}$/i.test(user.hash);
  let replacement: string | undefined;
  if (legacy && timingSafeEqual(Buffer.from(sha256(password), "hex"), Buffer.from(user.hash, "hex"))) {
    replacement = await Bun.password.hash(password, "argon2id");
  } else {
    const hash = user?.hash.startsWith("$argon2id$") ? user.hash
      : await (dummyHash ??= Bun.password.hash(randomBytes(32).toString("hex"), "argon2id"));
    const valid = await Bun.password.verify(password, hash);
    if (!valid || !user || !user.hash.startsWith("$argon2id$")) throw invalid();
  }

  const token = randomBytes(32).toString("hex");
  const previousToken = sessionToken(request);
  await db.begin(async (transaction) => {
    if (replacement) {
      await transaction`
        UPDATE Users SET Password = ${replacement} WHERE Id = ${user.id} AND Password = ${user.hash}
      `;
    }
    if (previousToken) await transaction`DELETE FROM BunSessions WHERE TokenHash = ${previousToken}`;
    await transaction`DELETE FROM BunSessions WHERE ExpiresAt <= UTC_TIMESTAMP() ORDER BY ExpiresAt LIMIT 100`;
    await transaction`
      INSERT INTO BunSessions (TokenHash, UserId, ExpiresAt)
      VALUES (${sha256(token)}, ${user.id}, TIMESTAMPADD(SECOND, ${sessionSeconds}, UTC_TIMESTAMP()))
    `;
  });
  return sessionCookie(json({ id: user.id, email: user.email }), token, secure);
}

export async function authRequest(db: SQL, request: Request, action: string, secure: boolean) {
  if (action === "session") {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    const active = await session(db, request);
    return active.refresh(json(active.user), secure);
  }
  if (!["register", "login", "logout"].includes(action)) notFound();
  if (request.method !== "POST") return methodNotAllowed(["POST"]);
  if (action === "register") return register(db, request);
  if (action === "login") return login(db, request, secure);

  const token = sessionToken(request);
  if (token) await db`DELETE FROM BunSessions WHERE TokenHash = ${token}`;
  return sessionCookie(empty(), "", secure, 0);
}
