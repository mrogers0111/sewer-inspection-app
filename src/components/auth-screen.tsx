import { ArrowRight, LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { User } from "@/domain";
import { api, ApiError } from "@/lib/api";
import { Brand, ErrorMessage } from "./shared";
import { Button, Input } from "./ui/primitives";

export function AuthScreen({ expired, onLogin }: { expired: boolean; onLogin: (user: User) => void }) {
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError(undefined);
    setNotice("");
    try {
      if (registering) {
        await api("/auth/register", { method: "POST", data, authForm: true });
        setRegistering(false);
        setNotice("Account created. Sign in to open your workspace.");
      } else {
        onLogin(await api<User>("/auth/login", { method: "POST", data, authForm: true }));
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError(0, "Unable to complete this action."));
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-dvh lg:grid-cols-[minmax(23rem,0.85fr)_1fr]">
    <aside className="auth-aside relative isolate flex min-h-28 flex-col justify-between overflow-hidden bg-[#12352c] px-6 py-6 text-white sm:px-10 lg:min-h-dvh lg:px-14 lg:py-12">
      <Brand />
      <div className="auth-pattern pointer-events-none absolute inset-0 -z-10 hidden lg:block" aria-hidden />
      <div className="hidden lg:block">
        <p className="max-w-md text-4xl font-semibold leading-[1.1] tracking-tight xl:text-5xl">Sewer inspection workspace</p>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-[#c2d9cf]">Manage projects and track segment and manhole inspections.</p>
      </div>
    </aside>
    <div className="grid place-items-center px-6 py-10 sm:px-12">
      <div className="w-full max-w-[25rem]">
        <div className="mb-6 grid size-12 place-items-center rounded-xl border bg-card text-primary shadow-xs"><LockKeyhole size={21} aria-hidden /></div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{registering ? "Create an account" : "Sign in"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{registering ? "Create your account and a new organization." : "Sign in to your inspection workspace."}</p>
        {expired && !registering && !notice && <p role="status" className="mt-5 rounded-md border bg-accent p-3 text-sm">Your session expired. Sign in to return to your workspace.</p>}
        {notice && <p role="status" className="mt-5 rounded-md border bg-accent p-3 text-sm">{notice}</p>}
        <form key={String(registering)} className="mt-6 grid gap-4" onSubmit={submit}>
          {error && <ErrorMessage message={error.message} />}
          <AuthField name="email" label="Email" type="email" autoComplete="username" value={email} onChange={setEmail} error={error?.fields.email} busy={busy} />
          <AuthField name="password" label="Password" type="password" autoComplete={registering ? "new-password" : "current-password"} minLength={registering ? 8 : undefined} error={error?.fields.password} busy={busy} />
          {registering && <AuthField name="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" error={error?.fields.confirmPassword} busy={busy} />}
          <Button type="submit" className="mt-1 h-11 w-full" disabled={busy}>{busy ? "Please wait…" : registering ? "Create account" : "Sign in"}<ArrowRight aria-hidden /></Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {registering ? "Already have an account? " : "Need an account? "}
          <button type="button" className="font-semibold text-primary underline-offset-4 hover:underline" disabled={busy}
            onClick={() => { setRegistering(!registering); setError(undefined); setNotice(""); }}>
            {registering ? "Sign in" : "Register"}
          </button>
        </p>
      </div>
    </div>
  </main>;
}

function AuthField({ name, label, type, autoComplete, value, onChange, minLength, error, busy }: {
  name: string; label: string; type: string; autoComplete: string; value?: string;
  onChange?: (value: string) => void; minLength?: number; error?: string; busy: boolean;
}) {
  return <div className="grid gap-1.5">
    <label htmlFor={name} className="text-sm font-semibold">{label}</label>
    <Input id={name} name={name} type={type} autoComplete={autoComplete} value={value} disabled={busy}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      minLength={minLength} required aria-invalid={!!error} aria-describedby={error ? name + "-error" : undefined} />
    {error && <span id={name + "-error"} className="text-sm text-destructive">{error}</span>}
  </div>;
}
