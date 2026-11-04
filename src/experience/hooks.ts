import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { experienceStateService } from "../services/experienceStateService";
export function useMotionDiagnostics() {
  return useSyncExternalStore(
    experienceStateService.subscribe,
    experienceStateService.getDiagnostics,
  );
}
export function useReducedMotionSafe() {
  const flags = useMotionDiagnostics();
  const [system, setSystem] = useState(
    () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false,
  );
  useEffect(() => {
    const q = matchMedia("(prefers-reduced-motion: reduce)"),
      f = () => setSystem(q.matches);
    q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, []);
  return system || flags.reducedMotion === "reduce";
}
export function useDelayedVisible(active: boolean, delay = 350) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const id = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(id);
  }, [active, delay]);
  return active && show;
}
let locks = 0,
  previous: any = null;
export function lockDocument() {
  if (locks++ === 0) {
    previous = {
      overflow: document.body.style.overflow,
      padding: document.body.style.paddingInlineEnd,
    };
    const gap = innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingInlineEnd = gap + "px";
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (--locks === 0 && previous) {
      document.body.style.overflow = previous.overflow;
      document.body.style.paddingInlineEnd = previous.padding;
    }
  };
}
export function useModalAccess(active: boolean, close?: () => void) {
  const ref = useRef<HTMLElement>(null),
    closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!active) return;
    const release = lockDocument(),
      prior = document.activeElement as HTMLElement;
    requestAnimationFrame(() => {
      const first = ref.current?.querySelector<HTMLElement>(
        'button:not([disabled]),[tabindex="0"],input',
      );
      (first || ref.current)?.focus({ preventScroll: true });
    });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeRef.current) {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const all = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),a,input,select,[tabindex="0"]',
          ) || [],
        ).filter((x) => x.offsetParent !== null);
        if (!all.length) {
          e.preventDefault();
          ref.current?.focus();
          return;
        }
        if (e.shiftKey && document.activeElement === all[0]) {
          e.preventDefault();
          all.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === all.at(-1)) {
          e.preventDefault();
          all[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      release();
      document.removeEventListener("keydown", key);
      if (prior?.isConnected) prior.focus({ preventScroll: true });
    };
  }, [active]);
  return ref;
}
