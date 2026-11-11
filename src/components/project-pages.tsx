import { ChevronLeft, ChevronRight, CircleDot, FolderKanban, Pipette } from "lucide-react";
import type { Manhole, Organization, Project, ProjectPage, Segment } from "@/domain";
import { useQuery } from "@/lib/api";
import { Link, useNavigation } from "@/lib/navigation";
import { fields, useEditor } from "./editor";
import { AddButton, DataTable, EditActions, ListPanel, RowLink } from "./lists";
import { BackLink, Busy, displayDate, EmptyState, ErrorMessage, PageHeading, StatusBadge } from "./shared";
import { Button, Card, TabsContent, TabsList, TabsRoot, TabsTrigger } from "./ui/primitives";

const projectDeletion = "This permanently deletes the project, its segments and manholes, their inspection records, and segment jetting history.";

export function ProjectsPage({ base, org, page }: { base: string; org: Organization; page: number }) {
  const query = useQuery<ProjectPage>(`${base}?page=${page}`);
  const editor = useEditor();
  const { go } = useNavigation();
  const add = (trigger: HTMLElement) => editor.edit({
    title: "New project", path: base, fields: fields.project, trigger,
    onSaved: () => page === 1 ? query.reload() : go(base),
  });

  return <>
    <PageHeading title="Projects" detail={org.name} actions={<AddButton label="New project" click={add} />} />
    <Card>
      <div className="flex items-center gap-2 px-4 py-4 sm:px-5">
        <FolderKanban size={18} className="text-primary" aria-hidden />
        <h2 className="font-semibold">Project directory</h2>
      </div>
      {query.error && <div className="p-4 pt-0"><ErrorMessage message={query.error} retry={query.reload} /></div>}
      {query.loading && !query.data && <Busy />}
      {!!query.data?.items.length && <DataTable title="Projects" rows={query.data.items} columns={[
        { name: "Project", cell: (row) => <RowLink href={`${base}/${row.id}`}>{row.name}</RowLink> },
        { name: "Project number", cell: (row) => <span className="whitespace-nowrap text-muted-foreground">{row.number}</span> },
      ]} actions={(row) => <EditActions label={row.name}
        edit={(trigger) => editor.edit({ title: "Edit project", path: `${base}/${row.id}`, fields: fields.project, initial: row, trigger, onSaved: query.reload })}
        remove={(trigger) => editor.remove({ title: `Delete ${row.name}?`, path: `${base}/${row.id}`, description: projectDeletion, trigger, onSaved: query.reload })} />}
      />}
      {query.data?.items.length === 0 && !query.loading &&
        <EmptyState icon={FolderKanban} title={page > 1 ? "No projects on this page" : "No projects yet"}
          description={page === 1 ? "Create a project to organize segments, manholes, and their inspections." : undefined} />}
      {(page > 1 || query.data?.hasMore) && <nav aria-label="Project pages" className="flex items-center justify-between gap-3 border-t p-4 sm:px-5">
        {page > 1 ? <Button asChild variant="outline" size="sm"><Link href={page === 2 ? base : `${base}?page=${page - 1}`}><ChevronLeft />Previous</Link></Button> : <span />}
        <span className="text-sm text-muted-foreground">Page {page}</span>
        {query.data?.hasMore ? <Button asChild variant="outline" size="sm"><Link href={`${base}?page=${page + 1}`}>Next<ChevronRight /></Link></Button> : <span />}
      </nav>}
    </Card>
    {editor.modal}
  </>;
}

export type AssetKind = "segments" | "manholes";
export const assetLabel = { segments: "segment", manholes: "manhole" } as const;
export const assetFields = { segments: fields.segment, manholes: fields.manhole };
export const assetDeletion = {
  segments: "This permanently deletes the segment, its inspection records, and its jetting history.",
  manholes: "This permanently deletes the manhole and its inspection records.",
};

export function ProjectPage({ base, path, tab }: { base: string; path: string; tab: AssetKind }) {
  const project = useQuery<Project>(path);
  const editor = useEditor();
  const { go } = useNavigation();

  return <>
    <BackLink href={base}>Projects</BackLink>
    {project.loading && !project.data && <Card><Busy text="Loading project…" /></Card>}
    {project.error && <ErrorMessage message={project.error} retry={project.reload} />}
    {project.data && <>
      <PageHeading title={project.data.name} detail={`Project ${project.data.number}`} actions={
        <EditActions label={project.data.name}
          edit={(trigger) => editor.edit({ title: "Edit project", path, fields: fields.project, initial: project.data!, trigger, onSaved: project.reload })}
          remove={(trigger) => editor.remove({ title: `Delete ${project.data!.name}?`, path, description: projectDeletion, trigger, onSaved: () => go(base) })}
        />
      } />
      <TabsRoot value={tab} onValueChange={(value) => go(value === "segments" ? path : path + "?tab=manholes")}>
        <TabsList aria-label="Project assets" className="mb-5">
          <TabsTrigger value="segments"><Pipette aria-hidden />Segments</TabsTrigger>
          <TabsTrigger value="manholes"><CircleDot aria-hidden />Manholes</TabsTrigger>
        </TabsList>
        <TabsContent value="segments">{tab === "segments" && <AssetList path={path} kind="segments" />}</TabsContent>
        <TabsContent value="manholes">{tab === "manholes" && <AssetList path={path} kind="manholes" />}</TabsContent>
      </TabsRoot>
    </>}
    {editor.modal}
  </>;
}

function AssetList({ path, kind }: { path: string; kind: AssetKind }) {
  const base = `${path}/${kind}`;
  const query = useQuery<(Segment | Manhole)[]>(base);
  const editor = useEditor();
  const label = assetLabel[kind];
  const segment = kind === "segments";
  const name = (row: Segment | Manhole) => "number" in row ? row.number : row.manholeId;

  return <>
    <ListPanel title={segment ? "Segments" : "Manholes"} icon={segment ? Pipette : CircleDot} query={query}
      add={{ label: `Add ${label}`, click: (trigger) => editor.edit({
        title: `Add ${label}`, path: base, fields: assetFields[kind], trigger, onSaved: query.reload,
      }) }}
      columns={[
        { name: segment ? "Segment number" : "Manhole identifier", cell: (row) => <RowLink href={`${base}/${row.id}`}>{name(row)}</RowLink> },
        { name: "Status", cell: (row) => <StatusBadge value={row.inspectionStatusType} /> },
        { name: segment ? "Start coordinates" : "Inspected", cell: (row) => <span className="whitespace-nowrap text-muted-foreground">
          {"number" in row ? row.startingLongitudeLatitude || "—" : displayDate(row.inspectedDate)}
        </span> },
      ]}
      actions={(row) => <EditActions label={`${label} ${name(row)}`}
        edit={(trigger) => editor.edit({ title: `Edit ${label}`, path: `${base}/${row.id}`, fields: assetFields[kind], initial: row, trigger, onSaved: query.reload })}
        remove={(trigger) => editor.remove({ title: `Delete ${label} ${name(row)}?`, path: `${base}/${row.id}`, description: assetDeletion[kind], trigger, onSaved: query.reload })}
      />}
    />
    {editor.modal}
  </>;
}
