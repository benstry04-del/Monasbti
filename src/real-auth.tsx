import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Eye, EyeOff, Flower2, Mail, ShieldCheck } from "lucide-react";
import { branding } from "./branding.mjs";
import { api, useStore } from "./store";
import { Btn, Link, Field, Logo, go } from "./main";
import "./auth-journey.css";

const copy = {
  login: ["يا هلا بعودتكم", "سجّلوا دخولكم وكملوا من وين وقفتوا.", "تسجيل الدخول"],
  register: ["خلّنا نبدأ حكايتكم", "كم معلومة بسيطة، ونزهّب لكم مكان تحفظون فيه كل تفاصيل مناسبتكم.", "إنشاء حساب"],
  verify: ["باقي خطوة وتكتمل", "حطّوا رمز التحقق اللي وصلكم على البريد. يتكوّن من ست أرقام.", "تحقق وتابع"],
  "forgot-password": ["نسيتوا كلمة المرور؟", "اكتبوا بريد الحساب ونرسل لكم رابط تعيين كلمة مرور جديدة.", "إرسال رابط الاستعادة"],
  "reset-password": ["نزهّب كلمة مرور جديدة", "اختاروا كلمة مرور جديدة، وبعدها تقدرون تسجّلون دخولكم.", "حفظ كلمة المرور"],
};

const verificationKey = "habb:verification-email";
let verificationEmail = "";
function savedEmail() {
  try { return sessionStorage.getItem(verificationKey) || verificationEmail; }
  catch { return verificationEmail; }
}
function rememberEmail(email: string) {
  verificationEmail = email;
  try {
    if (email) sessionStorage.setItem(verificationKey, email);
    else sessionStorage.removeItem(verificationKey);
  } catch {}
}

