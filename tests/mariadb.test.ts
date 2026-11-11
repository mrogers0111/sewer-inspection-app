import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import type { Jetting, Manhole, ManholeRecord, Organization, Project, ProjectPage, Segment, SegmentRecord, User } from "../src/domain";
import { createApi } from "../src/server/api";

describe.skipIf(!Bun.env.TEST_DATABASE_URL)("MariaDB API", () => {
  let db: SQL;
  let server: ReturnType<typeof Bun.serve>;
  const users = new Set<string>();
  const organizations = new Set<string>();
  const tag = crypto.randomUUID().slice(0, 8);
  const email = `legacy-${tag}@example.test`;
  const freshEmail = `fresh-${tag}@example.test`;
  const password = "inspection-test-password";
  const legacyUserId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  const conflictOrgId = crypto.randomUUID();
  const date = "2024-11-03T01:30:47";

  beforeAll(async () => {
    const url = Bun.env.TEST_DATABASE_URL!;
    if (url === Bun.env.DATABASE_URL || !/^\/(?:[a-z0-9_]*_)?(?:test|qa)(?:_|$)/i.test(new URL(url).pathname)) {
      throw new Error("TEST_DATABASE_URL must point to a separate database named for test or QA.");
    }
    db = new SQL(url);
    await db.file(import.meta.dir + "/../db/schema.sql").simple();

    // Seed data with the legacy schema before running the additive migration.
    const oldHash = new Bun.CryptoHasher("sha256").update(password).digest("hex").toUpperCase();
    await db`INSERT INTO Users (Id, Email, Password) VALUES (${legacyUserId}, ${email}, ${oldHash})`;
    users.add(email);
    await db`INSERT INTO Organizations (Id, Name) VALUES
      (${orgId}, ${"Legacy organization " + tag}), (${conflictOrgId}, ${`conflict-${tag}@example.test's Organization`})`;
    organizations.add(orgId);
    organizations.add(conflictOrgId);
    await db`INSERT INTO UserOrganizations (UserId, OrganizationId) VALUES (${legacyUserId}, ${orgId})`;
    const project = await db`INSERT INTO Projects (Number, Name, OrganizationId) VALUES ('P-LEGACY', 'Existing project', ${orgId})`;
    const segment = await db`INSERT INTO Segments
      (ProjectId, InspectionStatusType, Number, Notes, StartingLongitudeLatitude, EndingLongitudeLatitude)
      VALUES (${project.lastInsertRowid}, 3, 'S-LEGACY', 'Existing notes', '-87.60, 41.89', '-87.62, 41.91')`;
    await db`INSERT INTO Jettings (SegmentId, DateTime, NumberOfTimesJetted, LengthJetted, Notes, UserId)
      VALUES (${segment.lastInsertRowid}, '2024-11-03 01:30:47', 2, '108.40', 'Existing jetting', ${legacyUserId})`;
    const migration = import.meta.dir + "/../db/migrations/001-bun-sessions.sql";
    await db.file(migration).simple();
    await db.file(migration).simple();

    server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: createApi(db) });
  });

  afterAll(async () => {
    if (server) await server.stop(true);
    if (!db) return;
    try {
      for (const id of organizations) {
        await db`DELETE FROM Projects WHERE OrganizationId = ${id}`;
        await db`DELETE FROM Organizations WHERE Id = ${id}`;
      }
      for (const address of users) await db`DELETE FROM Users WHERE Email = ${address}`;
    } finally {
      await db.close();
    }
  });

  async function request<T>(path: string, status: number, options: {
    method?: string; cookie?: string; body?: unknown; origin?: string;
  } = {}) {
    const { method = "GET", cookie, body, origin = server.url.origin } = options;
    const response = await fetch(new URL("/api" + path, server.url), {
      method,
      headers: {
        ...(method !== "GET" && { Origin: origin }),
        ...(cookie && { Cookie: cookie }),
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = response.status === 204 ? undefined : await response.json();
    expect(response.status, `${method} ${path} ${JSON.stringify(data)}`).toBe(status);
    return { data: data as T, response, cookie: response.headers.get("Set-Cookie")?.split(";")[0] };
  }

  test("preserves legacy accounts and data, enforces membership, and completes the inspection lifecycle", async () => {
    await request("/missing", 404);
    await request("/organizations", 401);
    await request("/auth/register", 403, { method: "POST", origin: "https://example.test", body: {} });

    const conflict = `conflict-${tag}@example.test`;
    await request("/auth/register", 409, { method: "POST", body: { email: conflict, password, confirmPassword: password } });
    expect(await db`SELECT Id FROM Users WHERE Email = ${conflict}`).toHaveLength(0);
    await request("/auth/register", 201, { method: "POST", body: { email: freshEmail, password, confirmPassword: password } });
    users.add(freshEmail);
    const [freshOrg] = await db`SELECT CAST(Id AS CHAR) AS id FROM Organizations WHERE Name = ${freshEmail + "'s Organization"}`;
    organizations.add(freshOrg.id);
    const fresh = await request<User>("/auth/login", 200, { method: "POST", body: { email: freshEmail, password } });
    const otherCookie = fresh.cookie!;
    const otherBase = `/organizations/${freshOrg.id}/projects`;

    await request("/auth/login", 401, { method: "POST", body: { email, password: "wrong-password" } });
    const login = await request<User>("/auth/login", 200, { method: "POST", body: { email, password } });
    expect(login.data).toEqual({ id: legacyUserId, email });
    expect(login.response.headers.get("Set-Cookie")).toMatch(/HttpOnly/i);
    expect(login.response.headers.get("Set-Cookie")).toMatch(/SameSite=Lax/i);
    expect(login.response.headers.get("Set-Cookie")).toMatch(/Max-Age=900/i);
    const cookie = login.cookie!;
    const [upgraded] = await db`SELECT Password AS hash FROM Users WHERE Id = ${legacyUserId}`;
    expect(upgraded.hash).toStartWith("$argon2id$");
    expect(await Bun.password.verify(password, upgraded.hash)).toBe(true);
    const { data: orgs } = await request<Organization[]>("/organizations", 200, { cookie });
    expect(orgs.map(({ id }) => id)).toEqual([orgId]);
    const base = `/organizations/${orgId}/projects`;
    const { data: original } = await request<ProjectPage>(base, 200, { cookie });
    const oldPath = `${base}/${original.items[0]!.id}`;
    const { data: legacySegments } = await request<Segment[]>(oldPath + "/segments", 200, { cookie });
    const legacySegment = legacySegments[0]!;
    expect(legacySegment).toMatchObject({ inspectionStatusType: 3, startingLongitudeLatitude: "-87.60, 41.89", number: "S-LEGACY" });
    const legacyAsset = `${oldPath}/segments/${legacySegment.id}`;
    const { data: jettings } = await request<Jetting[]>(legacyAsset + "/jettings", 200, { cookie });
    expect(jettings[0]).toMatchObject({ dateTime: date, lengthJetted: "108.40", userId: legacyUserId });
    await request(legacyAsset + "/jettings", 405, { cookie, method: "POST", body: {} });
    await request(oldPath, 404, { cookie: otherCookie });
    await request(`${otherBase}/${original.items[0]!.id}`, 404, { cookie: otherCookie });

    const { data: project } = await request<Project>(base, 201, { cookie, method: "POST", body: { name: "North trunk", number: "P-100" } });
    const projectPath = `${base}/${project.id}`;
    await request(projectPath, 200, { cookie, method: "PATCH", body: { name: "North trunk renewal" } });
    const { data: projectPage } = await request<ProjectPage>(base, 200, { cookie });
    expect(projectPage.items[0]?.name).toBe("North trunk renewal");
    const bulk = Array.from({ length: 19 }, (_, i) => ({ OrganizationId: orgId, Name: `Extra ${i}`, Number: `E-${i}` }));
    await db`INSERT INTO Projects ${db(bulk)}`;
    const { data: firstPage } = await request<ProjectPage>(base, 200, { cookie });
    expect(firstPage.items).toHaveLength(20);
    expect(firstPage.hasMore).toBe(true);
    const { data: secondPage } = await request<ProjectPage>(base + "?page=2", 200, { cookie });
    expect(secondPage.items.map(({ id }) => id)).toEqual([original.items[0]!.id]);

    const { data: segment } = await request<Segment>(projectPath + "/segments", 201, { cookie, method: "POST", body: {
      number: "S-100", notes: "New segment", inspectionStatusType: 0,
      startingLongitudeLatitude: " -87.61, 41.90 ", endingLongitudeLatitude: "-87.64, 41.92",
    } });
    expect(segment.startingLongitudeLatitude).toBe(" -87.61, 41.90 ");
    const segmentPath = `${projectPath}/segments/${segment.id}`;
    await request(segmentPath, 200, { cookie, method: "PATCH", body: { inspectionStatusType: 1 } });
    await request(`${oldPath}/segments/${segment.id}`, 404, { cookie, method: "DELETE" });
    const { data: invalid } = await request<{ fields: object }>(segmentPath + "/records", 400, { cookie, method: "POST", body: {
      dateTime: date, notes: "", directionType: 2, inspectedLength: "123.456", userId: fresh.data.id,
    } });
    expect(invalid.fields).toMatchObject({ inspectedLength: expect.any(String), directionType: expect.any(String), userId: expect.any(String) });
    const { data: inspection } = await request<SegmentRecord>(segmentPath + "/records", 201, { cookie, method: "POST", body: {
      dateTime: date, notes: "Surveyed", directionType: 1, inspectedLength: "99999999.99",
    } });
    expect(inspection).toMatchObject({ dateTime: date, inspectedLength: "99999999.99", userId: legacyUserId });
    const recordPath = `${segmentPath}/records/${inspection.id}`;
    await request(`${legacyAsset}/records/${inspection.id}`, 404, { cookie, method: "PATCH", body: { notes: "Wrong parent" } });
    await db`INSERT INTO UserOrganizations (UserId, OrganizationId) VALUES (${fresh.data.id}, ${orgId})`;
    const { data: updated } = await request<SegmentRecord>(recordPath, 200, { cookie: otherCookie, method: "PATCH", body: { notes: "Reviewed" } });
    expect(updated).toMatchObject({ notes: "Reviewed", userId: legacyUserId });
    await db`DELETE FROM UserOrganizations WHERE UserId = ${fresh.data.id} AND OrganizationId = ${orgId}`;
    await request(recordPath, 404, { cookie: otherCookie });

    const manholeBody = { manholeId: "MH-100", inspectionStatusType: 2, inspectedDate: date };
    const { data: manhole } = await request<Manhole>(projectPath + "/manholes", 201, { cookie, method: "POST", body: manholeBody });
    expect(manhole.inspectedDate).toBe(date);
    await request(projectPath + "/manholes", 409, { cookie, method: "POST", body: manholeBody });
    const manholePath = `${projectPath}/manholes/${manhole.id}`;
    await request(manholePath, 200, { cookie, method: "PATCH", body: { inspectionStatusType: 1 } });
    const { data: mr } = await request<ManholeRecord>(manholePath + "/records", 201, { cookie, method: "POST", body: {
      dateTime: date, notes: "Manhole inspected", inspectionStatusType: 1,
    } });
    expect(mr).toMatchObject({ inspectionStatusType: 1, userId: legacyUserId });
    const manholeRecordPath = `${manholePath}/records/${mr.id}`;
    await request(manholeRecordPath, 200, { cookie, method: "GET" });
    await request(manholeRecordPath, 204, { cookie, method: "DELETE" });
    await request(manholeRecordPath, 404, { cookie });

    await request(projectPath, 204, { cookie, method: "DELETE" });
    expect(await db`SELECT Id FROM Manholes WHERE Id = ${manhole.id}`).toHaveLength(0);
    expect(await db`SELECT Id FROM SegmentRecords WHERE Id = ${inspection.id}`).toHaveLength(0);
    expect(await db`SELECT Id FROM Segments WHERE Id = ${segment.id}`).toHaveLength(0);

    const token = cookie.split("=")[1]!;
    const tokenHash = new Bun.CryptoHasher("sha256").update(token).digest("hex");
    await db`UPDATE BunSessions SET ExpiresAt = TIMESTAMPADD(SECOND, 5, UTC_TIMESTAMP()) WHERE TokenHash = ${tokenHash}`;
    await request("/auth/session", 200, { cookie });
    const [active] = await db`SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), ExpiresAt) AS seconds FROM BunSessions WHERE TokenHash = ${tokenHash}`;
    expect(Number(active.seconds)).toBeGreaterThan(890);
    await db`UPDATE BunSessions SET ExpiresAt = TIMESTAMPADD(SECOND, -1, UTC_TIMESTAMP()) WHERE TokenHash = ${tokenHash}`;
    await request("/auth/session", 401, { cookie });
    await request("/auth/logout", 204, { cookie: otherCookie, method: "POST" });
    await request("/auth/session", 401, { cookie: otherCookie });
  }, 30_000);
});
