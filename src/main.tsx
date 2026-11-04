import {branding} from "./branding.mjs";
import {useRecordPage,RecordPager} from './record-pagination';
import { couponDiscount, installmentMinors } from "./money.mjs";
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Search,
  CalendarDays,
  MapPin,
  Users,
  ShoppingBag,
  Menu,
  X,
  Flower2,
  Sparkles,
  Star,
  Plus,
  Minus,
  Trash2,
  Bookmark,
  ShieldCheck,
  Clock,
  FileText,
  CreditCard,
  Bell,
  LayoutDashboard,
  House,
  Grid2X2,
  Gift,
  User,
  LogOut,
  SlidersHorizontal,
  Download,
  Printer,
  Send,
  Camera,
  Coffee,
  Armchair,
  Utensils,
  Car,
  Music,
  GraduationCap,
  Cake,
  Building2,
  Headphones,
  MessageCircle,
  Settings,
  ChartNoAxesCombined,
  ClipboardList,
  Wallet,
  CheckCheck,
  Pencil,
  Eye,
  AlertCircle,
  RefreshCw,
  PackageCheck,
  Mail,
  Phone,
  Globe,
  LockKeyhole,
  ExternalLink,
} from "lucide-react";
import { api, useStore, isDemo } from "./store";
import { RealAuth } from "./real-auth";
import { accountHome, authPath, loginDestination } from "./auth-navigation";
import {
  occasions,
  categories,
  labels,
  money,
  pricing,
  current,
} from "./domain.mjs";
import "./styles.css";
import { Admin, Supplier, Utility, Demo } from "./operations";
import {
  ExperienceOrchestrator,
  useExperience,
} from "./experience/ExperienceOrchestrator";
import { PromoFilmCard } from "./components/brand-motion/PromoFilmCard";
import {
  BrandedLoader,
  ContextualLoader,
  PaymentSuccessBloom,
} from "./components/brand-motion/BrandedLoader";
import { MotionDiagnostics } from "./experience/MotionDiagnostics";
import { loadingMessages } from "./experience/core.mjs";
import { registerExperienceCache } from "./services/offlineCacheService";
const iconMap = [
  Grid2X2,
  Building2,
  Sparkles,
  Armchair,
  Flower2,
  Utensils,
  Coffee,
  Music,
  Camera,
  Car,
  User,
];
const A = "/assets/";
function go(path: string) {
  if (path === location.pathname + location.search + location.hash) return;
  history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "instant" });
}
function Link({ to, children, className = "", onClick, ...rest }: any) {
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && !e.defaultPrevented) {
          e.preventDefault();
          onClick?.(e);
          go(to);
        }
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
function Logo({
  variant = "default",
  className = "",
}: {
  variant?: "default" | "footer" | "auth" | "compact";
  className?: string;
} = {}) {
  const identity = branding(useStore().settings);
  const full = variant === "footer" || variant === "auth";
  return <Link to="/" className={"logo logo--" + variant + " " + className}
    aria-label={[identity.title, "الرئيسية"].filter(Boolean).join(" — ")}>
    {full && identity.logo ? (
      <span className={variant === "footer" ? "footer-logo-badge" : "auth-logo-badge"}>
        <img src={identity.logo} alt={identity.title || "الشعار"} className={variant === "footer" ? "logo-img--full" : "logo-img--auth"} />
      </span>
    ) : <>
      {!full && identity.emblem && <span className="logo-mark"><img src={identity.emblem} alt="" className="logo-emblem-img" /></span>}
      {(identity.name || identity.latin) && <span className="logo-text-block">
        {identity.name && <span className="logo-title-row"><strong className="logo-brand-name">{identity.name}</strong><span className="heritage-ornament-dot" aria-hidden="true">❖</span></span>}
        {identity.latin && <span className="logo-subtitle-row"><span className="heritage-hairline" aria-hidden="true" /><small className="logo-en-sub">{identity.latin}</small><span className="heritage-hairline" aria-hidden="true" /></span>}
      </span>}
      {!identity.name && !identity.latin && (full || !identity.emblem) && <span>الرئيسية</span>}
    </>}
  </Link>;
}
function Btn({
  children,
  onClick,
  to,
  variant = "",
  className = "",
  ...rest
}: any) {
  return to ? (
    <Link to={to} className={"btn " + variant + " " + className} {...rest}>
      {children}
    </Link>
  ) : (
    <button
      className={"btn " + variant + " " + className}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
function Price({ value, className = "" }: any) {
  return (
    <span className={"price " + className}>
      <b>{money(value)}</b> <small>د.ك</small>
    </span>
  );
}
function Badge({ status, children }: any) {
  let good = [
      "CONFIRMED",
      "PAID",
      "CONFIRMED_SUPPLIER",
      "SIGNED",
      "COMPLETED",
      "CONTRACT_APPROVED",
    ].includes(status),
    bad = [
      "FAILED",
      "PAYMENT_FAILED",
      "CANCELLED",
      "REJECTED",
      "DISPUTED",
    ].includes(status);
  return (
    <span className={"badge " + (good ? "good" : bad ? "bad" : "warm")}>
      {good ? <Check size={12} /> : <Clock size={12} />}{" "}
      {children || labels[status] || status}
    </span>
  );
}
function Field({ label, children, hint }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Empty({
  title = "لا توجد عناصر بعد",
  text = "كل حكاية جميلة تبدأ بخطوة.",
  to = "/services",
  cta = "تصفّح الخدمات",
}: any) {
  return (
    <div className="empty">
      <Flower2 size={55} strokeWidth={0.8} />
      <h3>{title}</h3>
      <p>{text}</p>
      {to && (
        <Btn to={to}>
          {cta}
          <ArrowLeft size={16} />
        </Btn>
      )}
    </div>
  );
}
function SectionTitle({ title, sub, action, to }: any) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {action && (
        <Link className="text-link" to={to}>
          {action}
          <ArrowLeft size={15} />
        </Link>
      )}
    </div>
  );
}
function demoDocumentHeading(settings: any, title: string) {
  const identity = branding(settings);
  const escape = (text: string) => text.replace(/[&<>"']/g, char => "&#" + char.charCodeAt(0) + ";");
  return '<!doctype html><html dir="rtl"><meta charset="utf-8"><title>' + escape(title) + '</title>' +
    (identity.logo ? '<img src="' + escape(identity.logo) + '" height="80" alt="">' : '') +
    '<h1>' + escape(identity.title || title);
}
function exportFile(name: string, data: any, type = "application/json") {
  if (!isDemo && type === "text/html") {
    const payment = api
      .get()
      .payments.find((p) => p.receipt + ".html" === name);
    const endpoint = name.startsWith("quote-")
      ? "/api/documents/quote/" + encodeURIComponent(name.slice(6, -5))
      : payment
        ? "/api/documents/receipt/" + payment.id
        : null;
    if (endpoint) {
      const a = document.createElement("a");
      a.href = endpoint;
      a.download = name;
      a.click();
      return;
    }
  }

  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2),
    url = URL.createObjectURL(new Blob(["\ufeff" + text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
function App() {
  const s = useStore();
  const identity = branding(s.settings);
  useEffect(() => {
    if (!isDemo && !s.runtime?.ready) return;
    document.title = identity.title || "منصة المناسبات";
    for (const rel of ["icon", "apple-touch-icon"]) {
      document.head.querySelector('link[rel="'+rel+'"]')?.remove();
      if (!identity.icon) continue;
      const link = document.createElement("link");
      link.rel = rel; link.href = identity.icon; document.head.appendChild(link);
    }
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute("content", [identity.title, "منصة لتخطيط المناسبات وخدمات الضيافة والتنسيق"].filter(Boolean).join(" — "));
  }, [identity.title, identity.icon, s.runtime?.ready]);
  const { markAppReady } = useExperience();
  useEffect(() => {
    if (!isDemo && !s.runtime?.ready) return;
    const frame = requestAnimationFrame(() => markAppReady());
    return () => cancelAnimationFrame(frame);
  }, [markAppReady, s.runtime?.ready]);
  const [path, setPath] = useState(location.pathname),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState<any>(null),
    [menu, setMenu] = useState(false),
    [signingOut, setSigningOut] = useState(false),
    [demoState, setDemoState] = useState("normal");
  const lastFocus = useRef<any>(null);
  useEffect(() => {
    if (!menu) return;
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenu(false);
      document.querySelector<HTMLButtonElement>(".header .menu-button")?.focus();
    };
    addEventListener("keydown", closeMenu);
    return () => removeEventListener("keydown", closeMenu);
  }, [menu]);
  useEffect(() => {
    const f = () => {
      setPath(location.pathname);
      setMenu(false);
    };
    addEventListener("popstate", f);
    return () => removeEventListener("popstate", f);
  }, []);
  useEffect(() => {
    if (toast) {
      let id = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  useEffect(() => {
    document.documentElement.dir = "rtl";
    document.documentElement.lang = "ar";
  }, []);
  useEffect(() => {
    if (!modal) return;
    lastFocus.current = document.activeElement;
    const first = document.querySelector<HTMLElement>(
      ".modal input, .modal textarea, .modal button",
    );
    first?.focus();
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
      if (e.key === "Tab") {
        const els = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".modal button,.modal input,.modal textarea,.modal select,.modal a",
          ),
        ).filter((x) => !x.hasAttribute("disabled"));
        let a = els[0],
          b = els.at(-1);
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b?.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a?.focus();
        }
      }
    };
    addEventListener("keydown", f);
    return () => {
      removeEventListener("keydown", f);
      lastFocus.current?.focus();
    };
  }, [modal]);
  async function act(action: string, p: any = {}, message = "تم الحفظ بنجاح") {
    setBusy(true);
    try {
      const next = await api.send(action, p);
      if (message) setToast(message);
      return next;
    } catch (e: any) {
      setToast(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      if (await act("LOGOUT", {}, "مع السلامة.. ونشوفكم على خير")) {
        setModal(null);
        go("/");
      }
    } finally {
      setSigningOut(false);
    }
  }
  function ask(
    title: string,
    action: string,
    p: any = {},
    label = "التفاصيل / سبب الإجراء",
    after?: () => void,
  ) {
    setModal({ title, action, p, label, after });
  }
  const role = s.session?.role;
  const signedIn = Boolean(s.session);
  const authReady = isDemo || (s.runtime?.ready && !s.runtime?.error);
  const inAuth = path.startsWith("/auth/");
  const workspace = accountHome(role);
  const workspaceLabel = role === "supplier" ? "بوابة المورد" :
    role === "admin" || role === "staff" ? "لوحة الإدارة" : "لوحة مناسبتكم";
  const canPlan = !signedIn || role === "customer";
  const loginLink = authPath("login");
  useEffect(() => {
    if (isDemo || !authReady || !signedIn || !inAuth) return;
    const next = new URLSearchParams(location.search).get("next") || "";
    history.replaceState({}, "", loginDestination(role, next));
    dispatchEvent(new PopStateEvent("popstate"));
  }, [authReady, signedIn, inAuth, path, role]);
  const isAdmin = path.startsWith("/admin"),
    isSupplier = path.startsWith("/supplier"),
    isCustomer = [
      "/planner",
      "/cart",
      "/request-review",
      "/quote/",
      "/contract/",
      "/checkout/",
      "/payment-result",
      "/dashboard",
      "/bookings/",
      "/favorites",
      "/notifications",
      "/profile",
    ].some(
      (p) =>
        path === p ||
        path.startsWith(p + "/") ||
        (p.endsWith("/") && path.startsWith(p)),
    );
  const denied =
    (isAdmin && !["admin", "staff"].includes(role)) ||
    (isSupplier && role !== "supplier") ||
    (isCustomer && !signedIn) ||
    (!canPlan && /^\/(planner|cart|dashboard|favorites|checkout|payment-result)(\/|$)/.test(path));
  const adminWorkspace = isAdmin && !denied;
  let content: any;
  const shared = { s, act, ask, busy, setToast, setModal, signOut, signingOut };
  if (denied)
    content = (
      <div className="container narrow">
        <Empty
          title={s.session ? "الوصول غير مسموح" : "حياك الله، سجّل دخولك"}
          text={
            s.session
              ? "هذه المساحة مخصصة لفريق العمل المخوّل."
              : "سجّل دخولك لنحفظ تفاصيل مناسبتك ونتابعها معك."
          }
          to={signedIn ? workspace : authPath("login", path + location.search + location.hash)}
          cta={signedIn ? workspaceLabel : "تسجيل الدخول"}
        />
      </div>
    );
  else if (path === "/") content = <Home {...shared} />;
  else if (
    path === "/services" ||
    path === "/packages" ||
    path === "/favorites"
  )
    content = <Catalog {...shared} path={path} />;
  else if (/^\/(services|packages)\//.test(path))
    content = <Detail {...shared} path={path} />;
  else if (path.startsWith("/auth/"))
    content = isDemo ? (
      <Auth {...shared} path={path} />
    ) : (
      signedIn ? null : <RealAuth key={path} path={path} />
    );
  else if (path === "/planner") content = <Planner {...shared} />;
  else if (path === "/cart") content = <Cart {...shared} />;
  else if (path === "/request-review" || path.startsWith("/bookings/"))
    content = <Booking {...shared} id={path.split("/")[2] || s.activeOrder} />;
  else if (path.startsWith("/quote/") || path.startsWith("/contract/"))
    content = (
      <QuoteContract
        {...shared}
        id={path.split("/")[2]}
        contractMode={path.startsWith("/contract/")}
      />
    );
  else if (path.startsWith("/checkout/") || path === "/payment-result")
    content = (
      <Checkout
        {...shared}
        id={path.split("/")[2] || s.activeOrder}
        result={path === "/payment-result"}
      />
    );
  else if (path === "/dashboard") content = <Dashboard {...shared} />;
  else if (isAdmin) content = <Admin {...shared} path={path} />;
  else if (isSupplier) content = <Supplier {...shared} path={path} />;
  else if (!isDemo && (path === "/demo" || path === "/demo/motion"))
    content = <div className="container section"><Empty title="أدوات العرض التجريبي" text="هذه الأدوات مخصصة لبيئة الاختبار. لإدارة الحجوزات والعمليات افتح لوحة الإدارة." to="/admin" cta="لوحة الإدارة" /></div>;
  else if (path === "/demo/motion" && isDemo) content = <MotionDiagnostics />;
  else if (path === "/demo" && isDemo)
    content = (
      <Demo {...shared} demoState={demoState} setDemoState={setDemoState} />
    );
  else if (
    [
      "/about",
      "/faq",
      "/contact",
      "/notifications",
      "/profile",
      "/support",
    ].includes(path)
  )
    content = <Utility {...shared} path={path} />;
  else
    content = (
      <Empty
        title="الصفحة مو موجودة"
        text="تقدرون تردون للرئيسية ونزهّب مناسبتكم وفالكم طيب."
        to="/"
        cta="ردّوا للرئيسية"
      />
    );
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Logo />
          <nav aria-label="القائمة الرئيسية">
            <Link to="/" className={path === "/" ? "active" : ""}>
              الرئيسية
            </Link>
            <Link
              to="/services"
              className={path.startsWith("/services") ? "active" : ""}
            >
              الخدمات
            </Link>
            <Link
              to="/packages"
              className={path.startsWith("/packages") ? "active" : ""}
            >
              الباقات
            </Link>
            {canPlan && <Link to="/planner">زهّبوا مناسبتكم</Link>}
            <Link to="/about">{identity.name ? "عن " + identity.name : "عن المنصة"}</Link>
          </nav>
          <div className="header-actions">
            {isDemo && (
              <Link
                to="/demo/motion"
                className={
                  "btn motion-btn " + (path === "/demo/motion" ? "active" : "")
                }
                aria-label="تجربة الحركة"
                title="تجربة الحركة — Motion Lab"
              >
                <span className="motion-btn-icon" aria-hidden="true">
                  <Sparkles size={16} />
                </span>
                <span className="motion-btn-text">تجربة الحركة</span>
              </Link>
            )}
            <Link
              className="icon-btn desktop"
              aria-label="تدورون على خدمة؟"
              to="/services"
            >
              <Search size={19} />
            </Link>
            {s.session && (
              <Link
                className="icon-btn notification-nav"
                to="/notifications"
                aria-label="الإشعارات"
              >
                <Bell size={19} />
                {s.notifications.some(
                  (n) => !n.read && (!n.userId || n.userId === s.session.id),
                ) && <i />}
              </Link>
            )}
            {canPlan && <Link
              className="icon-btn cart-nav"
              to="/cart"
              aria-label="سلة مناسبتكم"
            >
              <ShoppingBag size={20} />
              {s.cart.length > 0 && <i>{s.cart.length}</i>}
            </Link>}
            {(authReady || signedIn) && (signedIn ? (
              <>
                <Link to={workspace} className="account" aria-label={workspaceLabel}>
                  <span className="avatar">{s.session.name?.[0] || <User size={17} />}</span>
                  <span>يا هلا {s.session.name?.split(" ")[0]}<small>{workspaceLabel}</small></span>
                </Link>
                <button type="button" className="icon-btn header-logout" aria-label="تسجيل الخروج"
                  title="تسجيل الخروج" disabled={signingOut} onClick={signOut}><LogOut size={19} /></button>
              </>
            ) : !inAuth && (
              <Link to={loginLink} className="icon-btn header-login" aria-label="تسجيل الدخول" title="تسجيل الدخول">
                <User size={19} /><span>تسجيل الدخول</span>
              </Link>
            ))}
            {canPlan && <Btn to="/planner" className="book-header">
              زهّبوا الحين
              <CalendarDays size={16} />
            </Btn>}
            <button
              className="icon-btn menu-button"
              aria-label={menu ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={menu}
              aria-controls="header-mobile-menu"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menu && (
          <div className="mobile-menu" id="header-mobile-menu">
            <Link to="/">الرئيسية</Link>
            {isDemo && <Link to="/demo/motion">تجربة الحركة (Motion Lab)</Link>}
            <Link to="/services">خدماتنا ونقوتنا</Link>
            <Link to="/packages">الباقات المزهّبة</Link>
            {canPlan && <Link to="/planner">زهّبوا مناسبتكم</Link>}
            {signedIn && <>
              <Link to={workspace}>{workspaceLabel}</Link>
              <Link to="/profile">بياناتكم وملفكم</Link>
            </>}
            <Link to="/support">تواصلوا ويا المنسق</Link>
            <Link to="/faq">استفساراتكم وأسئلتكم</Link>
            <Link to="/about">{identity.name ? "عن " + identity.name : "عن المنصة"}</Link>
            {authReady && !signedIn && !inAuth && <>
              <Link to={loginLink}>تسجيل الدخول</Link>
              <Link to={authPath("register")}>إنشاء حساب</Link>
            </>}
            {signedIn && <button type="button" disabled={signingOut} onClick={signOut}>تسجيل الخروج</button>}
          </div>
        )}
      </header>
      {s.offline && (
        <div className="offline">
          <AlertCircle size={16} /> وضع عدم الاتصال التجريبي — البيانات المحفوظة
          متاحة للعرض.
        </div>
      )}
      {!isDemo && s.runtime?.error && !adminWorkspace ? (
        <main className="container section">
          <Empty title="تعذر الاتصال بالخدمة" text={s.runtime.error} />
          <Btn onClick={() => api.refresh().catch(() => {})}>
            إعادة المحاولة
          </Btn>
        </main>
      ) : !isDemo && !s.runtime?.ready ? (
        <main className="container section">
          <BrandedLoader mode="section" />
        </main>
      ) : demoState === "loading" ? (
        <main className="container">
          <BrandedLoader mode="section" context="generic" />
          <div className="grid three">
            {[1, 2, 3].map((i) => (
              <div className="skeleton card-skeleton" key={i} />
            ))}
          </div>
          <Btn onClick={() => setDemoState("normal")}>إنهاء اختبار التحميل</Btn>
        </main>
      ) : demoState === "error" ? (
        <main className="container">
          <Empty
            title="تعذر تحميل البيانات"
            text="خطأ محاكى DEMO-503. بياناتك محفوظة."
            to={null}
          />
          <Btn onClick={() => setDemoState("normal")}>
            إعادة المحاولة
            <RefreshCw size={16} />
          </Btn>
        </main>
      ) : (
        <main key={adminWorkspace ? "/admin" : path} className={adminWorkspace ? "admin-workspace" : "page-enter"}>
          {content}
        </main>
      )}
      {!isAdmin && !isSupplier && (isDemo || !path.startsWith("/auth/")) && <Footer />}
      {(isDemo || !path.startsWith("/auth/")) && <nav className="bottom-nav" aria-label="تنقل الهاتف">
        {(signedIn && workspace === "/admin"
          ? [
              ["/admin/orders", "الطلبات", ClipboardList],
              [role === "admin" ? "/admin/payments" : "/admin/approvals", role === "admin" ? "الدفعات" : "الاعتمادات", Wallet],
              ["/admin", "لوحة الإدارة", House],
              ["/admin/reports", "التقارير", ChartNoAxesCombined],
              [role === "admin" ? "/admin/settings" : "/profile", role === "admin" ? "الإعدادات" : "حسابي", Menu],
            ]
          : signedIn && workspace === "/supplier"
            ? [
                ["/supplier", "الرئيسية", House],
                ["/supplier/requests", "الطلبات", ClipboardList],
                ["/supplier/jobs", "التنفيذ", PackageCheck],
                ["/supplier/profile", "الملف", User],
              ]
            : [
                ["/", "الرئيسية", House],
                ["/services", "خدماتنا", Flower2],
                ["/planner", "زهّبوا الحين", CalendarDays],
                ...(signedIn ? [["/dashboard", "مناسباتي", Gift], ["/profile", "حسابي", User]] :
                  authReady ? [[loginLink, "دخول", User], [authPath("register"), "حساب جديد", Plus]] : []),
              ]
        ).map(([to, title, Icon]: any, i) => (
          <Link
            key={to}
            to={to}
            className={
              (path === to ? "active " : "") + (i === 2 ? "center-nav" : "")
            }
          >
            <Icon size={21} />
            <span>{title}</span>
          </Link>
        ))}
      </nav>}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <button onClick={() => setToast("")} aria-label="إغلاق التنبيه">
            <X size={14} />
          </button>
        </div>
      )}

      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal.title}
          >
            <div className="modal-heading">
              <h2>{modal.title}</h2>
              <button
                aria-label="إغلاق النافذة"
                className="icon-btn"
                onClick={() => setModal(null)}
              >
                <X />
              </button>
            </div>
            {modal.body || (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  let f = new FormData(e.currentTarget),
                    next = await act(modal.action, {
                      ...modal.p,
                      ...(modal.action==='FEEDBACK'?{rating:Number(f.get('rating'))}:{}),
                      reason: f.get("reason"),
                      message: f.get("reason"),
                      text: f.get("reason"),
                      reply: f.get("reason"),
                    });
                  if (next) {
                    setModal(null);
                    modal.after?.();
                  }
                }}
              >
                {modal.action==='FEEDBACK'&&<Field label="التقييم"><select name="rating" defaultValue={5}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></Field>}
                <Field label={modal.label}>
                  <textarea name="reason" required minLength={3} rows={4} />
                </Field>
                <div className="info">
                  <ShieldCheck size={19} />
                  سيتم حفظ الإجراء في سجل العملية وإبلاغ الأطراف المعنية.
                </div>
                <Btn type="submit" disabled={busy}>
                  تأكيد الإجراء
                  <Check size={17} />
                </Btn>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
function Footer() {
  const { settings } = useStore();
  const identity = branding(settings);
  return (
    <footer>
      <div className="container footer-grid">
        <div className="footer-brand-col">
          <Logo variant="footer" />
          <p>
            نحوّل كل مناسبة لحكاية كويتية راقية تبيّض الوجه.
            <br />
            بروح السنع والذرابة، واهتمام فائق بأدق التفاصيل والمواجيب.
          </p>
          <div className="socials">
            <span>KW</span>
            <Flower2 size={19} />
            <Heart size={19} />
          </div>
        </div>
        <div>
          <h4>زهاب مناسبتكم</h4>
          <Link to="/services">خدماتنا ونقوتنا</Link>
          <Link to="/packages">الباقات المزهّبة</Link>
          <Link to="/planner">تخطيط المناسبة</Link>
        </div>
        <div>
          <h4>فالكم طيب.. وحنا بخدمتكم</h4>
          <Link to="/about">{identity.name ? "عن " + identity.name : "عن المنصة"}</Link>
          <Link to="/faq">استفساراتكم وأسئلتكم</Link>
          <Link to="/contact">تواصلوا ويانا</Link>
        </div>
        <div>
          <h4>حياكم بأي وقت</h4>
          <a
            href={
              settings.contactPhone
                ? "tel:" + settings.contactPhone
                : "/contact"
            }
          >
            <Phone size={14} />
            {settings.contactPhone || "تواصلوا عبر النموذج"}
          </a>
          <a
            href={
              settings.contactEmail
                ? "mailto:" + settings.contactEmail
                : "/contact"
            }
          >
            <Mail size={14} />
            {settings.contactEmail || "فريق خدمة العملاء"}
          </a>
          <p>
            <MapPin size={14} /> ديرة الخير — الكويت
          </p>
        </div>
      </div>
      <div className="footer-bottom">
        © 2026 {identity.title} — لكل مناسبة حكاية كويتية راقية تبيّض
        الوجه.{" "}
        <span>
          {isDemo
            ? "بيئة تجريبية — جميع الحجوزات والمدفوعات محاكاة"
            : settings.companyName || identity.name || "المنصة"}
        </span>
      </div>
    </footer>
  );
}
function Hero({ title, sub, text, home = false, canPlan = true }: any) {
  return (
    <section className={"hero " + (home ? "home-hero" : "")}>
      <div className="hero-image" />
      <div className="hero-shade" />
      <div className="container hero-content">
        <span className="eyebrow">
          ❖ يا هلا ومسهلا.. على السنع والذرابة تلاقونا ❖
        </span>
        <h1>{title}</h1>
        <h2>{sub}</h2>
        <p>{text}</p>
        {home && canPlan && (
          <div className="hero-select">
            <select
              aria-label="نوع المناسبة"
              defaultValue=""
              onChange={(e) => api.send("PLANNER", { type: e.target.value })}
            >
              <option value="" disabled>
                شنو بخاطركم نزهّب لكم اليوم؟
              </option>
              {occasions.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <Btn to="/planner">
              سمّوا وابدوا حكايتكم
              <ArrowLeft size={17} />
            </Btn>
          </div>
        )}
      </div>
      <div className="hero-wave" />
    </section>
  );
}
function ServiceCard({ service, act, s }: any) {
  return (
    <article className="service-card">
      <div className="service-photo">
        <Link to={"/services/" + service.id}>
          <img
            src={A + service.image + ".jpg"}
            alt={service.title}
            loading="lazy"
          />
        </Link>
        <button
          className={
            "favorite icon-btn " +
            (s.favorites.includes(service.id) ? "saved" : "")
          }
          aria-label={"حفظ " + service.title}
          onClick={() =>
            act(
              "FAVORITE",
              { id: service.id },
              s.favorites.includes(service.id)
                ? "شلتوها من المفضلة"
                : "انحفظت بالمفضلة.. فالكم طيب",
            )
          }
        >
          <Heart
            size={17}
            fill={s.favorites.includes(service.id) ? "currentColor" : "none"}
          />
        </button>
        <Badge status={service.available ? "CONFIRMED" : "PENDING"}>
          {!isDemo && !service.availabilityKnown
            ? "حسب توفر الموعد"
            : service.available
              ? "مزهّب ومتاح الحين"
              : "غير متاح بالموعد المحدد"}
        </Badge>
      </div>
      <div className="service-body">
        <Link to={"/services/" + service.id}>
          <h3>{service.title}</h3>
        </Link>
        <p>{service.category} · شغل سنع ومدلول</p>
        <div className="rating">
          <span>★★★★★</span>{" "}
          <small>
            ({service.reviews}) {service.rating.toFixed(1)}
          </small>
        </div>
        <div className="service-bottom">
          <Price value={service.price} />
          <button
            className="add-cart"
            aria-label={"إضافة " + service.title + " للسلة"}
            onClick={() =>
              act(
                "CART_ADD",
                { id: service.id },
                "انضافت الخدمة لسلة مناسبتكم.. زارتنا البركة!",
              )
            }
          >
            <Plus size={18} />
            <ShoppingBag size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
function PackageCard({ pack }: any) {
  return (
    <Link to={"/packages/" + pack.id} className="package-card">
      <img src={A + pack.image + ".jpg"} alt={pack.title} loading="lazy" />
      <div>
        <span className="eyebrow">ذكريات تفرّح القلب</span>
        <h3>{pack.title}</h3>
        <p>شغل سنع يبيّض الوجه · لي حد {pack.capacity} معزوم</p>
        <span className="muted">تبدي من</span>
        <div className="package-price">
          <Price value={pack.price} />
          <span className="round-arrow">
            <ArrowLeft size={17} />
          </span>
        </div>
      </div>
    </Link>
  );
}
function Home({ s }: any) {
  const brand = branding(s.settings).name || "المنصة";
  const occasionImages = [
    "wedding",
    "flowers",
    "table",
    "cake",
    "coffee",
    "flowers",
    "hall",
    "table",
  ];
  return (
    <>
      <Hero
        home
        canPlan={!s.session || s.session.role === "customer"}
        title="يا هلا ومسهلا.. زارتنا البركة"
        sub="كل مناسبة تبيّض الوجه.. تبدي من هني"
        text={`من ليالي العمر وأفراح الأهل لي عزائم الديوانية والجمعات الطيبة، نزهّب لكم كل التفاصيل على أصولها.. استريحوا وخلو الباقي على سنع ${brand} وفالكم طيب.`}
      />
      {!s.session && <section className="container welcome-path" aria-labelledby="welcome-path-title">
        <div>
          <span className="eyebrow">أول مرة ويانا؟</span>
          <h2 id="welcome-path-title">خلّ مناسبتكم تمشي على سنع</h2>
          <p>خذوا فكرة عن الخدمات، اختاروا اللي يناسبكم، واحفظوا تجهيزاتكم بحسابكم علشان تردّون لها بأي وقت.</p>
        </div>
        <div className="button-row">
          <Btn to="/auth/register?next=%2Fplanner">افتحوا حساب وابدوا <ArrowLeft size={17} /></Btn>
          <Btn to="/auth/login" variant="outline">عندكم حساب؟</Btn>
          <Link to="/services" className="text-link">أبي أتصفّح أول</Link>
        </div>
      </section>}
      <PromoFilmCard />
      <section className="container occasions-section">
        <SectionTitle
          title="نقوة مناسباتنا"
          sub="عسى دياركم دوم عامرة بالأفراح والمسرات.. نقّوا مناسبتكم وخلو الباقي علينا"
        />
        <div className="occasion-grid">
          {[0, 4, 3, 2, 6, 7].map((i) => (
            <Link
              to="/planner"
              key={i}
              className="occasion-card"
              onClick={() => {
                api.send("PLANNER", { type: occasions[i], step: 0 });
              }}
            >
              <img src={A + occasionImages[i] + ".jpg"} alt="" loading="lazy" />
              <div>
                {occasions[i]}
                <span>
                  <ArrowLeft size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="audience-section">
        <div className="container">
          <SectionTitle
            title="لمن ودّكم نزهّب المناسبة؟"
            sub="خدمات مفصّلة على سنقة عشرة ترضي كل الأذواق"
          />
          <div className="grid three">
            {[
              [
                "حريمنا وأفراحنا",
                "كوش، أعراس، استقبالات ولحظات تملى العين بكل ذرابة",
                "flowers",
                "نسائية",
              ],
              [
                "جمعات الأهل والكل",
                "مناسبات مشتركة وخدمات متكاملة تبيّض الوجه",
                "table",
                "مشتركة",
              ],
              [
                "ديوانية ورياييل",
                "عزائم، قهاوي مهيلة، ومواجيب رجال ترفع الراس",
                "coffee",
                "رجالية",
              ],
            ].map(([t, d, p, f]) => (
              <Link
                to={"/services?audience=" + encodeURIComponent(f)}
                className="audience-card"
                key={t}
              >
                <img src={A + p + ".jpg"} alt="" loading="lazy" />
                <div>
                  <Users size={26} strokeWidth={1} />
                  <h3>{t}</h3>
                  <p>{d}</p>
                  <span className="round-arrow">
                    <ArrowLeft size={16} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="container section">
        <SectionTitle
          title="باقاتنا المزهّبة"
          sub="باقات جاهزة متكاملة من نقوة خدمات الكويت لأحلى الليالي"
          to="/packages"
          action="شوفوا كل الباقات"
        />
        <div className="grid three">
          {s.packages.slice(0, 3).map((p) => (
            <PackageCard key={p.id} pack={p} />
          ))}
        </div>
      </section>
      <section className="how-section">
        <div className="container">
          <SectionTitle
            title="شلون نزهّب مناسبتكم خطوة بخطوة؟"
            sub="رحلة سهلة ومريحة من أول فكرة لين تكتمل فرحتكم على خير"
          />
          <div className="steps how-steps">
            {[
              [
                "علمونا بطلبكم",
                "قولوا لنا شنو بخاطركم ومتى الموعد",
                CalendarDays,
              ],
              ["نرتّب ونخطط سوا", "ننسّق كل صغيرة وكبيرة على ذوقكم", Pencil],
              [
                "شغل سنع ومضبوط",
                "فريقنا والموردين يزهّبون كل شي بإتقان",
                Flower2,
              ],
              [
                "استريحوا وعيشوا الفرحة",
                "حيّا الله ضيوفكم وعسى الفرح دوم فالكم",
                Heart,
              ],
            ].map(([t, d, Icon]: any) => (
              <div className="how-step" key={t}>
                <span>
                  <Icon size={22} />
                </span>
                <b>{t}</b>
                <small>{d}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="container section">
        <SectionTitle
          title="حچيكم الطيب.. يفرّح القلب وتاج على راسنا"
          sub="ذكريات حلوة وشهادات غالية من أهلنا وحبايبنا بالكويت"
        />
        <div className="grid three testimonials">
          {[
            [
              "سارة العتيبي",
              "يا عل ربي يسلمكم.. شغل سنع وذرابة لا يعلى عليها، بيّضتوا وجهي جدام المعازيم وكل شي كان على أصوله.",
            ],
            [
              "عبدالله الشمري",
              "ما قصرتوا عساكم عالقوة.. قهوة مهيلة واستقبال وديكور عزيمة يرفع الراس والتزام بالدقيقة.",
            ],
            [
              "نورة الحمد",
              "فوق الخيال والتنسيق يبرد الجبد.. ارتحت من عبالة التجهيز وعشت يومي بكل راحة وفرحة.. مشكورين وما قصرتوا.",
            ],
          ].map(([name, t]) => (
            <article className="card" key={name}>
              <span className="quote-mark">”</span>
              <p>«{t}»</p>
              <b>{name}</b>
              <span className="stars">★★★★★</span>
            </article>
          ))}
        </div>
      </section>
      <section className="container final-banner">
        <Flower2 size={52} strokeWidth={0.8} />
        <div>
          <h2>مناسبتكم تستاهل كل السنع والذرابة</h2>
          <p>
            خلّوا العبالة والتجهيز علينا، استريحوا وعيشوا اللحظة وفالكم طيب.
          </p>
        </div>
        <Btn to="/planner">
          ودّكم نبدي نزهّب؟
          <ArrowLeft size={17} />
        </Btn>
      </section>
    </>
  );
}
function Catalog({ s, act, path }: any) {
  const categoryOptions = s.categories || categories;
  const [q, setQ] = useState(""),
    [cat, setCat] = useState("جميع الخدمات"),
    [aud, setAud] = useState(
      new URLSearchParams(location.search).get("audience") || "الكل",
    ),
    [sort, setSort] = useState("popular"),
    [budget, setBudget] = useState("all"),
    [show, setShow] = useState(false),
    [only, setOnly] = useState(false),
    [occasion, setOccasion] = useState("الكل"),
    [area, setArea] = useState("الكل"),
    [date, setDate] = useState("");
  const [availability, setAvailability] = useState<any>({}),
    [availabilityError, setAvailabilityError] = useState("");
  useEffect(() => {
    let active = true;
    setAvailability({});
    setAvailabilityError("");
    if (date && !isDemo)
      api
        .availability(date)
        .then((result) => {
          if (active)
            setAvailability(
              Object.fromEntries(
                result.items.map((x) => [x.serviceId, x.available]),
              ),
            );
        })
        .catch((e) => {
          if (active) setAvailabilityError(e.message);
        });
    return () => {
      active = false;
    };
  }, [date]);
  let packages = path === "/packages",
    fav = path === "/favorites";
  let list = s.services.filter(
    (v) =>
      (!fav || s.favorites.includes(v.id)) &&
      (!q || v.title.includes(q)) &&
      (cat === "جميع الخدمات" || v.category === cat) &&
      (aud === "الكل" || v.audience === aud) &&
      (budget === "all" || v.price <= Number(budget)) &&
      (!only || (date && !isDemo ? availability[v.id] > 0 : v.available)) &&
      (occasion === "الكل" ||
        (occasion === "حفل زفاف" ? v.category !== "نقل" : true)) &&
      (area === "الكل" ||
        s.suppliers.find((x) => x.id === v.supplierId)?.active) &&
      (!date || new Date(date + "T23:59:59Z") >= new Date()),
  );
  if (sort === "low") list.sort((a, b) => a.price - b.price);
  if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
  return (
    <>
      <Hero
        title={
          fav
            ? "نقوتكم ومفضلاتكم"
            : packages
              ? "باقاتنا المزهّبة لمناسبتكم"
              : "خدماتنا ونقوتنا"
        }
        sub="كل اللي يخطر ببالكم لمناسبة تبيّض الوجه بمكان واحد"
        text="خدمات مختارة نقوة من خيرة مجهزي وموردي المناسبات بالكويت، شغل سنع وراحة بال وفالكم طيب."
      />
      <div className="container section">
        <div className="breadcrumb">
          <Link to="/">الرئيسية</Link>
          <ChevronLeft size={12} />
          {fav ? "المفضلة" : packages ? "الباقات" : "الخدمات"}
        </div>
        {!packages && (
          <>
            <div className="aud-tabs">
              {["الكل", "نسائية", "مشتركة", "رجالية"].map((v, i) => (
                <button
                  className={aud === v ? "selected" : ""}
                  key={v}
                  onClick={() => setAud(v)}
                >
                  {i === 0 ? <Grid2X2 size={19} /> : <Users size={19} />}{" "}
                  {i === 0
                    ? "كل الخدمات"
                    : v === "نسائية"
                      ? "حق الحريم"
                      : v === "رجالية"
                        ? "حق الرياييل"
                        : "جمعات مشتركة"}
                </button>
              ))}
            </div>
            <button
              className="filter-toggle btn soft"
              onClick={() => setShow(!show)}
            >
              <SlidersHorizontal size={18} /> فلترة سنعة وسريعة
              <ChevronDown size={16} />
            </button>
            <div className={"filter-panel card " + (show ? "open" : "")}>
              <div className="filter-title">
                <h3>
                  <SlidersHorizontal size={22} /> فلترة سنعة وسريعة
                </h3>
                <p>نقّوا اللي يناسب خاطركم وميزانيتكم بثواني</p>
              </div>
              <div className="filter-grid">
                <Field label="ابحثوا عن خدمة">
                  <div className="input-icon">
                    <Search size={17} />
                    <input
                      placeholder="قاعة، كوشة، بوفيه، قدوع وضيافة، تصوير..."
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                </Field>
                <Field label="نوع الخدمة">
                  <select value={cat} onChange={(e) => setCat(e.target.value)}>
                    {categoryOptions.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="الميزانية">
                  <select
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  >
                    <option value="all">كل الميزانيات</option>
                    <option value="500">لي حد 500 د.ك</option>
                    <option value="1000">لي حد 1,000 د.ك</option>
                    <option value="2500">لي حد 2,500 د.ك</option>
                  </select>
                </Field>
                <Field label="نوع المناسبة">
                  <select
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}
                  >
                    {["الكل", ...occasions].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="الموقع">
                  <select
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                  >
                    {[
                      "الكل",
                      "حولي",
                      "العاصمة",
                      "الفروانية",
                      "الأحمدي",
                      "الجهراء",
                      "مبارك الكبير",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field label="تاريخ المناسبة">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={only}
                    onChange={(e) => setOnly(e.target.checked)}
                  />{" "}
                  المزهّب والمتاح الحين بس
                </label>
                <Btn
                  variant="soft"
                  onClick={() => {
                    setQ("");
                    setCat("جميع الخدمات");
                    setAud("الكل");
                    setBudget("all");
                    setOnly(false);
                    setOccasion("الكل");
                    setArea("الكل");
                    setDate("");
                  }}
                >
                  مسح الفلترة ورد من أول
                  <RefreshCw size={14} />
                </Btn>
              </div>
            </div>
            <SectionTitle
              title={fav ? "المفضلة المحفوظة" : "نقوة الخدمات المتاحة"}
              sub="اكتشفوا خدمات سنعة لمناسبتكم من أفضل المجهزين والموردين بالكويت"
            />
            <div className="category-strip">
              {categoryOptions.map((c, i) => {
                const Icon = iconMap[i] || Flower2;
                return (
                  <button
                    key={c}
                    className={cat === c ? "selected" : ""}
                    onClick={() => setCat(c)}
                  >
                    <Icon size={26} strokeWidth={1.1} />
                    <span>{c}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {availabilityError && (
          <p role="alert" className="form-error">
            {availabilityError}
          </p>
        )}
        <div className="catalog-toolbar">
          <span>
            {packages ? s.packages.length : list.length}{" "}
            {packages ? "باقة مزهّبة" : "خدمة متاحة"}{" "}
            <span className="muted">· نقوة تليق فيكم وتبيّض وجهكم</span>
          </span>
          <select
            aria-label="ترتيب النتائج"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="popular">الأكثر طلبًا وشهرة</option>
            <option value="low">السعر: من الأقل</option>
            <option value="rating">الأعلى تقييمًا وذرابة</option>
          </select>
        </div>
        {packages ? (
          <div className="grid two">
            {[...s.packages]
              .sort((a, b) => (sort === "low" ? a.price - b.price : 0))
              .map((p) => (
                <PackageCard key={p.id} pack={p} />
              ))}
          </div>
        ) : list.length ? (
          <div className="service-grid">
            {list.map((service) => (
              <ServiceCard
                {...{
                  service:
                    date && !isDemo
                      ? {
                          ...service,
                          available: availability[service.id] > 0,
                          availabilityKnown:
                            availability[service.id] !== undefined,
                        }
                      : service,
                  s,
                  act,
                }}
                key={service.id}
              />
            ))}
          </div>
        ) : (
          <Empty
            title="ما لقينا نتائج مطابقة"
            text="جرّبوا تغيرون الفلترة شوي، وفالكم طيب وإن شاء الله تلاقون اللي يسر خاطركم."
            to={fav ? "/services" : null}
          />
        )}
      </div>
    </>
  );
}
function Detail({ s, act, path, setModal }: any) {
  const brand = branding(s.settings).name || "المنصة";
  const isPackage = path.startsWith("/packages"),
    item = (isPackage ? s.packages : s.services).find(
      (x) => x.id === path.split("/")[2],
    ),
    [guests, setGuests] = useState(item?.capacity || 100),
    [color, setColor] = useState("أبيض ملكي"),
    [tab, setTab] = useState(0),
    [qty, setQty] = useState(1),
    [photo, setPhoto] = useState(0),
    [notes, setNotes] = useState("");
  if (!item)
    return (
      <Empty
        title="هذا الخيار مو متاح حاليًا"
        text="تقدرون تتصفحون باقي نقواتنا من الخدمات والباقات."
      />
    );
  let photos = [item.image, "flowers", "table", "wedding", "hall"];
  let price = isPackage
    ? item.price * (guests / (item.capacity || 100))
    : item.price;
  return (
    <div className="container detail-page">
      <div className="breadcrumb">
        <Link to="/">الرئيسية</Link>
        <ChevronLeft size={12} />
        <Link to={isPackage ? "/packages" : "/services"}>
          {isPackage ? "الباقات" : "الخدمات"}
        </Link>
        <ChevronLeft size={12} />
        {item.title}
      </div>
      <div className="detail-top">
        <div className="detail-summary">
          <span className="pill">
            {isPackage ? "باقات المناسبات" : item.category}
          </span>
          <h1>{item.title}</h1>
          <p>
            {item.description ||
              "تجربة سنعة متكاملة تجمع بين الذرابة الكويتية واللمسات العصرية ليوم استثنائي يحقق كل اللي بخاطركم."}
          </p>
          <div className="rating">
            <span>★★★★★</span> 4.9 <small>(128 مراجعة)</small>
          </div>
          <p className="muted">تبدي من</p>
          <Price value={price} className="large-price" />
          <p className="rose">
            لـ {isPackage ? guests : "خدمة مخصصة حسب"}{" "}
            {isPackage ? "معزوم وضيف كريم" : "الطلب"}
          </p>
          <div className="trust-grid">
            {[
              [ShieldCheck, "شغل سنع ومضمون"],
              [Users, "فريق عيال ديرة وخبرة"],
              [Flower2, "تفصيل على ذوقكم"],
              [CheckCheck, "متابعة أول بأول"],
            ].map(([Icon, t]: any) => (
              <div key={t}>
                <Icon size={23} strokeWidth={1} />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="gallery">
          <div className="gallery-main">
            <img src={A + photos[photo] + ".jpg"} alt={item.title} />
            <button
              className="icon-btn gallery-prev"
              aria-label="الصورة السابقة"
              onClick={() => setPhoto((photo + 4) % 5)}
            >
              <ChevronRight />
            </button>
            <button
              className="icon-btn gallery-next"
              aria-label="الصورة التالية"
              onClick={() => setPhoto((photo + 1) % 5)}
            >
              <ChevronLeft />
            </button>
            <button
              className="photo-count"
              onClick={() =>
                setModal({
                  title: "معرض " + item.title,
                  body: (
                    <img
                      className="modal-photo"
                      src={A + photos[photo] + ".jpg"}
                      alt={item.title}
                    />
                  ),
                })
              }
            >
              <Camera size={16} /> عرض الصور · {photo + 1}/5
            </button>
          </div>
          <div className="thumbnails">
            {photos.map((p, i) => (
              <button
                aria-label={"عرض الصورة " + (i + 1)}
                key={i}
                className={photo === i ? "selected" : ""}
                onClick={() => setPhoto(i)}
              >
                <img src={A + p + ".jpg"} alt="" />
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="tabs">
        {[
          "تفاصيل الباقة",
          "شنو يشمل؟",
          "شنو ما يشمل؟",
          "خيارات وإضافات",
          "معلومات الخدمة",
          "حچي وتقييمات العملاء",
        ].map((t, i) => (
          <button
            key={t}
            className={tab === i ? "active" : ""}
            onClick={() => setTab(i)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="detail-options">
        <section className="card">
          <h3>الخيارات الرئيسية</h3>
          <Field label="عدد الضيوف المعازيم">
            <div className="choice-row">
              {[50, 100, 200, 300].map((n) => (
                <button
                  key={n}
                  className={guests === n ? "choice selected" : "choice"}
                  onClick={() => setGuests(n)}
                >
                  {n} معزوم
                </button>
              ))}
            </div>
          </Field>
          <Field label="ألوان وتنسيق المناسبة">
            <div className="swatches">
              {[
                "أبيض ملكي",
                "وردي ناعم",
                "بيج دافئ",
                "أزرق ملكي",
                "ذهبي فاخر",
              ].map((c, i) => (
                <button
                  aria-label={c}
                  key={c}
                  className={color === c ? "selected" : ""}
                  onClick={() => setColor(c)}
                >
                  <span
                    style={{
                      background: [
                        "#f0ede7",
                        "#c8a18c",
                        "#d48d99",
                        "#223c70",
                        "#c69a61",
                      ][i],
                    }}
                  />
                  {c}
                </button>
              ))}
            </div>
          </Field>
        </section>
        <section className="card">
          <h3>
            {tab === 5
              ? "حچي وتقييمات العملاء"
              : tab === 4
                ? "معلومات الخدمة"
                : tab === 2
                  ? "شنو ما يشمل؟"
                  : "شنو يشمل؟"}
          </h3>
          {(tab === 5
            ? [
                "★★★★★ — سارة: تنسيق يبرد الجبد وخدمة تبيّض الوجه.",
                "★★★★★ — نورة: كل شي كان على أصوله وبالدقيقة.",
              ]
            : tab === 4
              ? [
                  "التوفر النهائي يتأكد بعد مراجعة وتأكيد فريقنا",
                  "الخدمة تشمل جميع مناطق ومحافظات الكويت",
                  `متابعة منسق ${brand} وياكم من البداية للنهاية`,
                ]
              : tab === 2
                ? [
                    "خدمات الضيافة الإضافية خارج الباقة",
                    "فرقة موسيقية حية أو طقاقات",
                    "تصاريح خاصة بالموقع الخارجي",
                    "توزيعات وهدايا المعازيم",
                  ]
                : [
                    "تصميم وديكور كامل للمكان على السنع",
                    "تجهيز الطاولات والكراسي الملكية الفاخرة",
                    "الورود الطبيعية وخنين البخور والديكورات",
                    "فريق التنظيم والاستقبال بكل بشاشة",
                    "جلسة تنسيق خاصة ويا منسقكم",
                  ]
          ).map((t) => (
            <div className="inclusion" key={t}>
              <CheckCircle2 size={16} />
              {t}
            </div>
          ))}
        </section>
        <aside className="card booking-card">
          <h3>احجزوا هـ{isPackage ? "الباقة السنعة" : "الخدمة السنعة"}</h3>
          <Price value={price * qty} />
          <Field label="الكمية">
            <Counter value={qty} onChange={setQty} />
          </Field>
          <Field label="طلبات خاصة بخاطركم (اختياري)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="كتبوا لنا أي تفاصيل أو لمسات خاصة ودّكم فيها وفالكم طيب"
              rows={2}
            />
          </Field>
          <Btn
            disabled={false}
            onClick={async () => {
              if (isPackage) {
                await act(
                  "CART_PACKAGE",
                  { id: item.id, qty, guests, option: color },
                  "",
                );
              } else
                await act("CART_ADD", { id: item.id, qty, option: color }, "");
              await act(
                "PLANNER",
                { guests, notes },
                "انضافت اختياراتكم لسلة مناسبتكم.. زارتنا البركة!",
              );
              go("/cart");
            }}
          >
            أضيفوها لسلة مناسبتكم
            <ShoppingBag size={17} />
          </Btn>
          <small>
            <ShieldCheck size={14} />
            نتأكد من التوفر والسعر المزبوط قبل لا نعتمد أي حجز
          </small>
        </aside>
      </div>
      <SectionTitle
        title="لمسات تكمل سنع مناسبتكم"
        sub="نقوة إضافية لتفاصيل تبيّض الوجه"
      />
      <div className="service-grid">
        {s.services.slice(3, 7).map((service) => (
          <ServiceCard {...{ s, act, service }} key={service.id} />
        ))}
      </div>
    </div>
  );
}
function Counter({ value, onChange }: any) {
  return (
    <div className="counter">
      <button aria-label="زيادة الكمية" onClick={() => onChange(value + 1)}>
        <Plus size={15} />
      </button>
      <b>{value}</b>
      <button
        disabled={value <= 1}
        aria-label="تقليل الكمية"
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <Minus size={15} />
      </button>
    </div>
  );
}
function Auth({ s, act, path, setToast }: any) {
  const brand = branding(s.settings).name || "المنصة";
  const [error, setError] = useState(""),
    [password, setPassword] = useState(false);
  let type = path.split("/")[2],
    register = type === "register",
    verify = type === "verify",
    forgot = type === "forgot-password";
  if (verify && !sessionStorage.getItem("registration"))
    return (
      <div className="container narrow section">
        <Empty
          title="ابدوا بخطوة التسجيل يا هلا"
          text="رمز التحقق يبيّن عقب ما تنشئون الحساب أو تطلبون استعادة كلمة المرور."
          to="/auth/register"
          cta="إنشاء حساب"
        />
      </div>
    );
  return (
    <div className="auth-wrap">
      <div className="auth-visual">
        <img src={A + "hero.jpg"} alt="تنسيق حفل فاخر" />
        <div>
          <Flower2 size={48} strokeWidth={1} />
          <h2>
            لكل مناسبة
            <br />
            حكاية كويتية تفرّح القلب وتبيّض الوجه
          </h2>
          <p>وياكم من أول فكرة وخاطر، لين ليلة الفرح وأحلى لحظة.</p>
        </div>
      </div>
      <section className="auth-form">
        <Logo variant="auth" />
        <span className="eyebrow">يا هلا ومسهلا في {brand}</span>
        <h1>
          {register
            ? "حكايتكم وفرحتكم تبدي من هني"
            : verify
              ? "باقي خطوة ونبدي نزهّب"
              : forgot
                ? "استعادة كلمة المرور"
                : "يا هلا وحياكم الله من جديد"}
        </h1>
        <p>
          {register
            ? "سجلوا حسابكم وخلو عبالة التجهيز علينا.. زارتنا البركة!"
            : verify
              ? "حطوا رمز التحقق اللي وصلكم. رمز التجربة السريع: 123456"
              : forgot
                ? "راح ندز لكم رمز تحقق تجريبي عشان تعيدون تعيين كلمة المرور."
                : "سجلوا دخولكم وتابعوا كل تفاصيل وزهاب مناسبتكم بكل سهالة."}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const f = Object.fromEntries(new FormData(e.currentTarget));
            if (verify) {
              if (f.otp !== "123456") {
                setError("رمز التحقق مو مضبوط.. تأكدوا منه عافاكم الله");
                return;
              }
              const draft = JSON.parse(
                sessionStorage.getItem("registration") || "{}",
              );
              if (draft.reset) {
                await api.resetPassword(draft.email, String(f.newPassword));
                sessionStorage.removeItem("registration");
                setToast("تم تحديث كلمة المرور التجريبية وفالكم طيب");
                go("/auth/login");
                return;
              }
              const user = {
                id: "c-" + Date.now(),
                role: "customer",
                name: draft.name,
                email: draft.email,
                mobile: draft.mobile,
                location: draft.location,
                locale: "ar",
              };
              try {
                await api.register(user, draft.password);
                sessionStorage.removeItem("registration");
                setToast("تم إنشاء حسابكم.. يا هلا ومسهلا نورتونا!");
                go("/");
              } catch (e: any) {
                setError(e.message);
              }
              return;
            }
            if (forgot) {
              sessionStorage.setItem(
                "registration",
                JSON.stringify({ reset: true, email: f.email }),
              );
              go("/auth/verify");
              return;
            }
            if (register) {
              if (String(f.password).length < 8) {
                setError("كلمة المرور لازم ما تقل عن 8 أحرف لسلامة حسابكم");
                return;
              }
              sessionStorage.setItem("registration", JSON.stringify(f));
              go("/auth/verify");
              return;
            }
            const email = String(f.email).toLowerCase();
            if (await api.authenticate(email, String(f.password))) {
              go("/dashboard");
              return;
            }
            const role = email.split("@")[0];
            const staff = s.users.find((u) => u.email === email);
            if (staff && !staff.active) {
              setError("تم إيقاف هذا الحساب، تواصلوا مع الإدارة");
              return;
            }
            if (
              (!staff &&
                ![
                  "customer@demo.kw",
                  "supplier@demo.kw",
                  "staff@demo.kw",
                  "admin@demo.kw",
                ].includes(email)) ||
              f.password !==
                (sessionStorage.getItem("demoReset:" + email) ||
                  "Monasabati2026!")
            ) {
              setError(
                "بيانات الدخول مو مضبوطة.. شيكوا الحسابات التوضيحية في ملف README.",
              );
              return;
            }
            const effectiveRole = staff?.role || role;
            const session = {
              id: role,
              role: effectiveRole,
              name:
                role === "customer"
                  ? "سارة العتيبي"
                  : role === "supplier"
                    ? "دار المناسبات"
                    : role === "staff"
                      ? "ريم المنسقة"
                      : "أمل محمد",
              email,
              mobile: "96550001234",
              supplierId: "v1",
            };
            if (await act("LOGIN", session, "يا هلا ومسهلا.. نورتونا")) {
              let next = new URLSearchParams(location.search).get("next");
              go(
                next ||
                  (["admin", "staff"].includes(effectiveRole)
                    ? "/admin"
                    : effectiveRole === "supplier"
                      ? "/supplier"
                      : "/dashboard"),
              );
            }
          }}
        >
          {verify ? (
            <>
              <Field label="رمز التحقق">
                <input
                  name="otp"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="••••••"
                  autoComplete="one-time-code"
                />
              </Field>
              {JSON.parse(sessionStorage.getItem("registration") || "{}")
                .reset && (
                <Field label="كلمة المرور الجديدة">
                  <input
                    type="password"
                    name="newPassword"
                    required
                    minLength={8}
                  />
                </Field>
              )}
              <Btn
                variant="text"
                type="button"
                onClick={() => setToast("أُعيد إرسال الرمز التجريبي: 123456")}
              >
                إعادة إرسال الرمز
              </Btn>
            </>
          ) : (
            <>
              {register && (
                <Field label="الاسم الكامل">
                  <input
                    name="name"
                    required
                    placeholder="شنو الاسم الكريم؟"
                    autoComplete="name"
                  />
                </Field>
              )}
              <Field label="البريد الإلكتروني">
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="name@example.com"
                  dir="ltr"
                  autoComplete="email"
                />
              </Field>
              {register && (
                <>
                  <Field label="رقم الهاتف">
                    <input
                      name="mobile"
                      type="tel"
                      required
                      minLength={8}
                      placeholder="+965"
                      dir="ltr"
                    />
                  </Field>
                  <Field label="المنطقة">
                    <select name="location">
                      {[
                        "حولي",
                        "العاصمة",
                        "الفروانية",
                        "الأحمدي",
                        "الجهراء",
                        "مبارك الكبير",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
              {!forgot && (
                <Field label="كلمة المرور">
                  <div className="input-icon">
                    <input
                      name="password"
                      type={password ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="8 أحرف أو أكثر"
                      autoComplete={
                        register ? "new-password" : "current-password"
                      }
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="إظهار كلمة المرور"
                      onClick={() => setPassword(!password)}
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                </Field>
              )}
              {register && (
                <label className="check-label">
                  <input type="checkbox" required />
                  أوافق على <Link to="/faq">شروط السنع وسياسة الخصوصية</Link>
                </label>
              )}
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Btn type="submit" className="full">
            {register
              ? "إنشاء حساب"
              : verify
                ? "تحقق وتابع"
                : forgot
                  ? "إرسال رمز التحقق"
                  : "تسجيل الدخول"}
            <ArrowLeft size={17} />
          </Btn>
        </form>
        {!verify && !forgot && (
          <>
            <Link className="text-link" to="/auth/forgot-password">
              نسيت كلمة المرور؟
            </Link>
            <p className="auth-bottom">
              {register ? "عندكم حساب من قبل؟" : "أول مرة تنورونا؟"}{" "}
              <Link to={register ? "/auth/login" : "/auth/register"}>
                {register ? "سجّلوا دخولكم" : "أنشئوا حسابًا جديدًا"}
              </Link>
            </p>
          </>
        )}
        <small className="muted">
          <ShieldCheck size={13} /> بيانات تجريبية للعرض فقط، ما يندز أي مسج أو
          إيميل حقيقي.
        </small>
      </section>
    </div>
  );
}
function Planner({ s, act, setToast }: any) {
  const brand = branding(s.settings).name || "المنصة";
  const p = s.planner,
    [error, setError] = useState("");
  const titles = [
    "نوع المناسبة",
    "تاريخ المناسبة",
    "الموقع والمكان",
    "عدد الضيوف",
    "الميزانية",
    "الخدمات المطلوبة",
  ];
  const step = p.step;
  const update = (data: any) => act("PLANNER", data, "");
  async function next() {
    let err =
      step === 1 && (!p.date || new Date(p.date) < new Date("2026-10-24"))
        ? "اختاري تاريخًا مستقبليًا لمناسبتك"
        : step === 2 && !p.location
          ? "حددي موقع ومنطقة المناسبة"
          : step === 3 && (p.guests < 1 || p.guests > 5000)
            ? "عدد الضيوف المعازيم لازم يكون بين 1 و5000"
            : step === 4 && p.budget < 100
              ? "الميزانية تبدي من 100 د.ك"
              : "";
    if (err) {
      setError(err);
      return;
    }
    setError("");
    if (step === 5) {
      go("/cart");
      return;
    }
    await update({ step: step + 1 });
  }
  return (
    <>
      <Hero
        title="زهّبوا مناسبتكم"
        sub="نحو لحظات تبيّض الوجه.. بخطوات بسيطة وسنعة"
        text="خلونا نساعدكم بتجهيز مناسبتكم على الأصول. ننقّي وياكم كل التفاصيل عشان تطلع ليلتكم سنعة وترفع الراس وفالكم طيب."
      />
      <div className="container planner">
        <div className="steps planner-steps">
          {titles.map((t, i) => (
            <div
              key={t}
              className={step === i ? "active" : step > i ? "done" : ""}
            >
              <span>{step > i ? <Check size={16} /> : i + 1}</span>
              <small>{t}</small>
            </div>
          ))}
        </div>
        <div className="card wizard-card">
          <div className="wizard-title">
            <div>
              <h2>
                <CalendarDays size={24} />
                {titles[step]}
              </h2>
              <p>
                {
                  [
                    "سمّوا بالله ونقّوا نوع المناسبة اللي ودّكم نزهّبها لكم",
                    "متى يوم السعد؟ موعدكم المميز يستاهل أحسن استعداد",
                    "وين ودّكم نجتمع ونفرح؟ حددوا لنا المنطقة والقاعة",
                    "كم معزوم غالي على قلوبكم راح ينوّر المناسبة؟",
                    "حدود ميزانيتكم التقريبية.. ونضبط لكم أحسن العروض",
                    "نقّوا الخدمات اللي تكمل حلاوة مناسبتكم وتبيّض وجهكم",
                  ][step]
                }
              </p>
            </div>
            <span>{step + 1} من 6</span>
          </div>
          {step === 0 ? (
            <div className="planner-occasions">
              {occasions.map((t, i) => (
                <button
                  className={
                    "planner-option " + (p.type === t ? "selected" : "")
                  }
                  key={t}
                  onClick={() => update({ type: t })}
                >
                  <div>
                    <img
                      src={
                        A +
                        [
                          "wedding",
                          "flowers",
                          "table",
                          "cake",
                          "food",
                          "flowers",
                          "hall",
                          "coffee",
                        ][i] +
                        ".jpg"
                      }
                      alt=""
                    />
                    {p.type === t && <CheckCircle2 size={22} />}
                  </div>
                  <span className="planner-icon">
                    {React.createElement(
                      [
                        Heart,
                        Flower2,
                        GraduationCap,
                        Cake,
                        Utensils,
                        Users,
                        Building2,
                        Coffee,
                      ][i],
                      { size: 28, strokeWidth: 1 },
                    )}
                  </span>
                  <h3>{t}</h3>
                  <p>
                    {
                      [
                        "ليلة العمر بكل سنعها وذرابتها",
                        "فالكم التوفيق وبداية قصة حلوة",
                        "فرحة الإنجاز ورفعة الراس",
                        "عسى أيامكم كلها أعياد وفرح",
                        "عزيمة تبيّض الوجه ومواجيب كرم",
                        "جمعة أحباب وقرايب تسر الخاطر",
                        "فعالية ترتقي باسمكم وتبيّض الوجه",
                        "جلسة رايقة وخاصة على الأصول",
                      ][i]
                    }
                  </p>
                </button>
              ))}
            </div>
          ) : step === 1 ? (
            <div className="wizard-input">
              <CalendarDays size={55} strokeWidth={1} />
              <Field label="تاريخ المناسبة">
                <input
                  type="date"
                  value={p.date}
                  min="2026-10-24"
                  onChange={(e) => update({ date: e.target.value })}
                />
              </Field>
              <Field label="وقت بدء المناسبة">
                <input
                  type="time"
                  value={p.time || "19:00"}
                  onChange={(e) => update({ time: e.target.value })}
                />
              </Field>
            </div>
          ) : step === 2 ? (
            <div className="wizard-input">
              <MapPin size={55} strokeWidth={1} />
              <Field label="المنطقة">
                <select
                  value={p.location}
                  onChange={(e) => update({ location: e.target.value })}
                >
                  {[
                    "",
                    "حولي",
                    "العاصمة",
                    "الفروانية",
                    "الأحمدي",
                    "الجهراء",
                    "مبارك الكبير",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="عنوان / اسم القاعة">
                <input
                  value={p.venue || ""}
                  placeholder="اسم القاعة أو العنوان التفصيلي"
                  onChange={(e) => update({ venue: e.target.value })}
                />
              </Field>
              <Field label="المكان">
                <select
                  value={p.venueType || "داخلي"}
                  onChange={(e) => update({ venueType: e.target.value })}
                >
                  <option>داخلي</option>
                  <option>خارجي</option>
                  <option>لم أقرر بعد</option>
                </select>
              </Field>
            </div>
          ) : step === 3 ? (
            <div className="wizard-input">
              <Users size={55} strokeWidth={1} />
              <Field label="عدد الضيوف المتوقع">
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={p.guests}
                  onChange={(e) => update({ guests: Number(e.target.value) })}
                />
              </Field>
              <div className="choice-row">
                {[50, 100, 150, 200, 300].map((n) => (
                  <button
                    key={n}
                    className={"choice " + (p.guests === n ? "selected" : "")}
                    onClick={() => update({ guests: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ) : step === 4 ? (
            <div className="wizard-input">
              <Wallet size={55} strokeWidth={1} />
              <Price value={p.budget} className="large-price" />
              <Field label="ميزانية المناسبة بالدينار الكويتي">
                <input
                  type="range"
                  min={100}
                  max={20000}
                  step={100}
                  value={p.budget}
                  onChange={(e) => update({ budget: Number(e.target.value) })}
                />
                <input
                  type="number"
                  min={100}
                  max={100000}
                  value={p.budget}
                  onChange={(e) => update({ budget: Number(e.target.value) })}
                />
              </Field>
            </div>
          ) : (
            <div className="service-grid wizard-services">
              {s.services.slice(0, 10).map((service) => (
                <div key={service.id} className="wizard-service">
                  <img src={A + service.image + ".jpg"} alt="" />
                  <h4>{service.title}</h4>
                  <Price value={service.price} />
                  <Btn
                    variant={
                      s.cart.some((x) => x.id === service.id)
                        ? "soft"
                        : "outline"
                    }
                    onClick={() =>
                      s.cart.some((x) => x.id === service.id)
                        ? act(
                            "CART_REMOVE",
                            { id: service.id },
                            "أزيلت الخدمة من سلة مناسبتكم",
                          )
                        : act(
                            "CART_ADD",
                            { id: service.id },
                            "أضيفت الخدمة لسلة مناسبتكم.. زارتنا البركة",
                          )
                    }
                  >
                    {s.cart.some((x) => x.id === service.id) ? (
                      <Check size={15} />
                    ) : (
                      <Plus size={15} />
                    )}{" "}
                    {s.cart.some((x) => x.id === service.id)
                      ? "تم الاختيار"
                      : "اختيار"}
                  </Btn>
                </div>
              ))}
            </div>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="planner-tip">
            <Flower2 size={34} strokeWidth={1} />
            <div>
              <b>شور ونصيحة من {brand}</b>
              <p>
                اختياركم الدقيق لتفاصيل المناسبة يساعدنا نقترح لكم أفضل الخدمات
                والموردين المزهّبين اللي يضبطون شغلكم على سنقة عشرة وفالكم طيب.
              </p>
            </div>
            <span className="avatar">هـ</span>
          </div>
          <div className="wizard-actions">
            <Btn
              variant="text"
              onClick={() => {
                setToast(
                  "حفظنا كل تفاصيل زهاب مناسبتكم.. استريحوا وردوا لنا بأي وقت وفالكم طيب",
                );
                go("/dashboard");
              }}
            >
              <Bookmark size={17} />
              حفظ ومتابعة لاحقًا
            </Btn>
            <div>
              {step > 0 && (
                <Btn
                  variant="outline"
                  onClick={() => update({ step: step - 1 })}
                >
                  السابق
                </Btn>
              )}
              <Btn onClick={next}>
                {step === 5 ? "مراجعة سلة مناسبتك" : "التالي"}
                <ArrowLeft size={18} />
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
function Cart({ s, act, busy }: any) {
  const [coupon, setCoupon] = useState("");
  const total = pricing(s.cart, couponDiscount(s.cart, s.coupon));
  return (
    <>
      <Hero
        title="سلة مناسبتكم"
        sub="قريبين من جعل مناسبتكم واقعًا حلوًا يفرّح القلب"
        text="راجعوا تفاصيل اختياراتكم ودزوا الطلب للمراجعة، عشان يتواصل وياكم فريقنا ويؤكدها مع الموردين بكل أمانة وسنع."
      />
      <div className="container section">
        <Progress status="DRAFT" />
        <div className="cart-layout">
          <div>
            <SectionTitle
              title="العناصر المختارة"
              sub="تقدرون تعدلون الكمية أو تشيلون أي خدمة قبل لا ترسلون الطلب للمراجعة"
            />
            {s.cart.length ? (
              s.cart.map((l) => (
                <article className="cart-item" key={l.id}>
                  <img src={A + l.image + ".jpg"} alt={l.title} />
                  <div>
                    <h3>{l.title}</h3>
                    <p>
                      {l.category} · {l.option}
                    </p>
                    <div className="cart-meta">
                      <span>
                        <CalendarDays size={14} />
                        {s.planner.date}
                      </span>
                      <span>
                        <Users size={14} />
                        {s.planner.guests} معزوم
                      </span>
                      <span>
                        <MapPin size={14} />
                        {s.planner.location}
                      </span>
                    </div>
                    <Badge status="WAITING" />
                  </div>
                  <Counter
                    value={l.qty}
                    onChange={(qty) => act("CART_QTY", { id: l.id, qty }, "")}
                  />
                  <div>
                    <Price value={l.price * l.qty} />
                    <small className="muted">سعر مبدئي</small>
                    <button
                      className="icon-btn danger"
                      aria-label={"إزالة " + l.title}
                      onClick={() =>
                        act(
                          "CART_REMOVE",
                          { id: l.id },
                          "أزيلت الخدمة. تقدرون تتراجعون تحت",
                        )
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <Empty title="سلة مناسبتكم بانتظار اختياراتكم السنعة" />
            )}
            {s.lastRemoved && (
              <Btn
                variant="text"
                onClick={() => act("CART_UNDO", {}, "استعدنا الخدمة لسلتكم")}
              >
                تراجع عن الحذف
                <RefreshCw size={15} />
              </Btn>
            )}
            <Link className="add-services" to="/services">
              <span className="round-arrow">
                <Plus size={20} />
              </span>
              <div>
                <h3>إضافة خدمات ثانية</h3>
                <p>اكتشفوا المزيد من اللمسات والنقوة لمناسبتكم</p>
              </div>
              <ArrowLeft size={20} />
            </Link>
            <SectionTitle
              title="خدمات تكمّل السنع قد تعجبكم"
              sub="ضيفوا المزيد من اللمسات المميزة لمناسبتكم"
            />
            <div className="grid three compact-services">
              {s.services
                .filter((x) => !s.cart.some((l) => l.id === x.id))
                .slice(0, 3)
                .map((service) => (
                  <ServiceCard key={service.id} {...{ s, act, service }} />
                ))}
            </div>
          </div>
          <aside className="card cart-summary">
            <h2>
              عرض سعر مبدئي
              <FileText size={22} />
            </h2>
            <p>هذا عرض تقديري ومبدئي يتأكد بعد مراجعة الموردين واعتمادهم.</p>
            <Summary
              totals={total}
              discount={couponDiscount(s.cart, s.coupon)}
            />
            <div className="summary-event">
              <p>
                <CalendarDays size={19} />
                تاريخ المناسبة <b>{s.planner.date}</b>
              </p>
              <p>
                <Users size={19} />
                عدد الضيوف <b>{s.planner.guests} معزوم</b>
              </p>
              <p>
                <MapPin size={19} />
                الموقع <b>{s.planner.location}</b>
              </p>
              <Link to="/planner" className="text-link">
                تعديل تفاصيل المناسبة
                <Pencil size={13} />
              </Link>
            </div>
            <form
              className="coupon"
              onSubmit={(e) => {
                e.preventDefault();
                act("COUPON", { code: coupon });
              }}
            >
              <input
                aria-label="كود الخصم"
                placeholder="عندكم كود خصم؟"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
              />
              <button type="submit">تطبيق الكود</button>
              {!isDemo && s.coupon && (
                <button
                  type="button"
                  onClick={() => act("COUPON", { code: "" })}
                >
                  إزالة الخصم
                </button>
              )}
            </form>
            <div className="warning">
              <AlertCircle size={20} />
              <div>
                <b>بانتظار تأكيد المورد</b>
                <p>
                  السعر النهائي والتوفر بعد مراجعة الفريق. لا يتم خصم أي مبلغ
                  حاليًا وتطمنوا.
                </p>
              </div>
            </div>
            <Btn
              className="full"
              disabled={!s.cart.length || busy}
              onClick={async () => {
                if (
                  await act("SUBMIT", {}, "استلمنا طلبكم بكل حب.. وفالكم طيب!")
                )
                  go("/request-review");
              }}
            >
              إرسال الطلب للمراجعة
              <Send size={17} />
            </Btn>
            <small className="secure">
              <ShieldCheck size={17} />
              حجزكم يبدأ بالمراجعة، والدفع بعد توقيع العقد.
            </small>
          </aside>
        </div>
      </div>
    </>
  );
}
function Summary({ totals, discount = 0 }: any) {
  return (
    <div className="summary">
      <div>
        <span>مجموع الخدمات</span>
        <span>{money(totals.subtotal)} د.ك</span>
      </div>
      {discount > 0 && (
        <div className="success">
          <span>خصم خاص</span>
          <span>− {money(discount)} د.ك</span>
        </div>
      )}
      <div>
        <span>رسوم إضافية</span>
        <span>{money(totals.fees || 0)} د.ك</span>
      </div>
      {totals.tax > 0 && (
        <div>
          <span>الضريبة {totals.taxRate}%</span>
          <Price value={totals.tax} />
        </div>
      )}
      <div className="summary-total">
        <b>الإجمالي</b>
        <Price value={totals.total} />
      </div>
    </div>
  );
}
function Progress({ status }: any) {
  if (status === "DRAFT")
    return (
      <div className="steps progress-steps cart-progress">
        {["سلة المناسبة", "مراجعة الفريق", "تأكيد الموردين", "تأكيد الحجز"].map(
          (t, i) => (
            <div key={t} className={i === 0 ? "done" : ""}>
              <span>{i === 0 ? <ShoppingBag size={18} /> : i + 1}</span>
              <small>{t}</small>
            </div>
          ),
        )}
      </div>
    );
  const sequence = [
    "REQUESTED",
    "SUPPLIER_CONFIRMATION",
    "CUSTOMER_REVIEW",
    "SIGNED",
    "CONFIRMED",
    "PREPARATION",
    "COMPLETED",
  ];
  const active = sequence.indexOf(status);
  return (
    <div className="steps progress-steps">
      {[
        "إرسال الطلب",
        "تأكيد الموردين",
        "عرض السعر",
        "توقيع العقد",
        "تأكيد الحجز",
        "قيد التحضير",
        "يوم المناسبة",
      ].map((t, i) => (
        <div key={t} className={active >= i ? "done" : ""}>
          <span>
            {active > i ? (
              <Check size={17} />
            ) : (
              React.createElement(
                [FileText, Users, FileText, Pencil, CreditCard, Flower2, Gift][
                  i
                ],
                { size: 18 },
              )
            )}
          </span>
          <small>{t}</small>
        </div>
      ))}
    </div>
  );
}
function useOrder(s: any, id: string) {
  return s.orders.find(
    (o) =>
      o.id === id &&
      (s.session.role !== "customer" || o.customerId === s.session.id),
  );
}
function OrderEvent({ o }: any) {
  return (
    <>
      <span>
        <CalendarDays size={16} />
        {o.occasion.date}
      </span>
      <span>
        <MapPin size={16} />
        {o.occasion.location} — الكويت
      </span>
      <span>
        <Users size={16} />
        {o.occasion.guests} ضيف
      </span>
    </>
  );
}
function Booking({ s, act, ask, id }: any) {
  const brand = branding(s.settings).name || "المنصة";
  const o = useOrder(s, id);
  if (!o)
    return <Empty title="الطلب مو موجود" to="/dashboard" cta="مناسباتي" />;
  return (
    <>
      <Hero
        title="تفاصيل وزهاب مناسبتكم"
        sub={o.occasion.type + " — يا هلا " + o.customer.split(" ")[0]}
        text="كل التفاصيل بمكان واحد.. وياكم خطوة بخطوة من أول فكرة لين تكتمل الفرحة على خير ونبيّض وجهكم."
      />
      <div className="container section">
        <div className="section-title">
          <div>
            <span className="eyebrow">طلب رقم {o.id}</span>
            <h2>{o.occasion.type}</h2>
          </div>
          <Badge status={o.status} />
        </div>
        <div className="card">
          <div className="event-inline">
            <OrderEvent o={o} />
          </div>
          <Progress status={o.status} />
        </div>
        <div className="grid two section">
          <section className="card">
            <h3>خدمات وزهاب مناسبتكم</h3>
            {o.lines.map((l) => (
              <div className="list-row" key={l.id}>
                <img src={A + l.image + ".jpg"} alt="" />
                <div>
                  <h4>{l.title}</h4>
                  <Badge status={l.response} />
                </div>
                <Price value={l.price * l.qty} />
              </div>
            ))}
          </section>
          <section className="card">
            <h3>الخطوة الياية</h3>
            {o.status === "CUSTOMER_REVIEW" ? (
              <>
                <p>
                  عرض السعر جاهز ومزهّب! راجعوا التفاصيل واعتمدوا العرض عشان
                  نجهّز لكم العقد.
                </p>
                <Btn to={"/quote/" + o.id}>
                  مراجعة عرض السعر
                  <ArrowLeft size={17} />
                </Btn>
              </>
            ) : o.contract?.status === "APPROVED" ? (
              <>
                <p>عقدكم جاهز للتوقيع الإلكتروني.. خطوة بسيطة ونبدأ التنفيذ.</p>
                <Btn to={"/contract/" + o.id}>
                  مراجعة وتوقيع العقد
                  <Pencil size={17} />
                </Btn>
              </>
            ) : o.contract?.status === "SIGNED" ? (
              <>
                <p>
                  العقد موقّع ومضبوط. تقدرون الحين تتابعون الدفعات وتجهيز
                  الموردين.
                </p>
                <Btn to={"/checkout/" + o.id}>
                  عرض جدول الدفعات
                  <CreditCard size={17} />
                </Btn>
              </>
            ) : (
              <div className="info">
                <Clock size={22} />
                فريقنا قاعد يراجع طلبكم ويتواصل ويا الموردين للتأكيد.. بنبلغكم
                أول بأول وفالكم طيب.
              </div>
            )}
            <div className="action-grid">
              <Btn
                variant="outline"
                onClick={() =>
                  ask("طلب تعديل المناسبة", "CHANGES", { id: o.id })
                }
              >
                <Pencil size={17} />
                طلب تعديل
              </Btn>
              <Btn variant="outline" to="/support">
                <MessageCircle size={17} />
                مراسلة المنسق
              </Btn>
              <Btn
                variant="outline"
                onClick={() =>
                  ask(
                    "طلب إلغاء الحجز",
                    "CANCEL",
                    { id: o.id },
                    s.settings.cancellation,
                  )
                }
              >
                <X size={17} />
                طلب إلغاء
              </Btn>
              <Btn
                variant="outline"
                onClick={() =>
                  exportFile(o.id + ".json", {
                    id: o.id,
                    occasion: o.occasion,
                    services: o.lines.map(({ title, price, qty }) => ({
                      title,
                      price,
                      qty,
                    })),
                    status: o.status,
                  })
                }
              >
                <Download size={17} />
                تنزيل التفاصيل
              </Btn>
            </div>
            {o.status === "COMPLETED" && (
              <Btn
                onClick={() =>
                  ask(
                    `شلون كانت مناسبتكم ويا ${brand}؟`,
                    "FEEDBACK",
                    { id: o.id, rating: 5 },
                    "تقييمكم الطيب واقتراحاتكم",
                  )
                }
              >
                قيّموا تجربتكم
                <Star size={17} />
              </Btn>
            )}
          </section>
        </div>
        {o.amendment && <Amendment {...{ s, act, o }} />}
        <div className="grid two">
          <section className="card">
            <h3>سجل رحلتكم والخطوات</h3>
            <div className="vertical-timeline">
              {o.timeline
                .slice()
                .reverse()
                .map((t, i) => (
                  <div key={i}>
                    <span />
                    <div>
                      <b>{labels[t.status] || t.status}</b>
                      <small>{new Date(t.at).toLocaleString("ar-KW")}</small>
                    </div>
                  </div>
                ))}
            </div>
          </section>
          <section className="card">
            <h3>المستندات والدفعات</h3>
            {o.contract && (
              <div className="list-row">
                <FileText />
                <div>
                  <h4>عقد المناسبة · v{o.contract.version}</h4>
                  <p>{o.contract.signature || "بانتظار التوقيع"}</p>
                </div>
                <Btn variant="text" to={"/contract/" + o.id}>
                  عرض
                  <ChevronLeft size={14} />
                </Btn>
              </div>
            )}
            {s.payments
              .filter((p) => p.orderId === o.id)
              .map((p) => (
                <div className="list-row" key={p.id}>
                  <CreditCard size={20} />
                  <div>
                    <h4>{p.receipt}</h4>
                    <Badge status={p.status} />
                    {p.refundStatus && <Badge status={p.refundStatus} />}
                  </div>
                  <Price value={p.amount} />
                  <button
                    aria-label="تنزيل الإيصال"
                    className="icon-btn"
                    onClick={() => exportFile(p.receipt + ".json", p)}
                  >
                    <Download size={16} />
                  </button>
                </div>
              ))}
          </section>
        </div>
      </div>
    </>
  );
}
function Amendment({ s, act, o }: any) {
  const a = o.amendment;
  const [consent,setConsent] = useState(false), [signature,setSignature] = useState("");
  useEffect(()=>{setConsent(false);setSignature("");},[a.id]);
  return (
    <section className="card amendment">
      <h3>
        ملحق تعديل الحجز <Badge status={a.status} />
      </h3>
      <p>{a.reason}</p>
      {a.lines.map((l) => (
        <div className="list-row" key={l.id}>
          <span>{l.title}</span>
          <Price value={l.price} />
          <Badge status={l.response} />
        </div>
      ))}
      {a.financials && <div className="summary-lines">
        <p>الضريبة <Price value={a.financials.tax || 0} /></p>
        <p>إجمالي الملحق <Price value={a.financials.total} /></p>
      </div>}
      {a.status === "CUSTOMER_REVIEW" && s.session.role === "customer" && (
        <>
        <label className="check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />أقر بالموافقة على بنود الملحق ومبلغه</label>
        <Field label="التوقيع على الملحق بالاسم الكامل"><input value={signature} onChange={e=>setSignature(e.target.value)} /></Field>
        <Btn
          disabled={!consent || !signature.trim()}
          onClick={() =>
            act(
              "AMENDMENT_ACCEPT",
              { id: o.id, consent, signature },
              "تم توثيق الموافقة على الملحق",
            )
          }
        >
          الموافقة والتوقيع على الملحق
        </Btn>
        </>
      )}
      {!isDemo && [a,...(o.amendmentHistory || [])].filter(x=>x.version).map(x=><p key={x.id}><a href={`/api/contracts/${encodeURIComponent(o.id)}?version=${x.version}`} download>تنزيل الملحق الموثق · الإصدار {x.version}</a></p>)}
      {a.status === "INTERNAL_REVIEW" &&
        ["admin", "staff"].includes(s.session.role) && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act("AMENDMENT_APPROVE", {
                id: o.id,
                reason: new FormData(e.currentTarget).get("reason"),
              });
            }}
          >
            <Field label="سبب اعتماد الملحق">
              <input name="reason" required />
            </Field>
            <Btn type="submit">تسجيل الموافقة المستقلة على الملحق</Btn>
          </form>
        )}
      {a.status === "SIGNED" && s.session.role === "customer" && (
        <Btn to={"/checkout/" + o.id + "?amendment=1"}>دفع فرق الملحق</Btn>
      )}
      {["admin", "staff"].includes(s.session.role) &&
        a.status === "REQUESTED" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act("AMENDMENT_CREATE", {
                id: o.id,
                serviceId: new FormData(e.currentTarget).get("serviceId"),
              });
            }}
          >
            <Field label="الخدمة الإضافية">
              <select name="serviceId">
                {s.services.map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.title}
                  </option>
                ))}
              </select>
            </Field>
            <Btn type="submit">إنشاء عرض ملحق مستقل</Btn>
          </form>
        )}
    </section>
  );
}
function QuoteContract({ s, act, ask, id, contractMode }: any) {
  const brand = branding(s.settings).name || "المنصة";
  const o = useOrder(s, id),
    [consent, setConsent] = useState(false),
    [signature, setSignature] = useState(""),
    [mode, setMode] = useState("type"),
    [drawn, setDrawn] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  if (!o) return <Empty title="الطلب مو موجود" to="/dashboard" />;
  const ready = [
    "CUSTOMER_REVIEW",
    "CONTRACT_APPROVED",
    "SIGNED",
    "CONFIRMED",
    "PREPARATION",
    "IN_PROGRESS",
    "COMPLETED",
    "PAYMENT_FAILED",
    "PAYMENT_PENDING",
  ].includes(o.status);
  if (!ready && o.status !== "EXPIRED")
    return (
      <div className="container section">
        <Empty
          title="العرض قيد التجهيز"
          text="ننتظر مراجعة الإدارة وتأكيد الموردين قبل السعر النهائي.. وفالكم طيب."
          to={"/bookings/" + id}
          cta="تتبع الطلب"
        />
      </div>
    );
  const totals = pricing(
      o.contract?.snapshot || o.quoteSnapshot || o.lines,
      o.discount,
      0,
      o.financials?.taxRate || 0,
    ),
    expired = o.validUntil && new Date(o.validUntil) < new Date();
  return (
    <>
      <Hero
        title="عرض السعر ومسودة العقد"
        sub="كل التفاصيل واضحة جدامكم.. بشفافية وسنع"
        text="استعرضوا عرض السعر وبنوده، ووقعوا إلكترونيًا عشان نبدا تجهيز مناسبتكم بكل أمانة وذرابة."
      />
      <div className="container section">
        <Progress status={o.status} />
        <div className="grid two">
          <div className="card">
            <h3>
              تفاصيل المناسبة
              <CalendarDays size={20} />
            </h3>
            <div className="event-inline">
              <OrderEvent o={o} />
            </div>
          </div>
          <div className="card">
            <h3>
              بيانات العميل
              <Users size={20} />
            </h3>
            <p>{o.customer}</p>
            <p>
              {s.session.email} · {s.session.mobile}
            </p>
          </div>
        </div>
        <section className="card section quote-table">
          <div className="section-title">
            {!isDemo && o.contract && (
              <a
                className="btn outline"
                href={"/api/contracts/" + encodeURIComponent(id)}
              >
                تنزيل نسخة العقد الموثقة
              </a>
            )}
            <h2>
              عرض السعر <span className="pill">الإصدار {o.version}</span>
            </h2>
            <div>
              <Btn
                variant="outline"
                onClick={() =>
                  exportFile(
                    "quote-" + id + ".html",
                    demoDocumentHeading(s.settings, "عرض السعر") + ' — ' +
                      id +
                      "</h1><p>" +
                      o.customer +
                      "</p>" +
                      o.lines
                        .map(
                          (l) =>
                            "<p>" +
                            l.title +
                            " — " +
                            money(l.price * l.qty) +
                            " د.ك</p>",
                        )
                        .join("") +
                      "<h2>الإجمالي " +
                      money(totals.total) +
                      " د.ك</h2></html>",
                    "text/html",
                  )
                }
              >
                <Download size={15} />
                تحميل العرض
              </Btn>
              <Btn variant="text" onClick={() => window.print()}>
                <Printer size={16} />
                طباعة / PDF
              </Btn>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>الخدمة</th>
                  <th>الوصف</th>
                  <th>الكمية</th>
                  <th>سعر الوحدة (د.ك)</th>
                  <th>الإجمالي (د.ك)</th>
                </tr>
              </thead>
              <tbody>
                {(o.contract?.snapshot || o.quoteSnapshot || o.lines).map(
                  (l) => (
                    <tr key={l.id}>
                      <td>
                        <div className="table-service">
                          <img src={A + l.image + ".jpg"} alt="" />
                          {l.title}
                        </div>
                      </td>
                      <td>
                        {l.category} · {l.option || "تنفيذ شامل"}
                      </td>
                      <td>{l.qty}</td>
                      <td>{money(l.price)}</td>
                      <td>{money(l.price * l.qty)}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <div className="quote-summary">
            <div className="trust-grid">
              {[
                [Clock, "تنفيذ في الموعد المتفق عليه"],
                [ShieldCheck, "جودة وموثوقية مضمونة"],
                [Users, "فريق محترف ومعتمد"],
              ].map(([Icon, t]: any) => (
                <div key={t}>
                  <Icon size={30} strokeWidth={1} />
                  <p>{t}</p>
                </div>
              ))}
            </div>
            <Summary totals={totals} discount={o.discount} />
          </div>
          <p className="muted">
            صلاحية العرض:{" "}
            {o.validUntil
              ? new Date(o.validUntil).toLocaleDateString("ar-KW")
              : "7 أيام من تاريخ الإرسال"}{" "}
            · الخدمات الموضحة تشمل تجهيزها وتنفيذها ومتابعتها.
          </p>
        </section>
        <div className="grid three">
          <div className="card">
            <h3>
              حالة العرض والعقد
              <FileText size={21} />
            </h3>
            <Badge status={expired ? "EXPIRED" : o.status} />
            <p>
              نراجع كل بند بدقة عشان تطلع مناسبتكم على أكمل وجه ومرضية لخاطركم.
            </p>
            {expired ? (
              <Btn onClick={() => act("RENEW", { id })}>طلب تجديد العرض</Btn>
            ) : !o.contract ? (
              <Btn
                onClick={async () => {
                  if (
                    await act(
                      "QUOTE_ACCEPT",
                      { id },
                      "اعتمدنا العرض وجهزنا لكم العقد",
                    )
                  )
                    go("/contract/" + id);
                }}
              >
                الموافقة وتجهيز العقد
                <Check size={17} />
              </Btn>
            ) : (
              <Btn variant="outline" to={"/contract/" + id}>
                عرض العقد
                <Pencil size={16} />
              </Btn>
            )}
            <Btn
              variant="text"
              onClick={() => ask("طلب تعديل عرض السعر", "CHANGES", { id })}
            >
              طلب تعديل
            </Btn>
          </div>
          <div className="card">
            <h3>
              سياسة الإلغاء والاسترداد
              <ShieldCheck size={21} />
            </h3>
            <p>{o.contract?.clauses || s.settings.cancellation}</p>
            <div className="info">
              جميع التفاصيل موضحة في نسخة العقد المعتمدة.
            </div>
          </div>
          <div className="card">
            <h3>
              جدول الدفعات
              <Wallet size={21} />
            </h3>
            {(
              o.contract?.paymentSchedule || [
                s.settings.deposit,
                s.settings.second,
                100 - s.settings.deposit - s.settings.second,
              ]
            ).map((n, i) => (
              <div className="milestone" key={i}>
                <span>
                  {
                    [
                      "عند توقيع العقد",
                      "قبل المناسبة بـ 30 يومًا",
                      "قبل المناسبة بـ 7 أيام",
                    ][i]
                  }
                </span>
                <b>{n}%</b>
                <Price value={installmentMinors(totals.total,o.contract?.paymentSchedule || [s.settings.deposit,s.settings.second,100-s.settings.deposit-s.settings.second])[i]/1000} />
              </div>
            ))}
          </div>
        </div>
        {o.contract && (
          <section className="card section contract-section">
            <h2>بنود العقد · الإصدار {o.contract.version}</h2>
            {[
              "نطاق الخدمات والتزامات التنفيذ",
              "مواعيد التنفيذ ومسؤوليات العميل",
              "الدفعات والتعديلات على الحجز",
              "سياسة الإلغاء والاسترداد",
              "الخصوصية وتسوية الخلافات",
            ].map((t, i) => (
              <details key={t} open={i === 0}>
                <summary>
                  {t}
                  <ChevronDown size={17} />
                </summary>
                <p>
                  {i === 3
                    ? o.contract.clauses
                    : i === 2
                      ? "تُسدد الدفعات بحسب الجدول أعلاه. أي تعديل بعد التوقيع يصدر في ملحق مستقل ويخضع لموافقة المورد والعميل."
                      : "تلتزم " + brand + " بتنسيق وتنفيذ الخدمات الموضحة في عرض السعر المعتمد وفق التاريخ والموقع المتفق عليهما بكل سنع وأمانة. تُحفظ نسخة العقد والموافقة وإصدار الشروط في سجل الطلب."}
                </p>
              </details>
            ))}
            {o.contract.status === "SIGNED" ? (
              <div className="signed-panel">
                <ShieldCheck size={36} />
                <div>
                  <h3>تم توقيع العقد بنجاح</h3>
                  {o.contract.signatureImage && (
                    <img
                      src={o.contract.signatureImage}
                      alt="التوقيع المرسوم المحفوظ"
                      style={{
                        maxWidth: 220,
                        height: 65,
                        objectFit: "contain",
                      }}
                    />
                  )}
                  <p>
                    التوقيع: {o.contract.signature} ·{" "}
                    {new Date(
                      o.contract.signedAt || o.createdAt,
                    ).toLocaleString("ar-KW")}
                  </p>
                </div>
                <Btn to={"/checkout/" + id}>
                  متابعة الدفعات
                  <ArrowLeft size={17} />
                </Btn>
              </div>
            ) : (
              <div className="signature-panel">
                <div>
                  <h3>
                    التوقيع الإلكتروني
                    <Pencil size={22} />
                  </h3>
                  <p>
                    أوافق على جميع البنود المذكورة في عرض السعر ومسودة العقد.
                  </p>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    أقر وأوافق على الشروط والأحكام
                  </label>
                </div>
                <div>
                  <div className="tabs">
                    <button
                      className={mode === "type" ? "active" : ""}
                      onClick={() => setMode("type")}
                    >
                      كتابة الاسم
                    </button>
                    <button
                      className={mode === "draw" ? "active" : ""}
                      onClick={() => setMode("draw")}
                    >
                      رسم التوقيع
                    </button>
                  </div>
                  {mode === "type" ? (
                    <input
                      aria-label="التوقيع بالاسم الكامل"
                      className="signature-input"
                      placeholder="اكتبي اسمك الكامل"
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                    />
                  ) : (
                    <>
                      <canvas
                        ref={canvas}
                        width={450}
                        height={130}
                        aria-label="ارسم توقيعك"
                        onPointerDown={(e) => {
                          drawing.current = true;
                          e.currentTarget.setPointerCapture(e.pointerId);
                          const c = canvas.current!,
                            r = c.getBoundingClientRect(),
                            ctx = c.getContext("2d")!;
                          ctx.beginPath();
                          ctx.moveTo(
                            ((e.clientX - r.left) * 450) / r.width,
                            ((e.clientY - r.top) * 130) / r.height,
                          );
                        }}
                        onPointerMove={(e) => {
                          if (!drawing.current) return;
                          const c = canvas.current!,
                            r = c.getBoundingClientRect(),
                            ctx = c.getContext("2d")!;
                          ctx.strokeStyle = "#5a2d2d";
                          ctx.lineWidth = 2;
                          ctx.lineTo(
                            ((e.clientX - r.left) * 450) / r.width,
                            ((e.clientY - r.top) * 130) / r.height,
                          );
                          ctx.stroke();
                          setDrawn(true);
                        }}
                        onPointerUp={() => (drawing.current = false)}
                      />
                      <Btn
                        variant="text"
                        onClick={() => {
                          canvas.current
                            ?.getContext("2d")
                            ?.clearRect(0, 0, 450, 130);
                          setDrawn(false);
                        }}
                      >
                        مسح التوقيع
                      </Btn>
                    </>
                  )}
                </div>
                <Btn
                  disabled={
                    !consent ||
                    (mode === "type" ? signature.trim().length < 3 : !drawn)
                  }
                  onClick={async () => {
                    if (
                      await act(
                        "SIGN",
                        {
                          id,
                          consent,
                          signature:
                            mode === "type"
                              ? signature
                              : o.customer + " (توقيع مرسوم)",
                          image:
                            mode === "draw"
                              ? canvas.current?.toDataURL()
                              : undefined,
                        },
                        "تم توقيع العقد بنجاح",
                      )
                    )
                      go("/checkout/" + id);
                  }}
                >
                  اعتماد وتوقيع إلكتروني
                  <ShieldCheck size={17} />
                </Btn>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
function Checkout({ s, act, id, result, setModal }: any) {
  const o = useOrder(s, id),
    [method, setMethod] = useState("KNET"),
    [scenario, setScenario] = useState("success"),
    [milestone, setMilestone] = useState(0),
    [consent, setConsent] = useState(false),
    [processing, setProcessing] = useState(false),
    [error, setError] = useState("");
  const amendment = new URLSearchParams(location.search).has("amendment");
  useEffect(() => {
    if (isDemo || !result) return;
    const q = new URLSearchParams(location.search),
      record = q.get("paymentRecord"),
      gatewayId = q.get("paymentId");
    if (record && gatewayId)
      api.reconcile(record, gatewayId).catch((e: any) => setError(e.message));
    else api.refresh().catch((e: any) => setError(e.message));
  }, [result]);
  const last = s.payments.find((p) => p.id === s.lastPayment);
  if (!o || o.contract?.status !== "SIGNED")
    return (
      <div className="container section">
        <Empty
          title="وقّعوا العقد أولًا يا هلا"
          text="ما نقدر نبدي الدفع قبل ما تعتمدون العقد وتوقعونه بكل سنع."
          to={o ? "/contract/" + id : "/dashboard"}
          cta="عرض العقد"
        />
      </div>
    );
  const total =
    o.contract.total || pricing(o.contract.snapshot, o.discount).total;
  const installmentAmounts = installmentMinors(total, o.contract?.paymentSchedule || [s.settings.deposit,s.settings.second,100-s.settings.deposit-s.settings.second]).map(n=>n/1000);
  const amount = amendment
    ? (o.amendment?.financials?.total ?? pricing(o.amendment?.lines || []).total)
    : installmentAmounts[milestone];
  async function pay(which = scenario) {
    setProcessing(true);
    setError("");
    if (!isDemo) {
      try {
        await api.send("PAY", {
          id,
          milestone,
          amendment,
          method: method === "KNET" ? "KNET" : "CARD",
        });
      } catch (e: any) {
        setError(e.message);
      } finally {
        setProcessing(false);
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 700));
    let next = await act(
      "PAY",
      { id, method, scenario: which, milestone, amendment },
      "",
    );
    setProcessing(false);
    if (next) go("/payment-result");
    else
      setError(
        "تعذر إتمام العملية.. تأكدوا من استحقاق الدفعة أو جربوا مرة ثانية وفالكم طيب.",
      );
  }
  if (result && last)
    return (
      <div className="container narrow section">
        <div className={"payment-result card " + last.status.toLowerCase()}>
          {last.status === "PAID" && <PaymentSuccessBloom />}
          {last.status === "PAID" ? (
            <CheckCircle2 size={70} strokeWidth={1} />
          ) : last.status === "FAILED" ? (
            <AlertCircle size={70} strokeWidth={1} />
          ) : (
            <Clock size={70} strokeWidth={1} />
          )}
          <span className="eyebrow">بوابة الدفع وتأكيد الحجز</span>
          <h1>
            {last.status === "PAID"
              ? "تم الدفع بكل نجاح"
              : last.status === "FAILED"
                ? "تعذر إتمام الدفع"
                : loadingMessages.verification}
          </h1>
          <p>
            {last.status === "PAID"
              ? "وصلتنا دفعتكم المباركة.. مناسبتكم صارت أقرب، واستريحوا وخلو الباقي علينا وفالكم طيب."
              : last.status === "FAILED"
                ? "البطاقة التجريبية تم رفضها.. ما انخصم ولا فلس. تقدرون تغيرون الطريقة وتجربون مرة ثانية بكل سهولة."
                : "بانتظار إشعار بوابة الدفع لتأكيد التحويل ومباشرة التجهيز."}
          </p>
          <Price value={last.amount} className="large-price" />
          <div className="receipt-lines">
            <p>
              رقم العملية <b>{last.id}</b>
            </p>
            <p>
              رقم الإيصال <b>{last.receipt}</b>
            </p>
            <p>
              طريقة الدفع <b>{last.method}</b>
            </p>
            <p>
              التاريخ <b>{new Date(last.at).toLocaleString("ar-KW")}</b>
            </p>
          </div>
          {last.status === "PENDING" && isDemo && (
            <Btn
              onClick={() =>
                act(
                  "WEBHOOK",
                  { paymentId: last.id },
                  "تمت محاكاة إشعار البوابة وتأكيد الدفع",
                )
              }
            >
              محاكاة Webhook لتأكيد الدفع
            </Btn>
          )}
          {last.status === "FAILED" ? (
            <Btn to={"/checkout/" + id}>
              إعادة المحاولة / تغيير الطريقة
              <RefreshCw size={17} />
            </Btn>
          ) : (
            <Btn to="/dashboard">
              الانتقال إلى لوحة مناسبتك
              <ArrowLeft size={17} />
            </Btn>
          )}
          {last.status === "PAID" && (
            <Btn
              variant="outline"
              onClick={() =>
                exportFile(
                  last.receipt + ".html",
                  demoDocumentHeading(s.settings, "إيصال تجريبي") + '</h1><p>' +
                    last.receipt +
                    "</p><p>" +
                    money(last.amount) +
                    " د.ك</p><p>" +
                    last.method +
                    " — " +
                    last.at +
                    "</p></html>",
                  "text/html",
                )
              }
            >
              <Download size={17} />
              تحميل الإيصال السنع
            </Btn>
          )}
        </div>
      </div>
    );
  return (
    <>
      <Hero
        title="تأكيد الدفع"
        sub="خطوة أخيرة.. ونبدي نزهّب ليلتكم الطيبة"
        text="شيكوا على المبلغ وجدول الدفعات قبل ما تأكدون الدفع عبر بوابة مزود الدفع الآمنة."
      />
      <div className="container section checkout-layout">
        <section className="card">
          <h2>
            {amendment ? "دفع فرق ملحق التعديل" : "جدول دفعات المناسبة السنعة"}
          </h2>
          {!amendment &&
            (
              o.contract?.paymentSchedule || [
                s.settings.deposit,
                s.settings.second,
                100 - s.settings.deposit - s.settings.second,
              ]
            ).map((n, i) => {
              let paid = s.payments.some(
                  (p) =>
                    p.orderId === id &&
                    p.milestone === i &&
                    p.status === "PAID" &&
                    !p.amendment,
                ),
                due =
                  i === 0 ||
                  s.settings.earlyPayment ||
                  Date.now() >=
                    new Date(o.occasion.date).getTime() -
                      (i === 1 ? 30 : 7) * 86400000;
              return (
                <label
                  className={
                    "payment-option " + (milestone === i ? "selected" : "")
                  }
                  key={i}
                >
                  <input
                    type="radio"
                    name="milestone"
                    checked={milestone === i}
                    disabled={paid || !due}
                    onChange={() => setMilestone(i)}
                  />
                  <div>
                    <b>
                      {
                        ["الدفعة الأولى", "الدفعة الثانية", "الدفعة النهائية"][
                          i
                        ]
                      }{" "}
                      · {n}%
                    </b>
                    <small>
                      {paid
                        ? "تم السداد وفالكم طيب"
                        : due
                          ? "مستحقة الحين"
                          : "تو الناس عليها (غير مستحقة)"}
                    </small>
                  </div>
                  <Price value={installmentAmounts[i]} />
                </label>
              );
            })}
          <h3>طريقة الدفع اللي تريحكم</h3>
          <div className="payment-methods">
            {(isDemo
              ? ["KNET", "بطاقة ائتمانية", "تحويل بنكي"]
              : ["KNET", "بطاقة ائتمانية"]
            ).map((m) => (
              <button
                key={m}
                className={method === m ? "selected" : ""}
                onClick={() => setMethod(m)}
              >
                <CreditCard size={22} />
                {m}
              </button>
            ))}
          </div>
          {isDemo && (
            <Field label="سيناريو بوابة الدفع التجريبية">
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
              >
                <option value="success">دفع ناجح ومكتمل</option>
                <option value="decline">رفض البطاقة</option>
                <option value="pending">دفع معلق</option>
                <option value="3ds">تحقق 3D Secure آمن</option>
              </select>
            </Field>
          )}
          <div className="grid two">
            <Field label="الاسم على البطاقة / الفاتورة">
              <input defaultValue={o.customer} placeholder="الاسم الكامل" />
            </Field>
            <Field label="الهاتف">
              <input defaultValue={s.session.mobile} inputMode="tel" />
            </Field>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {isDemo
              ? "أوافق على المبلغ وشروط الدفع التجريبي"
              : "أوافق على المبلغ وشروط الدفع؛ سأنتقل إلى بوابة الدفع الآمنة"}
          </label>
          {error && <p className="form-error">{error}</p>}
          <Btn
            className="full"
            disabled={
              !consent ||
              processing ||
              (!amendment &&
                s.payments.some(
                  (p) =>
                    p.orderId === id &&
                    p.milestone === milestone &&
                    p.status === "PAID" &&
                    !p.amendment,
                ))
            }
            onClick={() => {
              if (!isDemo) {
                pay();
                return;
              }
              if (scenario === "3ds") {
                setModal({
                  title: "التحقق الآمن والسنع — 3D Secure",
                  body: (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const code = new FormData(e.currentTarget).get("otp");
                        if (code !== "123456") {
                          setError(
                            "رمز التحقق مو مضبوط.. تأكدوا منه عافاكم الله",
                          );
                          return;
                        }
                        setModal(null);
                        pay("success");
                      }}
                    >
                      <p role="status">{loadingMessages.verification}</p>
                      <p>
                        حطوا الرمز التجريبي 123456 عشان نأكد العملية بكل سهالة.
                      </p>
                      <Field label="رمز التحقق">
                        <input
                          name="otp"
                          required
                          pattern="123456"
                          inputMode="numeric"
                          title="الرمز التجريبي 123456"
                        />
                      </Field>
                      <Btn type="submit">تأكيد الدفع السريع</Btn>
                      <Btn
                        variant="text"
                        type="button"
                        onClick={() => {
                          setModal(null);
                          pay("decline");
                        }}
                      >
                        محاكاة فشل التحقق
                      </Btn>
                    </form>
                  ),
                });
              } else pay();
            }}
          >
            {processing ? (
              <ContextualLoader
                pending={processing}
                context="payment"
                mode="micro"
              />
            ) : (
              <LockKeyhole size={18} />
            )}{" "}
            {processing
              ? "قاعدين نعالج دفعتكم الحين..."
              : "ادفع الآن · " + money(amount) + " د.ك"}
          </Btn>
          <div className="secure">
            <ShieldCheck size={17} />
            {isDemo
              ? "بوابة محاكاة وتجربة آمنة. ما يحتاج تحطون بيانات بنكية حقيقية."
              : "بيانات البطاقة تُدخل لدى مزود الدفع فقط؛ لا تُخزَّن بيانات البطاقات في المنصة."}
          </div>
        </section>
        <aside className="card cart-summary">
          <img className="checkout-image" src={A + "hero.jpg"} alt="" />
          <h3>
            {o.occasion.type} — {o.customer}
          </h3>
          <div className="event-inline">
            <OrderEvent o={o} />
          </div>
          <Summary totals={{ subtotal: total, total: amount }} />
          <Badge status="SIGNED" />
          <p>العقد موقّع ومعتمد باسم {o.contract.signature}</p>
          <Link to={"/contract/" + id} className="text-link">
            مراجعة العقد السنع
            <FileText size={15} />
          </Link>
        </aside>
      </div>
    </>
  );
}
function Dashboard({ s, act, ask }: any) {
  const brand = branding(s.settings).name || "المنصة";
  const own = s.orders.filter((o) => o.customerId === s.session.id),
    o = own.find((o) => o.id === s.activeOrder) || own[0];
  const history=useRecordPage('bookings',{},own,s.runtime?.refreshedAt);
  if (!o)
    return (
      <>
        <Hero
          title={"يا هلا ومسهلا " + s.session.name.split(" ")[0]}
          sub="خلّنا نبدي حكاية مناسبتكم السنعة"
          text="زهّبوا ليلتكم واختاروا نقوتكم، وخلو عبالة التجهيز كلها علينا وفالكم طيب."
        />
        <div className="container section">
          <Empty
            title="مناسبتكم الأولى بانتظاركم"
            to="/planner"
            cta="ابدوا تخطيط مناسبتكم الحين"
          />
          {s.planner.step > 0 && (
            <Btn to="/planner" variant="outline">
              متابعة التخطيط المزهّب
            </Btn>
          )}
        </div>
      </>
    );
  const total = o.contract?.total || pricing(o.lines, o.discount).total,
    percent = Math.round((o.paid / total) * 100),
    days = Math.max(
      0,
      Math.ceil((new Date(o.occasion.date).getTime() - Date.now()) / 86400000),
    );
  return (
    <>
      <Hero
        title="يا هلا ومسهلا.. لوحة مناسبتكم"
        sub="كل تفاصيل وزهاب مناسبتكم بمكان واحد"
        text="وياكم خطوة بخطوة، من التخطيط والتنسيق لين تكتمل الفرحة على خير ونبيّض وجهكم."
      />
      <div className="container section customer-dashboard">
        <div className="dashboard-event">
          <article className="card upcoming-card">
            <div>
              <span className="eyebrow">مناسبتي الياية</span>
              <h2>
                {o.occasion.type} {o.customer.split(" ")[0]}
              </h2>
              <div className="event-inline">
                <OrderEvent o={o} />
              </div>
              <div className="button-row">
                <Btn to={"/bookings/" + o.id}>
                  عرض التفاصيل والزهاب
                  <ArrowLeft size={16} />
                </Btn>
                <Btn
                  variant="outline"
                  onClick={() => ask("تعديل الطلب", "CHANGES", { id: o.id })}
                >
                  <Pencil size={16} />
                  تعديل الطلب
                </Btn>
                <Btn variant="outline" to="/support">
                  <MessageCircle size={16} />
                  مراسلة المنسق السنع
                </Btn>
              </div>
            </div>
            <img src={A + "table.jpg"} alt="تنسيق مناسبتك" />
          </article>
          <div className="countdown">
            <CalendarDays size={39} strokeWidth={1} />
            <p>متبقي على يوم السعد</p>
            <strong>
              {days}
              <small>أيام</small>
            </strong>
          </div>
        </div>
        <section className="card section">
          <h3>
            حالة الحجز <Bell size={20} />
          </h3>
          <Progress status={o.status} />
          <Badge status={o.status} />
          {o.status === "CUSTOMER_REVIEW" && (
            <Btn to={"/quote/" + o.id} variant="text">
              عرض السعر جاهز ومزهّب بانتظاركم
              <ArrowLeft size={16} />
            </Btn>
          )}
        </section>
        <div className="grid three dashboard-cards">
          <section className="card">
            <h3>
              التنبيهات ومواعيد السنع
              <Bell size={20} />
            </h3>
            {[
              ["مراجعة التصميم والديكور النهائي", "قبل المناسبة بأسبوعين"],
              ["موعد تجربة قائمة الأكل والبوفيه", "بالتنسيق مع المنسق الخاص"],
              ["موعد جلسة الترتيب والسنع مع المنسق", "حياكم الله وبانتظاركم"],
            ].map(([a, b]) => (
              <div className="list-row" key={a}>
                <CalendarDays size={21} />
                <div>
                  <h4>{a}</h4>
                  <p>{b}</p>
                </div>
              </div>
            ))}
            <Btn
              variant="outline"
              className="full"
              onClick={() =>
                exportFile(
                  "habb-alsaad-event.ics",
                  "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART:" +
                    o.occasion.date.replaceAll("-", "") +
                    "T160000Z\r\nSUMMARY:" +
                    o.occasion.type +
                    " — " + brand.replace(/[\r\n]/g, "") + "\r\nEND:VEVENT\r\nEND:VCALENDAR",
                  "text/calendar",
                )
              }
            >
              إضافة إلى التقويم
              <CalendarDays size={16} />
            </Btn>
          </section>
          <section className="card">
            <h3>
              تأكيدات الموردين وفريق العمل
              <Flower2 size={20} />
            </h3>
            {o.lines.slice(0, 4).map((l) => (
              <div className="list-row" key={l.id}>
                <img src={A + l.image + ".jpg"} alt="" />
                <div>
                  <h4>{l.title}</h4>
                  <Badge status={l.response} />
                </div>
              </div>
            ))}
            <Link className="text-link" to={"/bookings/" + o.id}>
              عرض الكل
              <ChevronLeft size={14} />
            </Link>
          </section>
          <section className="card">
            <h3>
              الدفعات والمبالغ
              <Wallet size={20} />
            </h3>
            <div
              className="payment-donut"
              style={{ "--progress": percent + "%" } as any}
            >
              <div>
                <small>تم دفع</small>
                <Price value={o.paid} />
                <p>
                  {percent}% من {money(total)} د.ك
                </p>
              </div>
            </div>
            <Btn variant="outline" className="full" to={"/checkout/" + o.id}>
              عرض جميع الدفعات
              <ArrowLeft size={15} />
            </Btn>
          </section>
        </div>
        <div className="grid two section">
          <section className="card">
            <h3>
              إجراءات سريعة
              <Sparkles size={21} />
            </h3>
            <div className="action-grid">
              <Btn
                variant="soft"
                onClick={() =>
                  ask(
                    "إضافة خدمة إلى حجزكم",
                    "CHANGES",
                    { id: o.id },
                    "الخدمة المطلوبة وتفاصيلها السنعة",
                  )
                }
              >
                <Plus size={17} />
                إضافة خدمة
              </Btn>
              <Btn variant="soft" to="/planner">
                <Pencil size={17} />
                مناسبة جديدة
              </Btn>
              <Btn variant="soft" to="/support">
                <Headphones size={17} />
                تواصلوا وياي
              </Btn>
              <Btn variant="soft" to="/favorites">
                <Heart size={17} />
                المفضلة
              </Btn>
            </div>
          </section>
          <section className="card">
            <h3>كل مناسباتك</h3><RecordPager data={history} />
            {history.items.map((x) => (
              <div className="list-row" key={x.id}>
                <Gift size={21} />
                <div>
                  <h4>
                    {x.occasion.type} · {x.id}
                  </h4>
                  <Badge status={x.status} />
                </div>
                <Btn
                  variant="text"
                  onClick={async () => {
                    await act("SELECT_ORDER", { id: x.id }, "");
                    go("/bookings/" + x.id);
                  }}
                >
                  تفاصيل
                  <ChevronLeft size={15} />
                </Btn>
              </div>
            ))}
          </section>
        </div>
        {o.amendment && <Amendment {...{ s, act, o }} />}
      </div>
    </>
  );
}

export {
  Logo,
  Btn,
  Link,
  Price,
  Badge,
  Field,
  Empty,
  SectionTitle,
  Hero,
  Progress,
  Summary,
  OrderEvent,
  Amendment,
  exportFile,
  go,
};
const mount = document.getElementById("root") as any;
const root = mount.__reactRoot || (mount.__reactRoot = createRoot(mount));
registerExperienceCache();
root.render(
  <ExperienceOrchestrator>
    <App />
  </ExperienceOrchestrator>,
);
