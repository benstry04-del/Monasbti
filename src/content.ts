import { useStore } from "./store";
export function useContent() {
  const published = useStore().content;
  let preview = {};
  if (new URLSearchParams(location.search).get("contentPreview") === "1" && window.parent !== window) {
    try { preview = JSON.parse(sessionStorage.getItem("habb:content-preview") || "{}"); } catch {}
  }
  return (key: string, fallback: string): string => preview[key] ?? published?.[key] ?? fallback;
}