export function RealAuth({ path }: { path: string }) {
  const settings = useStore().settings;
  const identity = branding(settings);
  const kind = path.split("/")[2] as keyof typeof copy;
  const register = kind === "register", verify = kind === "verify";
  const forgot = kind === "forgot-password", reset = kind === "reset-password";
  const [title, intro, submitLabel] = copy[kind] || copy.login;
  const [email, setEmail] = useState(() => verify ? savedEmail() : "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) alert.current?.focus(); }, [error]);

  const params = new URLSearchParams(location.search);
  const rawNext = params.get("next") || "";
  const next = /^\/(?![\/\\])/.test(rawNext) && !/[\\\x00-\x1f]/.test(rawNext) ? rawNext : "";
  const authLink = (target: string) => "/auth/" + target + (next ? "?next=" + encodeURIComponent(next) : "");
  const finish = (role: string) => go(next || (role === "supplier" ? "/supplier" :
    ["admin", "staff"].includes(role) ? "/admin" : "/dashboard"));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || resending) return;
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (register) {
        await api.register(values, values.password);
        rememberEmail(values.email);
        go(authLink("verify"));
      } else if (verify) {
        const result = await api.verify(values.email, values.code);
        rememberEmail("");
        finish(result.user?.role || "customer");
      } else if (forgot) {
        await api.forgot(values.email);
        setNotice("إذا بريدكم مسجّل ويانا، راح يوصلكم رابط الاستعادة. شيّكوا الوارد والبريد غير المرغوب فيه.");
      } else if (reset) {
        await api.resetPassword(params.get("token"), values.password);
        go(authLink("login"));
      } else {
        const result = await api.authenticate(values.email, values.password);
        finish(result.user?.role);
      }
    } catch (failure: any) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="auth-journey">
    <div className="auth-journey-top">
      <Link to="/"><ArrowRight size={17} /> ردّوا للرئيسية</Link>
      <Link to="/services">تصفّحوا الخدمات <ArrowLeft size={16} /></Link>
    </div>
    <div className="auth-journey-grid">
      <aside className="auth-story" aria-label="رحلتكم مع المنصة">
        <img src="/assets/hero-kuwait.jpg" alt="" />
        <div className="auth-story-copy">
          <span className="auth-story-kicker"><Flower2 size={17} /> {identity.name || "مناسبتكم"}</span>
          <h2>من أول فكرة<br />{" "}لي يوم السعد.</h2>
          <p>رتّبوا مناسبتكم على راحتكم، وخلّوا كل تفاصيلها بمكان واحد.</p>
          <ul>
            <li><CalendarDays size={19} /><span>اختاروا نوع المناسبة وموعدها</span></li>
            <li><Flower2 size={19} /><span>تصفّحوا الخدمات واحفظوا اللي يعجبكم</span></li>
            <li><Check size={19} /><span>تابعوا الطلب والعرض من حسابكم</span></li>
          </ul>
        </div>
      </aside>
      <section className="auth-form auth-journey-panel" aria-labelledby="auth-journey-title">
        <Logo variant="auth" className={identity.logo ? "auth-image-logo" : "auth-text-logo"} />
        {!forgot && !reset && !verify && <nav className="auth-switch" aria-label="اختيار طريقة الدخول">
          <Link to={authLink("login")} aria-current={!register ? "page" : undefined}>عندي حساب</Link>
          <Link to={authLink("register")} aria-current={register ? "page" : undefined}>أول مرة ويانا</Link>
        </nav>}
        {(register || verify) && <ol className="auth-steps" aria-label="خطوات إنشاء الحساب">
          <li aria-current={register ? "step" : undefined}><b>{verify ? <Check size={13} /> : "١"}</b> بياناتكم</li>
          <li aria-current={verify ? "step" : undefined}><b>٢</b> تأكيد البريد</li>
        </ol>}
        <div className="auth-journey-heading">
          <span className="eyebrow">حياكم الله{identity.name && " في " + identity.name}</span>
          <h1 id="auth-journey-title">{title}</h1>
          <p>{intro}</p>
        </div>
        <form onSubmit={submit} aria-busy={busy}>
          {register && <div className="auth-contact">
            <Field label="الاسم الكامل"><input name="name" required autoComplete="name" minLength={2} maxLength={120} placeholder="اسمكم الكريم" /></Field>
            <Field label="رقم الهاتف"><input name="mobile" type="tel" dir="ltr" minLength={8} maxLength={24} required autoComplete="tel" placeholder="+965" /></Field>
          </div>}
          {!reset && <Field label="البريد الإلكتروني">
            <input name="email" type="email" required autoComplete={register || verify ? "email" : "username"} dir="ltr"
              value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" />
          </Field>}
          {verify ? <Field label="رمز التحقق">
            <input name="code" required pattern="[0-9]{6}" inputMode="numeric" autoComplete="one-time-code"
              dir="ltr" maxLength={6} className="auth-code" placeholder="••••••" />
          </Field> : !forgot && <>
            <div className="auth-password">
              <Field label={reset ? "كلمة المرور الجديدة" : "كلمة المرور"}>
                <input name="password" type={showPassword ? "text" : "password"} dir="ltr" required
                  minLength={register || reset ? 12 : undefined} maxLength={128}
                  aria-label={reset ? "كلمة المرور الجديدة" : "كلمة المرور"}
                  aria-describedby={register || reset ? "auth-password-help" : undefined}
                  autoComplete={register || reset ? "new-password" : "current-password"} />
              </Field>
              <button type="button" onClick={() => setShowPassword(value => !value)}
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                aria-pressed={showPassword}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
            </div>
            {(register || reset) && <small id="auth-password-help" className="auth-field-help">خلّوها ١٢ حرفًا أو أكثر.</small>}
          </>}
          {!register && !verify && !forgot && !reset &&
            <Link className="auth-secondary-link" to={authLink("forgot-password")}>نسيتوا كلمة المرور؟</Link>}
          {register && <label className="check-label auth-consent">
            <input type="checkbox" required /> أوافق على <Link to="/faq">الشروط وسياسة الخصوصية</Link>
          </label>}
          {error && <p className="form-error" tabIndex={-1} ref={alert} role="alert">{error}</p>}
          {notice && <p className="info" role="status">{notice}</p>}
          <Btn type="submit" className="full auth-submit" disabled={busy || resending}>
            {busy ? "لحظة… نجهّز طلبكم" : submitLabel}<ArrowLeft size={18} />
          </Btn>
          {verify && <Btn type="button" variant="text" disabled={busy || resending || !email}
            onClick={async () => {
              setResending(true); setError(""); setNotice("");
              try {
                await api.resend(email);
                rememberEmail(email);
                setNotice("تم طلب رمز جديد. شيّكوا على بريدكم بعد شوي.");
              } catch (failure: any) { setError(failure.message); }
              finally { setResending(false); }
            }}><Mail size={17} /> {resending ? "جارٍ طلب الرمز…" : "إعادة إرسال الرمز"}</Btn>}
        </form>
        <div className="auth-journey-help">
          <ShieldCheck size={18} />
          {forgot || reset || verify
            ? <Link to={authLink("login")}>العودة لتسجيل الدخول</Link>
            : <span>محتاجين مساعدة؟ <Link to="/support">تواصلوا ويانا</Link></span>}
        </div>
      </section>
    </div>
  </div>;
}
