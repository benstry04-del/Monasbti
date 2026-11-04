import { emitExperienceEvent } from "../experience/experience-events";
export function registerExperienceCache() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener(
    "load",
    () =>
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => emitExperienceEvent("brand_offline_shell_registered"))
        .catch(() => emitExperienceEvent("brand_offline_cache_unavailable")),
    { once: true },
  );
}
