import { ArrowLeft, CircleAlert, Droplets, LoaderCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { statuses } from "@/domain";
import { Badge, Button } from "./ui/primitives";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return <div className={cn("flex items-center gap-3", className)}>
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#c5f0d8] text-[#173d30]"><Droplets size={22} aria-hidden /></span>
    <span className="text-base font-bold tracking-tight">Sewer Inspection</span>
  </div>;
}

export function Busy({ text = "Loading…" }: { text?: string }) {
  return <div role="status" className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
    <LoaderCircle aria-hidden className="size-4 animate-spin" />{text}
  </div>;
}

export function ErrorMessage({ message, retry }: { message: string; retry?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
    <CircleAlert className="size-4 shrink-0" aria-hidden />
    <span>{message}</span>
    {retry && <Button type="button" variant="outline" size="sm" onClick={retry}>Try again</Button>}
  </div>;
}

export function EmptyState({ icon: Icon, title, description, children }: {
  icon: LucideIcon; title: string; description?: string; children?: ReactNode;
}) {
  return <div className="flex min-h-44 flex-col items-center justify-center gap-2 px-5 py-9 text-center">
    <span className="mb-1 grid size-11 place-items-center rounded-xl bg-accent text-primary"><Icon size={21} aria-hidden /></span>
    <p className="font-semibold">{title}</p>
    {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
    {children}
  </div>;
}

const statusColors = [
  "border-slate-200 bg-slate-50 text-slate-700",
  "border-emerald-200 bg-emerald-50 text-emerald-800",
  "border-amber-200 bg-amber-50 text-amber-900",
  "border-rose-200 bg-rose-50 text-rose-800",
];

export function StatusBadge({ value }: { value: number }) {
  return <Badge className={statusColors[value]}>
    <span className="size-1.5 rounded-full bg-current" aria-hidden />{statuses[value] ?? "Unknown"}
  </Badge>;
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
    <ArrowLeft className="size-4" aria-hidden />{children}
  </Link>;
}

export function PageHeading({ title, detail, actions }: { title: string; detail?: string; actions?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      <h1 tabIndex={-1} className="break-words text-3xl font-semibold tracking-tight outline-none sm:text-[2.5rem]">{title}</h1>
      {detail && <p className="mt-1.5 break-words text-sm text-muted-foreground sm:text-base">{detail}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>;
}

export function displayDate(value: string) {
  return value.replace("T", " ");
}
