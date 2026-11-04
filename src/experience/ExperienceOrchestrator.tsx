import {branding} from "../branding.mjs";
import {useStore} from "../store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { experienceStateService } from "../services/experienceStateService";
import {
  warmBrandAssets,
  playSignatureSound,
} from "../services/mediaPreloadService";
import {
  motionTokens,
  experienceReducer,
  experienceTransitions,
  loadingMessages,
} from "./core.mjs";
import { emitExperienceEvent } from "./experience-events";
import {
  useModalAccess,
  useMotionDiagnostics,
  useReducedMotionSafe,
} from "./hooks";
import { CinematicPlayer } from "../components/brand-motion/CinematicPlayer";
import { MotionStage } from "../components/brand-motion/MotionStage";
import {
  LoadingLayer,
  useLoadingOperations,
} from "../components/brand-motion/BrandedLoader";
import "./motion.css";
const Context = createContext<any>(null);
export function useExperience() {
  return useContext(Context);
}
export function ExperienceOrchestrator({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = useStore();
  const identity = branding(store.settings);
  const brandingReady = store.runtime?.ready !== false;
  const [state, setState] = useState("UNKNOWN"),
    [sequence, setSequence] = useState(0),
    [ready, setReady] = useState(false),
    [phase, setPhase] = useState("arrival"),
    [promo, setPromo] = useState(false),
    [continued, setContinued] = useState(false),
    [failOpen, setFailOpen] = useState(false);
  const reduced = useReducedMotionSafe(),
    flags = useMotionDiagnostics(),
    began = useRef(performance.now()),
    transitionBegan = useRef(0),
    readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    handled = useRef(false),
    promoScroll = useRef({ y: 0, path: "" });
  const { operations } = useLoadingOperations();
  const bootActive = state !== "APP",
    blocking =
      bootActive || promo || operations.some((x) => x.tier === "fullscreen");
  const send = useCallback(
    (event: string) =>
      setState((s) =>
        experienceTransitions[s]?.[event] ? experienceReducer(s, event) : s,
      ),
    [],
  );
  const markAppReady = useCallback(() => {
    if (readyTimer.current) clearTimeout(readyTimer.current);
    readyTimer.current = setTimeout(
      () => setReady(true),
      Math.max(0, experienceStateService.getDiagnostics().appReadyDelay || 0),
    );
  }, [sequence]);
  useEffect(() => {
    began.current = performance.now();
    handled.current = false;
    setReady(false);
    setContinued(false);
    setFailOpen(false);
    setPhase("arrival");
    setState("UNKNOWN");
    const timer = setTimeout(() => {
      const kind = experienceStateService.resolve(
        experienceStateService.getDiagnostics().introVersion,
      );
      if (kind === "RETURNING_USER") {
        setState("RETURNING_SPLASH");
        emitExperienceEvent("returning_splash_shown", {
          introVersion: flags.introVersion,
          reducedMotion: reduced,
        });
      } else setState("PREPARE_INTRO");
      warmBrandAssets();
    }, 0);
    return () => {
      clearTimeout(timer);
      if (readyTimer.current) clearTimeout(readyTimer.current);
    };
  }, [sequence]);
  useEffect(() => {
    if (!["RETURNING_SPLASH", "LOADING_CONTINUATION"].includes(state)) return;
    const min = reduced
      ? motionTokens.timing.reducedSplash
      : motionTokens.timing.splashMinimum;
    const timer = setTimeout(
      () => {
        if (ready) {
          setPhase("lock");
          playSignatureSound();
          send("LOCK");
        } else {
          setPhase("loop");
          send("WAIT");
          setContinued(true);
        }
      },
      Math.max(0, min - (performance.now() - began.current)),
    );
    return () => clearTimeout(timer);
  }, [state, ready, reduced, send]);
  useEffect(() => {
    if (state !== "RETURNING_SPLASH" || reduced) return;
    const reveal = setTimeout(
        () => setPhase("reveal"),
        motionTokens.timing.splashReveal,
      ),
      gather = setTimeout(
        () => setPhase("gather"),
        motionTokens.timing.splashGather,
      ),
      assemble = setTimeout(
        () => setPhase("assemble"),
        motionTokens.timing.splashAssemble,
      );
    return () => {
      clearTimeout(reveal);
      clearTimeout(gather);
      clearTimeout(assemble);
    };
  }, [state, reduced]);
  useEffect(() => {
    if (!["LOGO_LOCK", "TRANSITION_TO_APP"].includes(state)) return;
    const duration =
      state === "TRANSITION_TO_APP"
        ? motionTokens.timing.filmTransition
        : motionTokens.timing.transition;
    if (!transitionBegan.current) transitionBegan.current = performance.now();
    const remaining = Math.max(
      0,
      duration - (performance.now() - transitionBegan.current),
    );
    const timer = setTimeout(() => {
      if (ready) {
        emitExperienceEvent("brand_app_entered", {
          durationToReady: Math.round(performance.now() - began.current),
          reducedMotion: reduced,
          introVersion: flags.introVersion,
        });
        send("ENTER");
        transitionBegan.current = 0;
      } else {
        setContinued(true);
        setPhase("loop");
      }
    }, remaining);
    return () => clearTimeout(timer);
  }, [state, ready, send, reduced]);
  useEffect(() => {
    if (!bootActive) return;
    const timer = setTimeout(
      () => setFailOpen(true),
      motionTokens.timing.failOpen,
    );
    return () => clearTimeout(timer);
  }, [bootActive, sequence]);
  const finishFilm = useCallback(
    ({ skipped, failed = false }: { skipped: boolean; failed?: boolean }) => {
      if (handled.current) return;
      handled.current = true;
      experienceStateService.markSeen({
        version: experienceStateService.getDiagnostics().introVersion,
        skipped,
      });
      if (failed) send("FAIL");
      send(skipped ? "SKIP" : "COMPLETE");
      send("TRANSITION");
      setPhase("lock");
      transitionBegan.current = performance.now();
      playSignatureSound();
    },
    [send],
  );
  const restart = useCallback(() => {
    setPromo(false);
    transitionBegan.current = 0;
    setSequence((x) => x + 1);
  }, []);
  const openPromo = useCallback(() => {
    if (!identity.originalFilm) return;
    promoScroll.current = { y: scrollY, path: location.pathname };
    setPromo(true);
  }, [identity.originalFilm]);
  const closePromo = useCallback(() => {
    setPromo(false);
    requestAnimationFrame(() => {
      if (location.pathname === promoScroll.current.path)
        window.scrollTo({ top: promoScroll.current.y, behavior: "instant" });
    });
  }, []);
  useEffect(() => {
    if (!promo) return;
    const back = () => setPromo(false);
    addEventListener("popstate", back);
    return () => removeEventListener("popstate", back);
  }, [promo]);
  useEffect(() => {
    document.documentElement.dataset.habbReducedMotion = String(reduced);
  }, [reduced]);
  const splashRef = useModalAccess(
    bootActive && !["PREPARE_INTRO", "PLAYING", "FALLBACK"].includes(state),
  );
  useEffect(() => {
    if (brandingReady && !identity.originalFilm && ["PREPARE_INTRO", "PLAYING", "FALLBACK"].includes(state))
      setState("RETURNING_SPLASH");
    if (!identity.originalFilm && promo) closePromo();
  }, [brandingReady, identity.originalFilm, state, promo, closePromo]);
  const filmActive = brandingReady && identity.originalFilm && ["PREPARE_INTRO", "PLAYING", "FALLBACK"].includes(state);
  const fading = ready && ["LOGO_LOCK", "TRANSITION_TO_APP"].includes(state);
  return (
    <Context.Provider
      value={{
        markAppReady,
        openPromo,
        restart,
        state,
        ready,
        reducedMotion: reduced,
      }}
    >
      <div
        className="experience-app"
        data-experience-app
        inert={blocking}
        aria-hidden={blocking ? true : undefined}
      >
        {children}
      </div>
      {filmActive && (
        <CinematicPlayer
          key={"intro-" + sequence}
          first
          onFinish={finishFilm}
          onPlayingChange={(playing) => {
            if (playing) send("PLAY");
            else send("PAUSE");
          }}
        />
      )}
      {bootActive && !filmActive && (
        <section
          ref={splashRef as any}
          className={
            "experience-overlay " +
            (fading ? "experience-exiting " : "") +
            (reduced ? "motion-reduced " : "") +
            (state === "TRANSITION_TO_APP" ? "film-logo-morph" : "")
          }
          data-experience-state={state}
          role="dialog"
          aria-modal="true"
          aria-label={
            continued ? "نجهّز التفاصيل" : "مرحبًا بك"
          }
          tabIndex={-1}
        >
          <span className="experience-topline">{brandingReady && (identity.latin || identity.name)}</span>
          <div className="experience-center">
            {brandingReady && <MotionStage
              phase={continued && !ready ? "loop" : phase}
              size="splash"
              staticOnly={
                reduced || state === "UNKNOWN" || state === "TRANSITION_TO_APP"
              }
            />}
            <div className="experience-wordmark">
              <span>يا هلا ومسهلا</span>
              <small>
                {continued
                  ? loadingMessages.generic
                  : "لحظة… نزهّب لكم المكان"}
              </small>
            </div>
          </div>
          <div className="experience-bottomline">
            <span>بروح كويتية.. واهتمام بكل تفصيل</span>
            {continued && failOpen && (
              <button
                onClick={() => {
                  setReady(true);
                  setPhase("lock");
                  send("LOCK");
                }}
              >
                تفضّلوا للموقع<small>تقدرون تكمّلون الحين</small>
              </button>
            )}
          </div>
        </section>
      )}
      {!bootActive && <LoadingLayer />}
      {promo && identity.originalFilm && <CinematicPlayer onClose={closePromo} />}
    </Context.Provider>
  );
}
