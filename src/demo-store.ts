import { loadingExperience } from "./experience/loading-controller";
import { experienceStateService } from "./services/experienceStateService";
import { useSyncExternalStore } from "react";
import { seed, dispatch, KEY } from "./domain.mjs";
let state;
try {
  state = JSON.parse(localStorage.getItem(KEY) || "null");
  if (state?.version !== 3) state = seed();
  else if (
    state.settings &&
    (state.settings.brand == null || state.settings.brand === "مناسبتي")
  ) {
    state.settings.brand = "هَبّ السعد";
    localStorage.setItem(KEY, JSON.stringify(state));
  }
} catch {
  state = seed();
}
const listeners = new Set<() => void>();
const emit = () => {
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((f) => f());
};
window.addEventListener("storage", (e) => {
  if (e.key === KEY && e.newValue) {
    state = JSON.parse(e.newValue);
    listeners.forEach((f) => f());
  }
});
async function hash(text: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
const rawApi = {
  get: () => state,
  async register(profile: any, password: string) {
    profile = { ...profile, email: profile.email.trim().toLowerCase() };
    const accounts = state.accounts || [];
    if (
      [
        "customer@demo.kw",
        "supplier@demo.kw",
        "staff@demo.kw",
        "admin@demo.kw",
      ].includes(profile.email) ||
      accounts.some((x) => x.email === profile.email)
    )
      throw Error("هذا البريد مسجل بالفعل");
    state.accounts = [
      ...accounts,
      { ...profile, passwordHash: await hash(password) },
    ];
    state.session = profile;
    emit();
  },
  async authenticate(email: string, password: string) {
    let account = state.accounts?.find((x) => x.email === email);
    if (!account || account.passwordHash !== (await hash(password)))
      return null;
    const { passwordHash, ...profile } = account;
    state.session = profile;
    emit();
    return profile;
  },
  async resetPassword(email: string, password: string) {
    email = email.trim().toLowerCase();
    const account = state.accounts?.find((x) => x.email === email);
    if (account) {
      account.passwordHash = await hash(password);
      emit();
    } else sessionStorage.setItem("demoReset:" + email, password);
  },
  async send(action: string, p: any = {}) {
    const network = experienceStateService.getDiagnostics().network;
    if (action !== "PLANNER")
      await new Promise((r) =>
        setTimeout(
          r,
          network === "slow4g" ? 3600 : network === "fast4g" ? 750 : 180,
        ),
      );
    if (
      network === "offline" &&
      !["OFFLINE", "LOGOUT", "LOGIN"].includes(action)
    )
      throw Error(
        "محاكاة عدم الاتصال: بياناتك محفوظة. أعد الشبكة من مختبر الحركة للمحاولة.",
      );
    if (state.offline && !["OFFLINE", "LOGOUT", "LOGIN"].includes(action))
      throw Error(
        "أنت في وضع عدم الاتصال التجريبي. أعد الاتصال من /demo للمحاولة.",
      );
    if (
      state.session?.role === "customer" &&
      [
        "QUOTE_ACCEPT",
        "CHANGES",
        "AMENDMENT_ACCEPT",
        "SIGN",
        "CANCEL",
        "FEEDBACK",
        "RENEW",
      ].includes(action)
    ) {
      const o = state.orders.find((x) => x.id === (p.id || state.activeOrder));
      if (o?.customerId !== state.session.id)
        throw Error("لا يمكنك تعديل طلب يخص حسابًا آخر");
    }
    state = dispatch(state, action, p);
    emit();
    return state;
  },
  reset() {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("demoReset:") || key === "registration")
        sessionStorage.removeItem(key);
    state = seed();
    emit();
  },
};
export const api = {
  ...rawApi,
  send(action: string, p: any = {}) {
    return loadingExperience.run(
      {
        context: loadingExperience.contextForAction(action, p, state.services),
        scope: "button",
      },
      () => rawApi.send(action, p),
    );
  },
  register(profile: any, password: string) {
    return loadingExperience.run(
      { context: "generic", scope: "fullscreen" },
      () => rawApi.register(profile, password),
    );
  },
  authenticate(email: string, password: string) {
    return loadingExperience.run(
      { context: "generic", scope: "fullscreen" },
      () => rawApi.authenticate(email, password),
    );
  },
  resetPassword(email: string, password: string) {
    return loadingExperience.run({ context: "generic", scope: "button" }, () =>
      rawApi.resetPassword(email, password),
    );
  },
};
export function useStore() {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => state,
  );
}
