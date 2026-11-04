import { loadingTier, contextForAction } from "./core.mjs";
import { emitExperienceEvent } from "./experience-events";
export type LoadingOptions = {
  scope?: "button" | "section" | "fullscreen";
  context?: string;
  message?: string;
  progress?: number;
};
type Operation = LoadingOptions & {
  id: string;
  started: number;
  tier: string;
  source: HTMLElement | null;
  timers: ReturnType<typeof setTimeout>[];
};
let operations: Operation[] = [];
const listeners = new Set<() => void>();
let snapshot = { operations };
const publish = () => {
  snapshot = { operations: [...operations] };
  listeners.forEach((f) => f());
};
export function requestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, "0")).join("");
}
export const loadingExperience = {
  subscribe(f: () => void) {
    listeners.add(f);
    return () => listeners.delete(f);
  },
  getSnapshot: () => snapshot,
  start(options: LoadingOptions = {}) {
    const id = requestId(),
      source = document.activeElement?.closest("button") as HTMLElement | null;
    const op: Operation = {
      id,
      context: "generic",
      scope: "button",
      ...options,
      source,
      started: performance.now(),
      tier: "hidden",
      timers: [],
    };
    operations = [...operations, op];
    publish();
    for (const delay of [350, 1200, 3000])
      op.timers.push(
        setTimeout(() => {
          if (!operations.some((x) => x.id === id)) return;
          op.tier = loadingTier(performance.now() - op.started + 2);
          if (delay === 350) {
            source?.setAttribute("aria-busy", "true");
            emitExperienceEvent("loading_experience_shown", {
              context: op.context,
              scope: op.scope,
            });
          }
          if (delay === 3000)
            emitExperienceEvent("loading_experience_long_operation", {
              context: op.context,
              duration: Math.round(performance.now() - op.started),
            });
          publish();
        }, delay),
      );
    return id;
  },
  finish(id: string) {
    const op = operations.find((x) => x.id === id);
    op?.timers.forEach(clearTimeout);
    op?.source?.removeAttribute("aria-busy");
    operations = operations.filter((x) => x.id !== id);
    publish();
  },
  update(id: string, progress: number) {
    const op = operations.find((x) => x.id === id);
    if (op && Number.isFinite(progress)) {
      op.progress = Math.min(1, Math.max(0, progress));
      publish();
    }
  },
  async run<T>(options: LoadingOptions, work: () => Promise<T>) {
    const id = this.start(options);
    try {
      return await work();
    } finally {
      this.finish(id);
    }
  },
  contextForAction,
};
