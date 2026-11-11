import { Building2, FolderKanban, LogOut, PanelTop } from "lucide-react";
import { useEffect, useState } from "react";
import { AssetPage } from "./components/asset-page";
import { AuthScreen } from "./components/auth-screen";
import { ProjectPage, ProjectsPage } from "./components/project-pages";
import { Brand, Busy, EmptyState, ErrorMessage, PageHeading } from "./components/shared";
import { Button, Card, Select } from "./components/ui/primitives";
import type { Organization, User } from "./domain";
import { api, ApiError, useQuery } from "./lib/api";
import { Link, NavigationProvider, projectIndex, useNavigation } from "./lib/navigation";
import "./index.css";

export function App() {
  return <NavigationProvider><Session /></NavigationProvider>;
}

function Session() {
  const [user, setUser] = useState<User | null>();
  const [expired, setExpired] = useState(false);
  const [startupError, setStartupError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<User>("/auth/session", { signal: controller.signal }).then(
      (active) => { if (!controller.signal.aborted) setUser(active); },
      (error: ApiError) => {
        if (controller.signal.aborted) return;
        if (error.status === 401) setUser(null);
        else setStartupError(error.message);
      },
    );
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const expire = () => { setUser(null); setExpired(true); };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);

  if (startupError) return <main className="mx-auto grid max-w-md gap-6 p-6 pt-16">
    <Brand /><ErrorMessage message={startupError} retry={() => { setStartupError(""); setAttempt((count) => count + 1); }} />
  </main>;
  if (user === undefined) return <main className="mx-auto max-w-md p-6 pt-16"><Brand /><Busy text="Opening workspace…" /></main>;
  if (!user) return <AuthScreen expired={expired} onLogin={(active) => { setExpired(false); setUser(active); }} />;
  return <Workspace user={user} onLogout={() => setUser(null)} />;
}

function Workspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { location, go } = useNavigation();
  const [pathname, search] = location.split("?");
  const query = useQuery<Organization[]>("/organizations");
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const route = /^\/organizations\/([^/]+)\/projects(?:\/([1-9]\d*)(?:\/(segments|manholes)\/([1-9]\d*))?)?\/?$/.exec(pathname ?? "");
  const defaultOrg = query.data?.[0];
  const org = route ? query.data?.find(({ id }) => id === route[1]?.toLowerCase()) : defaultOrg;
  const base = org ? projectIndex(org.id) : undefined;
  const projectPath = base && route?.[2] ? `${base}/${route[2]}` : undefined;
  const kind = route?.[3] === "manholes" ? "manholes" : "segments";
  const assetPath = projectPath && route?.[4] ? `${projectPath}/${kind}/${route[4]}` : undefined;
  const params = new URLSearchParams(search);
  const rawPage = Number(params.get("page") ?? 1);
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 2147483647 ? rawPage : 1;

  useEffect(() => {
    if (pathname === "/" && base) go(base, true);
  }, [pathname, base, go]);

  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await api("/auth/logout", { method: "POST" });
      go("/", true);
      onLogout();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Could not sign out.");
      setLoggingOut(false);
    }
  }

  return <div className="min-h-dvh md:grid md:grid-cols-[15.5rem_minmax(0,1fr)]">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-card focus:p-3">Skip to content</a>
    <aside className="flex flex-col gap-5 bg-[#12352c] px-4 py-4 text-white md:sticky md:top-0 md:h-dvh md:gap-8 md:px-5 md:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={base ?? (defaultOrg ? projectIndex(defaultOrg.id) : "/")} aria-label="Sewer Inspection home"><Brand /></Link>
        <Button variant="ghost" size="icon" type="button" className="text-[#d1e5db] hover:bg-white/10 hover:text-white md:hidden"
          onClick={logout} disabled={loggingOut} aria-label="Sign out"><LogOut aria-hidden /></Button>
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 md:grid-cols-1">
        {!!query.data?.length && <div className="grid min-w-0 gap-1.5">
          <label htmlFor="organization" className="flex items-center gap-1.5 text-xs font-semibold text-[#b9d1c6]"><Building2 size={14} aria-hidden />Organization</label>
          <Select id="organization" value={org?.id ?? ""} className="min-w-0 border-white/20 bg-white/10 text-white [&_option]:bg-card [&_option]:text-foreground"
            onChange={(event) => go(projectIndex(event.target.value))}>
            {!org && <option value="" disabled>Select an organization</option>}
            {query.data.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </Select>
        </div>}
        {base && <nav aria-label="Workspace" className="hidden md:block">
          <Link href={base} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-semibold hover:bg-white/15">
            <FolderKanban size={17} aria-hidden />Projects
          </Link>
        </nav>}
      </div>
      <div className="mt-auto hidden min-w-0 border-t border-white/15 pt-4 md:block">
        <p className="mb-2 truncate px-2 text-xs text-[#b9d1c6]" title={user.email}>{user.email}</p>
        <Button type="button" variant="ghost" className="w-full justify-start text-[#e0ece6] hover:bg-white/10 hover:text-white"
          onClick={logout} disabled={loggingOut}><LogOut aria-hidden />{loggingOut ? "Signing out…" : "Sign out"}</Button>
      </div>
    </aside>
    <main id="main-content" className="min-w-0">
      <div className="hidden min-h-16 items-center gap-2 border-b bg-card px-8 text-sm font-medium text-muted-foreground md:flex">
        <PanelTop size={16} aria-hidden />Workspace
      </div>
      <div className="mx-auto max-w-6xl p-4 py-6 sm:p-7 md:p-8 lg:px-11 lg:py-10">
        {logoutError && <div className="mb-5"><ErrorMessage message={logoutError} retry={logout} /></div>}
        {query.error && <ErrorMessage message={query.error} retry={query.reload} />}
        {query.loading && !query.data && <Card><Busy text="Loading organizations…" /></Card>}
        {query.data?.length === 0 && <>
          <PageHeading title="Projects" />
          <Card><EmptyState icon={Building2} title="No organizations" description="Projects are available once your account belongs to an organization." /></Card>
        </>}
        {query.data?.length && (!org || !route && pathname !== "/") ? <>
          <PageHeading title="Page unavailable" />
          <p className="mb-4 text-sm text-muted-foreground">This page could not be found in your workspace.</p>
          {defaultOrg && <Button asChild><Link href={projectIndex(defaultOrg.id)}>View projects</Link></Button>}
        </> : null}
        {base && org && (route || pathname === "/") && (
          assetPath && projectPath ? <AssetPage key={assetPath} path={assetPath} projectPath={projectPath} kind={kind} />
            : projectPath ? <ProjectPage key={projectPath} path={projectPath} base={base} tab={params.get("tab") === "manholes" ? "manholes" : "segments"} />
            : <ProjectsPage key={base} base={base} org={org} page={page} />
        )}
      </div>
    </main>
  </div>;
}
