import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border bg-card hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: { default: "h-10 px-4", sm: "h-9 px-3", icon: "size-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({ className, variant, size, asChild, ...props }: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return <Component data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

const fieldClass = "w-full rounded-md border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 aria-invalid:border-destructive disabled:opacity-50 sm:text-sm";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn("h-10", fieldClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn("min-h-24 py-2.5", fieldClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn("h-10", fieldClass, className)} {...props} />;
}

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap", className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("min-w-0 rounded-xl border bg-card shadow-xs", className)} {...props} />;
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <div className="w-full overflow-x-auto">
    <table className={cn("w-full text-left text-sm", className)} {...props} />
  </div>;
}

export function TableHead(props: ComponentProps<"th">) {
  return <th scope="col" {...props} className={cn("border-b bg-muted/60 px-4 py-3 font-semibold whitespace-nowrap text-muted-foreground sm:px-5", props.className)} />;
}

export function TableCell(props: ComponentProps<"td">) {
  return <td {...props} className={cn("px-4 py-3.5 align-middle sm:px-5", props.className)} />;
}

export const TabsRoot = Tabs.Root;
export const TabsContent = Tabs.Content;

export function TabsList(props: ComponentProps<typeof Tabs.List>) {
  return <Tabs.List {...props} className={cn("inline-flex max-w-full items-center gap-1 rounded-lg border bg-muted p-1", props.className)} />;
}

export function TabsTrigger(props: ComponentProps<typeof Tabs.Trigger>) {
  return <Tabs.Trigger {...props} className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm [&_svg]:size-4", props.className)} />;
}

export function Modal({ title, description, onClose, busy, children, trigger }: {
  title: string; description: string; onClose: () => void; busy: boolean; children: ReactNode; trigger: HTMLElement | null;
}) {
  return <Dialog.Root open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-20 bg-black/40" />
      <Dialog.Content
        className="fixed left-1/2 top-1/2 z-30 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-5 shadow-xl sm:p-6"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (trigger?.isConnected) trigger.focus();
          else document.querySelector<HTMLElement>("main h1")?.focus();
        }}
      >
        <Dialog.Title className="pr-10 text-lg font-semibold">{title}</Dialog.Title>
        <Dialog.Description className="mt-1.5 pr-8 text-sm text-muted-foreground">{description}</Dialog.Description>
        <Dialog.Close asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="Close dialog" className="absolute right-3 top-3" disabled={busy}><X /></Button>
        </Dialog.Close>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
