import { ChevronRight, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/lib/navigation";
import { Busy, EmptyState, ErrorMessage } from "./shared";
import { Button, Card, Table, TableCell, TableHead } from "./ui/primitives";

type Column<T> = { name: string; cell: (row: T) => ReactNode };
type Row = { id: number };
type Query<T> = { data?: T; loading: boolean; error?: string; reload: () => void };

export function DataTable<T extends Row>({ title, columns, rows, actions }: {
  title: string; columns: Column<T>[]; rows: T[]; actions?: (row: T) => ReactNode;
}) {
  return <Table>
    <caption className="sr-only">{title}</caption>
    <thead><tr>
      {columns.map(({ name }) => <TableHead key={name}>{name}</TableHead>)}
      {actions && <TableHead className="w-px text-right">Actions</TableHead>}
    </tr></thead>
    <tbody className="divide-y">
      {rows.map((row) => <tr key={row.id} className="hover:bg-muted/30">
        {columns.map(({ name, cell }) => <TableCell key={name}>{cell(row)}</TableCell>)}
        {actions && <TableCell><div className="flex justify-end gap-1">{actions(row)}</div></TableCell>}
      </tr>)}
    </tbody>
  </Table>;
}

export function ListPanel<T extends Row>({ title, icon, query, columns, actions, add, children }: {
  title: string; icon: LucideIcon; query: Query<T[]>; columns: Column<T>[];
  actions?: (row: T) => ReactNode;
  add?: { label: string; click: (trigger: HTMLElement) => void };
  children?: ReactNode;
}) {
  return <Card>
    <div className="flex min-h-[4.5rem] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {add && <AddButton {...add} variant="outline" />}
    </div>
    {query.error && <div className="p-4 pt-0"><ErrorMessage message={query.error} retry={query.reload} /></div>}
    {query.loading && !query.data && <Busy />}
    {!!query.data?.length && <DataTable title={title} columns={columns} rows={query.data} actions={actions} />}
    {query.data?.length === 0 && !query.loading && <EmptyState icon={icon} title={`No ${title.toLowerCase()} yet`} />}
    {children}
  </Card>;
}

export function AddButton({ label, click, variant = "default" }: {
  label: string; click: (trigger: HTMLElement) => void; variant?: "default" | "outline";
}) {
  return <Button type="button" variant={variant} onClick={(event) => click(event.currentTarget)}><Plus aria-hidden />{label}</Button>;
}

export function EditActions({ label, edit, remove }: {
  label: string; edit: (trigger: HTMLElement) => void; remove: (trigger: HTMLElement) => void;
}) {
  return <>
    <Button type="button" variant="ghost" size="icon" aria-label={`Edit ${label}`} title={`Edit ${label}`}
      onClick={(event) => edit(event.currentTarget)}><Pencil aria-hidden /></Button>
    <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${label}`} title={`Delete ${label}`}
      onClick={(event) => remove(event.currentTarget)}><Trash2 aria-hidden /></Button>
  </>;
}

export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex max-w-72 items-center gap-1.5 font-semibold text-primary underline-offset-4 hover:underline">
    <span className="break-words">{children}</span><ChevronRight size={15} className="shrink-0" aria-hidden />
  </Link>;
}
