import React, { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { MotionStage } from "./MotionStage";
import { loadingMessages } from "../../experience/core.mjs";
import { loadingExperience } from "../../experience/loading-controller";
import {
  useDelayedVisible,
  useModalAccess,
  useReducedMotionSafe,
} from "../../experience/hooks";
export function MicroLoader({ label = "نجهّز التفاصيل…" }: { label?: string }) {
  return (
    <span className="habb-micro-loader" role="status" aria-label={label}>
      <i />
      <i />
      <i />
    </span>
  );
}
export function BrandedLoader({
  mode = "section",
  context = "generic",
  progress,
  message,
}: {
  mode?: string;
  context?: string;
  progress?: number;
  message?: string;
}) {
  return (
    <div
      className={"branded-loader branded-loader--" + mode}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <MotionStage
        context={context}
        phase="loop"
        progress={progress}
        size={mode === "fullscreen" ? "splash" : "loader"}
      />
      <p className="loading-copy">
        {message || loadingMessages[context] || loadingMessages.generic}
      </p>
      {typeof progress === "number" && Number.isFinite(progress) && (
        <div className="true-progress">
          <progress
            max={1}
            value={Math.max(0, Math.min(1, progress))}
            aria-label="تقدم المهام المكتملة"
          />
          <small>{Math.round(Math.max(0, Math.min(1, progress)) * 100)}%</small>
        </div>
      )}
      {mode === "section" && (
        <div className="brand-skeletons" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      )}
    </div>
  );
}
export function ContextualLoader({
  pending,
  context = "generic",
  mode = "inline",
}: {
  pending: boolean;
  context?: string;
  mode?: string;
}) {
  const visible = useDelayedVisible(pending);
  if (!visible) return null;
  return mode === "micro" ? (
    <MicroLoader label={loadingMessages[context]} />
  ) : mode === "inline" ? (
    <span className="contextual-inline" role="status">
      <MicroLoader />
      {loadingMessages[context] || loadingMessages.generic}
    </span>
  ) : (
    <BrandedLoader mode={mode} context={context} />
  );
}
export function useLoadingOperations() {
  return useSyncExternalStore(
    loadingExperience.subscribe,
    loadingExperience.getSnapshot,
  );
}
export function LoadingLayer() {
  const { operations } = useLoadingOperations();
  const visible = operations.filter((o) => o.tier !== "hidden"),
    op =
      visible.find((o) => o.tier === "fullscreen") ||
      visible.find((o) => o.tier === "section") ||
      visible.at(-1);
  const fullscreen = op?.tier === "fullscreen";
  const ref = useModalAccess(!!fullscreen);
  if (!op) return null;
  if (op.tier === "micro") {
    const r = op.source?.getBoundingClientRect();
    if (r && r.width > 0 && r.top >= 0 && r.bottom <= innerHeight)
      return createPortal(
        <span
          className="button-micro-portal"
          style={{ top: r.top + 3, left: r.right - 36 }}
        >
          <MicroLoader label={loadingMessages[op.context || "generic"]} />
        </span>,
        document.body,
      );
    return (
      <div className="global-micro-status">
        <MicroLoader />
        {loadingMessages[op.context || "generic"]}
      </div>
    );
  }
  return (
    <section
      ref={ref as any}
      tabIndex={-1}
      className={
        fullscreen ? "habb-loading-overlay" : "habb-section-loading-layer"
      }
      role={fullscreen ? "dialog" : "region"}
      aria-modal={fullscreen ? true : undefined}
      aria-label={loadingMessages[op.context || "generic"]}
    >
      <BrandedLoader
        mode={fullscreen ? "fullscreen" : "section"}
        context={op.context}
        progress={op.progress}
        message={op.message}
      />
      {fullscreen && (
        <small className="loading-patience">
          نحفظ تفاصيلك بعناية. ستظهر النتيجة فور اكتمال العملية.
        </small>
      )}
    </section>
  );
}
export function PaymentSuccessBloom() {
  const reduced = useReducedMotionSafe();
  return (
    <div
      className={"payment-success-bloom " + (reduced ? "bloom-reduced" : "")}
      data-verified-success="true"
      aria-hidden="true"
    >
      <span className="success-floral-sprite" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <i key={i} style={{ "--bloom-angle": i * 60 + "deg" } as any} />
      ))}
    </div>
  );
}
