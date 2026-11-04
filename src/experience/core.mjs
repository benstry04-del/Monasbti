export const INTRO_VERSION = "1";
export const motionTokens = Object.freeze({
  duration: {
    instant: 0.12,
    fast: 0.22,
    standard: 0.42,
    elegant: 0.72,
    splashSegment: 0.9,
  },
  easing: {
    standard: [0.22, 1, 0.36, 1],
    enter: [0.16, 1, 0.3, 1],
    exit: [0.7, 0, 0.84, 0],
    luxury: [0.25, 0.8, 0.2, 1],
  },
  timing: {
    micro: 350,
    section: 1200,
    fullscreen: 3000,
    skip: 2800,
    splashMinimum: 1450,
    reducedSplash: 950,
    transition: 420,
    filmTransition: 720,
    mediaWait: 4500,
    mediaFailure: 1250,
    loop: 2600,
    splashReveal: 220,
    splashGather: 800,
    splashAssemble: 1100,
    failOpen: 3500,
    diagnosticMediaDelay: 5500,
  },
});
export const loadingMessages = {
  generic: "لحظة… نرتّبها لك",
  services: "نرتّب لك الخدمات المناسبة…",
  venues: "نفتح لك أجمل الخيارات…",
  hospitality: "نرتّب تفاصيل الضيافة…",
  quote: "نجمع تفاصيل مناسبتك…",
  contract: "نجهّز العرض والعقد للمراجعة…",
  payment: "جاري تأمين عملية الدفع…",
  verification: "بانتظار تأكيد الدفع",
  success: "تمت الدفعة بنجاح",
};
export const DEFAULT_DIAGNOSTICS = Object.freeze({
  network: "normal",
  media: "normal",
  renderer: "auto",
  reducedMotion: "system",
  appReadyDelay: 0,
  introVersion: INTRO_VERSION,
});
export const keys = {
  seen: "habbIntroSeenVersion",
  completed: "habbIntroCompletedAt",
  skipped: "habbIntroSkipped",
  mute: "habbMotionMuted",
  diagnostics: "habbMotionDiagnostics.v1",
};
export function loadingTier(elapsed) {
  return elapsed < 350
    ? "hidden"
    : elapsed < 1200
      ? "micro"
      : elapsed < 3000
        ? "section"
        : "fullscreen";
}
export function progressPhase(progress) {
  if (typeof progress !== "number" || !Number.isFinite(progress)) return "loop";
  const p = Math.min(1, Math.max(0, progress));
  return p < 0.2
    ? "arrival"
    : p < 0.45
      ? "reveal"
      : p < 0.7
        ? "gather"
        : p < 0.9
          ? "assemble"
          : "lock";
}
export function resolveExperience(seen, current = INTRO_VERSION) {
  return Number(seen || 0) >= Number(current)
    ? "RETURNING_USER"
    : Number(seen || 0) > 0
      ? "NEW_INTRO_VERSION"
      : "NEW_USER";
}
export function canSkip(elapsed, { reduced = false, failed = false } = {}) {
  return reduced || failed ? elapsed >= 1250 : elapsed >= 2800;
}
export function contextForAction(action, p = {}, services = []) {
  if (["PAY", "WEBHOOK", "REFUND", "REFUND_SETTLE"].includes(action))
    return "payment";
  if (["SIGN", "QUOTE_ACCEPT", "APPROVE_INTERNAL"].includes(action))
    return "contract";
  if (
    [
      "PRICE",
      "PUBLISH",
      "SUBMIT",
      "AMENDMENT_CREATE",
      "AMENDMENT_ACCEPT",
    ].includes(action)
  )
    return "quote";
  if (action.startsWith("CART")) {
    const item = services.find((x) => x.id === p.id);
    return /قاعات|كوش/.test(item?.category || "")
      ? "venues"
      : /ضيافة|بوفيه/.test(item?.category || "")
        ? "hospitality"
        : "services";
  }
  return "generic";
}
export function chooseRenderer({
  reduced = false,
  webgl = true,
  lowMemory = false,
  saveData = false,
  forced = "auto",
} = {}) {
  return reduced
    ? "static"
    : !webgl || lowMemory || saveData || forced === "fallback"
      ? "css"
      : "webgl";
}
export class ExperienceStateService {
  constructor(storage, clock = () => new Date().toISOString()) {
    this.storage = storage;
    this.clock = clock;
    this.memory = new Map();
    this.listeners = new Set();
    this.diagnostics = null;
    this.persistent = true;
  }
  read(key) {
    try {
      const value = this.storage?.getItem(key);
      return value ?? this.memory.get(key) ?? null;
    } catch {
      this.persistent = false;
      return this.memory.get(key) ?? null;
    }
  }
  write(key, value) {
    this.memory.set(key, value);
    try {
      this.storage?.setItem(key, value);
    } catch {
      this.persistent = false;
    }
  }
  remove(key) {
    this.memory.delete(key);
    try {
      this.storage?.removeItem(key);
    } catch {
      this.persistent = false;
    }
  }
  resolve(version = INTRO_VERSION) {
    return resolveExperience(this.read(keys.seen), version);
  }
  markSeen({ version = INTRO_VERSION, skipped = false } = {}) {
    this.write(keys.seen, String(version));
    this.write(keys.completed, this.clock());
    this.write(keys.skipped, String(skipped));
    this.notify();
  }
  getRecord() {
    return {
      version: this.read(keys.seen),
      completedAt: this.read(keys.completed),
      skipped: this.read(keys.skipped) === "true",
      persistent: this.persistent,
    };
  }
  resetIntro() {
    for (const key of [keys.seen, keys.completed, keys.skipped])
      this.remove(key);
    this.notify();
  }
  getMuted() {
    return this.read(keys.mute) !== "false";
  }
  setMuted(muted) {
    this.write(keys.mute, String(muted));
    this.notify();
  }
  getDiagnostics = () => {
    if (!this.diagnostics) {
      try {
        this.diagnostics = {
          ...DEFAULT_DIAGNOSTICS,
          ...JSON.parse(this.read(keys.diagnostics) || "{}"),
        };
      } catch {
        this.diagnostics = { ...DEFAULT_DIAGNOSTICS };
      }
    }
    return this.diagnostics;
  };
  updateDiagnostics(patch) {
    this.diagnostics = { ...this.getDiagnostics(), ...patch };
    this.write(keys.diagnostics, JSON.stringify(this.diagnostics));
    this.notify();
  }
  resetDiagnostics() {
    this.diagnostics = { ...DEFAULT_DIAGNOSTICS };
    this.remove(keys.diagnostics);
    this.notify();
  }
  subscribe = (f) => {
    this.listeners.add(f);
    return () => this.listeners.delete(f);
  };
  notify() {
    this.listeners.forEach((f) => f());
  }
}
export const experienceTransitions = {
  UNKNOWN: { FIRST: "PREPARE_INTRO", RETURNING: "RETURNING_SPLASH" },
  PREPARE_INTRO: {
    PLAY: "PLAYING",
    FAIL: "FALLBACK",
    SKIP: "MARK_SEEN",
    COMPLETE: "MARK_SEEN",
  },
  PLAYING: {
    COMPLETE: "MARK_SEEN",
    SKIP: "MARK_SEEN",
    FAIL: "FALLBACK",
    PAUSE: "PREPARE_INTRO",
  },
  FALLBACK: { SKIP: "MARK_SEEN" },
  MARK_SEEN: { TRANSITION: "TRANSITION_TO_APP" },
  TRANSITION_TO_APP: { ENTER: "APP" },
  RETURNING_SPLASH: { WAIT: "LOADING_CONTINUATION", LOCK: "LOGO_LOCK" },
  LOADING_CONTINUATION: { LOCK: "LOGO_LOCK" },
  LOGO_LOCK: { ENTER: "APP" },
  APP: { RESTART: "UNKNOWN" },
};
export function experienceReducer(state, event) {
  const next = experienceTransitions[state]?.[event];
  if (!next) throw Error(`Invalid experience transition: ${state} -> ${event}`);
  return next;
}
