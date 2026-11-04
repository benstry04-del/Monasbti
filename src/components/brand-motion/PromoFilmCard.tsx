import {branding} from "../../branding.mjs";
import {useStore} from "../../store";
import React, { useEffect, useRef } from "react";
import { Play, ArrowLeft } from "lucide-react";
import { useExperience } from "../../experience/ExperienceOrchestrator";
import { mediaAssets } from "../../services/mediaPreloadService";
import { emitExperienceEvent } from "../../experience/experience-events";
export function PromoFilmCard() {
  const { openPromo } = useExperience(),
    ref = useRef<HTMLElement>(null);
  const state = useStore();
  const visible = state.runtime?.ready !== false && branding(state.settings).originalFilm;
  useEffect(() => {
    if (!visible || !ref.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((x) => x.isIntersecting)) {
          emitExperienceEvent("brand_promo_card_impression");
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);
  if (!visible) return null;
  return (
    <section
      ref={ref}
      className="container promo-film-section"
      aria-labelledby="promo-film-title"
    >
      <div className="promo-film-card">
        <img
          src={mediaAssets.poster}
          alt="لقطة من فيلم هَبّ السعد"
          loading="lazy"
        />
        <div className="promo-film-overlay" />
        <div className="promo-film-copy">
          <span className="motion-overline">HABB ALSAAD · THE EXPERIENCE</span>
          <h2 id="promo-film-title">شوفي كيف تبدأ الحكاية</h2>
          <p>20 ثانية من الفراغ… إلى ليلة كاملة</p>
          <button className="promo-film-button" onClick={openPromo}>
            <span>
              <Play size={17} fill="currentColor" />
            </span>
            شاهد التجربة
            <ArrowLeft size={17} />
          </button>
        </div>
        <button
          className="promo-film-center-play"
          onClick={openPromo}
          aria-label="تشغيل فيلم هَبّ السعد"
        >
          <Play size={25} fill="currentColor" />
        </button>
        <span className="film-duration">00:20 · قصة تستحق المشاهدة</span>
      </div>
    </section>
  );
}
