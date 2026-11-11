import { expect, test } from "bun:test";
import { dateTime, parseFields, projects } from "../src/server/schema";

test("inspection dates preserve wall-clock time and reject impossible dates and time zones", () => {
  expect(dateTime("2024-02-29T08:15")).toBe("2024-02-29 08:15:00");
  expect(dateTime("2024-11-03T01:30:47")).toBe("2024-11-03 01:30:47");
  expect(dateTime("2025-02-29T08:15")).toBeUndefined();
  expect(dateTime("2025-04-31T08:15")).toBeUndefined();
  expect(dateTime("2025-04-30T24:00")).toBeUndefined();
  expect(dateTime("2025-04-30T08:15:00Z")).toBeUndefined();
});

test("writes reject immutable fields and decimals that the database would round", () => {
  const records = projects.children![0]!.children![0]!;
  expect(() => parseFields(records.fields, { segmentId: 2, userId: crypto.randomUUID() }, true)).toThrow();
  expect(() => parseFields(records.fields, { inspectedLength: "10.001" }, true)).toThrow();
  expect(parseFields(records.fields, { inspectedLength: "99999999.99", directionType: 0 }, true))
    .toEqual({ InspectedLength: "99999999.99", DirectionType: 0 });
});
