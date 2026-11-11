import type { SQL } from "bun";
import { HttpError, empty, integerId, json, methodNotAllowed, notFound, readObject, uuidPattern } from "./http";
import { parseFields, projects, type Resource } from "./schema";

type ParentId = number | string;

function projection(db: SQL, resource: Resource) {
  // All identifiers are defined in the resource schema, never taken from a request.
  const parent = resource === projects ? "CAST(OrganizationId AS CHAR)" : `\`${resource.parent}\``;
  const columns = ["Id AS id", `${parent} AS ${resource.parentKey}`];
  if (resource.authored) columns.push("CAST(UserId AS CHAR) AS userId");
  for (const [name, field] of Object.entries(resource.fields)) {
    const column = `\`${field.column}\``;
    const expression = field.format === "date" ? `REPLACE(CAST(${column} AS CHAR), ' ', 'T')`
      : field.format === "text" ? `CAST(${column} AS CHAR)` : column;
    columns.push(`${expression} AS \`${name}\``);
  }
  return db.unsafe(columns.join(", "));
}

async function find(db: SQL, resource: Resource, parent: ParentId, id: number, lock: boolean) {
  const [row] = await db`
    SELECT ${projection(db, resource)} FROM ${db(resource.table)}
    WHERE Id = ${id} AND ${db(resource.parent)} = ${parent}
    ${db.unsafe(lock ? "FOR UPDATE" : "")}
  `;
  return row ?? notFound();
}

const pageSize = 20;

async function collection(db: SQL, resource: Resource, parent: ParentId, userId: string, request: Request) {
  if (request.method === "GET") {
    if (resource.paginated) {
      const page = integerId(new URL(request.url).searchParams.get("page") ?? "1");
      const items = await db`
        SELECT ${projection(db, resource)} FROM ${db(resource.table)}
        WHERE ${db(resource.parent)} = ${parent} ORDER BY Id DESC
        LIMIT ${pageSize + 1} OFFSET ${(page - 1) * pageSize}
      `;
      return json({ items: items.slice(0, pageSize), page, hasMore: items.length > pageSize });
    }
    const order = db.unsafe(resource.authored ? "DateTime DESC, Id DESC" : "Id ASC");
    return json(await db`
      SELECT ${projection(db, resource)} FROM ${db(resource.table)}
      WHERE ${db(resource.parent)} = ${parent} ORDER BY ${order}
    `);
  }

  const methods = resource.readOnly ? ["GET"] : ["GET", "POST"];
  if (request.method !== "POST" || resource.readOnly) return methodNotAllowed(methods);
  const values = parseFields(resource.fields, await readObject(request), false);
  values[resource.parent] = parent;
  if (resource.authored) values.UserId = userId;
  const result = await db`INSERT INTO ${db(resource.table)} ${db(values)}`;
  return json(await find(db, resource, parent, Number(result.lastInsertRowid), false), 201);
}

async function resourceRequest(db: SQL, resource: Resource, parent: ParentId, userId: string, request: Request, path: string[]): Promise<Response> {
  if (path[0] !== resource.path) notFound();
  if (path.length === 1) return collection(db, resource, parent, userId, request);
  if (resource.readOnly) notFound();

  const id = integerId(path[1]!);
  const row = await find(db, resource, parent, id, request.method !== "GET");
  if (path.length > 2) {
    const child = resource.children?.find(({ path: name }) => name === path[2]) ?? notFound();
    return resourceRequest(db, child, id, userId, request, path.slice(2));
  }

  switch (request.method) {
    case "GET":
      return json(row);
    case "PATCH": {
      const values = parseFields(resource.fields, await readObject(request), true);
      await db`UPDATE ${db(resource.table)} SET ${db(values)} WHERE Id = ${id}`;
      return json(await find(db, resource, parent, id, false));
    }
    case "DELETE":
      await db`DELETE FROM ${db(resource.table)} WHERE Id = ${id}`;
      return empty();
    default:
      return methodNotAllowed(["GET", "PATCH", "DELETE"]);
  }
}

export async function organizationsRequest(db: SQL, userId: string, request: Request, path: string[]) {
  if (!path.length) {
    if (request.method !== "GET") return methodNotAllowed(["GET"]);
    return json(await db`
      SELECT CAST(o.Id AS CHAR) AS id, o.Name AS name
      FROM UserOrganizations uo JOIN Organizations o ON o.Id = uo.OrganizationId
      WHERE uo.UserId = ${userId} ORDER BY o.Name, o.Id
    `);
  }

  const organizationId = path[0]!;
  if (!uuidPattern.test(organizationId)) throw new HttpError(400, "Invalid organization ID.");
  return db.begin(async (transaction) => {
    const [membership] = await transaction`
      SELECT Id FROM UserOrganizations WHERE UserId = ${userId} AND OrganizationId = ${organizationId}
      ${transaction.unsafe(request.method === "GET" ? "" : "FOR UPDATE")}
    `;
    if (!membership) notFound();
    return resourceRequest(transaction, projects, organizationId, userId, request, path.slice(1));
  });
}
