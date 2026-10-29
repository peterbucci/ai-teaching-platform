import {
  createContext,
  createElement,
  startTransition,
  useContext,
  useLayoutEffect,
  useState,
} from "react";
const listeners = new Set();
const currentLocation = () => ({
  pathname: window.location.pathname,
  search: window.location.search,
});
const NavigationContext = createContext(currentLocation());
export function NavigationProvider({ children }) {
  const [snapshot, setSnapshot] = useState(currentLocation);
  useLayoutEffect(() => {
    listeners.add(setSnapshot);
    return () => {
      listeners.delete(setSnapshot);
    };
  }, []);
  return createElement(
    NavigationContext.Provider,
    { value: snapshot },
    children,
  );
}
export function notifyNavigation() {
  const snapshot = currentLocation();
  // Next 16.4.3 sequential-router-queue.restore publishes router state inside
  // startTransition. Local urgent state can commit before that URL reaches
  // useSearchParams. A synchronous external store concealed this focus race.
  startTransition(() => {
    for (const notify of listeners) notify(snapshot);
  });
}
export function useSearchParams() {
  return new URLSearchParams(useContext(NavigationContext).search);
}
export function usePathname() {
  return useContext(NavigationContext).pathname;
}
export function go(href, replace = false) {
  const next = new URL(href, window.location.href);
  if (next.origin !== window.location.origin)
    throw new Error("External fixture navigation denied");
  window.history[replace ? "replaceState" : "pushState"](null, "", next);
}
export function useRouter() {
  return {
    push: go,
    replace: (href) => go(href, true),
    refresh: notifyNavigation,
    prefetch() {},
  };
}
// Model the installed Next 16.4.3 app-router history wrapper boundary.
// Router-owned writes carrying __NA/_N bypass hook synchronization. External
// URL writes copy Next's private fields, then synchronize the router snapshot.
// Metadata-only stamping must not notify hooks, and hooks must not read the
// live URL on an unrelated local render after a bypassed internal write.
window.history.replaceState(
  {
    ...window.history.state,
    __NA: true,
    __PRIVATE_NEXTJS_INTERNALS_TREE: { componentFixture: true },
  },
  "",
);
for (const method of ["pushState", "replaceState"]) {
  const original = window.history[method].bind(window.history);
  window.history[method] = (data, unused, url) => {
    if (data?.__NA || data?._N) return original(data, unused, url);
    const next = { ...(data ?? {}) };
    const current = window.history.state;
    if (current?.__NA) next.__NA = current.__NA;
    if (current?.__PRIVATE_NEXTJS_INTERNALS_TREE)
      next.__PRIVATE_NEXTJS_INTERNALS_TREE =
        current.__PRIVATE_NEXTJS_INTERNALS_TREE;
    const result = original(next, unused, url);
    if (url) notifyNavigation();
    return result;
  };
}
window.addEventListener("popstate", notifyNavigation);
window.addEventListener("hashchange", notifyNavigation);
