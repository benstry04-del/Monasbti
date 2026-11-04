import {branding, logoDefaults} from "../../branding.mjs";
import {useStore} from "../../store";
import React, { Suspense, lazy, useEffect, useState, useMemo } from "react";
import { mediaAssets } from "../../services/mediaPreloadService";
import { chooseRenderer, progressPhase } from "../../experience/core.mjs";
import {
  useMotionDiagnostics,
  useReducedMotionSafe,
} from "../../experience/hooks";
import { emitExperienceEvent } from "../../experience/experience-events";
const WebGLStage = lazy(() => import("./WebGLStage"));
class MotionBoundary extends React.Component<any, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    emitExperienceEvent("returning_splash_fallback_used", {
      reason: "animation-module-unavailable",
      renderer: "css",
    });
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
const selections: Record<string, number[]> = {
  generic: [1, 2, 4, 6, 7, 5],
  venues: [9, 5, 2, 4, 8, 3],
  hospitality: [6, 3, 4, 1, 7, 8],
  services: [1, 2, 4, 6, 9, 7],
  quote: [7, 0, 11, 3],
  contract: [7, 4, 0, 9],
  payment: [0, 7, 4],
};
function safeRenderer(reduced: boolean, forced: string) {
  if (reduced) return "static";
  if (!navigator.onLine) return "css";
  const nav = navigator as any;
  if (
    forced === "fallback" ||
    (nav.deviceMemory && nav.deviceMemory < 4) ||
    nav.connection?.saveData
  )
    return "css";
  try {
    const c = document.createElement("canvas"),
      gl = c.getContext("webgl2") || c.getContext("webgl");
    if (gl) {
      (gl as WebGLRenderingContext)
        .getExtension("WEBGL_lose_context")
        ?.loseContext();
      return "webgl";
    }
  } catch {}
  return "css";
}
export function LogoAssembler({ phase = "lock" }: { phase?: string }) {
  const [failed, setFailed] = useState(false);
  const identity = branding(useStore().settings);
  const image = identity.logo === logoDefaults.logo ? (failed ? "/assets/habb-alsaad-logo.png" : mediaAssets.logo) : identity.logo;
  useEffect(() => setFailed(false), [identity.logo]);
  if (!image || (failed && identity.logo !== logoDefaults.logo))
    return identity.title ? <div className="experience-wordmark">{identity.title}</div> : null;
  if (identity.logo !== logoDefaults.logo)
    return <div className="logo-assembler"><img className="assembled-logo" src={image} alt={identity.title || "الشعار"} onError={() => setFailed(true)} /></div>;
  const clips = [
    "polygon(46% 6%,54% 6%,56% 14%,48% 22%,42% 15%)",
    "polygon(31% 16%,49% 11%,48% 48%,28% 64%,6% 61%,25% 45%)",
    "polygon(51% 12%,70% 27%,75% 44%,94% 57%,97% 64%,61% 64%,50% 46%)",
    "polygon(44% 29%,54% 29%,66% 58%,48% 64%,33% 57%)",
    "polygon(5% 60%,50% 59%,50% 81%,5% 81%)",
    "polygon(50% 59%,96% 59%,96% 81%,50% 81%)",
    "polygon(4% 81%,96% 81%,96% 91%,4% 91%)",
  ];
  return (
    <div className={"logo-assembler logo-phase-" + phase}>
      <img
        className="assembled-logo"
        src={image}
        alt={identity.title || "الشعار"}
        onError={() => setFailed(true)}
        draggable={false}
      />
      <div className="logo-pieces" aria-hidden="true">
        {clips.map((clip, i) => (
          <img
            key={i}
            src={image}
            alt=""
            draggable={false}
            style={
              {
                clipPath: clip,
                "--piece-x": [-10, -65, 65, 0, -38, 38, 0][i] + "px",
                "--piece-y": [-55, -15, -18, 22, 45, 45, 55][i] + "px",
                "--piece-r": [-4, -12, 12, 3, -5, 5, 0][i] + "deg",
              } as any
            }
          />
        ))}
      </div>
      <i className="brand-lock-glint" aria-hidden="true" />
    </div>
  );
}
export function EventObjectOrbit({
  context = "generic",
  phase = "loop",
}: {
  context?: string;
  phase?: string;
}) {
  const objects = selections[context] || selections.generic;
  return (
    <div className="css-object-orbit" aria-hidden="true">
      {objects.map((id, i) => {
        const angle = (i / objects.length) * Math.PI * 2 - 0.9;
        return (
          <span
            className={"motion-object motion-object-" + i}
            key={id}
            style={
              {
                left: 50 + Math.cos(angle) * 40 + "%",
                top: 50 + Math.sin(angle) * 32 + "%",
                "--object-position": `${((id % 4) * 100) / 3}% ${Math.floor(id / 4) * 50}%`,
                "--object-delay": -i * 0.38 + "s",
                "--object-depth": (i % 2 ? 35 : -35) + "px",
              } as any
            }
          />
        );
      })}
    </div>
  );
}
export function MotionStage({
  context = "generic",
  phase = "loop",
  progress,
  size = "normal",
  staticOnly = false,
}: {
  context?: string;
  phase?: string;
  progress?: number;
  size?: string;
  staticOnly?: boolean;
}) {
  const reduced = useReducedMotionSafe() || staticOnly,
    flags = useMotionDiagnostics(),
    [failed, setFailed] = useState(false);
  const renderer = useMemo(
    () => safeRenderer(reduced, flags.renderer),
    [reduced, flags.renderer],
  );
  const strategy = chooseRenderer({
    reduced,
    webgl: renderer === "webgl" && !failed,
    forced: flags.renderer,
  });
  const actual = progress === undefined ? phase : progressPhase(progress);
  useEffect(() => {
    if (strategy === "css" && size === "splash")
      emitExperienceEvent("returning_splash_fallback_used", {
        renderer: "css",
        reducedMotion: reduced,
      });
  }, [strategy, size, reduced]);
  return (
    <div
      className={`motion-stage motion-stage--${size} motion-stage--${strategy} stage-phase-${actual} context-${context}`}
      data-renderer={strategy}
      data-phase={actual}
    >
      <div className="stage-ground" aria-hidden="true" />
      {strategy === "webgl" ? (
        <MotionBoundary
          fallback={<EventObjectOrbit context={context} phase={actual} />}
        >
          <Suspense
            fallback={<EventObjectOrbit context={context} phase={actual} />}
          >
            <WebGLStage
              phase={actual}
              context={context}
              objectIds={selections[context] || selections.generic}
              onFailure={() => setFailed(true)}
            />
          </Suspense>
        </MotionBoundary>
      ) : strategy === "css" ? (
        <EventObjectOrbit context={context} phase={actual} />
      ) : null}
      <div className="ribbon-conductor" aria-hidden="true">
        <span />
        <span />
      </div>
      <LogoAssembler phase={strategy === "static" ? "lock" : actual} />
      {["contract", "quote"].includes(context) && (
        <div className="document-outline" aria-hidden="true" />
      )}
      {context === "payment" && (
        <div className="payment-secure-frame" aria-hidden="true" />
      )}
    </div>
  );
}
