export const staffAllowed = [
  "", "orders", "quotes", "approvals", "contracts", "suppliers",
  "customers", "events", "reports", "audit", "settlements", "deliveries",
];

export function accountHome(role?: string) {
  if (role === "supplier") return "/supplier";
  if (role === "admin" || role === "staff") return "/admin";
  return "/dashboard";
}

export function authPath(kind: string, next = "") {
  return "/auth/" + kind + (next ? "?next=" + encodeURIComponent(next) : "");
}

export function loginDestination(role: string, next: string) {
  const home = accountHome(role);
  if (!/^\/(?![\/\\])/.test(next) || /[\\\x00-\x20]/.test(next)) return home;
  const target = new URL(next, location.origin);
  if (target.origin !== location.origin) return home;
  const path = target.pathname;
  if (/^\/(auth|api|health|demo)(\/|$)/.test(path)) return home;
  if (path.startsWith("/admin") && home !== "/admin") return home;
  if (role === "staff" && path.startsWith("/admin/") && !staffAllowed.includes(path.split("/")[2])) return home;
  if (path.startsWith("/supplier") && role !== "supplier") return home;
  if (/^\/(planner|cart|dashboard|favorites|checkout|payment-result)(\/|$)/.test(path) && role !== "customer") return home;
  return target.pathname + target.search + target.hash;
}
