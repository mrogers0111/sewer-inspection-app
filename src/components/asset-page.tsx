import { ClipboardList, Waves } from "lucide-react";
import type { ReactNode } from "react";
import { directions, type Jetting, type Manhole, type ManholeRecord, type Segment, type SegmentRecord } from "@/domain";
import { useQuery } from "@/lib/api";
import { useNavigation } from "@/lib/navigation";
import { fields, useEditor } from "./editor";
import { EditActions, ListPanel } from "./lists";
import { assetDeletion, assetFields, assetLabel, type AssetKind } from "./project-pages";
import { BackLink, Busy, displayDate, ErrorMessage, PageHeading, StatusBadge } from "./shared";
import { Card } from "./ui/primitives";

export function AssetPage({ path, projectPath, kind }: { path: string; projectPath: string; kind: AssetKind }) {
  const query = useQuery<Segment | Manhole>(path);
  const editor = useEditor();
  const { go } = useNavigation();
  const parent = kind === "segments" ? projectPath : projectPath + "?tab=manholes";
  const label = assetLabel[kind];
  const row = query.data;

  return <>
    <BackLink href={parent}>{kind === "segments" ? "Project segments" : "Project manholes"}</BackLink>
    {query.loading && !row && <Card><Busy text={`Loading ${label}…`} /></Card>}
    {query.error && <ErrorMessage message={query.error} retry={query.reload} />}
    {row && <>
      <PageHeading title={"number" in row ? `Segment ${row.number}` : `Manhole ${row.manholeId}`}
        actions={<>
          <StatusBadge value={row.inspectionStatusType} />
          <EditActions label={label}
            edit={(trigger) => editor.edit({ title: `Edit ${label}`, path, fields: assetFields[kind], initial: row, trigger, onSaved: query.reload })}
            remove={(trigger) => editor.remove({ title: `Delete ${label}?`, path, description: assetDeletion[kind], trigger, onSaved: () => go(parent) })}
          />
        </>}
      />
      <div className="grid gap-5">
        <Card className="p-4 sm:p-5">
          <h2 className="mb-4 font-semibold">{kind === "segments" ? "Segment details" : "Manhole details"}</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            {"number" in row ? <>
              <Detail label="Start coordinates">{row.startingLongitudeLatitude || "—"}</Detail>
              <Detail label="End coordinates">{row.endingLongitudeLatitude || "—"}</Detail>
              {row.notes && <Detail label="Notes" className="sm:col-span-2">{row.notes}</Detail>}
            </> : <Detail label="Inspected">{displayDate(row.inspectedDate)}</Detail>}
          </dl>
        </Card>
        <InspectionHistory key={path} path={path + "/records"} kind={kind} />
        {kind === "segments" && <JettingHistory path={path + "/jettings"} />}
      </div>
    </>}
    {editor.modal}
  </>;
}

function Detail({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={className}>
    <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{children}</dd>
  </div>;
}

function InspectionHistory({ path, kind }: { path: string; kind: AssetKind }) {
  const query = useQuery<(SegmentRecord | ManholeRecord)[]>(path);
  const editor = useEditor();
  const segment = kind === "segments";
  const recordFields = segment ? fields.segmentRecord : fields.manholeRecord;

  return <>
    <ListPanel title="Inspection records" icon={ClipboardList} query={query}
      add={{ label: "Add inspection", click: (trigger) => editor.edit({
        title: "Add inspection", path, fields: recordFields, trigger, onSaved: query.reload,
      }) }}
      columns={[
        { name: "Date and time", cell: (row) => <time dateTime={row.dateTime} className="whitespace-nowrap font-semibold">{displayDate(row.dateTime)}</time> },
        ...(segment ? [
          { name: "Length", cell: (row: SegmentRecord | ManholeRecord) => "inspectedLength" in row ? row.inspectedLength : "—" },
          { name: "Direction", cell: (row: SegmentRecord | ManholeRecord) => "directionType" in row ? directions[row.directionType] ?? "—" : "—" },
        ] : [{ name: "Status", cell: (row: SegmentRecord | ManholeRecord) => "inspectionStatusType" in row ? <StatusBadge value={row.inspectionStatusType} /> : "—" }]),
        { name: "Notes", cell: (row) => <Notes value={row.notes} /> },
      ]}
      actions={(row) => <EditActions label={`inspection from ${displayDate(row.dateTime)}`}
        edit={(trigger) => editor.edit({ title: "Edit inspection", path: `${path}/${row.id}`, fields: recordFields, initial: row, trigger, onSaved: query.reload })}
        remove={(trigger) => editor.remove({ title: "Delete inspection?", path: `${path}/${row.id}`, description: "This permanently deletes the inspection record.", trigger, onSaved: query.reload })}
      />}
    />
    {editor.modal}
  </>;
}

function JettingHistory({ path }: { path: string }) {
  const query = useQuery<Jetting[]>(path);
  return <ListPanel title="Jetting history" icon={Waves} query={query} columns={[
    { name: "Date and time", cell: (row) => <time dateTime={row.dateTime} className="whitespace-nowrap font-semibold">{displayDate(row.dateTime)}</time> },
    { name: "Times jetted", cell: (row) => row.numberOfTimesJetted },
    { name: "Length jetted", cell: (row) => row.lengthJetted },
    { name: "Notes", cell: (row) => <Notes value={row.notes} /> },
  ]} />;
}

function Notes({ value }: { value: string }) {
  return <span className="block min-w-24 max-w-sm whitespace-pre-wrap break-words text-muted-foreground">{value || "—"}</span>;
}
