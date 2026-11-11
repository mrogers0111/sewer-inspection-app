import { useId, useState, type FormEvent } from "react";
import { directions, statuses } from "@/domain";
import { api, ApiError } from "@/lib/api";
import { ErrorMessage } from "./shared";
import { Button, Input, Modal, Select, Textarea } from "./ui/primitives";

type Field = { key: string; label: string; required?: boolean; max?: number; type?: "date" | "decimal" | "notes"; options?: readonly string[]; placeholder?: string };

const status = { key: "inspectionStatusType", label: "Inspection status", options: statuses };
const notes: Field = { key: "notes", label: "Notes", type: "notes" };
const date: Field = { key: "dateTime", label: "Inspection date and time", type: "date", required: true };

export const fields = {
  project: [
    { key: "number", label: "Project number", max: 100, required: true },
    { key: "name", label: "Project name", max: 255, required: true },
  ],
  segment: [
    { key: "number", label: "Segment number", max: 100, required: true },
    status,
    { key: "startingLongitudeLatitude", label: "Start coordinates", max: 128, placeholder: "Longitude, latitude" },
    { key: "endingLongitudeLatitude", label: "End coordinates", max: 128, placeholder: "Longitude, latitude" },
    notes,
  ],
  manhole: [
    { key: "manholeId", label: "Manhole identifier", max: 100, required: true },
    status,
    { key: "inspectedDate", label: "Inspected date and time", type: "date", required: true },
  ],
  segmentRecord: [
    date,
    { key: "inspectedLength", label: "Inspected length", type: "decimal", required: true },
    { key: "directionType", label: "Direction", options: directions },
    notes,
  ],
  manholeRecord: [date, status, notes],
} satisfies Record<string, Field[]>;

type EditOptions = {
  title: string; path: string; fields: Field[]; initial?: Record<string, unknown>;
  trigger: HTMLElement | null; onSaved: () => void;
};
type DeleteOptions = {
  title: string; path: string; description: string; trigger: HTMLElement | null; onSaved: () => void;
};
type Action = ({ type: "edit" } & EditOptions) | ({ type: "delete" } & DeleteOptions);

export function useEditor() {
  const [action, setAction] = useState<Action>();
  return {
    edit: (options: EditOptions) => setAction({ type: "edit", ...options }),
    remove: (options: DeleteOptions) => setAction({ type: "delete", ...options }),
    modal: action ? <Editor action={action} onClose={() => setAction(undefined)} /> : null,
  };
}

function localNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

function Editor({ action, onClose }: { action: Action; onClose: () => void }) {
  const prefix = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError>();
  const deleting = action.type === "delete";
  const description = deleting ? action.description : "Fields marked with an asterisk are required.";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      if (action.type === "delete") {
        await api(action.path, { method: "DELETE" });
      } else {
        const form = new FormData(event.currentTarget);
        const data = Object.fromEntries(action.fields.map(({ key, options }) =>
          [key, options ? Number(form.get(key)) : String(form.get(key) ?? "")]));
        await api(action.path, { method: action.initial ? "PATCH" : "POST", data });
      }
      action.onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError(0, "Unable to complete this action."));
      setBusy(false);
    }
  }

  return <Modal title={action.title} description={description} onClose={onClose} busy={busy} trigger={action.trigger}>
    <form onSubmit={submit} className="mt-5 grid gap-4">
      {error && <ErrorMessage message={error.message} />}
      {action.type === "edit" && action.fields.map((field) => {
        const id = prefix + field.key;
        const errorMessage = error?.fields[field.key];
        const value = String(action.initial?.[field.key] ?? (field.options ? 0 : field.type === "date" ? localNow() : ""));
        const props = {
          id, name: field.key, defaultValue: value, disabled: busy, required: field.required,
          "aria-invalid": !!errorMessage, "aria-describedby": errorMessage ? id + "-error" : undefined,
        };
        return <div key={field.key} className="grid gap-1.5">
          <label htmlFor={id} className="text-sm font-semibold">{field.label}{field.required && <span aria-hidden> *</span>}</label>
          {field.options ? <Select {...props}>{field.options.map((label, index) => <option key={label} value={index}>{label}</option>)}</Select>
            : field.type === "notes" ? <Textarea {...props} />
            : <Input {...props} type={field.type === "date" ? "datetime-local" : "text"}
                step={field.type === "date" ? 1 : undefined}
                inputMode={field.type === "decimal" ? "decimal" : undefined}
                maxLength={field.max} placeholder={field.placeholder} />}
          {errorMessage && <span id={id + "-error"} className="text-sm text-destructive">{errorMessage}</span>}
        </div>;
      })}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy} autoFocus={deleting}>Cancel</Button>
        <Button type="submit" variant={deleting ? "destructive" : "default"} disabled={busy}>
          {busy ? (deleting ? "Deleting…" : "Saving…") : (deleting ? "Delete" : "Save")}
        </Button>
      </div>
    </form>
  </Modal>;
}
