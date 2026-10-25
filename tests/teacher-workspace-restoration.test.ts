import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Run the actual effect with deterministic DOM/history/frame adapters. This
// checks placement timing and ownership, not browser layout or Next routing.
const source = readFileSync(
  new URL("../app/teacher/workspace-restoration.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;

function fixture() {
  type Listener = (event: { type: string }) => void;
  type Cleanup = (() => void) | undefined;
  const documentListeners = new Map<string, Set<Listener>>();
  const windowListeners = new Map<string, Set<Listener>>();
  const observers = new Set<() => void>();
  const frames = new Map<number, () => void>();
  const announcements: string[] = [];
  const scrolls: number[] = [];
  let nextFrame = 0;
  let cleanup: Cleanup;
  let unsubscribe: Cleanup;
  let url = new URL("https://example.test/teacher");
  let state: Record<string, unknown> | null = null;
  let pendingBody = false;
  let height = 2000;
  let scrollY = 0;

  class Element {
    scrollLeft = 0;
    scrollTop = 0;
    tabIndex = 0;
    isConnected = true;
    dataset: Record<string, string> = {};
    managed = false;
    id: string;
    constructor(id: string) {
      this.id = id;
    }
    getClientRects() {
      return this.isConnected ? [{}] : [];
    }
    closest(selector: string) {
      if (selector === "#main-content") return this === body ? null : main;
      if (selector.includes("data-workspace-restoration"))
        return this.managed ? this : null;
      return null;
    }
    matches() {
      return false;
    }
    querySelector() {
      return pendingBody ? marker : null;
    }
    focus() {
      document.activeElement = this;
    }
  }
  class Anchor extends Element {
    getAttribute() {
      return "/teacher/lessons";
    }
  }
  const body = new Element("body");
  const main = new Element("main-content");
  const marker = new Element("loading");
  const heading = new Element("destination-heading");
  const control = new Element("saved-control");
  const pane = new Element("saved-pane");
  const document = {
    body,
    activeElement: body,
    getElementById(id: string) {
      return [main, heading, control, pane].find((item) => item.id === id);
    },
    querySelector() {
      return pendingBody ? null : heading;
    },
    querySelectorAll(selector: string) {
      return selector.includes("data-workspace-scroll") ? [pane] : [];
    },
    addEventListener(name: string, listener: Listener) {
      const values = documentListeners.get(name) ?? new Set();
      values.add(listener);
      documentListeners.set(name, values);
    },
    removeEventListener(name: string, listener: Listener) {
      documentListeners.get(name)?.delete(listener);
    },
  };
  const window = {
    get location() {
      return url;
    },
    history: {
      get state() {
        return state;
      },
      replaceState(value: Record<string, unknown>) {
        state = value;
      },
    },
    crypto: webcrypto,
    get scrollX() {
      return 0;
    },
    get scrollY() {
      return scrollY;
    },
    scrollTo(_x: number, y: number) {
      scrollY = Math.min(y, height);
      scrolls.push(scrollY);
    },
    addEventListener(name: string, listener: Listener) {
      const values = windowListeners.get(name) ?? new Set();
      values.add(listener);
      windowListeners.set(name, values);
    },
  };
  const exports: Record<string, unknown> = {};
  runInNewContext(compiled, {
    exports,
    document,
    window,
    HTMLElement: Element,
    HTMLAnchorElement: Anchor,
    DOMException,
    URLSearchParams,
    CSS: { escape: (value: string) => value },
    queueMicrotask,
    requestAnimationFrame(callback: () => void) {
      frames.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame(id: number) {
      frames.delete(id);
    },
    MutationObserver: class {
      callback: () => void;
      constructor(callback: () => void) {
        this.callback = callback;
      }
      observe() {
        observers.add(this.callback);
      }
      disconnect() {
        observers.delete(this.callback);
      }
    },
    require(name: string) {
      if (name === "react")
        return {
          useEffect(effect: () => Cleanup) {
            cleanup = effect();
          },
          useState: () => ["", (value: string) => announcements.push(value)],
          useSyncExternalStore(
            subscribe: (notify: () => void) => Cleanup,
            snapshot: () => number,
          ) {
            unsubscribe ??= subscribe(() => {});
            return snapshot();
          },
        };
      if (name === "next/navigation")
        return {
          usePathname: () => url.pathname,
          useSearchParams: () => url.searchParams,
        };
      if (name === "react/jsx-runtime") return { jsx: () => null };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  const component = exports.WorkspaceNavigationRestoration as (props: {
    label: string;
    pending: boolean;
  }) => unknown;

  function mount(pending = false) {
    cleanup?.();
    cleanup = undefined;
    component({ label: "Overview", pending });
  }
  function flush() {
    const queued = [...frames.values()];
    frames.clear();
    queued.forEach((callback) => callback());
  }
  function emit(listeners: Map<string, Set<Listener>>, type: string) {
    listeners.get(type)?.forEach((listener) => listener({ type }));
  }
  function savedReturn() {
    mount();
    flush();
    const originalState = state;
    control.focus();
    scrollY = 700;
    pane.scrollTop = 140;
    emit(documentListeners, "scroll");
    url = new URL("https://example.test/teacher/lessons");
    state = null;
    mount();
    flush();
    url = new URL("https://example.test/teacher");
    state = originalState;
    height = 0;
    scrollY = 0;
    pane.scrollTop = 0;
    document.activeElement = body;
    emit(windowListeners, "popstate");
    announcements.length = 0;
    scrolls.length = 0;
  }
  return {
    mount,
    flush,
    savedReturn,
    scrolls,
    announcements,
    pane,
    heading,
    control,
    document,
    get observerCount() {
      return observers.size;
    },
    setBody(pending: boolean) {
      pendingBody = pending;
      height = pending ? 0 : 2000;
      observers.forEach((notify) => notify());
    },
    setHash() {
      url.hash = "exact-evidence";
    },
    savePendingEvents() {
      emit(documentListeners, "scroll");
      emit(documentListeners, "focusin");
    },
    unmount() {
      cleanup?.();
      unsubscribe?.();
    },
  };
}

test("route loading does not consume Back placement or overwrite it with clamped scroll", () => {
  const app = fixture();
  app.savedReturn();
  app.mount(true);
  app.flush();
  app.savePendingEvents();
  assert.deepEqual(app.scrolls, []);
  assert.deepEqual(app.announcements, []);
  app.setBody(false);
  app.mount();
  app.flush();
  assert.deepEqual(app.scrolls, [700]);
  assert.equal(app.pane.scrollTop, 140);
  assert.equal(app.document.activeElement, app.control);
  assert.deepEqual(app.announcements, ["Overview workspace"]);
  app.unmount();
});

test("same-shell streamed fallback waits for the resolved body before restoring Back", () => {
  const app = fixture();
  app.savedReturn();
  app.setBody(true);
  app.mount();
  app.flush();
  app.savePendingEvents();
  assert.deepEqual(app.scrolls, []);
  assert.deepEqual(app.announcements, []);
  assert.equal(app.observerCount, 1);
  app.setBody(false);
  app.flush();
  assert.deepEqual(app.scrolls, [700]);
  assert.equal(app.pane.scrollTop, 140);
  assert.equal(app.document.activeElement, app.control);
  assert.equal(app.observerCount, 0);
  app.unmount();
});

for (const owner of ["hash", "page"] as const)
  test(`resolved streaming preserves ${owner}-owned placement`, () => {
    const app = fixture();
    app.savedReturn();
    app.setBody(true);
    app.mount();
    app.flush();
    if (owner === "hash") app.setHash();
    else {
      app.control.managed = true;
      app.control.focus();
    }
    app.setBody(false);
    app.flush();
    assert.deepEqual(app.scrolls, []);
    if (owner === "page") assert.equal(app.document.activeElement, app.control);
    assert.equal(app.observerCount, 0);
    app.unmount();
  });

test("leaving a streamed fallback cancels its observer and queued placement", () => {
  const app = fixture();
  app.savedReturn();
  app.setBody(true);
  app.mount();
  app.flush();
  assert.equal(app.observerCount, 1);
  app.setBody(false);
  app.unmount();
  app.flush();
  assert.equal(app.observerCount, 0);
  assert.deepEqual(app.scrolls, []);
  assert.deepEqual(app.announcements, []);
});
