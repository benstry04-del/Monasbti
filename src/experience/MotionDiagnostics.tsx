import React, { useState, useSyncExternalStore } from "react";
import { useExperience } from "./ExperienceOrchestrator";
import { useMotionDiagnostics, useReducedMotionSafe } from "./hooks";
import { experienceStateService } from "../services/experienceStateService";
import { experienceEvents } from "./experience-events";
import { loadingExperience } from "./loading-controller";
import { loadingMessages, motionTokens } from "./core.mjs";
import { BrandedLoader } from "../components/brand-motion/BrandedLoader";
import { api } from "../store";
export function MotionDiagnostics() {
  const flags = useMotionDiagnostics(),
    reduced = useReducedMotionSafe(),
    experience = useExperience(),
    events = useSyncExternalStore(
      experienceEvents.subscribe,
      experienceEvents.getSnapshot,
    ),
    [notice, setNotice] = useState(""),
    [context, setContext] = useState("quote"),
    [running, setRunning] = useState(false);
  const record = experienceStateService.getRecord();
  const videos = performance
    .getEntriesByType("resource")
    .filter((r: any) => /intro-v1.*\.(mp4|webm)/.test(r.name));
  function save(key: string, value: any) {
    experienceStateService.updateDiagnostics({ [key]: value });
    setNotice("تم حفظ إعداد الاختبار. استخدمي إعادة التشغيل لمعاينة الافتتاح.");
  }
  const first = () => {
    experienceStateService.resetIntro();
    setNotice("أُعيدت حالة المقدمة فقط. الحجوزات محفوظة.");
    experience.restart();
  };
  const returning = () => {
    experienceStateService.markSeen({
      version: flags.introVersion,
      skipped: true,
    });
    experience.restart();
  };
  async function preview(progress = false) {
    if (running) return;
    setRunning(true);
    setNotice("");
    const id = loadingExperience.start({
      scope: "fullscreen",
      context,
      progress: progress ? 0 : undefined,
    });
    try {
      for (let i = 0; i < (progress ? 5 : 1); i++) {
        await api.send("READ");
        if (progress) loadingExperience.update(id, (i + 1) / 5);
      }
      setNotice(
        progress
          ? "اكتملت خمس عمليات فعلية من Mock API؛ النسبة معبّرة عن المهام المكتملة."
          : "اكتمل طلب Mock API. تظهر طبقة التحميل حسب الوقت الفعلي.",
      );
    } catch (e: any) {
      setNotice(e.message);
    } finally {
      loadingExperience.finish(id);
      setRunning(false);
    }
  }
  function download() {
    const data = JSON.stringify({ record, settings: flags, events }, null, 2),
      a = document.createElement("a"),
      url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    a.download = "habb-motion-telemetry.json";
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  return (
    <div className="container motion-diagnostics">
      <div className="section-title">
        <div>
          <span className="eyebrow">HABB ALSAAD · EXPERIENCE LAB</span>
          <h1>مختبر تجربة هَبّ السعد</h1>
          <p>
            أدوات فحص مدمجة مع التطبيق نفسه. لا تغيّر هذه الأدوات الحجوزات أو
            العقود.
          </p>
        </div>
        <a className="motion-diagnostic-link" href="/demo">
          أدوات الأدوار
        </a>
      </div>
      <div className="motion-qa-banner">
        الحالة: {experience.state} · جاهزية التطبيق:{" "}
        {experience.ready ? "جاهز" : "بانتظار الجاهزية"} · الحركة المخفّضة:{" "}
        {reduced ? "مفعّلة" : "غير مفعّلة"} · ملفات الفيديو المطلوبة في هذا
        الدخول: <b data-video-request-count>{videos.length}</b>
      </div>
      {notice && (
        <p role="status" className="info">
          {notice}
        </p>
      )}
      <div className="grid two">
        <section className="card">
          <h2>الافتتاح والمشاهدة</h2>
          <div className="motion-diagnostic-actions">
            <button onClick={first}>محاكاة أول زيارة</button>
            <button onClick={returning}>معاينة Splash عائد</button>
            <button className="secondary" onClick={experience.openPromo}>
              إعادة مشاهدة الفيلم
            </button>
            <button
              className="secondary"
              onClick={() => {
                experienceStateService.updateDiagnostics({
                  introVersion: String(Number(flags.introVersion) + 1),
                });
                experience.restart();
              }}
            >
              رفع إصدار المقدمة وإعادة التشغيل
            </button>
          </div>
          <dl className="receipt-lines">
            <p>
              الإصدار الحالي <b>{flags.introVersion}</b>
            </p>
            <p>
              الإصدار المشاهد{" "}
              <b data-seen-version>{record.version || "لم يُشاهد"}</b>
            </p>
            <p>
              تم التخطي <b>{record.skipped ? "نعم" : "لا"}</b>
            </p>
            <p>
              وقت حفظ المشاهدة <b>{record.completedAt || "—"}</b>
            </p>
            <p>
              التخزين المحلي{" "}
              <b>{record.persistent ? "متاح" : "Fallback في الذاكرة"}</b>
            </p>
            <p>
              الصوت المحفوظ{" "}
              <b>
                {experienceStateService.getMuted()
                  ? "مكتوم"
                  : "مفعّل باختيار المستخدم"}
              </b>
            </p>
          </dl>
          <p className="muted">
            لا تُحمّل ملفات الفيلم في الدخول العائد؛ يبدأ طلبها عند التجربة
            الأولى أو إعادة المشاهدة فقط.
          </p>
        </section>
        <section className="card">
          <h2>الأجهزة والحالات البديلة</h2>
          <label className="field">
            <span>محاكاة الشبكة ووقت Mock API</span>
            <select
              value={flags.network}
              onChange={(e) => save("network", e.target.value)}
            >
              <option value="normal">Wi-Fi سريع · 180ms</option>
              <option value="fast4g">4G · 750ms</option>
              <option value="slow4g">4G بطيء · 3600ms</option>
              <option value="offline">
                Offline · فشل العمليات مع إبقاء الواجهة المحفوظة
              </option>
            </select>
          </label>
          <label className="field">
            <span>توفر الفيلم</span>
            <select
              value={flags.media}
              onChange={(e) => save("media", e.target.value)}
            >
              <option value="normal">طبيعي</option>
              <option value="slow">تأخر جاهزية الفيديو 5.5 ثانية</option>
              <option value="failed">فشل ملف الفيديو</option>
            </select>
          </label>
          <label className="field">
            <span>مصيّر الحركة</span>
            <select
              value={flags.renderer}
              onChange={(e) => save("renderer", e.target.value)}
            >
              <option value="auto">تلقائي · WebGL مع Fallback آمن</option>
              <option value="fallback">محاكاة غياب WebGL · 2.5D</option>
            </select>
          </label>
          <label className="field">
            <span>الحركة المخفّضة</span>
            <select
              value={flags.reducedMotion}
              onChange={(e) => save("reducedMotion", e.target.value)}
            >
              <option value="system">احترام إعداد الجهاز</option>
              <option value="reduce">تفعيل reduced-motion للاختبار</option>
            </select>
          </label>
          <label className="field">
            <span>تأخر جاهزية التطبيق</span>
            <select
              value={flags.appReadyDelay}
              onChange={(e) => save("appReadyDelay", Number(e.target.value))}
            >
              <option value={0}>جاهز فور اكتمال التركيب</option>
              <option value={2500}>2.5 ثانية</option>
              <option value={6000}>
                6 ثوانٍ · اختبار استمرار Splash كتحميل
              </option>
            </select>
          </label>
          <div className="motion-diagnostic-actions">
            <button onClick={experience.restart}>إعادة تشغيل التجربة</button>
            <button
              className="secondary"
              onClick={() => {
                experienceStateService.resetDiagnostics();
                setNotice("عادت إعدادات الشبكة والحركة إلى الوضع الطبيعي.");
              }}
            >
              استعادة الإعدادات الطبيعية
            </button>
          </div>
        </section>
        <section className="card">
          <h2>اختبار التحميل السياقي</h2>
          <p>
            ينفذ الطلب على Mock API الموجود. لا يظهر Loader قبل 350ms، ثم يتدرج
            حسب المدة الفعلية. وضع 4G البطيء يختبر الطبقة الكاملة.
          </p>
          <label className="field">
            <span>سياق التحميل</span>
            <select
              value={context}
              onChange={(e) => setContext(e.target.value)}
            >
              {Object.entries(loadingMessages)
                .filter(([k]) => !["success", "verification"].includes(k))
                .map(([k, v]) => (
                  <option value={k} key={k}>
                    {v as string}
                  </option>
                ))}
            </select>
          </label>
          <div className="motion-diagnostic-actions">
            <button disabled={running} onClick={() => preview(false)}>
              تشغيل طلب API
            </button>
            <button
              disabled={running}
              className="secondary"
              onClick={() => preview(true)}
            >
              خمس مهام بتقدم موثّق
            </button>
          </div>
          <p className="secure">
            التقدم المرقّم يظهر فقط بعد اكتمال مهام حقيقية، ولا يُستخدم في
            انتظار مجهول المدة.
          </p>
        </section>
        <section className="card">
          <h2>سجل التجربة المحلي</h2>
          <p>
            سجل قابل للربط بأي نظام تحليلات عبر حدث{" "}
            <code dir="ltr">habb:experience-event</code>، دون إرسال بيانات لأي
            مزود خارجي.
          </p>
          <div className="motion-diagnostic-actions">
            <button onClick={download}>تنزيل سجل الاختبار</button>
            <button
              className="secondary"
              onClick={() => experienceEvents.clear()}
            >
              مسح السجل المحلي
            </button>
          </div>
          <div className="telemetry-list">
            {events.slice(0, 8).map((e, i) => (
              <div key={i}>
                <code>{e.name}</code>
                <small>{new Date(e.at).toLocaleTimeString("ar-KW")}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="section-title section">
        <div>
          <h2>عالم واحد، لكل سياق</h2>
          <p>نفس الخامات والإضاءة والشعار، مع عناصر مناسبة للعملية.</p>
        </div>
      </div>
      <div className="motion-loader-previews">
        {[
          "venues",
          "hospitality",
          "quote",
          "contract",
          "payment",
          "generic",
        ].map((c) => (
          <section className="card" key={c}>
            <BrandedLoader context={c} mode="section" />
          </section>
        ))}
      </div>
    </div>
  );
}
