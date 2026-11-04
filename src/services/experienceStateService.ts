import { ExperienceStateService } from "../experience/core.mjs";
let storage: Storage | undefined;
try {
  storage = window.localStorage;
} catch {}
export const experienceStateService = new ExperienceStateService(storage);
window.addEventListener("storage", (e) => {
  if (e.key?.startsWith("habb")) {
    experienceStateService.diagnostics = null;
    experienceStateService.notify();
  }
});
