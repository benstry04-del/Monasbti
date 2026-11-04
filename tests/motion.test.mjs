import test from "node:test";
import assert from "node:assert/strict";
import {
  ExperienceStateService,
  INTRO_VERSION,
  keys,
  resolveExperience,
  loadingTier,
  progressPhase,
  chooseRenderer,
  experienceReducer,
  contextForAction,
  canSkip,
} from "../src/experience/core.mjs";
function memory() {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}
test("first visit resolves to NEW_USER and returning record survives a new service instance", () => {
  const storage = memory(),
    a = new ExperienceStateService(storage, () => "2026-10-23T20:00:00Z");
  assert.equal(a.resolve(), "NEW_USER");
  a.markSeen({ version: "1", skipped: false });
  const b = new ExperienceStateService(storage);
  assert.equal(b.resolve(), "RETURNING_USER");
  assert.equal(b.getRecord().completedAt, "2026-10-23T20:00:00Z");
  assert.equal(b.getRecord().skipped, false);
});
test("skip stores exact version and skipped state", () => {
  const s = new ExperienceStateService(memory());
  s.markSeen({ version: "1", skipped: true });
  assert.deepEqual([s.read(keys.seen), s.read(keys.skipped)], ["1", "true"]);
  assert.equal(s.resolve(), "RETURNING_USER");
});
test("a newer intro version plays once and never replays a downgraded version", () => {
  const s = new ExperienceStateService(memory());
  s.markSeen({ version: "1" });
  assert.equal(s.resolve("2"), "NEW_INTRO_VERSION");
  s.markSeen({ version: "2" });
  assert.equal(s.resolve("2"), "RETURNING_USER");
  assert.equal(s.resolve("1"), "RETURNING_USER");
});
test("reset intro preserves diagnostics and mute settings", () => {
  const s = new ExperienceStateService(memory());
  s.markSeen();
  s.updateDiagnostics({ network: "slow4g" });
  s.setMuted(false);
  s.resetIntro();
  assert.equal(s.resolve(), "NEW_USER");
  assert.equal(s.getDiagnostics().network, "slow4g");
  assert.equal(s.getMuted(), false);
});
test("storage failure falls back to memory and never prevents entry", () => {
  const fail = {
    getItem() {
      throw Error("denied");
    },
    setItem() {
      throw Error("quota");
    },
    removeItem() {
      throw Error("denied");
    },
  };
  const s = new ExperienceStateService(fail);
  assert.equal(s.resolve(), "NEW_USER");
  s.markSeen({ skipped: true });
  assert.equal(s.resolve(), "RETURNING_USER");
  assert.equal(s.getRecord().persistent, false);
});
test("malformed optional diagnostics recover to safe defaults", () => {
  const storage = memory();
  storage.setItem(keys.diagnostics, "{bad");
  const s = new ExperienceStateService(storage);
  assert.equal(s.getDiagnostics().media, "normal");
  assert.equal(s.getDiagnostics().introVersion, "1");
});
test("mute defaults on and remembers explicit user preference", () => {
  const s = new ExperienceStateService(memory());
  assert.equal(s.getMuted(), true);
  s.setMuted(false);
  assert.equal(s.getMuted(), false);
});
test("loading thresholds prevent flashes and upgrade at documented boundaries", () => {
  assert.equal(loadingTier(0), "hidden");
  assert.equal(loadingTier(349), "hidden");
  assert.equal(loadingTier(350), "micro");
  assert.equal(loadingTier(1199), "micro");
  assert.equal(loadingTier(1200), "section");
  assert.equal(loadingTier(2999), "section");
  assert.equal(loadingTier(3000), "fullscreen");
});
test("unknown progress uses a loop, finite progress maps real completion", () => {
  assert.equal(progressPhase(undefined), "loop");
  assert.equal(progressPhase(NaN), "loop");
  assert.equal(progressPhase(0), "arrival");
  assert.equal(progressPhase(0.2), "reveal");
  assert.equal(progressPhase(0.45), "gather");
  assert.equal(progressPhase(0.7), "assemble");
  assert.equal(progressPhase(0.9), "lock");
  assert.equal(progressPhase(10), "lock");
});
test("reduced motion always uses static identity and bypasses GPU", () => {
  assert.equal(chooseRenderer({ reduced: true, webgl: true }), "static");
  assert.equal(chooseRenderer({ webgl: false }), "css");
  assert.equal(chooseRenderer({ lowMemory: true }), "css");
  assert.equal(chooseRenderer({ saveData: true }), "css");
  assert.equal(chooseRenderer({ forced: "fallback" }), "css");
  assert.equal(chooseRenderer({ webgl: true }), "webgl");
});
test("first experience completion and skip both reach the app by logo transition", () => {
  for (const result of ["COMPLETE", "SKIP"]) {
    let s = experienceReducer("UNKNOWN", "FIRST");
    s = experienceReducer(s, "PLAY");
    s = experienceReducer(s, result);
    assert.equal(s, "MARK_SEEN");
    s = experienceReducer(s, "TRANSITION");
    assert.equal(s, "TRANSITION_TO_APP");
    assert.equal(experienceReducer(s, "ENTER"), "APP");
  }
});
test("returning splash continues as loading without another film", () => {
  let s = experienceReducer("UNKNOWN", "RETURNING");
  assert.equal(s, "RETURNING_SPLASH");
  s = experienceReducer(s, "WAIT");
  assert.equal(s, "LOADING_CONTINUATION");
  s = experienceReducer(s, "LOCK");
  assert.equal(s, "LOGO_LOCK");
  assert.equal(experienceReducer(s, "ENTER"), "APP");
});
test("native pause before ended still allows natural completion", () => {
  let s = experienceReducer("PLAYING", "PAUSE");
  s = experienceReducer(s, "COMPLETE");
  s = experienceReducer(s, "TRANSITION");
  assert.equal(experienceReducer(s, "ENTER"), "APP");
});
test("failed media is non-blocking and can mark skipped before entry", () => {
  let s = experienceReducer("UNKNOWN", "FIRST");
  s = experienceReducer(s, "FAIL");
  assert.equal(s, "FALLBACK");
  s = experienceReducer(s, "SKIP");
  s = experienceReducer(s, "TRANSITION");
  assert.equal(experienceReducer(s, "ENTER"), "APP");
});
test("invalid experience transitions are rejected", () => {
  assert.throws(() => experienceReducer("UNKNOWN", "COMPLETE"), /Invalid/);
  assert.throws(() => experienceReducer("APP", "PLAY"), /Invalid/);
});
test("skip is absent before 2.8s and failure exit allows 1.25s fallback", () => {
  assert.equal(canSkip(0), false);
  assert.equal(canSkip(2799), false);
  assert.equal(canSkip(2800), true);
  assert.equal(canSkip(1249, { failed: true }), false);
  assert.equal(canSkip(1250, { failed: true }), true);
});
test("payment operations stay in a secure payment context, never success before result", () => {
  for (const action of ["PAY", "WEBHOOK", "REFUND", "REFUND_SETTLE"])
    assert.equal(contextForAction(action), "payment");
  assert.equal(contextForAction("SIGN"), "contract");
  assert.equal(contextForAction("PUBLISH"), "quote");
  assert.equal(
    contextForAction("CART_ADD", { id: "s1" }, [
      { id: "s1", category: "قاعات" },
    ]),
    "venues",
  );
  assert.equal(
    contextForAction("CART_ADD", { id: "s6" }, [
      { id: "s6", category: "ضيافة وقهوة" },
    ]),
    "hospitality",
  );
});
