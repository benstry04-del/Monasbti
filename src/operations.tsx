import { staffAllowed } from "./auth-navigation";
import { BrandedLoader } from "./components/brand-motion/BrandedLoader";
import {BrandSettings} from "./brand-settings";
import {branding} from "./branding.mjs";
import {useRecordPage,RecordPager,downloadRecords,useServerValue} from './record-pagination';
import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Play,
  Check,
  CheckCircle2,
  ChevronLeft,
  Heart,
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
  Trash2,
  ShieldCheck,
  Clock,
  FileText,
  CreditCard,
  Bell,
  LayoutDashboard,
  House,
  Gift,
  User,
  LogOut,
  SlidersHorizontal,
  Download,
  Printer,
  Send,
  Camera,
  Coffee,
  Building2,
  Headphones,
  MessageCircle,
  Settings,
  ChartNoAxesCombined,
  ClipboardList,
  Wallet,
  Pencil,
  Eye,
  AlertCircle,
  RefreshCw,
  PackageCheck,
  Mail,
  Phone,
  LockKeyhole,
} from "lucide-react";
import {
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
} from "./main";
import { api, useStore, isDemo } from "./store";
import { Settlements } from "./settlements-ui";
import { IntegrationSettings, DeliveryHistory } from './integration-settings-ui';
import { categories, occasions, labels, money, pricing } from "./domain.mjs";
const adminNav: any[] = [
  ["", "لوحة الإدارة", LayoutDashboard],
  ["orders", "الطلبات", ClipboardList],
  ["quotes", "عروض الأسعار", FileText],
  ["approvals", "الموافقات", ShieldCheck],
  ["contracts", "العقود", FileText],
  ["suppliers", "الموردون", Users],
  ["catalog", "كتالوج الخدمات", Flower2],
  ["packages", "الباقات", Gift],
  ["payments", "الدفعات", CreditCard],
  ["settlements", "تسويات الموردين", Wallet],
  ["customers", "العملاء", User],
  ["events", "الفعاليات", CalendarDays],
  ["reports", "التقارير", ChartNoAxesCombined],
  ["users", "الفريق والصلاحيات", LockKeyhole],
  ["audit", "سجل التدقيق", Eye],
  ["settings", "الإعدادات", Settings],
  ["integrations", "الربط والتفعيل", ShieldCheck],
  ['deliveries','تسليم الإشعارات',Mail],
];
function monthlySeries(state: any, count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - count + 1 + i, 1);
    const aggregate=state.analytics?.months?.find(x=>x.month===d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
    if(state.analytics)return {revenue:aggregate?.revenue || 0,cost:aggregate?.cost || 0,profit:(aggregate?.revenue || 0)-(aggregate?.cost || 0)-(aggregate?.tax || 0),label:d.toLocaleDateString('ar-KW',{month:'short'})};
    const payments = state.payments.filter(
      (p: any) =>
        p.status === "PAID" &&
        new Date(p.at).getFullYear() === d.getFullYear() &&
        new Date(p.at).getMonth() === d.getMonth(),
    );
    const revenue = payments.reduce((n: number, p: any) => n + p.amount, 0);
    const cost = payments.reduce((n: number, p: any) => {
      const o = state.orders.find((o: any) => o.id === p.orderId);
      const total = o?.contract?.total || 0;
      const c = o ? pricing(o.lines).cost : 0;
      return n + (total && c !== null ? (p.amount * c) / total : 0);
    }, 0);
    return {
      revenue,
      cost,
      profit: revenue - cost,
      label: d.toLocaleDateString("ar-KW", { month: "short" }),
    };
  });
}
function Sparkline() {
  const s = useStore(),
    series = monthlySeries(s),
    max = Math.max(1, ...series.map((x) => x.revenue));
  return (
    <svg viewBox="0 0 240 40" className="sparkline" aria-hidden="true">
      <polyline
        points={series
          .map((x, i) => i * 48 + "," + (38 - (x.revenue / max) * 34))
          .join(" ")}
        fill="none"
        stroke="#c69a61"
        strokeWidth="1.7"
      />
    </svg>
  );
}
function Chart({ period = "6",analytics }: any) {
  const s = useStore(),
    series = monthlySeries(analytics?{...s,analytics}:s, Number(period)),
    max = Math.max(1, ...series.map((x) => Math.max(x.revenue, x.cost)));
  return (
    <div className="chart">
      <div className="chart-legend">
        <span>● الإيرادات المحصلة</span>
        <span>● التكاليف النسبية</span>
        <span>● الربح المحصل</span>
      </div>
      <svg
        viewBox="0 0 540 200"
        role="img"
        aria-label="المبالغ المحصلة حسب الشهر من قاعدة البيانات"
      >
        {["revenue", "cost", "profit"].map((key, j) => (
          <polyline
            key={key}
            points={series
              .map(
                (x, i) =>
                  20 +
                  (i * 490) / Math.max(1, series.length - 1) +
                  "," +
                  (180 - (Math.max(0, x[key]) / max) * 150),
              )
              .join(" ")}
            fill="none"
            stroke={["#6d3c43", "#b87872", "#c69a61"][j]}
            strokeWidth="2"
          />
        ))}
        {series.map((x, i) => (
          <text
            key={i}
            x={20 + (i * 490) / Math.max(1, series.length - 1)}
            y="198"
            fontSize="10"
            textAnchor="middle"
          >
            {x.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
const adminGroups = [
  ["المتابعة اليومية", ["", "orders", "events", "customers"]],
  ["العروض والتعاقد", ["quotes", "approvals", "contracts"]],
  ["الخدمات والموردون", ["suppliers", "catalog", "packages"]],
  ["المالية والتقارير", ["payments", "settlements", "reports"]],
  ["إدارة النظام", ["integrations", "deliveries", "users", "audit", "settings"]],
] as const;

function AdminNavigation({ state, page, onNavigate, onClose }: any) {
  const [query, setQuery] = useState("");
  const identity = branding(state.settings);
  const owner = state.session.role === "admin";
  const normalize = (value: string) => value.trim().replace(/[\u064b-\u065f\u0670]/g, "").replace(/[أإآ]/g, "ا");
  const term = normalize(query);
  const approvals = state.counters?.ownerApprovals ??
    state.orders.filter((order) => order.status === "NEEDS_OWNER_APPROVAL").length;
  const groups = adminGroups.map(([label, routes]) => ({
    label,
    items: routes.map(route => adminNav.find(item => item[0] === route))
      .filter(item => item && (owner || staffAllowed.includes(item[0])) &&
        (!term || normalize(label + " " + item[1]).includes(term))),
  })).filter(group => group.items.length);

  return <div className="admin-navigation">
    <div className="admin-navigation-brand">
      {identity.emblem && <img src={identity.emblem} alt="" className="admin-sidebar-logo" />}
      <div><strong>{identity.name || "إدارة المنصة"}</strong><small>{identity.latin || "مساحة العمل"}</small></div>
      {onClose && <button type="button" className="admin-nav-close" aria-label="إغلاق قائمة الإدارة" onClick={onClose}><X size={21} /></button>}
    </div>
    <div className="admin-nav-search">
      <input type="search" aria-label="ابحث في أقسام الإدارة" placeholder="ابحث في أقسام الإدارة" value={query} onChange={event => setQuery(event.target.value)} />
      {query && <button type="button" onClick={() => setQuery("")} aria-label="مسح البحث"><X size={16} /></button>}
    </div>
    <nav aria-label="أقسام الإدارة" className="admin-nav-groups">
      {groups.map(({label, items}) => <div key={label} className="admin-nav-group">
        <h2>{label}</h2>
        {items.map(([route, title, Icon]) => <Link key={route}
          to={route ? "/admin/" + route : "/admin"} onClick={onNavigate}
          className={route === page ? "active" : ""}
          aria-current={route === page ? "page" : undefined}>
          <Icon size={19} strokeWidth={1.6} />
          <span>{title}</span>
          {route === "approvals" && approvals > 0 && <i aria-label={approvals + " بانتظار موافقة المالك"}>{approvals}</i>}
        </Link>)}
      </div>)}
      {!groups.length && <p className="admin-nav-empty" role="status">لا توجد أقسام تطابق البحث.</p>}
    </nav>
    <div className="admin-nav-account">
      <strong>{state.session.name}</strong>
      <small>{owner ? "مالك المنصة" : "فريق التشغيل"}</small>
      <Link to="/" onClick={onNavigate}><House size={17} /> واجهة الموقع</Link>
    </div>
  </div>;
}

export function Admin(props: any) {
  const { s, path, act } = props;
  const page = path.split("/")[2] || "",
    id = path.split("/")[3];
  const [drawer, setDrawer] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeDrawer = () => dialog.current?.close();
  useEffect(() => { dialog.current?.close(); }, [path]);
  useEffect(() => {
    if (drawer) dialog.current?.querySelector<HTMLButtonElement>(".admin-nav-close")?.focus();
  }, [drawer]);
  useEffect(() => {
    const desktop = matchMedia("(min-width: 981px)");
    const closeOnDesktop = () => { if (desktop.matches) dialog.current?.close(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  let title = adminNav.find((n) => n[0] === page)?.[1] || "تفاصيل الطلب";
  if (s.session.role === "staff" && !staffAllowed.includes(page))
    return (
      <div className="container section">
        <Empty
          title="هذه الصلاحية مخصصة للمالك"
          text="يمكنك متابعة الطلبات والتسعير والمراجعة من لوحة التشغيل."
          to="/admin"
          cta="العودة للوحة الإدارة"
        />
      </div>
    );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar admin-workspace-sidebar">
        <AdminNavigation state={s} page={page} />
      </aside>
      <dialog id="admin-navigation-drawer" ref={dialog} className="admin-navigation-drawer"
        aria-label="قائمة الإدارة" onClose={() => setDrawer(false)}
        onClick={event => { if (event.target === event.currentTarget) closeDrawer(); }}>
        {drawer && <AdminNavigation state={s} page={page} onNavigate={closeDrawer} onClose={closeDrawer} />}
      </dialog>
      <div className="admin-content">
        <div className="admin-compact-toolbar">
          <button type="button" aria-label="فتح قائمة الإدارة" aria-expanded={drawer}
            aria-controls="admin-navigation-drawer" onClick={() => {
              dialog.current?.showModal();
              setDrawer(true);
            }}><Menu size={20} /> قائمة الإدارة</button>
          <span>{title}</span>
        </div>
        <div className="admin-page-heading">
          <div>
            <span className="eyebrow">مساحة إدارة المناسبات</span>
            <h1>{page ? title : "مرحبًا، " + s.session.name}</h1>
            <p>
              {page
                ? "كل التفاصيل التي تحتاجها لمتابعة عملك."
                : "هنا نظرة شاملة على أداء منصتك اليوم"}
            </p>
          </div>
          <div className="button-row">
            <span className="date-pill">
              <CalendarDays size={16} />
              {new Date().toLocaleDateString("ar-KW",{weekday:"long",year:"numeric",month:"long",day:"numeric",timeZone:"Asia/Kuwait"})}
            </span>

          </div>
        </div>
        {page === "" ? (
          <AdminOverview {...props} />
        ) : page === "orders" && id ? (
          <OrderEditor {...props} id={id} />
        ) : page === "orders" ||
          page === "quotes" ||
          page === "contracts" ||
          page === "approvals" ? (
          <Orders {...props} kind={page} />
        ) : page === "payments" ? (
          <Payments {...props} />
        ) : page === "integrations" ? (
          <IntegrationSettings />
        ) : page === 'deliveries' ? (
          <DeliveryHistory />
        ) : page === "settlements" ? (
          <Settlements session={s.session} />
        ) : page === "catalog" || page === "packages" ? (
          <ManageCatalog {...props} packages={page === "packages"} />
        ) : page === "suppliers" ? (
          <Suppliers {...props} />
        ) : page === "customers" ? (
          <Customers {...props} />
        ) : page === "events" ? (
          <Events {...props} />
        ) : page === "reports" ? (
          <Reports {...props} />
        ) : page === "users" ? (
          <Team {...props} />
        ) : page === "audit" ? (
          <Audit {...props} />
        ) : page === "settings" ? (
          <><BrandSettings settings={s.settings} act={act} /><SettingsPage {...props} /></>
        ) : (
          <Empty />
        )}
      </div>
    </div>
  );
}
function revenueSources(state:any){if(state.analytics){const entries=state.analytics.sources;return entries.length>5?[...entries.slice(0,4),['أخرى',entries.slice(4).reduce((n,x)=>n+Number(x[1]),0)]]:entries;}const amounts=new Map<string,number>();for(const pay of state.payments.filter(p=>['PAID','REFUND_PENDING'].includes(p.status))){const order=state.orders.find(o=>o.id===pay.orderId);if(!order)continue;const lines=order.contract?.snapshot||order.lines,total=pricing(lines).subtotal;if(!total)continue;for(const line of lines){const category=line.category||'أخرى';amounts.set(category,(amounts.get(category)||0)+Math.max(0,pay.amount-(pay.refunded||0))*line.price*line.qty/total);}}const entries=[...amounts].sort((a,b)=>b[1]-a[1]);return entries.length>5?[...entries.slice(0,4),['أخرى',entries.slice(4).reduce((sum,x)=>sum+x[1],0)]]:entries;}
function AdminOverview(props: any) {
  const { s } = props;
  const sources=revenueSources(s),sourceTotal=sources.reduce((sum,x)=>sum+Number(x[1]),0),palette=['#6d3c43','#b87872','#e1b6a1','#d9b580','#c3adbd'];let previous=0;const segments=sources.map((x,i)=>{const start=previous;previous+=Number(x[1])/Math.max(1,sourceTotal)*100;return palette[i]+' '+start+'% '+previous+'%';});
  const [period, setPeriod] = useState("6");
  const revenue = s.analytics?.revenue ?? s.payments
      .filter((p) => p.status === "PAID")
      .reduce((n, p) => n + p.amount - (p.refunded || 0), 0),
    profit = s.analytics?.profit ?? s.orders.reduce(
      (n, o) => n + (pricing(o.lines, o.discount).profit || 0),
      0,
    );
  return (
    <>
      <div className="kpi-grid">
        {[
          [
            "الطلبات الجديدة",
            s.analytics?.newOrders ?? s.orders.filter((o) =>
              [
                "REQUESTED",
                "INTERNAL_REVIEW",
                "SUPPLIER_CONFIRMATION",
              ].includes(o.status),
            ).length,
            Users,
            "orders",
          ],
          [
            "العقود بانتظار الاعتماد",
            s.analytics?.pendingContracts ?? s.orders.filter((o) =>
              [
                "CONTRACT_PENDING",
                "NEEDS_OWNER_APPROVAL",
                "CONTRACT_APPROVED",
              ].includes(o.status),
            ).length,
            FileText,
            "approvals",
          ],
          ["إجمالي الإيرادات", money(revenue) + " د.ك", Wallet, "payments"],
          [
            "الربحية المتوقعة",
            money(profit) + " د.ك",
            ChartNoAxesCombined,
            "reports",
          ],
        ].map(([t, n, Icon, route]: any) => (
          <Link to={"/admin/" + route} className="kpi card" key={t}>
            <div>
              <span>{t}</span>
              <span className="kpi-icon">
                <Icon size={23} strokeWidth={1.2} />
              </span>
            </div>
            <strong>{n}</strong>
            <small className="success">
              من السجلات الفعلية للفترة المعروضة
            </small>
            <Sparkline />
            <span className="kpi-link">
              عرض التفاصيل
              <ChevronLeft size={14} />
            </span>
          </Link>
        ))}
      </div>
      <div className="admin-chart-grid">
        <section className="card">
          <div className="section-title">
            <h3>الربحية</h3>
            <select
              aria-label="الفترة الزمنية"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="6">آخر 6 أشهر</option>
              <option value="3">آخر 3 أشهر</option>
            </select>
          </div>
          <Chart period={period} />
        </section>
        <section className="card">
          <h3>مصادر الإيرادات</h3>
          <div className="revenue-chart">
            <div className="revenue-donut" style={{background:sources.length?"conic-gradient("+segments.join(",")+")":"#ead8c6"}}>
              <div>
                <small>إجمالي الإيرادات</small>
                <b>{money(revenue)}</b>
                <small>د.ك</small>
              </div>
            </div>
            <div>
              {sources.map(([a, amount],i)=>[a,(Number(amount)/Math.max(1,sourceTotal)*100).toFixed(1)+"%"] ).map(([a, b], i) => (
                <p key={a}>
                  <i
                    style={{
                      background: [
                        "#6d3c43",
                        "#b87872",
                        "#e1b6a1",
                        "#d9b580",
                        "#c3adbd",
                      ][i],
                    }}
                  />
                  {a}
                  <b>{b}</b>
                </p>
              ))}
            </div>
          </div>
        </section>
        <section className="card">
          <h3>الدفعات</h3>
          {[
            ["المحصّلة", revenue, "PAID"],
            [
              "قيد المعالجة",
              s.analytics?.pendingPayments ?? s.payments
                .filter((p) => p.status === "PENDING")
                .reduce((n, p) => n + p.amount, 0),
              "PENDING",
            ],
            [
              "المتبقي على العقود",
              s.analytics?.outstanding ?? s.orders.reduce(
                (n, o) =>
                  n + Math.max(0, pricing(o.lines, o.discount).total - o.paid),
                0,
              ),
              "PENDING",
            ],
          ].map(([a, n, status]) => (
            <div className="payment-metric" key={a}>
              <small>{a}</small>
              <Price value={n} />
              <div className="mini-bar">
                <span
                  style={{
                    width:
                      (Number(n) /
                        Math.max(
                          1,
                          s.analytics?.contractTotal ?? s.orders.reduce(
                            (sum, o) => sum + (o.contract?.total || 0),
                            0,
                          ),
                        )) *
                        100 +
                      "%",
                  }}
                />
              </div>
            </div>
          ))}
          <Link className="text-link" to="/admin/payments">
            عرض جميع الدفعات
            <ChevronLeft size={15} />
          </Link>
        </section>
      </div>
      <div className="grid two section">
        <section className="card">
          <SectionTitle
            title="الطلبات الجديدة"
            to="/admin/orders"
            action="عرض الكل"
          />
          <OrderTable orders={s.orders.slice(0, 5)} />
        </section>
        <section className="card">
          <SectionTitle
            title="العقود بانتظار المراجعة"
            to="/admin/contracts"
            action="عرض الكل"
          />
          <OrderTable orders={s.orders.filter((o) => o.contract).slice(0, 5)} />
        </section>
      </div>
      <div className="grid three">
        <section className="card">
          <h3>التقويم</h3>
          <CalendarMini s={s} />
        </section>
        <section className="card">
          <SectionTitle
            title="الفعاليات القادمة"
            action="عرض الكل"
            to="/admin/events"
          />
          {s.orders.slice(0, 3).map((o) => (
            <Link to={"/admin/orders/" + o.id} className="list-row" key={o.id}>
              <img src={"/assets/" + o.lines[0].image + ".jpg"} alt="" />
              <div>
                <h4>
                  {o.occasion.type} · {o.customer}
                </h4>
                <p>
                  {o.occasion.date} · {o.occasion.location}
                </p>
              </div>
              <Badge status={o.status} />
            </Link>
          ))}
        </section>
        <section className="card">
          <SectionTitle
            title="الموردون"
            action="عرض الكل"
            to="/admin/suppliers"
          />
          {s.suppliers.slice(0, 4).map((v) => (
            <div className="list-row" key={v.id}>
              <Flower2 size={20} />
              <div>
                <h4>{v.name}</h4>
                <p>{v.category}</p>
              </div>
              <span className="stars">★ {v.rating}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
function OrderTable({ orders }: any) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>العميل</th>
            <th>المناسبة</th>
            <th>التاريخ</th>
            <th>القيمة</th>
            <th>الحالة</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <Link to={"/admin/orders/" + o.id}>{o.id}</Link>
              </td>
              <td>{o.customer}</td>
              <td>{o.occasion.type}</td>
              <td dir="ltr">{o.occasion.date}</td>
              <td>{money(pricing(o.lines, o.discount).total)}</td>
              <td>
                <Badge status={o.status} />
              </td>
              <td>
                <Link
                  className="icon-btn"
                  to={"/admin/orders/" + o.id}
                  aria-label={"تفاصيل " + o.id}
                >
                  <ChevronLeft size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!orders.length && <Empty title="لا توجد طلبات مطابقة" to={null} />}
    </div>
  );
}
function Orders({ s, kind }: any) {
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [occasion, setOccasion] = useState(""),
    [area, setArea] = useState(""),
    [date, setDate] = useState(""),
    [max, setMax] = useState("");
  let list = s.orders.filter(
    (o) =>
      (kind !== "contracts" || o.contract) &&
      (kind !== "approvals" ||
        [
          "NEEDS_OWNER_APPROVAL",
          "CONTRACT_PENDING",
          "QUOTE_READY",
          "SUPPLIER_UNAVAILABLE",
        ].includes(o.status)) &&
      (!q || o.customer.includes(q) || o.id.includes(q)) &&
      (!status || o.status === status) &&
      (!occasion || o.occasion.type === occasion) &&
      (!area || o.occasion.location === area) &&
      (!date || o.occasion.date === date) &&
      (!max || pricing(o.lines, o.discount).total <= Number(max)),
  );
  const recordParams={q,status,occasion,area,date,max,kind};
  const records=useRecordPage("bookings",recordParams,list,s.runtime?.refreshedAt);
  list=records.items;
  return (
    <>
      <RecordPager data={records} />
      <section className="card filter-grid">
        <Field label="بحث عن طلب / عميل">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="الاسم أو رقم الطلب"
          />
        </Field>
        <Field label="الحالة">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">جميع الحالات</option>
            {Object.entries(labels)
              .slice(0, 27)
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
        </Field>
        <Field label="نوع المناسبة">
          <select
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
          >
            <option value="">كل المناسبات</option>
            {occasions.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="المنطقة">
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">كل المناطق</option>
            {["حولي", "العاصمة", "السالمية"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="التاريخ">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="القيمة حتى (د.ك)">
          <input
            type="number"
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </Field>
      </section>
      <div className="section-title section">
        <h2>{records.total} طلب</h2>
        <Btn
          variant="outline"
          onClick={() =>
            !isDemo?downloadRecords('bookings',recordParams):exportFile(
              "orders.csv",
              "رقم الطلب,العميل,التاريخ,الإجمالي,الحالة\n" +
                list
                  .map((o) =>
                    [
                      o.id,
                      o.customer,
                      o.occasion.date,
                      pricing(o.lines, o.discount).total,
                      labels[o.status],
                    ].join(","),
                  )
                  .join("\n"),
              "text/csv",
            )
          }
        >
          <Download size={16} />
          تصدير CSV
        </Btn>
      </div>
      <section className="card">
        <OrderTable orders={list} />
      </section>
    </>
  );
}
function OrderEditor({ s, act, ask, id, setModal }: any) {
  const o = s.orders.find((o) => o.id === id),
    [local, setLocal] = useState<any>(null),
    [discount, setDiscount] = useState<any>(null),
    [note, setNote] = useState("");
  if (!o) return <Empty title="الطلب غير موجود" to="/admin/orders" />;
  const lines = local || o.lines,
    d = discount === null ? o.discount : discount,
    t = pricing(lines, Number(d));
  const isSigned = o.contract?.status === "SIGNED";
  const updateLine = (i: number, key: string, value: any) => {
    const next = structuredClone(lines);
    next[i][key] = value;
    setLocal(next);
  };
  return (
    <>
      <div className="order-toolbar">
        <div>
          <h2>
            {o.id} — {o.customer}
          </h2>
          <Badge status={o.status} />
        </div>
        <div className="button-row">
          <Btn
            variant="outline"
            onClick={() => act("REVIEW", { id }, "بدأت مراجعة الموردين")}
          >
            مراجعة الطلب
          </Btn>
          <Btn
            variant="outline"
            onClick={() => act("RENEW", { id }, "تم تجديد العرض")}
          >
            تجديد العرض
          </Btn>
        </div>
      </div>
      <section className="card">
        <div className="event-inline">
          <OrderEvent o={o} />
        </div>
        <Progress status={o.status} />
      </section>
      <div className="section-title section">
        <h2>التسعير وتأكيدات الموردين</h2>
        <span className="pill">الإصدار {o.version}</span>
      </div>
      <section className="card pricing-editor">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>الخدمة / المورد</th>
                <th>التكلفة د.ك</th>
                <th>سعر البيع د.ك</th>
                <th>الكمية</th>
                <th>Markup</th>
                <th>التوفر</th>
                <th>البديل</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id}>
                  <td>
                    <b>{l.title}</b>
                    <small>
                      {s.suppliers.find((v) => v.id === l.supplierId)?.name}
                    </small>
                  </td>
                  <td>
                    <input
                      aria-label={"تكلفة " + l.title}
                      type="number"
                      min={0}
                      disabled={isSigned}
                      value={l.cost ?? ""}
                      placeholder="غير مؤكدة"
                      onChange={(e) =>
                        updateLine(
                          i,
                          "cost",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={"سعر بيع " + l.title}
                      type="number"
                      min={1}
                      disabled={isSigned}
                      value={l.price}
                      onChange={(e) =>
                        updateLine(i, "price", Number(e.target.value))
                      }
                    />
                  </td>
                  <td>{l.qty}</td>
                  <td>
                    {l.cost
                      ? (((l.price - l.cost) / l.cost) * 100).toFixed(1) + "%"
                      : "—"}
                  </td>
                  <td>
                    <Badge status={l.response} />
                  </td>
                  <td>
                    {l.response === "REJECTED" ? (
                      <>
                        <p>{l.alternative}</p>
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            await act("ALTERNATIVE", {
                              id,
                              lineId: l.id,
                              serviceId: f.get("serviceId"),
                              reason: f.get("reason"),
                            });
                          }}
                        >
                          <Field label="الخدمة والمورد البديل">
                            <select name="serviceId" required>
                              {s.services
                                .filter((x) => x.id !== l.id)
                                .map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.title} ·{" "}
                                    {
                                      s.suppliers.find(
                                        (v) => v.id === x.supplierId,
                                      )?.name
                                    }
                                  </option>
                                ))}
                            </select>
                          </Field>
                          <Field label="سبب البديل">
                            <input name="reason" required />
                          </Field>
                          <Btn type="submit" disabled={isSigned}>
                            طلب تأكيد البديل
                          </Btn>
                        </form>
                      </>
                    ) : l.response !== "CONFIRMED_SUPPLIER" ? (
                      <Btn
                        variant="text"
                        disabled={isSigned}
                        onClick={() =>
                          ask(
                            "تسجيل تأكيد المورد يدويًا",
                            "SUPPLIER_RESPONSE",
                            {
                              id,
                              lineId: l.id,
                              response: "CONFIRMED_SUPPLIER",
                              cost: l.cost,
                            },
                            "سبب التأكيد اليدوي",
                          )
                        }
                      >
                        تسجيل تأكيد
                      </Btn>
                    ) : (
                      <CheckCircle2 size={20} className="success" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pricing-footer">
          <Field label="الخصم (د.ك)">
            <input
              disabled={isSigned}
              type="number"
              min={0}
              max={t.subtotal}
              value={d}
              onChange={(e) => setDiscount(Number(e.target.value))}
            />
          </Field>
          <div>
            <small>إجمالي التكاليف</small>
            <Price value={t.cost} />
            {t.cost === null && <Badge status="PENDING">تكلفة غير مؤكدة</Badge>}
          </div>
          <div>
            <small>الربح المتوقع</small>
            <Price value={t.profit} />
          </div>
          <div>
            <small>هامش الربح</small>
            <strong
              className={t.margin < s.settings.threshold ? "danger" : "success"}
            >
              {t.margin === null ? "غير معروف" : t.margin.toFixed(1) + "%"}
            </strong>
          </div>
          <div>
            <small>إجمالي البيع</small>
            <Price value={t.total} />
          </div>
          <Btn
            disabled={
              isSigned ||
              !lines.every((l) => l.price > 0) ||
              d < 0 ||
              d > t.subtotal
            }
            onClick={async () => {
              if (await act("PRICE", { id, lines, discount: Number(d) })) {
                setLocal(null);
                setDiscount(null);
              }
            }}
          >
            حفظ التسعير
          </Btn>
        </div>
        {t.margin !== null && t.margin < s.settings.threshold && (
          <div className="warning">
            <AlertCircle />
            الهامش أقل من {s.settings.threshold}% — يتطلب اعتماد المالك قبل
            إرسال العرض.
          </div>
        )}
        {isSigned && (
          <div className="info">
            <LockKeyhole size={20} />
            العقد موقّع. التعديل متاح عبر ملحق مستقل فقط.
          </div>
        )}
      </section>
      <div className="grid two section">
        <section className="card">
          <h3>
            سلسلة المراجعة والاعتماد
            <ShieldCheck size={22} />
          </h3>
          <p>
            مراجعة الموظف ثم اعتماد المالك. لا يعتمد نفس المستخدم المرحلتين.
          </p>
          {o.approvals.map((a, i) => (
            <div className="list-row" key={i}>
              <CheckCircle2 className="success" size={20} />
              <div>
                <h4>
                  {a.role === "staff" ? "مراجعة الموظف" : "اعتماد المالك"}
                </h4>
                <p>
                  {a.reason} · {new Date(a.at).toLocaleString("ar-KW")}
                </p>
              </div>
            </div>
          ))}
          <div className="button-row">
            <Btn
              variant="outline"
              disabled={isSigned}
              onClick={() =>
                ask(
                  "اعتماد المراجعة الداخلية",
                  "APPROVE_INTERNAL",
                  { id },
                  "سبب الاعتماد",
                )
              }
            >
              اعتماد {s.session.role === "admin" ? "المالك" : "الموظف"}
            </Btn>
            <Btn
              disabled={isSigned}
              onClick={() =>
                act("PUBLISH", { id }, "تم إرسال العرض المعتمد للعميل")
              }
            >
              إرسال عرض السعر
              <Send size={16} />
            </Btn>
            <Btn
              variant="text"
              disabled={isSigned}
              onClick={() =>
                ask(
                  "إعادة للمراجعة",
                  "NOTE",
                  { id },
                  "سبب الرفض أو طلب التعديل",
                )
              }
            >
              طلب مراجعة
            </Btn>
          </div>
          {o.status === "DISPUTED" && (
            <Btn
              variant="outline"
              onClick={() =>
                ask(
                  "اعتماد إلغاء الحجز",
                  "CANCEL_APPROVE",
                  { id },
                  "سبب الاعتماد وسياسة الاسترداد",
                )
              }
            >
              اعتماد الإلغاء
            </Btn>
          )}
        </section>
        <section className="card">
          <h3>
            ملاحظات داخلية
            <MessageCircle size={21} />
          </h3>
          {o.notes.map((n, i) => (
            <div className="note" key={i}>
              <p>{n.text}</p>
              <small>
                {n.actor} · {new Date(n.at).toLocaleDateString("ar-KW")}
              </small>
            </div>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act("NOTE", { id, text: note })) setNote("");
            }}
          >
            <Field label="أضف ملاحظة للفريق">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                rows={2}
              />
            </Field>
            <Btn type="submit" variant="outline">
              حفظ الملاحظة
            </Btn>
          </form>
        </section>
      </div>
      {o.amendment && <Amendment {...{ s, act, o }} />}
      <section className="card">
        <h3>الأنشطة الأخيرة</h3>
        {s.audit
          .filter((a) => a.entity === id)
          .slice(0, 8)
          .map((a) => (
            <div className="audit-row" key={a.id}>
              <span>{a.action}</span>
              <b>{a.actor}</b>
              <span>{a.reason}</span>
              <small>{new Date(a.at).toLocaleString("ar-KW")}</small>
            </div>
          ))}
      </section>
    </>
  );
}
function Payments({ s, act, setModal }: any) {
  const [filter, setFilter] = useState("all"),
    [q, setQ] = useState("");
  let list = s.payments.filter(
    (p) =>
      (filter === "all" || p.status === filter) &&
      (!q || p.id.includes(q) || p.orderId.includes(q)),
  );
  const recordParams={q,status:filter==='all'?'':filter};
  const records=useRecordPage("payments",recordParams,list,s.runtime?.refreshedAt);
  list=records.items;
  return (
    <>
      <RecordPager data={records} />
      <div className="kpi-grid">
        {[
          ["المحصلة", "PAID"],
          ["المعلقة", "PENDING"],
          ["المستردة", "REFUNDED"],
        ].map(([t, status]) => (
          <div className="card kpi" key={t}>
            <span>{t}</span>
            <Price
              value={!isDemo?(records.summary?.[status] || 0):s.payments
                .filter((p) =>
                  status === "REFUNDED"
                    ? (p.refunded || 0) > 0
                    : p.status === status,
                )
                .reduce(
                  (n, p) =>
                    n +
                    (status === "REFUNDED"
                      ? p.refunded || 0
                      : p.amount - (p.refunded || 0)),
                  0,
                )}
            />
          </div>
        ))}
      </div>
      <div className="toolbar">
        <input
          aria-label="بحث عملية دفع"
          placeholder="رقم العملية أو الطلب"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="حالة الدفع"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">جميع العمليات</option>
          <option value="PAID">مدفوعة</option>
          <option value="PENDING">معلقة</option>
          <option value="FAILED">فاشلة</option>
          <option value="REFUNDED">مستردة</option>
        </select>
        <Btn
          variant="outline"
          onClick={() =>
            !isDemo?downloadRecords('payments',recordParams):exportFile(
              "payments.csv",
              "العملية,الطلب,المبلغ,الحالة\n" +
                list
                  .map((p) => [p.id, p.orderId, p.amount, p.status].join(","))
                  .join("\n"),
              "text/csv",
            )
          }
        >
          تصدير
          <Download size={16} />
        </Btn>
      </div>
      <section className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>العملية</th>
                <th>الطلب</th>
                <th>الطريقة</th>
                <th>المبلغ</th>
                <th>الحالة</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.id}
                    <small>{new Date(p.at).toLocaleString("ar-KW")}</small>
                  </td>
                  <td>
                    <Link to={"/admin/orders/" + p.orderId}>{p.orderId}</Link>
                  </td>
                  <td>{p.method}</td>
                  <td>
                    <Price value={p.amount} />
                    {p.refunded > 0 && (
                      <small>المسترد: {money(p.refunded)}</small>
                    )}
                  </td>
                  <td>
                    <Badge status={p.status} />
                    {p.refundStatus && <Badge status={p.refundStatus} />}
                  </td>
                  <td>
                    <div className="button-row">
                      {p.status === "PENDING" && (
                        <Btn
                          variant="outline"
                          onClick={() =>
                            act(
                              isDemo ? "WEBHOOK" : "PAYMENT_REFRESH",
                              { paymentId: p.id },
                              isDemo
                                ? "تمت تسوية العملية"
                                : "طُلب التحقق من مزود الدفع؛ ستتحدث النتيجة بعد التأكيد",
                            )
                          }
                        >
                          {isDemo ? "تسوية يدوية" : "التحقق من المزود"}
                        </Btn>
                      )}
                      {p.status === "PAID" &&
                        s.session.role === "admin" &&
                        p.refundStatus !== "REFUND_PENDING" && (
                          <Btn
                            variant="outline"
                            onClick={() =>
                              setModal({
                                title: "استرداد دفعة",
                                body: (
                                  <form
                                    onSubmit={async (e) => {
                                      e.preventDefault();
                                      let f = new FormData(e.currentTarget);
                                      if (
                                        await act("REFUND", {
                                          paymentId: p.id,
                                          amount: Number(f.get("amount")),
                                          reason: f.get("reason"),
                                        })
                                      )
                                        setModal(null);
                                    }}
                                  >
                                    <p>
                                      المتاح للاسترداد{" "}
                                      {money(p.amount - (p.refunded || 0))} د.ك
                                    </p>
                                    <Field label="المبلغ">
                                      <input
                                        type="number"
                                        name="amount"
                                        min="0.001"
                                        step="0.001"
                                        max={p.amount - (p.refunded || 0)}
                                        required
                                      />
                                    </Field>
                                    <Field label="سبب الاسترداد">
                                      <textarea name="reason" required />
                                    </Field>
                                    <Btn type="submit">إرسال طلب الاسترداد</Btn>
                                  </form>
                                ),
                              })
                            }
                          >
                            استرداد
                          </Btn>
                        )}
                      {p.refundStatus === "REFUND_PENDING" &&
                        s.session.role === "admin" && (
                          <Btn
                            onClick={() =>
                              act(
                                isDemo ? "REFUND_SETTLE" : "REFUND_REFRESH",
                                { paymentId: p.id },
                                isDemo
                                  ? "تم الاسترداد وإصدار إشعار دائن"
                                  : "تم تحديث حالة الاسترداد المسجلة",
                              )
                            }
                          >
                            {isDemo
                              ? "تأكيد الاسترداد"
                              : "تحديث حالة الاسترداد"}
                          </Btn>
                        )}
                      <button
                        className="icon-btn"
                        aria-label="تفاصيل العملية"
                        onClick={() =>
                          setModal({
                            title: "تفاصيل العملية " + p.id,
                            body: (
                              <div>
                                <div className="receipt-lines">
                                  {Object.entries({
                                    المبلغ: money(p.amount) + " د.ك",
                                    الحالة: labels[p.status],
                                    الإيصال: p.receipt,
                                    الطريقة: p.method,
                                    التاريخ: p.at,
                                  }).map(([k, v]) => (
                                    <p key={k}>
                                      {k}
                                      <b>{v as any}</b>
                                    </p>
                                  ))}
                                </div>
                                <Btn
                                  onClick={() =>
                                    exportFile(p.receipt + ".json", p)
                                  }
                                >
                                  تنزيل الإيصال
                                  <Download size={16} />
                                </Btn>
                              </div>
                            ),
                          })
                        }
                      >
                        <Eye size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function ManageCatalog({ s, act, setModal, packages }: any) {
  const records=useRecordPage(packages?'packages':'services',{},packages?s.packages:s.services,s.runtime?.refreshedAt);
  const list=records.items;
  function edit(item: any = {}) {
    setModal({
      title: (item.id ? "تعديل " : "إضافة ") + (packages ? "باقة" : "خدمة"),
      body: (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f: any = Object.fromEntries(new FormData(e.currentTarget));
            f.price = Number(f.price);
            f.cost = f.cost ? Number(f.cost) : null;
            f.capacity = Number(f.capacity || 100);
            f.available = f.available === "on";
            f.serviceIds = packages
              ? new FormData(e.currentTarget).getAll("inclusions")
              : undefined;
            delete f.inclusions;
            if (
              await act(packages ? "PACKAGE_SAVE" : "CATALOG_SAVE", {
                ...item,
                ...f,
              })
            )
              setModal(null);
          }}
        >
          <Field label="الاسم">
            <input name="title" defaultValue={item.title} required />
          </Field>
          <div className="grid two">
            <Field label="السعر">
              <input
                type="number"
                min={1}
                name="price"
                defaultValue={item.price}
                required
              />
            </Field>
            <Field label={packages ? "السعة" : "تكلفة المورد"}>
              <input
                name={packages ? "capacity" : "cost"}
                type="number"
                min={0}
                defaultValue={packages ? item.capacity : item.cost}
              />
            </Field>
          </div>
          <Field label="الفئة">
            <select name="category" defaultValue={item.category}>
              {(s.categories || categories).slice(1).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          {!packages && (
            <Field label="سياسة التوفر">
              <select
                name="availabilityPolicy"
                defaultValue={item.availabilityPolicy || "supplier"}
              >
                <option value="supplier">تأكيد المورد قبل الاعتماد</option>
                <option value="advance">حجز مسبق بسبعة أيام</option>
                <option value="limited">مواعيد محدودة حسب الموسم</option>
              </select>
            </Field>
          )}
          <Field label="الصورة">
            <select name="image" defaultValue={item.image || "flowers"}>
              {[
                "wedding",
                "flowers",
                "table",
                "cake",
                "coffee",
                "camera",
                "food",
                "hall",
                "car",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          {packages ? (
            <Field
              label="الخدمات المشمولة"
              hint="اختاري الخدمات من القائمة. يمكن تحديد أكثر من خدمة."
            >
              <select
                multiple
                required
                size={6}
                name="inclusions"
                defaultValue={item.serviceIds || ["s1", "s4", "s8"]}
              >
                {s.services.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <>
      <RecordPager data={records} />
              <Field label="المورد">
                <select name="supplierId" defaultValue={item.supplierId}>
                  {s.suppliers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="الفئة المستهدفة">
                <select name="audience" defaultValue={item.audience}>
                  {["نسائية", "مشتركة", "رجالية"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <label className="check-label">
                <input
                  type="checkbox"
                  name="available"
                  defaultChecked={item.available ?? true}
                />
                متاحة الآن
              </label>
            </>
          )}
          <Field label="الوصف">
            <textarea
              name="description"
              defaultValue={item.description}
              rows={2}
            />
          </Field>
          <Btn type="submit">
            حفظ ونشر في الكتالوج
            <Check size={16} />
          </Btn>
        </form>
      ),
    });
  }
  return (
    <>
      <div className="section-title">
        <h2>
          {list.length} {packages ? "باقة" : "خدمة"}
        </h2>
        <div className="button-row">
          {!packages && (
            <Btn
              variant="outline"
              onClick={() =>
                setModal({
                  title: "إدارة فئات الخدمات",
                  body: <CategoryManager act={act} />,
                })
              }
            >
              إدارة الفئات
              <Flower2 size={16} />
            </Btn>
          )}
          <Btn onClick={() => edit()}>
            <Plus size={17} />
            إضافة {packages ? "باقة" : "خدمة"}
          </Btn>
        </div>
      </div>
      <div className="manage-grid">
        {list.map((x) => (
          <article className="card manage-card" key={x.id}>
            <img src={"/assets/" + x.image + ".jpg"} alt={x.title} />
            <div>
              <h3>{x.title}</h3>
              <p>{x.category || "باقة متكاملة"}</p>
              <Price value={x.price} />
              <div className="button-row">
                <Btn variant="outline" onClick={() => edit(x)}>
                  تعديل
                  <Pencil size={14} />
                </Btn>
                <button
                  className="icon-btn danger"
                  aria-label={"حذف " + x.title}
                  onClick={() =>
                    setModal({
                      title: "حذف " + x.title,
                      body: (
                        <>
                          <p>
                            ستختفي من الكتالوج. الطلبات والعقود السابقة تحتفظ
                            بنسخها.
                          </p>
                          <Btn
                            onClick={async () => {
                              if (
                                await act(
                                  packages
                                    ? "PACKAGE_DELETE"
                                    : "CATALOG_DELETE",
                                  { id: x.id },
                                )
                              )
                                setModal(null);
                            }}
                          >
                            تأكيد الحذف
                            <Trash2 size={16} />
                          </Btn>
                        </>
                      ),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
function CategoryManager({ act }: any) {
  const s = useStore(),
    [name, setName] = useState(""),
    [oldName, setOldName] = useState("");
  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act("CATEGORY_SAVE", { name, oldName })) {
            setName("");
            setOldName("");
          }
        }}
      >
        <Field label={oldName ? "تعديل اسم الفئة" : "فئة جديدة"}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>
        <Btn type="submit">
          حفظ الفئة
          <Check size={16} />
        </Btn>
      </form>
      {(s.categories || categories).slice(1).map((c) => (
        <div className="list-row" key={c}>
          <span>{c}</span>
          <span className="muted">
            {s.services.filter((x) => x.category === c).length} خدمة
          </span>
          <button
            className="icon-btn"
            aria-label={"تعديل فئة " + c}
            onClick={() => {
              setOldName(c);
              setName(c);
            }}
          >
            <Pencil size={15} />
          </button>
          <button
            className="icon-btn danger"
            aria-label={"حذف فئة " + c}
            onClick={() => act("CATEGORY_DELETE", { name: c })}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </>
  );
}
function Suppliers({ s, act, setModal }: any) {
  const [q, setQ] = useState("");
  const records=useRecordPage('suppliers',{q},s.suppliers.filter(v=>v.name.includes(q)),s.runtime?.refreshedAt);
  function edit(v: any = {}) {
    setModal({
      title: "بيانات المورد",
      body: (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = Object.fromEntries(new FormData(e.currentTarget));
            if (await act("SUPPLIER_SAVE", { ...v, ...f, active: true }))
              setModal(null);
          }}
        >
          <Field label="اسم المورد">
            <input name="name" required defaultValue={v.name} />
          </Field>
          <Field label="مرجع مستفيد جهة التحويل"><input name="payoutRecipientId" defaultValue={v.payoutRecipientId || ""} maxLength={160} /><small>مرجع المستفيد المعتمد لدى جهة التحويل؛ لا تُدخل بيانات بطاقة.</small></Field>
          <Field label="المنطقة">
            <input
              name="area"
              required
              defaultValue={v.area || "جميع مناطق الكويت"}
            />
          </Field>
          <Field label="الفئة">
            <select name="category" defaultValue={v.category}>
              {categories.slice(1).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Btn type="submit">حفظ المورد</Btn>
        </form>
      ),
    });
  }
  return (
    <>
      <RecordPager data={records} />
      <div className="toolbar">
        <input
          aria-label="بحث الموردين"
          placeholder="ابحث عن مورد"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {s.session.role === "admin" && (
          <Btn onClick={() => edit()}>
            إضافة مورد
            <Plus size={16} />
          </Btn>
        )}
      </div>
      <div className="grid two">
        {records.items
          .map((v) => (
            <article className="card supplier-card" key={v.id}>
              <div className="section-title">
                <span className="supplier-symbol">
                  <Flower2 size={32} strokeWidth={1} />
                </span>
                <Badge status={v.active ? "CONFIRMED" : "CANCELLED"}>
                  {v.active ? "نشط" : "موقوف"}
                </Badge>
              </div>
              <h2>{v.name}</h2>
              <p>
                {v.category} · {v.area}
              </p>
              <div className="supplier-metrics">
                <div>
                  <b>★ {v.rating}</b>
                  <small>التقييم</small>
                </div>
                <div>
                  <b>{v.response}%</b>
                  <small>سرعة الاستجابة</small>
                </div>
                <div>
                  <b>{v.reliability}%</b>
                  <small>نسبة الطلبات المكتملة</small>
                </div>
              </div>
              <div className="list-row">
                <span>طلبات مفتوحة</span>
                <b>
                  {
                    !isDemo?v.openOrderCount:s.orders.filter((o) =>
                      o.lines.some(
                        (l) =>
                          l.supplierId === v.id && l.response === "WAITING",
                      ),
                    ).length
                  }
                </b>
                <span>التعرض المالي</span>
                <Price
                  value={!isDemo?v.costExposure:s.orders
                    .flatMap((o) => o.lines)
                    .filter((l) => l.supplierId === v.id)
                    .reduce((n, l) => n + (l.cost || 0) * l.qty, 0)}
                />
              </div>
              <details>
                <summary>قائمة الأسعار والخدمات</summary>
                {s.services
                  .filter((x) => x.supplierId === v.id)
                  .map((x) => (
                    <div className="list-row" key={x.id}>
                      <span>{x.title}</span>
                      <Price value={x.cost} />
                    </div>
                  ))}
              </details>
              {s.session.role === "admin" && (
                <div className="button-row">
                  <Btn variant="outline" onClick={() => edit(v)}>
                    تعديل
                    <Pencil size={14} />
                  </Btn>
                  <Btn
                    variant="text"
                    onClick={() =>
                      act("SUPPLIER_SAVE", { id: v.id, active: !v.active })
                    }
                  >
                    {v.active ? "إيقاف المورد" : "تفعيل المورد"}
                  </Btn>
                </div>
              )}
            </article>
          ))}
      </div>
    </>
  );
}
function Customers({ s, act, setModal }: any) {
  const [q, setQ] = useState("");
  const people = [...new Set(s.orders.map((o) => o.customer))] as string[];
  const records=useRecordPage('customers',{q},people.filter(n=>n.includes(q)).map(n=>({id:n,name:n})),s.runtime?.refreshedAt);
  const tickets=useRecordPage('tickets',{},s.tickets,s.runtime?.refreshedAt);
  return (
    <>
      <RecordPager data={records} />
      <input
        className="search-field"
        aria-label="بحث العملاء"
        placeholder="ابحث باسم العميل"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="grid two section">
        {records.items.map((person) => {
            const n=person.name;
            const own=isDemo?s.orders.filter(o=>o.customer===n):person.recentBookings;
            return (
              <section className="card" key={person.id}>
                <div className="section-title">
                  <h2>{n}</h2>
                  <span className="avatar">{n[0]}</span>
                </div>
                <p>
                  {isDemo?own.length:person.bookingCount} مناسبات · إنفاق{" "}
                  <Price value={isDemo?own.reduce((a,o)=>a+o.paid,0):person.paidTotal} />
                </p>
                <div className="info">
                  <ShieldCheck size={18} />
                  تُعرض البيانات حسب صلاحيات حسابك لحماية الخصوصية.
                </div>
                {own.map((o) => (
                  <Link
                    className="list-row"
                    to={"/admin/orders/" + o.id}
                    key={o.id}
                  >
                    <span>
                      {o.id} · {o.occasion.type}
                    </span>
                    <Badge status={o.status} />
                    <ChevronLeft size={15} />
                  </Link>
                ))}
                <Btn
                  variant="outline"
                  disabled={!own.length}
                  onClick={() =>
                    setModal({
                      title: "ملاحظات العميل — " + n,
                      body: (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (
                              await act("NOTE", {
                                id: own[0].id,
                                text: new FormData(e.currentTarget).get("note"),
                              })
                            )
                              setModal(null);
                          }}
                        >
                          <p>هذه الملاحظة مرئية لفريق التشغيل المخوّل فقط.</p>
                          <Field label="الملاحظة">
                            <textarea name="note" required />
                          </Field>
                          <Btn type="submit">حفظ الملاحظة</Btn>
                        </form>
                      ),
                    })
                  }
                >
                  إضافة ملاحظة
                  <Pencil size={14} />
                </Btn>
              </section>
            );
          })}
      </div>
      <section className="card">
        <h2>تذاكر الدعم ({tickets.total})</h2><RecordPager data={tickets} />
        {tickets.items.map((t) => (
          <div className="list-row" key={t.id}>
            <div>
              <h4>
                {t.name} · {t.id}
              </h4>
              <p>{t.message}</p>
              <p>{t.reply}</p>
            </div>
            <Badge status={t.status === "RESOLVED" ? "COMPLETED" : "PENDING"} />
            {t.status !== "RESOLVED" && (
              <Btn
                variant="outline"
                onClick={() =>
                  setModal({
                    title: "الرد على التذكرة",
                    body: (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (
                            await act("TICKET_REPLY", {
                              id: t.id,
                              reply: new FormData(e.currentTarget).get("reply"),
                            })
                          )
                            setModal(null);
                        }}
                      >
                        <Field label="الرد">
                          <textarea name="reply" required />
                        </Field>
                        <Btn type="submit">إرسال الرد</Btn>
                      </form>
                    ),
                  })
                }
              >
                رد
              </Btn>
            )}
          </div>
        ))}
        {!tickets.items.length && (
          <p className="muted">لا توجد تذاكر مفتوحة حاليًا.</p>
        )}
      </section>
    </>
  );
}
function CalendarMini({ s, onSelect }: any) {
  const [month, setMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const year = month.getFullYear(),
    m = month.getMonth(),
    days = new Date(year, m + 1, 0).getDate(),
    offset = (month.getDay() + 1) % 7;
  const calendar=useServerValue(()=>api.calendar(year+'-'+String(m+1).padStart(2,'0')),year+'-'+m,s.runtime?.refreshedAt);
  return (
    <div className="calendar" aria-busy={!isDemo && !calendar.value}>
      {calendar.error && <p role="alert">{calendar.error}<button onClick={calendar.retry}>إعادة المحاولة</button></p>}
      <div className="toolbar">
        <button
          aria-label="الشهر السابق"
          onClick={() => setMonth(new Date(year, m - 1, 1))}
        >
          ‹
        </button>
        <h4>
          {month.toLocaleDateString("ar-KW", {
            month: "long",
            year: "numeric",
          })}
        </h4>
        <button
          aria-label="الشهر التالي"
          onClick={() => setMonth(new Date(year, m + 1, 1))}
        >
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {["س", "ح", "ن", "ث", "ر", "خ", "ج"].map((d, i) => (
          <small key={"d" + i}>{d}</small>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={"b" + i} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date =
              year +
              "-" +
              String(m + 1).padStart(2, "0") +
              "-" +
              String(i + 1).padStart(2, "0"),
            events = isDemo?s.orders.filter(o=>o.occasion.date===date).length:(calendar.value?.[date] || 0);
          return (
            <button
              key={date}
              aria-label={date + "، " + events + " مناسبة"}
              className={events ? "has-event" : ""}
              onClick={() =>
                onSelect ? onSelect(date) : go("/admin/events?date=" + date)
              }
            >
              {i + 1}
              {events > 0 && <i />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
function Events({ s, act }: any) {
  const [day, setDay] = useState(
      new URLSearchParams(location.search).get("date") || "",
    ),
    [view, setView] = useState("board");
  const fallback = s.orders.filter((o) => !day || o.occasion.date === day);
  const records=useRecordPage('bookings',{date:day,kind:'execution'},fallback,s.runtime?.refreshedAt);
  const list=records.items;
  return (
    <>
      <RecordPager data={records} />
      <div className="toolbar">
        <Btn
          variant={view === "board" ? "" : "outline"}
          onClick={() => setView("board")}
        >
          لوحة التنفيذ
        </Btn>
        <Btn
          variant={view === "calendar" ? "" : "outline"}
          onClick={() => setView("calendar")}
        >
          التقويم
        </Btn>
        {day && (
          <Btn variant="text" onClick={() => setDay("")}>
            عرض كل الأيام
          </Btn>
        )}
      </div>
      {view === "calendar" && (
        <div className="card calendar-large">
          <CalendarMini s={s} onSelect={setDay} />
        </div>
      )}
      <div className="kanban">
        {["CONFIRMED", "PREPARATION", "IN_PROGRESS", "COMPLETED"].map((st) => (
          <section className="kanban-column" key={st}>
            <h3>
              {labels[st]}
              <span>{isDemo?list.filter(o=>o.status===st).length:(records.counts?.[st] || 0)}</span>
            </h3>
            {list
              .filter((o) => o.status === st)
              .map((o) => (
                <article className="card" key={o.id}>
                  <Link to={"/admin/orders/" + o.id}>
                    <h3>
                      {o.occasion.type} · {o.customer}
                    </h3>
                  </Link>
                  <p>
                    {o.occasion.date} · {o.occasion.location}
                  </p>
                  {[
                    "تأكيد موقع المناسبة",
                    "مراجعة مستلزمات التنفيذ",
                    "التسليم للعميل",
                  ].map((t, i) => (
                    <label className="check-label" key={t}>
                      <input
                        type="checkbox"
                        checked={o.tasks[i]}
                        onChange={() =>
                          act(
                            "TASK",
                            { id: o.id, index: i },
                            "تم تحديث قائمة التنفيذ",
                          )
                        }
                      />
                      {t}
                    </label>
                  ))}
                  <select
                    aria-label={"حالة تنفيذ " + o.id}
                    value={o.execution}
                    onChange={(e) =>
                      act("EXECUTION", { id: o.id, status: e.target.value })
                    }
                  >
                    <option value="CONFIRMED">مؤكد</option>
                    <option value="Preparing">قيد التحضير</option>
                    <option value="On the way">في الطريق</option>
                    <option value="Delivered">تم التركيب / التسليم</option>
                    <option value="Completed">مكتمل</option>
                    <option value="Issue">مشكلة تنفيذ</option>
                  </select>
                </article>
              ))}
          </section>
        ))}
      </div>
    </>
  );
}
function Reports({ s }: any) {
  const [period, setPeriod] = useState("6"),
    [occasion, setOccasion] = useState("all");
  let list = s.orders.filter(
      (o) =>
        (occasion === "all" || o.occasion.type === occasion) &&
        new Date(o.createdAt) >=
          new Date(
            new Date().getFullYear(),
            new Date().getMonth() - Number(period) + 1,
            1,
          ),
    ),
    total = list.reduce((n, o) => n + pricing(o.lines, o.discount).total, 0),
    profit = list.reduce(
      (n, o) => n + (pricing(o.lines, o.discount).profit || 0),
      0,
    ),
    actual = list.reduce((n, o) => n + o.paid, 0);
  const report=useServerValue(()=>api.reportSummary({period,occasion:occasion==='all'?'':occasion}),period+'|'+occasion,s.runtime?.refreshedAt);
  const suppliers=useRecordPage('suppliers',{},s.suppliers,s.runtime?.refreshedAt);
  const count=isDemo?list.length:(report.value?.count || 0);
  if(!isDemo){total=report.value?.total || 0;profit=report.value?.profit || 0;actual=report.value?.actual || 0;}
  return (
    <>
      {!isDemo && !report.value && !report.error && <p role="status">جارٍ حساب التقرير من قاعدة البيانات…</p>}
      {report.error && <p role="alert">{report.error}<button onClick={report.retry}>إعادة المحاولة</button></p>}
      <div className="toolbar">
        <select
          aria-label="فترة التقرير"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="6">آخر 6 أشهر</option>
          <option value="3">آخر 3 أشهر</option>
        </select>
        <select
          aria-label="نوع المناسبة"
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
        >
          <option value="all">كل المناسبات</option>
          {occasions.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <Btn
          variant="outline"
          onClick={() =>
            exportFile(
              "report.csv",
              "نوع التقرير,القيمة\nالإيرادات المتوقعة," +
                total +
                "\nالربح المتوقع," +
                profit +
                "\nالمحصّل," +
                actual +
                "\nمتوسط العقد," +
                total / (count || 1),
              "text/csv",
            )
          }
        >
          <Download size={16} />
          تصدير التقرير
        </Btn>
      </div>
      <div className="kpi-grid">
        {[
          ["الإيرادات المتوقعة", total],
          ["الربح المتوقع", profit],
          ["المحصّل فعليًا", actual],
          ["متوسط العقد", total / (count || 1)],
        ].map(([t, v]) => (
          <div className="card kpi" key={t}>
            <span>{t}</span>
            <Price value={Number(v)} />
            <Sparkline />
          </div>
        ))}
      </div>
      <div className="grid two section">
        <div className="card">
          <h2>الإيرادات والربحية · {period} أشهر</h2>
          <Chart period={period} analytics={report.value?{months:report.value.months}:undefined} />
        </div>
        <div className="card">
          <h2>مسار التحويل</h2>
          {[
            ["الطلبات", count],
            [
              "العروض المرسلة",
              isDemo?list.filter(o=>o.quoteSnapshot || o.contract).length:(report.value?.quotes || 0),
            ],
            ["العقود", isDemo?list.filter(o=>o.contract).length:(report.value?.contracts || 0)],
            ["الحجوزات المدفوعة", isDemo?list.filter(o=>o.paid>0).length:(report.value?.paid || 0)],
          ].map(([t, n], i) => (
            <div className="funnel" key={t}>
              <span>{t}</span>
              <div style={{ width: Math.max(0,Number(n)/(count||1)*100)+"%" }}>{n}</div>
            </div>
          ))}
        </div>
      </div>
      <section className="card">
        <h2>أداء الموردين</h2><RecordPager data={suppliers} />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>المورد</th>
                <th>الاستجابة</th>
                <th>الالتزام</th>
                <th>التقييم</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.items.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td>{v.response}%</td>
                  <td>{v.reliability}%</td>
                  <td>★ {v.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function Team({ s, act, setModal }: any) {
  const records=useRecordPage('users',{},s.users,s.runtime?.refreshedAt);
  return (
    <>
      <RecordPager data={records} />
      <Btn
        onClick={() =>
          setModal({
            title: "دعوة موظف",
            body: (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await act(
                      "USER_SAVE",
                      Object.fromEntries(
                        [...new FormData(e.currentTarget)].filter(
                          ([k, v]) => k !== "supplierId" || v,
                        ),
                      ),
                      "أُرسلت دعوة تفعيل الحساب",
                    )
                  )
                    setModal(null);
                }}
              >
                <Field label="الاسم">
                  <input name="name" required />
                </Field>
                <Field label="البريد">
                  <input name="email" type="email" required />
                </Field>
                <Field label="الدور">
                  <select name="role">
                    <option value="staff">منسق / موظف</option>
                    <option value="supplier">مورد</option>
                    <option value="admin">مالك / مدير</option>
                  </select>
                </Field>
                <Field label="المورد المرتبط (لدعوة المورد فقط)">
                  <select name="supplierId">
                    <option value="">غير مرتبط</option>
                    {s.suppliers.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Btn type="submit">إنشاء الدعوة</Btn>
              </form>
            ),
          })
        }
      >
        دعوة عضو فريق
        <Plus size={17} />
      </Btn>
      <section className="card section">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>البريد</th>
                <th>الدور</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {records.items.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      aria-label={"دور " + u.name}
                      value={u.role}
                      disabled={u.id === s.session.id}
                      onChange={(e) =>
                        act("USER_SAVE", { id: u.id, role: e.target.value })
                      }
                    >
                      <option value="staff">موظف</option>
                      <option value="admin">مدير</option>
                    </select>
                  </td>
                  <td>
                    <Badge status={u.active ? "CONFIRMED" : "CANCELLED"}>
                      {u.active ? "نشط" : "موقوف"}
                    </Badge>
                  </td>
                  <td>
                    <Btn
                      variant="outline"
                      disabled={u.id === s.session.id}
                      onClick={() =>
                        act("USER_SAVE", { id: u.id, active: !u.active })
                      }
                    >
                      {u.active ? "إيقاف" : "تفعيل"}
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h3>مصفوفة الصلاحيات</h3>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>الصلاحية</th>
                <th>العميل</th>
                <th>المورد</th>
                <th>الموظف</th>
                <th>المالك</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["مشاهدة تكلفة المورد", "—", "تكلفته فقط", "نعم", "نعم"],
                ["تعديل سعر البيع", "—", "—", "مسودة", "نعم"],
                ["اعتماد الخصم والاسترداد", "—", "—", "—", "نعم"],
                ["إدارة المستخدمين", "—", "—", "—", "نعم"],
              ].map((r) => (
                <tr key={r[0]}>
                  {r.map((c, i) => (
                    <td key={i}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function Audit({ s }: any) {
  const [q, setQ] = useState("");
  let list = s.audit.filter((a) =>
    (a.actor + " " + a.action + " " + a.entity + " " + a.reason).includes(q),
  );
  const recordParams={q};
  const records=useRecordPage("audit",recordParams,list,s.runtime?.refreshedAt);
  list=records.items;
  return (
    <>
      <RecordPager data={records} />
      <div className="toolbar">
        <input
          aria-label="بحث سجل التدقيق"
          placeholder="ابحث بالإجراء، المستخدم، رقم الطلب"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Btn
          variant="outline"
          onClick={() => isDemo?exportFile('audit-log.json',list):downloadRecords('audit',recordParams)}
        >
          <Download size={16} />
          تصدير السجل
        </Btn>
      </div>
      <section className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>الإجراء</th>
                <th>الفاعل</th>
                <th>الكيان</th>
                <th>السبب</th>
                <th>التاريخ</th>
                <th>قبل / بعد</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td>{a.action}</td>
                  <td>{a.actor}</td>
                  <td>{a.entity}</td>
                  <td>{a.reason}</td>
                  <td>{new Date(a.at).toLocaleString("ar-KW")}</td>
                  <td>
                    <details>
                      <summary>عرض التغيير</summary>
                      <pre>
                        {JSON.stringify(
                          { before: a.before, after: a.after },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function SettingsPage({ s, act }: any) {
  const [dirty, setDirty] = useState(false);
  React.useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    addEventListener("beforeunload", f);
    const click = (e: MouseEvent) => {
      if (
        dirty &&
        (e.target as HTMLElement).closest("a") &&
        !confirm("لديك تغييرات غير محفوظة. هل تريد المغادرة؟")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", click, true);
    return () => {
      removeEventListener("beforeunload", f);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  return (
    <form
      className="card settings-form"
      onChange={() => setDirty(true)}
      onSubmit={async (e) => {
        e.preventDefault();
        const f: any = Object.fromEntries(new FormData(e.currentTarget));
        for (let k of ["threshold", "deposit", "second", "taxRate"])
          f[k] = Number(f[k]);
        if (f.couponCode) {
          f.coupons = [
            {
              code: f.couponCode.trim(),
              percent: Number(f.couponPercent),
              active: true,
              ...(f.couponExpires
                ? {
                    expiresAt: new Date(
                      f.couponExpires + "T23:59:59Z",
                    ).toISOString(),
                  }
                : {}),
            },
            ...(s.settings.coupons || []).filter(
              (x) => x.code !== f.couponCode.trim(),
            ),
          ];
        }
        delete f.couponCode;
        delete f.couponPercent;
        delete f.couponExpires;
        f.doubleApproval = f.doubleApproval === "on";
        f.earlyPayment = f.earlyPayment === "on";
        if (await act("SETTINGS", f)) setDirty(false);
      }}
    >
      <h2>إعدادات الهوية والسياسات</h2>
      <div className="grid two">
        <Field label="كود الخصم">
          <input name="couponCode" maxLength={40} />
        </Field>
        <Field label="نسبة الخصم %">
          <input
            name="couponPercent"
            type="number"
            min={0}
            max={100}
            step="0.1"
          />
        </Field>
        <Field label="تاريخ انتهاء الكود">
          <input name="couponExpires" type="date" />
        </Field>
      </div>
      {[
        ["companyName", "الاسم القانوني للمنشأة"],
        ["registrationNumber", "رقم التسجيل التجاري"],
        ["contactEmail", "البريد الرسمي"],
        ["contactPhone", "هاتف خدمة العملاء"],
      ].map(([name, label]) => (
        <Field key={name} label={label}>
          <input
            name={name}
            type={name === "contactEmail" ? "email" : "text"}
            defaultValue={s.settings[name] || ""}
          />
        </Field>
      ))}
      <Field label="الضريبة المعتمدة %">
        <input
          type="number"
          name="taxRate"
          min={0}
          max={100}
          step="0.01"
          defaultValue={s.settings.taxRate || 0}
        />
      </Field>
      <Field label="الشروط المعتمدة">
        <textarea name="terms" defaultValue={s.settings.terms || ""} />
      </Field>
      <Field label="سياسة الخصوصية">
        <textarea name="privacy" defaultValue={s.settings.privacy || ""} />
      </Field>
      
      <Field label="الحد الأدنى لهامش الربح %">
        <input
          type="number"
          name="threshold"
          min={0}
          max={100}
          defaultValue={s.settings.threshold}
          required
        />
      </Field>
      <div className="grid two">
        <Field label="الدفعة الأولى %">
          <input
            type="number"
            min={1}
            max={100}
            name="deposit"
            defaultValue={s.settings.deposit}
          />
        </Field>
        <Field label="الدفعة الثانية %">
          <input
            type="number"
            min={0}
            max={99}
            name="second"
            defaultValue={s.settings.second}
          />
        </Field>
      </div>
      <Field label="سياسة الإلغاء">
        <textarea
          name="cancellation"
          defaultValue={s.settings.cancellation}
          rows={3}
          required
        />
      </Field>
      <Field label="قالب الإشعارات">
        <textarea
          name="notificationTemplate"
          defaultValue={
            s.settings.notificationTemplate ||
            "حياك الله {الاسم}، تم تحديث حالة مناسبتك {رقم_الطلب}."
          }
        />
      </Field>
      <Field label="اللغة الافتراضية">
        <select name="locale" value="ar" disabled>
          <option value="ar">العربية</option>
        </select>
      </Field>
      <label className="check-label">
        <input
          type="checkbox"
          name="doubleApproval"
          defaultChecked={s.settings.doubleApproval}
        />
        تفعيل الموافقة المزدوجة واستقلال المراجع
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          name="earlyPayment"
          defaultChecked={s.settings.earlyPayment}
        />
        السماح بسداد الدفعات قبل الاستحقاق
      </label>
      {dirty && <p className="warning">توجد تغييرات غير محفوظة.</p>}
      <Btn type="submit">
        حفظ الإعدادات
        <Check size={17} />
      </Btn>
    </form>
  );
}
export function Supplier({ s, act, ask, path }: any) {
  const [filter, setFilter] = useState("all");
  const vendor = s.suppliers.find((v) => v.id === s.session.supplierId),
    page = path.split("/")[2],
    id = path.split("/")[3];
  const orders = s.orders.filter(
    (o) =>
      (o.lines.some((l) => l.supplierId === vendor?.id) ||
        o.amendment?.lines.some((l) => l.supplierId === vendor?.id)) &&
      (!id || o.id === id),
  );
  const records=useRecordPage('bookings',{...(id?{id}:{}),...(filter!=='all'?{response:filter}:{})},orders,s.runtime?.refreshedAt);
  if (!vendor) {
    return <div className="container section">
      {!isDemo && s.runtime?.route !== path ? <BrandedLoader mode="section" /> :
        <Empty title="ملف المورد غير متاح" text="تواصلوا مع إدارة المنصة لمراجعة ربط حسابكم بملف المورد." to="/support" cta="تواصلوا ويانا" />}
    </div>;
  }
  return (
    <div className="container section supplier-portal">
      <div className="section-title">
        <div>
          <span className="eyebrow">شركاء اللحظات الجميلة</span>
          <h1>حياك الله، {vendor?.name}</h1>
          <p>طلباتك ومواعيدك، كلّها في مكان واحد.</p>
        </div>
        <Badge status={vendor?.active?"CONFIRMED":"CANCELLED"}>{vendor?.active?"مورد معتمد":"مورد موقوف"}</Badge>
      </div>
      <div className="tabs supplier-tabs">
        {[
          ["/supplier", "نظرة عامة"],
          ["/supplier/requests", "طلبات التوفر"],
          ["/supplier/jobs", "لوحة التنفيذ"],
          ["/supplier/settlements", "المستحقات والتسويات"],
          ["/supplier/profile", "ملف المورد"],
        ].map(([to, t]) => (
          <Link className={path === to ? "active" : ""} key={to} to={to}>
            {t}
          </Link>
        ))}
      </div>
      {page === "settlements" ? <Settlements session={s.session} /> : page === "profile" ? (
        <section className="card narrow">
          <h2>ملف {vendor.name}</h2>
          <p>
            {vendor.category} · {vendor.area}
          </p>
          <p>
            التقييم ★ {vendor.rating} · الالتزام {vendor.reliability}%
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act(
                "PROFILE",
                {
                  mobile: new FormData(e.currentTarget).get("mobile"),
                  contact: new FormData(e.currentTarget).get("contact"),
                },
                "تم حفظ معلومات التواصل",
              );
            }}
          >
            <Field label="اسم مسؤول التواصل">
              <input
                name="contact"
                defaultValue={s.session.contact || vendor.name}
                required
              />
            </Field>
            <Field label="رقم التواصل">
              <input
                name="mobile"
                type="tel"
                defaultValue={s.session.mobile}
                required
              />
            </Field>
            <Btn type="submit">حفظ الملف</Btn>
          </form>
          <form
            className="section"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              act(
                "AVAILABILITY",
                {
                  serviceId: f.get("serviceId"),
                  date: f.get("date"),
                  capacity: Number(f.get("capacity")),
                  blocked: f.get("blocked") === "on",
                },
                "حُفظ التوفر الفعلي للتاريخ المحدد",
              );
            }}
          >
            <h3>تقويم السعة والتوفر</h3>
            <Field label="الخدمة">
              <select name="serviceId" required>
                {s.services
                  .filter((x) => x.supplierId === vendor.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="التاريخ">
              <input name="date" type="date" required />
            </Field>
            <Field label="السعة المتاحة لهذا اليوم">
              <input
                name="capacity"
                type="number"
                min={0}
                max={10000}
                required
                defaultValue={1}
              />
            </Field>
            <label className="check-label">
              <input name="blocked" type="checkbox" />
              إغلاق الحجز بهذا التاريخ
            </label>
            <Btn type="submit">حفظ توفر التاريخ</Btn>
          </form>
        </section>
      ) : (
        <>
          <div className="kpi-grid">
            <div className="card kpi">
              <span>طلباتك المفتوحة</span>
              <strong>
                {
                  !isDemo?vendor.waitingOrders:orders.filter((o) =>
                    o.lines.some(
                      (l) =>
                        l.supplierId === vendor.id && l.response === "WAITING",
                    ),
                  ).length
                }
              </strong>
              <Sparkline />
            </div>
            <div className="card kpi">
              <span>معدل قبول الطلبات</span>
              <strong>{vendor.response}%</strong>
              <Sparkline />
            </div>
            <div className="card kpi">
              <span>نسبة الطلبات المكتملة</span>
              <strong>{vendor.reliability}%</strong>
              <Sparkline />
            </div>
            <div className="card kpi">
              <span>تقييمك</span>
              <strong>★ {vendor.rating}</strong>
              <Sparkline />
            </div>
          </div>
          <div className="toolbar">
            <h2>
              {page === "jobs" ? "تنفيذ المناسبات" : "طلبات تأكيد التوفر"}
            </h2>
            <select
              aria-label="تصفية الطلبات"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">جميع الطلبات</option>
              <option value="WAITING">بانتظار الرد</option>
              <option value="CONFIRMED_SUPPLIER">المؤكدة</option>
              <option value="REJECTED">غير المتاحة</option>
            </select>
          </div>
          <RecordPager data={records} />
          {records.items.map((o) => {
            const lines = o.lines.filter(
              (l) =>
                l.supplierId === vendor.id &&
                (filter === "all" || l.response === filter),
            );
            return (
              <section className="card supplier-order" key={o.id}>
                <div className="section-title">
                  <div>
                    <Link to={"/supplier/requests/" + o.id}>
                      <h3>
                        {o.id} · {o.occasion.type}
                      </h3>
                    </Link>
                    <div className="event-inline">
                      <OrderEvent o={o} />
                    </div>
                  </div>
                  <Badge status={o.status} />
                </div>
                {lines.map((l) => (
                  <div className="supplier-line" key={l.id}>
                    <img src={"/assets/" + l.image + ".jpg"} alt="" />
                    <div>
                      <h3>{l.title}</h3>
                      <p>الكمية {l.qty} · مهلة الرد 24 ساعة</p>
                      <Badge status={l.response} />
                      {l.alternative && <p>{l.alternative}</p>}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        act(
                          "SUPPLIER_RESPONSE",
                          {
                            id: o.id,
                            lineId: l.id,
                            response: "CONFIRMED_SUPPLIER",
                            cost: Number(f.get("cost")),
                            leadTime: Number(f.get("leadTime")),
                          },
                          "تم تأكيد التوفر وتحديث الطلب",
                        );
                      }}
                    >
                      <div className="grid two">
                        <Field label="تكلفتك (د.ك)">
                          <input
                            aria-label={"تكلفة المورد " + l.title}
                            name="cost"
                            type="number"
                            defaultValue={l.cost}
                            min={1}
                            required
                          />
                        </Field>
                        <Field label="مدة التجهيز بالأيام">
                          <input
                            name="leadTime"
                            type="number"
                            defaultValue={l.leadTime || 2}
                            min={1}
                            required
                          />
                        </Field>
                      </div>
                      <div className="button-row">
                        <Btn
                          type="submit"
                          disabled={o.contract?.status === "SIGNED"}
                        >
                          <Check size={16} />
                          تأكيد التوفر والتكلفة
                        </Btn>
                        <Btn
                          type="button"
                          variant="outline"
                          disabled={o.contract?.status === "SIGNED"}
                          onClick={() =>
                            ask(
                              "عدم التوفر واقتراح بديل",
                              "SUPPLIER_RESPONSE",
                              { id: o.id, lineId: l.id, response: "REJECTED" },
                              "سبب الرفض والبديل المقترح",
                            )
                          }
                        >
                          اعتذار / بديل
                        </Btn>
                      </div>
                    </form>
                  </div>
                ))}
                {o.amendment?.lines.some((l) => l.supplierId === vendor.id) &&
                  o.amendment.status === "SUPPLIER_CONFIRMATION" && (
                    <div className="info">
                      <span>خدمة ملحق: {o.amendment.lines[0].title}</span>
                      <Btn
                        onClick={() =>
                          act(
                            "AMENDMENT_CONFIRM",
                            { id: o.id },
                            "تم تأكيد خدمة الملحق",
                          )
                        }
                      >
                        تأكيد الملحق
                      </Btn>
                    </div>
                  )}
                {(
                  <div className="supplier-execution">
                    {page === "jobs" && <Field label="حالة التنفيذ">
                      <select
                        value={o.execution}
                        onChange={(e) =>
                          act(
                            "EXECUTION",
                            { id: o.id, status: e.target.value },
                            "تم تحديث حالة التنفيذ",
                          )
                        }
                      >
                        <option value="CONFIRMED">تم التأكيد</option>
                        <option value="Preparing">قيد التحضير</option>
                        <option value="On the way">في الطريق</option>
                        <option value="Delivered">تم التركيب / التسليم</option>
                        <option value="Completed">مكتمل</option>
                        <option value="Issue">بلاغ مشكلة</option>
                      </select>
                    </Field>}
                    <Field
                      label={
                        isDemo
                          ? "إرفاق فاتورة / صورة تنفيذ (محاكاة)"
                          : "إرفاق فاتورة / صورة تنفيذ"
                      }
                    >
                      <input
                        type="file"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f && !isDemo) {
                            try {
                              await api.upload(f, o.id);
                            } catch (error: any) {
                              alert(error.message);
                            }
                            return;
                          }
                          if (f)
                            act(
                              "ATTACH",
                              { id: o.id, name: f.name, size: f.size },
                              "حُفظت بيانات المرفق",
                            );
                        }}
                      />
                    </Field>
                    {o.attachments?.map((a, i) => (
                      <small key={i}>
                        {a.url ? (
                          <a href={a.url} download>
                            {a.name}
                          </a>
                        ) : (
                          a.name
                        )}{" "}
                        · {a.size ? Math.round(a.size / 1024) + " KB" : ""}
                      </small>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
          {!orders.length && (
            <Empty title="لا توجد طلبات جديدة لهذا المورد" to={null} />
          )}
        </>
      )}
    </div>
  );
}
export function Utility({ s, act, path, setToast, signOut, signingOut }: any) {
  const brand = branding(s.settings).name || "المنصة";
  const [sent, setSent] = useState(false);
  let title = (
    {
      "/about": "عن " + brand,
      "/faq": "أسئلتكم واستفساراتكم بكل وضوح",
      "/contact": "تواصلوا ويانا.. زارتنا البركة",
      "/notifications": "تنبيهاتكم والجديد",
      "/profile": "ملفكم الشخصي والسنع",
      "/support": "منسقكم وياكم خطوة بخطوة",
    } as any
  )[path];
  if (path === "/profile" && !s.session)
    return (
      <div className="container section">
        <Empty
          title="يا هلا ومسهلا في مناسبتكم"
          to="/auth/login"
          cta="تسجيل الدخول"
        />
      </div>
    );
  return (
    <>
      <Hero
        title={title}
        sub={
          path === "/about"
            ? "لأن المناسبات الحلوة ما تنترك للصدفة.. تبيلها سنع وذرابة"
            : "كل اللي بخاطركم وتحتاجونه.. قريب منكم وعيونا لكم"
        }
        text="بروح أهل الكويت وذرابتهم واهتمامنا الشخصي، نزهّب وياكم ليلة تفرّح القلب وتبقى بالذاكرة دوم."
      />
      <div className="container section narrow">
        {path === "/about" ? (
          <>
            <section className="card about-card">
              <Flower2 size={54} strokeWidth={0.8} />
              <h2>كل مناسبة.. حكاية كويتية تبيّض الوجه</h2>
              <p>
                {brand} منصة كويتية تجمع أرقى وأسنع خدمات المناسبات والأفراح
                والضيافة بتجربة وحدة متكاملة تجمع بين أصالة التراث وذرابة
                الحاضر. نرتب كل شاردة وواردة ويا مزودي الخدمة المعتمدين، نشيك
                على التوفر والتكاليف بكل شفافية، ونمشي وياكم خطوة بخطوة من أول
                ما يخطر ببالكم الحفل لين تطفون شمعة ليلتكم المباركة.
              </p>
              <p>
                من عروسنا وأفراحنا الكبيرة لين غبقاتنا وقعداتنا الحميمة، فريقنا
                يدير باله على كل صغيرة وكبيرة عشان تستمتعون بضيوفكم ومواجيبكم
                وأنتوا مرتاحين البال ورافعين الراس.
              </p>
              <Btn to="/planner">
                خلّنا نبدي نزهّب لمناسبتكم
                <ArrowLeft size={17} />
              </Btn>
            </section>
            <div className="grid three section">
              {[
                "سنع وترتيب عالي",
                "شفافية بكل فلس",
                "وياكم بكل خطوة وموجب",
              ].map((t) => (
                <div className="card" key={t}>
                  <ShieldCheck size={27} />
                  <h3>{t}</h3>
                </div>
              ))}
            </div>
          </>
        ) : path === "/faq" ? (
          <div className="card">
            {[
              [
                "شلون أحجز مع " + brand + "؟",
                "سمّوا بالله وابدوا بمخطط المناسبة، نقّوا الخدمات اللي بخاطركم ودزوا الطلب. نشيك على التوفر ونجهّز لكم عرض سعر وعقد واضح وموثق قبل ما تدفعون أي فلس.",
              ],
              [
                "هل الأسعار المعروضة نهائية؟",
                "الأسعار الموجودة بالكتالوج تقديرية تقريبية، ويبين السعر النهائي الأكيد عقب ما يأكدون الموردين طلبكم ونعتمد العرض السنع سوا.",
              ],
              [
                "أقدر أعدل على الحجز بعد ما أوقع العقد؟",
                "أي نعم وأكيد، من صفحة حجزكم تقدرون تطلبون تعديل بكل سهالة. نطلع ملحق مستقل بالخدمة الجديدة والفرق المالي، وما يعتمد إلا بموافقتكم وتوقيعكم.",
              ],
              [
                "شلون نسدد الدفعات؟",
                `${s.settings.deposit}% عند التوقيع، ${s.settings.second}% قبل المناسبة بـ30 يوم، والباقي قبلها بـ7 أيام، وفق جدول الدفعات المثبت في عقدكم.`,
              ],
              ["شنو سياسة الإلغاء؟", s.settings.cancellation],
              [
                "أقدر أنقي المورد بنفسي مباشرة؟",
                "فريق " + brand + " ينسق ويا أسنع الموردين ويضمن التوفر والجودة العالية اللي تبيّض الوجه، وتظل كل متابعاتكم وترتيباتكم محشومة ومحفوظة عن طريق المنصة.",
              ],
              [
                "شلون تستخدمون بياناتي؟",
                isDemo ? "بيانات العرض التجريبي محفوظة في المتصفح." : (s.settings.privacy || "نستخدم بيانات الحساب والحجز لتقديم الخدمة. لا نخزن بيانات البطاقات؛ تتم معالجة الدفع في صفحة المزود الآمنة. تواصلوا مع الفريق لسياسة الخصوصية المعتمدة."),
              ],
            ].map(([t, p]) => (
              <details key={t}>
                <summary>
                  {t}
                  <ChevronLeft size={16} />
                </summary>
                <p>{p}</p>
              </details>
            ))}
          </div>
        ) : path === "/notifications" ? (
          <section className="card">
            <div className="section-title">
              <h2>آخر التنبيهات والأخبار</h2>
              <Btn
                variant="text"
                onClick={() => act("READ", {}, "تمت قراءة جميع الإشعارات")}
              >
                تحديد الكل كمقروء
                <Check size={16} />
              </Btn>
            </div>
            {s.notifications
              .filter((n) => n.userId === s.session?.id)
              .map((n) => (
                <Link
                  to={n.to}
                  className={"notification " + (!n.read ? "unread" : "")}
                  key={n.id}
                >
                  <span>
                    <Bell size={21} />
                  </span>
                  <div>
                    <h3>{n.title}</h3>
                    <small>{new Date(n.at).toLocaleString("ar-KW")}</small>
                  </div>
                  <ChevronLeft size={17} />
                </Link>
              ))}
          </section>
        ) : path === "/profile" ? (
          <section className="card">
            <h2>يا هلا ومسهلا {s.session.name}</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = Object.fromEntries(new FormData(e.currentTarget));
                await act("PROFILE", f);
              }}
            >
              <Field label="الاسم الكامل">
                <input name="name" defaultValue={s.session.name} required />
              </Field>
              <Field label="الهاتف">
                <input
                  name="mobile"
                  type="tel"
                  defaultValue={s.session.mobile}
                  required
                />
              </Field>
              <Field label="البريد الإلكتروني">
                <input
                  name="email"
                  type="email"
                  defaultValue={s.session.email}
                  required
                />
              </Field>
              <Field label="المنطقة">
                <select
                  name="location"
                  defaultValue={s.session.location || "حولي"}
                >
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
              <Field label="شنو تفضلون ونقوتكم الخاصة؟ (اختياري)">
                <textarea
                  name="preferences"
                  defaultValue={s.session.preferences || ""}
                  rows={2}
                />
              </Field>
              <Btn type="submit">
                حفظ التعديلات السنعة
                <Check size={16} />
              </Btn>
            </form>
            <div className="section button-row">
              <Btn
                variant="outline"
                onClick={signOut}
                disabled={signingOut}
              >
                تسجيل الخروج
                <LogOut size={16} />
              </Btn>
              {isDemo && <Btn
                variant="text"
                onClick={async () => {
                  await act(
                    "LOGOUT",
                    {},
                    "انتهت الجلسة التجريبية.. شرفونا بتسجيل الدخول مرة ثانية",
                  );
                  go("/auth/login");
                }}
              >
                محاكاة انتهاء الجلسة
              </Btn>}
            </div>
          </section>
        ) : (
          <>
            <div className="contact-methods">
              <div>
                <Phone size={24} />
                <b>دقّوا علينا</b>
                <a href="tel:+96522001234">+965 2200 1234</a>
              </div>
              <div>
                <Mail size={24} />
                <b>راسلونا وفالكم طيب</b>
                <a href="mailto:hello@habbalsaad.demo">hello@habbalsaad.demo</a>
              </div>
            </div>
            <section className="card">
              <h2>
                {sent
                  ? "وصلتنا رسالتكم الطيبة.. زارتنا البركة"
                  : "شنو بخاطركم ونقدر نخدمكم فيه؟"}
              </h2>
              {sent ? (
                <div className="success-panel">
                  <CheckCircle2 size={48} />
                  <p>
                    سجلنا رسالتكم السنعة وراح يتابعها فريق التنسيق والضيافة من
                    لوحة الدعم أول بأول.
                  </p>
                  <Btn variant="outline" onClick={() => setSent(false)}>
                    دزوا رسالة ثانية
                  </Btn>
                </div>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await act(
                        "TICKET",
                        Object.fromEntries(new FormData(e.currentTarget)),
                        "تم إنشاء تذكرة الدعم وفالكم طيب",
                      )
                    )
                      setSent(true);
                  }}
                >
                  {!s.session && (
                    <div className="grid two">
                      <Field label="الاسم">
                        <input name="name" required />
                      </Field>
                      <Field label="البريد">
                        <input type="email" name="email" required />
                      </Field>
                    </div>
                  )}
                  <Field label="شنو موضوع تواصلكم؟">
                    <select name="subject">
                      <option>استفسار عن مناسبة وزهابها</option>
                      <option>متابعة حجز قائم</option>
                      <option>طلب تعديل أو إضافة خدمة</option>
                      <option>استفسار عن الدفع</option>
                      <option>طلب استرداد أو إلغاء</option>
                    </select>
                  </Field>
                  <Field label="رسالتكم الكريمة">
                    <textarea
                      name="message"
                      required
                      minLength={5}
                      rows={5}
                      placeholder="قولوا لنا شنو بخاطركم وتامرون أمر.. وحنا وياكم عيونا لكم"
                    />
                  </Field>
                  <Btn type="submit">
                    إرسال الرسالة وفالكم طيب
                    <Send size={17} />
                  </Btn>
                </form>
              )}
            </section>
            {s.session && (
              <section className="card section">
                <h3>تذاكركم واستفساراتكم السابقة</h3>
                {s.tickets
                  .filter((t) => t.userId === s.session.id)
                  .map((t) => (
                    <div className="note" key={t.id}>
                      <Badge
                        status={
                          t.status === "RESOLVED" ? "COMPLETED" : "PENDING"
                        }
                      />
                      <h4>{t.id}</h4>
                      <p>{t.message}</p>
                      {t.reply && (
                        <div className="info">رد المنسق السنع: {t.reply}</div>
                      )}
                    </div>
                  ))}
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}
export function Demo({ s, act, setModal, demoState, setDemoState }: any) {
  return (
    <div className="container section">
      <span className="eyebrow">HABB ALSAAD · DEMO CONTROL ROOM</span>
      <h1>غرفة العرض التجريبي</h1>
      <Btn to="/demo/motion" variant="outline">
        مختبر تجربة الافتتاح والتحميل
        <Play size={16} />
      </Btn>
      <p>
        أدوات داخلية لا تظهر في تنقّل العميل. جميع الأدوار تشترك في بيانات هذا
        المتصفح.
      </p>
      <div className="grid two section">
        <section className="card">
          <h2>تبديل الدور</h2>
          <p>الحساب الحالي: {s.session?.name || "زائر"}</p>
          <div className="action-grid">
            {[
              ["customer", "العميل", "سارة العتيبي", "/dashboard"],
              ["supplier", "المورد", "دار المناسبات", "/supplier"],
              ["staff", "الموظف", "ريم المنسقة", "/admin"],
              ["admin", "المالك", "أمل محمد", "/admin"],
            ].map(([role, t, name, to]) => (
              <Btn
                key={role}
                variant="outline"
                onClick={async () => {
                  const account =
                    role === "customer"
                      ? s.accounts?.find(
                          (a) =>
                            a.id ===
                            s.orders.find((o) => o.id === s.activeOrder)
                              ?.customerId,
                        )
                      : null;
                  const { passwordHash, ...profile } = account || {};
                  await act(
                    "LOGIN",
                    {
                      id: role,
                      role,
                      name,
                      email: role + "@demo.kw",
                      mobile: "96550001234",
                      supplierId: "v1",
                      ...profile,
                    },
                    "تم تبديل الدور إلى " + t,
                  );
                  go(to);
                }}
              >
                {t}
                <User size={17} />
              </Btn>
            ))}
          </div>
          <Btn
            variant="text"
            onClick={async () => {
              await act("LOGOUT", {}, "أصبحت زائرًا");
              go("/");
            }}
          >
            تصفح كزائر
          </Btn>
          {s.session?.role === "supplier" && (
            <Field label="المورد الذي تمثله في العرض">
              <select
                value={s.session.supplierId}
                onChange={(e) =>
                  act(
                    "LOGIN",
                    {
                      ...s.session,
                      supplierId: e.target.value,
                      name: s.suppliers.find((v) => v.id === e.target.value)
                        .name,
                    },
                    "تم تبديل هوية المورد",
                  )
                }
              >
                {s.suppliers.map((v) => (
                  <option value={v.id} key={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </section>
        <section className="card">
          <h2>حالات الواجهة</h2>
          <div className="action-grid">
            <Btn
              variant="outline"
              onClick={() =>
                setDemoState(demoState === "loading" ? "normal" : "loading")
              }
            >
              اختبار Loading
            </Btn>
            <Btn
              variant="outline"
              onClick={() =>
                setDemoState(demoState === "error" ? "normal" : "error")
              }
            >
              اختبار Error
            </Btn>
            <Btn
              variant="outline"
              onClick={() =>
                act(
                  "OFFLINE",
                  {},
                  s.offline ? "تم الاتصال" : "تم تفعيل وضع Offline",
                )
              }
            >
              {s.offline ? "إعادة الاتصال" : "اختبار Offline"}
            </Btn>
            <Btn variant="outline" to="/favorites">
              اختبار المفضلة / Empty
            </Btn>
          </div>
          {s.session?.role === "admin" && (
            <>
              <Field label="الطلب الحالي">
                <select
                  value={s.activeOrder}
                  onChange={(e) =>
                    act("SELECT_ORDER", { id: e.target.value }, "")
                  }
                >
                  {s.orders.map((o) => (
                    <option value={o.id} key={o.id}>
                      {o.id} — {o.customer}
                    </option>
                  ))}
                </select>
              </Field>
              <Btn
                variant="outline"
                onClick={() =>
                  act(
                    "EXPIRE",
                    { id: s.activeOrder },
                    "انتهت صلاحية العرض المختار",
                  )
                }
              >
                محاكاة انتهاء صلاحية عرض
              </Btn>
            </>
          )}
        </section>
        <section className="card">
          <h2>إعادة ضبط العرض</h2>
          <p>
            يُحذف تقدم العرض المحلي ويعاد تحميل البيانات الأصلية، بما فيها السلة
            والحساب الحالي.
          </p>
          <Btn
            variant="outline"
            onClick={() =>
              setModal({
                title: "إعادة ضبط البيانات التجريبية",
                body: (
                  <>
                    <p>
                      سيتم مسح تقدم العرض الحالي من هذا المتصفح. الملفات الأصلية
                      للمشروع محفوظة.
                    </p>
                    <Btn
                      onClick={() => {
                        api.reset();
                        setModal(null);
                        go("/");
                      }}
                    >
                      إعادة الضبط الآن
                      <RefreshCw size={16} />
                    </Btn>
                  </>
                ),
              })
            }
          >
            إعادة ضبط البيانات
          </Btn>
        </section>
        <section className="card">
          <h2>السيناريو الكامل</h2>
          <ol>
            <li>العميل: خطط وأضف الخدمات ثم أرسل للمراجعة.</li>
            <li>
              المورد: أكد خدماتك. بدّل هوية المورد من هذه الغرفة عند الحاجة.
            </li>
            <li>الموظف: راجع التسعير وسجل اعتماد الموظف.</li>
            <li>المالك: اعتمد السعر وأرسل العرض.</li>
            <li>العميل: وافق، وقّع، وادفع تجريبيًا.</li>
          </ol>
          <p>كود الخصم: MONASABATI10 · رمز OTP: 123456</p>
        </section>
      </div>
    </div>
  );
}
