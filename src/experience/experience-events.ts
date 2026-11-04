export type ExperienceEvent = {
  name: string;
  at: string;
  metadata: Record<string, any>;
};
let records: ExperienceEvent[] = [];
let listeners = new Set<() => void>();
export function emitExperienceEvent(
  name: string,
  metadata: Record<string, any> = {},
) {
  const connection = (navigator as any).connection;
  const record = {
    name,
    at: new Date().toISOString(),
    metadata: {
      deviceClass:
        innerWidth < 768 ? "mobile" : innerWidth < 1024 ? "tablet" : "desktop",
      connection: connection?.effectiveType || "unknown",
      ...metadata,
    },
  };
  records = [record, ...records].slice(0, 150);
  listeners.forEach((f) => f());
  window.dispatchEvent(
    new CustomEvent("habb:experience-event", { detail: record }),
  );
}
export const experienceEvents = {
  getSnapshot: () => records,
  subscribe(f: () => void) {
    listeners.add(f);
    return () => listeners.delete(f);
  },
  clear() {
    records = [];
    listeners.forEach((f) => f());
  },
};
