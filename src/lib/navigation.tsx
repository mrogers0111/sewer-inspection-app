import { createContext, useContext, useEffect, useState, type ComponentProps, type ReactNode } from "react";

const Navigation = createContext({
  location: "/",
  go: (_href: string, _replace = false) => {},
});

export function NavigationProvider({ children }: { children: ReactNode }) {
  const current = () => window.location.pathname + window.location.search;
  const [location, setLocation] = useState(current);
  useEffect(() => {
    const update = () => setLocation(current());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return <Navigation.Provider value={{
    location,
    go(href, replace = false) {
      if (href === current()) return;
      if (replace) window.history.replaceState(null, "", href);
      else window.history.pushState(null, "", href);
      setLocation(current());
      window.scrollTo(0, 0);
    },
  }}>{children}</Navigation.Provider>;
}

export const useNavigation = () => useContext(Navigation);

export function Link({ href, onClick, ...props }: ComponentProps<"a"> & { href: string }) {
  const { go } = useNavigation();
  return <a href={href} {...props} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    go(href);
  }} />;
}

export const projectIndex = (orgId: string) => `/organizations/${orgId}/projects`;
