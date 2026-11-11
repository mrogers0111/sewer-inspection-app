import { directions, statuses } from "../domain";
import { HttpError } from "./http";

type Value = string | number;
type Rule = (value: unknown) => Value | undefined;

export function string(max: number, options: { trim?: boolean; required?: boolean } = {}): Rule {
  return (input) => {
    if (typeof input !== "string") return;
    const value = options.trim ? input.trim() : input;
    if ([...value].length <= max && (!options.required || value.trim().length > 0)) return value;
  };
}

export function dateTime(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(value)) return;
  const full = value.length === 16 ? value + ":00" : value;
  const date = new Date(full + "Z");
  if (Number(full.slice(0, 4)) >= 1000 && Number.isFinite(+date) && date.toISOString().slice(0, 19) === full) {
    return full.replace("T", " ");
  }
}

const decimal: Rule = (value) => {
  if (typeof value === "string" && /^-?\d{1,8}(?:\.\d{1,2})?$/.test(value)) return value;
};

const enumeration = (count: number): Rule => (value) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value < count ? value : undefined;

type Field = { column: string; parse: Rule; error: string; format?: "date" | "text" };
type Fields = Record<string, Field>;
const requiredText = (column: string, max: number): Field => ({
  column, parse: string(max, { trim: true, required: true }), error: `Enter 1 to ${max} characters.`,
});
const coordinate = (column: string): Field => ({
  column, parse: string(128), error: "Enter up to 128 characters.",
});
const status: Field = {
  column: "InspectionStatusType", parse: enumeration(statuses.length), error: "Select an inspection status.",
};
const notes: Field = {
  column: "Notes", parse: (value) => typeof value === "string" && Buffer.byteLength(value) <= 65535 ? value : undefined,
  error: "Enter notes up to 65,535 bytes.",
};
const date = (column: string): Field => ({
  column, parse: dateTime, error: "Enter a valid local date and time.", format: "date",
});
const length = (column: string): Field => ({
  column, parse: decimal, error: "Enter a length with up to 8 whole digits and 2 decimal places.", format: "text",
});

export type Resource = {
  path: string; table: string; parent: string; parentKey: string; fields: Fields;
  authored?: boolean; readOnly?: boolean; paginated?: boolean; children?: Resource[];
};

export const projects: Resource = {
  path: "projects", table: "Projects", parent: "OrganizationId", parentKey: "organizationId", paginated: true,
  fields: { number: requiredText("Number", 100), name: requiredText("Name", 255) },
  children: [
    {
      path: "segments", table: "Segments", parent: "ProjectId", parentKey: "projectId",
      fields: {
        number: requiredText("Number", 100), inspectionStatusType: status, notes,
        startingLongitudeLatitude: coordinate("StartingLongitudeLatitude"),
        endingLongitudeLatitude: coordinate("EndingLongitudeLatitude"),
      },
      children: [
        {
          path: "records", table: "SegmentRecords", parent: "SegmentId", parentKey: "segmentId", authored: true,
          fields: {
            dateTime: date("DateTime"), inspectedLength: length("InspectedLength"), notes,
            directionType: { column: "DirectionType", parse: enumeration(directions.length), error: "Select a direction." },
          },
        },
        {
          path: "jettings", table: "Jettings", parent: "SegmentId", parentKey: "segmentId", authored: true, readOnly: true,
          fields: {
            dateTime: date("DateTime"), lengthJetted: length("LengthJetted"), notes,
            numberOfTimesJetted: { column: "NumberOfTimesJetted", parse: enumeration(4294967296), error: "Enter a valid count." },
          },
        },
      ],
    },
    {
      path: "manholes", table: "Manholes", parent: "ProjectId", parentKey: "projectId",
      fields: { manholeId: requiredText("ManholeId", 100), inspectionStatusType: status, inspectedDate: date("InspectedDate") },
      children: [{
        path: "records", table: "ManholeRecords", parent: "ManholeId", parentKey: "manholeId", authored: true,
        fields: { dateTime: date("DateTime"), inspectionStatusType: status, notes },
      }],
    },
  ],
};

export function parseFields(fields: Fields, body: Record<string, unknown>, partial: boolean) {
  const errors: Record<string, string> = Object.create(null);
  const values: Record<string, Value> = {};
  for (const key of Object.keys(body)) {
    if (!Object.hasOwn(fields, key)) errors[key] = "This field cannot be written.";
  }
  for (const [key, field] of Object.entries(fields)) {
    if (partial && !Object.hasOwn(body, key)) continue;
    const value = field.parse(body[key]);
    if (value === undefined) errors[key] = field.error;
    else values[field.column] = value;
  }
  if (Object.keys(errors).length) throw new HttpError(400, "Check the highlighted fields.", errors);
  if (!Object.keys(values).length) throw new HttpError(400, "Provide at least one field.");
  return values;
}
