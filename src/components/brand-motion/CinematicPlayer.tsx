import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import {
  mediaAssets,
  selectFilmSources,
  primeSignatureSound,
} from "../../services/mediaPreloadService";
import { experienceStateService } from "../../services/experienceStateService";
import { emitExperienceEvent } from "../../experience/experience-events";
import { motionTokens } from "../../experience/core.mjs";
import {
  useModalAccess,
  useMotionDiagnostics,
  useReducedMotionSafe,
} from "../../experience/hooks";
import { MicroLoader } from "./BrandedLoader";
export function CinematicPlayer({
  first = false,
  onClose,
  onFinish,
  onPlayingChange,
}: {
  first?: boolean;
  onClose?: () => void;
  onFinish?: (result: { skipped: boolean; failed?: boolean }) => void;
  onPlayingChange?: (playing: boolean) => void;
}) {
  const flags = useMotionDiagnostics(),
    reduced = useReducedMotionSafe(),
    video = useRef<HTMLVideoElement>(null),
    started = useRef(false),
    finished = useRef(false),
    hiddenWasPlaying = useRef(false),
    waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    [muted, setMuted] = useState(
      first ? true : experienceStateService.getMuted(),
    ),
    [playing, setPlaying] = useState(false),
    [ready, setReady] = useState(false),
    [blocked, setBlocked] = useState(reduced),
    [failed, setFailed] = useState(false),
    [allowSkip, setAllowSkip] = useState(false),
    [slow, setSlow] = useState(false),
    [position, setPosition] = useState(0),
    [duration, setDuration] = useState(20.01),
    [sourceEnabled, setSourceEnabled] = useState(flags.media !== "slow"),
    [retry, setRetry] = useState(0);
  const sources = useMemo(
    () => selectFilmSources(),
    [flags.media, flags.network, retry],
  );
  const exit = (skipped = true, isFailed = false) => {
    if (finished.current) return;
    finished.current = true;
    video.current?.pause();
    if (first) onFinish?.({ skipped, failed: isFailed });
    else onClose?.();
  };
  const ref = useModalAccess(true, () => {
    if (!first || allowSkip || reduced) exit(true);
  });
  const swipe = useRef<number | null>(null);
  useEffect(() => {
    if (first) experienceStateService.setMuted(true);
    if (first)
      emitExperienceEvent("brand_intro_impression", {
        introVersion: flags.introVersion,
        reducedMotion: reduced,
      });
    else
      emitExperienceEvent("brand_promo_video_opened", {
        introVersion: flags.introVersion,
        reducedMotion: reduced,
      });
    waitTimer.current = setTimeout(() => {
      setSlow(true);
      setAllowSkip(true);
    }, motionTokens.timing.mediaWait);
    let reducedSkip = reduced
      ? setTimeout(() => setAllowSkip(true), motionTokens.timing.reducedSplash)
      : null;
    let source =
      flags.media === "slow"
        ? setTimeout(
            () => setSourceEnabled(true),
            motionTokens.timing.diagnosticMediaDelay,
          )
        : null;
    return () => {
      if (waitTimer.current) clearTimeout(waitTimer.current);
      if (reducedSkip) clearTimeout(reducedSkip);
      if (source) clearTimeout(source);
      video.current?.pause();
    };
  }, []);
  useEffect(() => {
    if (!playing || !first) return;
    const timer = setTimeout(
      () => setAllowSkip(true),
      motionTokens.timing.skip,
    );
    return () => clearTimeout(timer);
  }, [playing, first]);
  useEffect(() => {
    if (reduced && !started.current) {
      video.current?.pause();
      setBlocked(true);
    }
  }, [reduced]);
  useEffect(() => {
    const visibility = () => {
      const v = video.current;
      if (!v) return;
      if (document.hidden) {
        hiddenWasPlaying.current = !v.paused;
        v.pause();
      } else if (hiddenWasPlaying.current) {
        hiddenWasPlaying.current = false;
        v.play().catch(() => setBlocked(true));
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  useEffect(() => {
    if (!failed || !first) return;
    const timer = setTimeout(() => {
      setAllowSkip(true);
      exit(true, true);
    }, motionTokens.timing.mediaFailure);
    return () => clearTimeout(timer);
  }, [failed, first]);
  const start = () => {
    setBlocked(false);
    if (!muted) primeSignatureSound();
    video.current?.play().catch(() => {
      setBlocked(true);
      setAllowSkip(true);
      emitExperienceEvent("brand_intro_autoplay_blocked", { first });
    });
  };
  const onReady = () => {
    if (waitTimer.current) clearTimeout(waitTimer.current);
    setReady(true);
    setSlow(false);
    if (!reduced && !started.current) start();
  };
  const error = () => {
    if (failed) return;
    setFailed(true);
    setPlaying(false);
    setReady(false);
    setBlocked(false);
    emitExperienceEvent(
      first ? "brand_intro_failed" : "brand_promo_video_failed",
      {
        introVersion: flags.introVersion,
        reason:
          flags.media === "failed" ? "diagnostic-failure" : "media-unavailable",
      },
    );
  };
  const sound = () => {
    const next = !muted;
    setMuted(next);
    if (video.current) video.current.muted = next;
    experienceStateService.setMuted(next);
    primeSignatureSound();
    if (!next)
      emitExperienceEvent("brand_intro_sound_enabled", {
        first,
        introVersion: flags.introVersion,
      });
  };
  const completed = () => {
    emitExperienceEvent(
      first ? "brand_intro_completed" : "brand_promo_video_completed",
      {
        introVersion: flags.introVersion,
        duration: video.current?.duration || 20.01,
      },
    );
    if (first) exit(false);
    else {
      setPlaying(false);
      setPosition(duration);
    }
  };
  return (
    <section
      ref={ref as any}
      className={
        "cinematic-player " +
        (first ? "cinematic-first" : "cinematic-promo") +
        (reduced ? " cinematic-reduced" : "")
      }
      role="dialog"
      aria-modal="true"
      aria-label={
        first ? "التجربة الأولى — فيلم هَبّ السعد" : "مشاهدة فيلم هَبّ السعد"
      }
      aria-describedby="film-description"
      tabIndex={-1}
      onPointerDown={(e) => {
        if (
          !first &&
          e.pointerType === "touch" &&
          !(e.target as HTMLElement).closest("button,input")
        )
          swipe.current = e.clientY;
      }}
      onPointerUp={(e) => {
        if (!first && swipe.current !== null && e.clientY - swipe.current > 90)
          exit();
        swipe.current = null;
      }}
    >
      <div
        className="film-ambient"
        style={{ backgroundImage: `url(${mediaAssets.poster})` }}
        aria-hidden="true"
      />
      <img
        className="film-poster"
        src={mediaAssets.poster}
        alt="أبواب قاعة كويتية تفتح على حكاية مناسبة"
        fetchPriority="high"
      />
      <div className="film-shade" />
      {sourceEnabled && !failed && (
        <video
          key={retry}
          ref={video}
          className={ready ? "film-video is-ready" : "film-video"}
          playsInline
          muted={muted}
          autoPlay={!reduced}
          preload="auto"
          poster={mediaAssets.poster}
          controls={false}
          aria-label="فيلم هَبّ السعد — من أول هبّة تبدأ الحكاية"
          onCanPlay={onReady}
          onLoadedData={onReady}
          onLoadedMetadata={() => {
            if (
              video.current?.duration &&
              Number.isFinite(video.current.duration)
            )
              setDuration(video.current.duration);
            if (!reduced && !started.current) start();
          }}
          onPlaying={() => {
            if (waitTimer.current) clearTimeout(waitTimer.current);
            setReady(true);
            setPlaying(true);
            setBlocked(false);
            setSlow(false);
            onPlayingChange?.(true);
            if (!started.current) {
              started.current = true;
              emitExperienceEvent(
                first ? "brand_intro_started" : "brand_promo_video_started",
                {
                  introVersion: flags.introVersion,
                  muted: video.current?.muted,
                },
              );
            }
          }}
          onPause={() => {
            setPlaying(false);
            // Native media emits pause before ended. Preserve the completed state.
            if (!video.current?.ended && !finished.current)
              onPlayingChange?.(false);
          }}
          onTimeUpdate={() => setPosition(video.current?.currentTime || 0)}
          onWaiting={() => setSlow(true)}
          onError={error}
          onEnded={completed}
        >
          {sources.map((s) => (
            <source key={s.src} src={s.src} type={s.type} />
          ))}
          <track
            kind="captions"
            src="/brand-motion/video/intro-v1-ar.vtt"
            srcLang="ar"
            label="وصف الفيلم بالعربية"
          />
        </video>
      )}
      <div className="film-top-bar">
        <div className="film-brand">
          <span>هَبّ السعد</span>
          <small>HABB ALSAAD · THE FIRST MOMENT</small>
        </div>
        <div className="film-top-actions">
          <button
            className="film-control"
            onClick={sound}
            aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
            aria-pressed={!muted}
          >
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
            <span>{muted ? "الصوت مغلق" : "الصوت مفعّل"}</span>
          </button>
          {!first && (
            <button
              className="film-control film-close"
              onClick={() => exit()}
              aria-label="إغلاق الفيلم"
            >
              <X size={21} />
            </button>
          )}
        </div>
      </div>
      {(blocked || (reduced && !started.current)) && !failed && (
        <div className="film-poster-callout">
          <span className="motion-overline">حكاية تبدأ بتفصيل</span>
          <h1>
            من أول هبّة…
            <br />
            تبدأ الحكاية
          </h1>
          <p>
            {reduced
              ? "المشاهدة باختيارك. الحركة المخفّضة مفعّلة."
              : "فيلم هَبّ السعد · عشرون ثانية من الإلهام"}
          </p>
          <button className="film-play-cta" onClick={start}>
            <Play size={19} fill="currentColor" />
            تشغيل الفيديو
          </button>
        </div>
      )}
      {failed && (
        <div className="film-fallback-copy" role="status">
          <img src={mediaAssets.logo} alt="هَبّ السعد" />
          <h2>الحكاية بانتظارك</h2>
          <p>الفيلم غير متاح الآن، وباقي التجربة جاهز لك.</p>
          {!first && (
            <button
              className="film-control"
              onClick={() => {
                setFailed(false);
                setReady(false);
                started.current = false;
                setRetry((x) => x + 1);
              }}
            >
              <RefreshCw size={15} />
              إعادة المحاولة
            </button>
          )}
        </div>
      )}
      <div className="film-bottom-bar">
        <div>
          <span className="motion-overline">من الفراغ… إلى ليلة كاملة</span>
          <p>كل تفصيل، له حكاية.</p>
        </div>
        <div className="film-bottom-actions">
          {ready && !failed && (!reduced || started.current) && (
            <button
              className="film-control"
              onClick={() => {
                if (playing) video.current?.pause();
                else start();
              }}
              aria-label={playing ? "إيقاف الفيديو مؤقتًا" : "تشغيل الفيديو"}
            >
              {playing ? <Pause size={19} /> : <Play size={19} />}
            </button>
          )}
          {first && allowSkip && (
            <button
              className="film-skip"
              onClick={() => {
                emitExperienceEvent("brand_intro_skipped", {
                  introVersion: flags.introVersion,
                  secondsWatched: Math.round(position),
                  reducedMotion: reduced,
                });
                exit(true);
              }}
            >
              {slow || reduced || failed ? "شاهد التجربة لاحقًا" : "تخطي"}
              <ArrowLeft size={17} />
            </button>
          )}
          {!ready && !failed && !blocked && (
            <span className="film-buffering" role="status">
              <MicroLoader />
              {slow
                ? "نجهّز الفيلم، يمكنك المتابعة ومشاهدته لاحقًا"
                : "نفتح أبواب الحكاية…"}
            </span>
          )}
        </div>
      </div>
      <div
        className="film-progress-track"
        role="progressbar"
        aria-label="تقدم مشاهدة الفيلم"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.floor(position)}
      >
        <i
          style={{ width: `${Math.min(100, (position / duration) * 100)}%` }}
        />
      </div>
      <p id="film-description" className="sr-only">
        فيلم مدته عشرون ثانية. تفتح أبواب قاعة كويتية، وتنساب شرائط باللون
        العنابي والذهبي. تتجمّع الطاولات والكراسي والثريات والزهور والضيافة حتى
        تكتمل المناسبة ويظهر شعار هَبّ السعد. يمكن تشغيل الصوت أو كتمه؛ جميع
        الإجراءات متاحة بأزرار واضحة.
      </p>
    </section>
  );
}
