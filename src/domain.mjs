import {totals} from './money.mjs';
export const KEY = "monasabati.v1.3";
export const occasions = [
  "حفل زفاف",
  "خطوبة",
  "حفل تخرج",
  "عيد ميلاد",
  "عزيمة",
  "مناسبة عائلية",
  "فعالية شركة",
  "جلسة خاصة",
];
export const categories = [
  "جميع الخدمات",
  "قاعات",
  "كوش ومسرح",
  "جلسات وطاولات",
  "زهور وديكور",
  "بوفيه",
  "ضيافة وقهوة",
  "إضاءة وصوت",
  "تصوير",
  "نقل",
  "صالونات وتجهيز",
];
export const labels = {
  DRAFT: "مسودة",
  REQUESTED: "طلب جديد",
  INTERNAL_REVIEW: "قيد المراجعة",
  SUPPLIER_CONFIRMATION: "بانتظار الموردين",
  QUOTE_READY: "العرض جاهز",
  CUSTOMER_REVIEW: "بانتظار موافقتك",
  CONTRACT_PENDING: "اعتماد العقد",
  CONTRACT_APPROVED: "جاهز للتوقيع",
  SIGNED: "العقد موقّع",
  PAYMENT_PENDING: "بانتظار الدفع",
  CONFIRMED: "حجز مؤكد",
  PREPARATION: "قيد التحضير",
  IN_PROGRESS: "جاري التنفيذ",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغي",
  EXPIRED: "منتهي الصلاحية",
  NEEDS_CHANGES: "طلب تعديل",
  SUPPLIER_UNAVAILABLE: "بديل مطلوب",
  PAYMENT_FAILED: "تعذر الدفع",
  DISPUTED: "طلب إلغاء",
  NEEDS_OWNER_APPROVAL: "بانتظار اعتماد المالك",
  PAID: "مدفوعة",
  PENDING: "قيد المعالجة",
  FAILED: "فشلت",
  REFUNDED: "مستردة",
  REFUND_PENDING: "جاري الاسترداد",
  CONFIRMED_SUPPLIER: "تم التأكيد",
  REJECTED: "غير متاح",
  WAITING: "بانتظار التأكيد",
};

export const bookingMachine = {
  DRAFT: ["REQUESTED"],
  REQUESTED: [
    "INTERNAL_REVIEW",
    "SUPPLIER_CONFIRMATION",
    "SUPPLIER_UNAVAILABLE",
    "QUOTE_READY",
    "NEEDS_OWNER_APPROVAL",
    "NEEDS_CHANGES",
    "DISPUTED",
  ],
  INTERNAL_REVIEW: [
    "SUPPLIER_CONFIRMATION",
    "SUPPLIER_UNAVAILABLE",
    "QUOTE_READY",
    "NEEDS_OWNER_APPROVAL",
    "NEEDS_CHANGES",
    "DISPUTED",
  ],
  SUPPLIER_CONFIRMATION: [
    "SUPPLIER_UNAVAILABLE",
    "QUOTE_READY",
    "NEEDS_OWNER_APPROVAL",
    "NEEDS_CHANGES",
    "DISPUTED",
  ],
  SUPPLIER_UNAVAILABLE: [
    "SUPPLIER_CONFIRMATION",
    "QUOTE_READY",
    "NEEDS_OWNER_APPROVAL",
    "NEEDS_CHANGES",
    "DISPUTED",
  ],
  QUOTE_READY: [
    "CUSTOMER_REVIEW",
    "SUPPLIER_CONFIRMATION",
    "SUPPLIER_UNAVAILABLE",
    "NEEDS_OWNER_APPROVAL",
    "NEEDS_CHANGES",
    "DISPUTED",
    "EXPIRED",
  ],
  NEEDS_OWNER_APPROVAL: [
    "CUSTOMER_REVIEW",
    "QUOTE_READY",
    "SUPPLIER_CONFIRMATION",
    "NEEDS_CHANGES",
    "DISPUTED",
  ],
  CUSTOMER_REVIEW: [
    "CONTRACT_PENDING",
    "CONTRACT_APPROVED",
    "QUOTE_READY",
    "SUPPLIER_CONFIRMATION",
    "NEEDS_OWNER_APPROVAL",
    "NEEDS_CHANGES",
    "EXPIRED",
    "DISPUTED",
  ],
  CONTRACT_PENDING: [
    "CONTRACT_APPROVED",
    "QUOTE_READY",
    "NEEDS_OWNER_APPROVAL",
    "NEEDS_CHANGES",
    "DISPUTED",
    "EXPIRED",
  ],
  CONTRACT_APPROVED: [
    "SIGNED",
    "QUOTE_READY",
    "SUPPLIER_CONFIRMATION",
    "NEEDS_OWNER_APPROVAL",
    "NEEDS_CHANGES",
    "DISPUTED",
    "EXPIRED",
  ],
  SIGNED: ["PAYMENT_PENDING", "CONFIRMED", "PAYMENT_FAILED", "DISPUTED"],
  PAYMENT_PENDING: ["CONFIRMED", "PAYMENT_FAILED", "DISPUTED"],
  PAYMENT_FAILED: ["PAYMENT_PENDING", "CONFIRMED", "DISPUTED"],
  CONFIRMED: ["PREPARATION", "IN_PROGRESS", "COMPLETED", "DISPUTED"],
  PREPARATION: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "DISPUTED"],
  IN_PROGRESS: ["CONFIRMED", "PREPARATION", "COMPLETED", "DISPUTED"],
  COMPLETED: ["DISPUTED"],
  DISPUTED: [
    "CANCELLED",
    "CONFIRMED",
    "PREPARATION",
    "IN_PROGRESS",
    "COMPLETED",
  ],
  CANCELLED: [],
  EXPIRED: [
    "NEEDS_CHANGES",
    "CUSTOMER_REVIEW",
    "QUOTE_READY",
    "SUPPLIER_CONFIRMATION",
  ],
  NEEDS_CHANGES: [
    "INTERNAL_REVIEW",
    "SUPPLIER_CONFIRMATION",
    "SUPPLIER_UNAVAILABLE",
    "QUOTE_READY",
    "NEEDS_OWNER_APPROVAL",
    "CUSTOMER_REVIEW",
    "DISPUTED",
    "EXPIRED",
  ],
};

export const money = (n) =>
  new Intl.NumberFormat("en-KW", { maximumFractionDigits: 3 }).format(n || 0);
export function pricing(lines, discount = 0, fees = 0, taxRate = 0) {return totals(lines,discount,fees,taxRate);}
export const markup = (cost, percent) => cost * (1 + percent / 100);
const titles = [
  "قاعة الياقوت للمناسبات",
  "كوشة الياسمين الملكية",
  "جلسات وطاولات فاخرة",
  "تنسيق الزهور والديكور",
  "بوفيه كويتي فاخر",
  "ضيافة قهوة كويتية",
  "إضاءة ومؤثرات بصرية",
  "تصوير فوتوغرافي وفيديو",
  "النقل بسيارات فاخرة",
  "تجهيز العروس الراقي",
  "قاعة لؤلؤة الخليج",
  "مسرح الورد الملكي",
  "جلسات خارجية دافئة",
  "زهور موسمية راقية",
  "بوفيه شرقي متكامل",
  "ركن الضيافة الملكي",
  "أنظمة صوت احترافية",
  "تصوير سينمائي للمناسبة",
  "توصيل ضيوف المناسبة",
  "تجهيز ومكياج السهرة",
  "طاولات استقبال ذهبية",
  "ديكور مدخل المناسبة",
  "كيك المناسبة الفاخر",
  "تنسيق احتفالات التخرج",
];
const cats = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 3, 4, 5, 2,
];
const pics = [
  "hall",
  "wedding",
  "table",
  "flowers",
  "food",
  "coffee",
  "wedding",
  "camera",
  "car",
  "flowers",
  "hall",
  "wedding",
  "table",
  "flowers",
  "food",
  "coffee",
  "hall",
  "camera",
  "car",
  "flowers",
  "table",
  "flowers",
  "cake",
  "wedding",
];
const prices = [
  2500, 1800, 550, 1200, 1800, 450, 650, 800, 350, 250, 2200, 1500, 600, 450,
  1400, 650, 400, 1100, 250, 180, 400, 750, 250, 900,
];
export function seed() {
  const services = titles.map((title, i) => ({
    id: "s" + (i + 1),
    title,
    category: categories[cats[i]],
    image: pics[i],
    price: prices[i],
    cost: Math.round(prices[i] * 0.68),
    rating: 4.7 + (i % 3) / 10,
    reviews: 88 + i * 7,
    available: i % 5 !== 1,
    audience: ["مشتركة", "نسائية", "رجالية"][i % 3],
    supplierId: "v" + ((i % 10) + 1),
    description:
      "تفاصيل مدروسة ولمسات سنعة تبيّض الوجه، ننفّذها بكل ذرابة لتكون مناسبتكم حكاية تفرح القلب. تشمل التجهيز والتركيب وفريق التنفيذ والمتابعة أول بأول.",
  }));
  const packages = [
    "باقة زفاف الياسمين الملكية",
    "باقة الضيافة الكويتية",
    "باقة الأمسية الراقية",
    "باقة الفخامة",
    "باقة التخرج المميزة",
    "باقة لقاء الأحبة",
  ].map((title, i) => ({
    id: "p" + (i + 1),
    title,
    price: [4500, 2500, 3500, 7500, 1800, 1200][i],
    capacity: [100, 50, 150, 300, 75, 30][i],
    image: ["hero", "coffee", "table", "wedding", "cake", "flowers"][i],
    serviceIds: i === 0 ? ["s1", "s4", "s8"] : ["s" + (i + 1), "s" + (i + 4)],
  }));
  const suppliers = [
    "دار المناسبات",
    "كوش الياسمين",
    "لمسات الخليج",
    "أزهار المناسبة",
    "مذاقات الكويت",
    "بيت الضيافة",
    "نور الإضاءة",
    "استوديو العدسة",
    "رويال ترانس",
    "أناقة",
  ];
  const orders = Array.from({ length: 12 }, (_, i) => {
    let lines = [services[i % 8], services[(i + 3) % 8]].map((s) => ({
      ...s,
      qty: 1,
      response: "CONFIRMED_SUPPLIER",
      leadTime: 2,
    }));
    let status = [
      "CONFIRMED",
      "CUSTOMER_REVIEW",
      "SUPPLIER_CONFIRMATION",
      "CONTRACT_APPROVED",
      "PREPARATION",
      "REQUESTED",
      "SIGNED",
      "COMPLETED",
      "PAYMENT_PENDING",
      "INTERNAL_REVIEW",
      "CONTRACT_PENDING",
      "NEEDS_CHANGES",
    ][i];
    return {
      id: "MN-" + (1087 - i),
      customerId: i === 0 ? "customer" : "seed" + i,
      customer: ["سارة العتيبي", "نورة الحمد", "فاطمة الغانم", "أحمد المطيري"][
        i % 4
      ],
      occasion: {
        type: occasions[i % 8],
        date: "2026-12-" + String(5 + i).padStart(2, "0"),
        location: ["حولي", "العاصمة", "السالمية"][i % 3],
        guests: 100 + i * 10,
        budget: 8000,
      },
      lines,
      status,
      discount: 0,
      version: 1,
      createdAt: "2026-10-23T09:00:00Z",
      timeline: [
        { status: "REQUESTED", at: "2026-10-20T10:00:00Z" },
        { status, at: "2026-10-23T09:00:00Z" },
      ],
      notes: [],
      approvals: [],
      contract: [0, 3, 4, 6, 7, 8].includes(i)
        ? {
            version: 1,
            status: i === 3 ? "APPROVED" : "SIGNED",
            signature:
              i === 3
                ? ""
                : [
                    "سارة العتيبي",
                    "نورة الحمد",
                    "فاطمة الغانم",
                    "أحمد المطيري",
                  ][i % 4],
            snapshot: structuredClone(lines),
            total: pricing(lines).total,
            clauses:
              "قبل 60 يومًا: استرداد 90%، قبل 30 يومًا: 50%، أقل من 30 يومًا: لا استرداد.",
          }
        : null,
      execution: "CONFIRMED",
      tasks: [false, false, false],
      paid: i === 0 ? pricing(lines).total * 0.3 : 0,
    };
  });
  const state = {
    categories: [...categories],
    version: 3,
    session: null,
    services,
    packages,
    suppliers: suppliers.map((name, i) => ({
      id: "v" + (i + 1),
      name,
      rating: 4.5 + (i % 5) / 10,
      area: "جميع مناطق الكويت",
      active: true,
      response: 92 + (i % 8),
      reliability: 95 + (i % 5),
      category: categories[i + 1],
    })),
    cart: [],
    favorites: ["s4", "s6"],
    planner: {
      step: 0,
      type: "حفل زفاف",
      date: "2026-12-12",
      location: "حولي",
      guests: 150,
      budget: 8000,
      notes: "",
    },
    orders,
    activeOrder: "MN-1087",
    payments: [
      { order: 0, m: 0, status: "PAID" },
      { order: 0, m: 1, status: "PENDING" },
      { order: 0, m: 2, status: "PENDING" },
      { order: 4, m: 0, status: "PAID" },
      { order: 7, m: 0, status: "PAID" },
      { order: 7, m: 1, status: "PAID" },
      { order: 7, m: 2, status: "PAID" },
      { order: 8, m: 0, status: "PENDING" },
      { order: 6, m: 0, status: "FAILED" },
      { order: 0, m: 0, status: "FAILED" },
    ].map((p, i) => ({
      id: "PAY-" + (200 + i),
      orderId: orders[p.order].id,
      amount:
        Math.round(
          pricing(orders[p.order].lines).total * [0.3, 0.4, 0.3][p.m] * 1000,
        ) / 1000,
      milestone: p.m,
      status: p.status,
      method: "KNET تجريبي",
      at: "2026-10-22T12:00:00Z",
      receipt: "RC-" + (200 + i),
    })),
    notifications: Array.from({ length: 20 }, (_, i) => ({
      id: "n" + i,
      userId: "customer",
      title: [
        "حياك الله في مناسبتك",
        "عرض جديد بانتظار المراجعة",
        "تم تأكيد خدمة من المورد",
        "تذكير بموعد مناسبتك",
      ][i % 4],
      read: i > 4,
      to: "/dashboard",
      at: "2026-10-23T09:00:00Z",
    })),
    audit: Array.from({ length: 30 }, (_, i) => ({
      id: "a" + i,
      actor: "أمل محمد",
      action: ["مراجعة طلب", "تأكيد مورد", "اعتماد عرض", "حفظ إعدادات"][i % 4],
      entity: orders[i % 12].id,
      before: "مسودة",
      after: "تمت المراجعة",
      reason: "بيانات العرض التجريبي",
      at: "2026-10-22T10:" + String(i).padStart(2, "0") + ":00Z",
    })),
    tickets: [],
    users: [
      {
        id: "staff",
        name: "ريم — منسقة المناسبات",
        email: "staff@demo.kw",
        role: "staff",
        active: true,
        mfa: true,
      },
      {
        id: "admin",
        name: "أمل محمد",
        email: "admin@demo.kw",
        role: "admin",
        active: true,
        mfa: true,
      },
    ],
    settings: {
      brand: "هَبّ السعد",
      threshold: 20,
      deposit: 30,
      second: 40,
      cancellation:
        "قبل 60 يومًا: استرداد 90%، قبل 30 يومًا: 50%، أقل من 30 يومًا: لا استرداد.",
      doubleApproval: true,
      earlyPayment: false,
      locale: "ar",
    },
    offline: false,
  };
  for (const order of state.orders)
    order.paid = state.payments
      .filter((p) => p.orderId === order.id && p.status === "PAID")
      .reduce((n, p) => n + p.amount, 0);
  return state;
}
export function current(s) {
  return s.orders.find((o) => o.id === s.activeOrder);
}
export function dispatch(state, action, p = {}) {
  const s = structuredClone(state),
    role = s.session?.role,
    at = new Date().toISOString(),
    actor = s.session?.name || "زائر";
  let o = s.orders.find((x) => x.id === (p.id || s.activeOrder));
  const requireRole = (...roles) => {
    if (!roles.includes(role))
      throw Error("ليس لديك صلاحية لتنفيذ هذا الإجراء");
  };
  const log = (
    action,
    entity,
    before,
    after,
    reason = p.reason || "إجراء تجريبي موثّق",
  ) =>
    s.audit.unshift({
      id: crypto.randomUUID(),
      actor,
      action,
      entity,
      before,
      after,
      reason,
      at,
    });
  const notify = (title, to = "/dashboard") =>
    s.notifications.unshift({
      id: crypto.randomUUID(),
      userId: o?.customerId || s.session?.id || "guest",
      title,
      to,
      at,
      read: false,
    });
  const transition = (status) => {
    const old = o.status;
    if (old !== status && !bookingMachine[old]?.includes(status))
      throw Error(
        "الانتقال من " +
          (labels[old] || old) +
          " إلى " +
          (labels[status] || status) +
          " غير متاح",
      );
    o.status = status;
    o.timeline.push({ status, at });
    log(action, o.id, old, status);
  };
  const unlocked = () => {
    if (o?.contract?.status === "SIGNED")
      throw Error("العقد موقع، يجب إنشاء ملحق تعديل مستقل");
  };
  const signed = () => {
    if (!o?.contract || o.contract.status !== "SIGNED")
      throw Error("يجب توقيع العقد قبل الدفع");
  };
  switch (action) {
    case "LOGIN":
      s.session = p;
      break;
    case "LOGOUT":
      s.session = null;
      break;
    case "PROFILE":
      requireRole("customer", "supplier", "admin", "staff");
      s.session = { ...s.session, ...p };
      if (s.accounts) {
        const account = s.accounts.find((x) => x.id === s.session.id);
        if (account) Object.assign(account, p);
      }
      break;
    case "PLANNER":
      s.planner = { ...s.planner, ...p };
      break;
    case "FAVORITE":
      s.favorites = s.favorites.includes(p.id)
        ? s.favorites.filter((x) => x !== p.id)
        : [...s.favorites, p.id];
      break;
    case "CART_ADD": {
      if (!s.services.find((x) => x.id === p.id))
        throw Error("الخدمة غير موجودة");
      let l = s.cart.find((x) => x.id === p.id);
      if (l) l.qty += p.qty || 1;
      else
        s.cart.push({
          ...s.services.find((x) => x.id === p.id),
          qty: p.qty || 1,
          option: p.option || "الأساسية",
          response: "WAITING",
        });
      break;
    }
    case "CART_PACKAGE": {
      const pack = s.packages.find((x) => x.id === p.id);
      if (!pack?.serviceIds?.length)
        throw Error("هذه الباقة لا تحتوي خدمات محددة بعد");
      const selected = pack.serviceIds.map((id) =>
        s.services.find((x) => x.id === id),
      );
      if (selected.some((x) => !x))
        throw Error("تحتاج الباقة تحديث خدماتها من الإدارة");
      const base = selected.reduce((n, x) => n + x.price, 0),
        target = (pack.price * (p.guests || pack.capacity)) / pack.capacity;
      let allocated = 0;
      selected.forEach((x, i) => {
        const price =
          i === selected.length - 1
            ? Math.round((target - allocated) * 1000) / 1000
            : Math.round((x.price / base) * target * 1000) / 1000;
        allocated += price;
        s.cart.push({
          ...x,
          id: pack.id + ":" + crypto.randomUUID() + ":" + x.id,
          title: x.title + " — " + pack.title,
          price,
          qty: p.qty || 1,
          option: p.option || "الأساسية",
          response: "WAITING",
        });
      });
      break;
    }
    case "CART_REMOVE":
      s.lastRemoved = s.cart.find((x) => x.id === p.id);
      s.cart = s.cart.filter((x) => x.id !== p.id);
      break;
    case "CART_UNDO":
      if (s.lastRemoved) s.cart.push(s.lastRemoved);
      s.lastRemoved = null;
      break;
    case "CART_QTY":
      s.cart = s.cart.map((x) =>
        x.id === p.id ? { ...x, qty: Math.max(1, p.qty) } : x,
      );
      break;
    case "COUPON":
      if (p.code !== "MONASABATI10")
        throw Error("الكود غير صالح. جرّب MONASABATI10");
      s.coupon = 10;
      break;
    case "SUBMIT": {
      requireRole("customer");
      if (!s.cart.length) throw Error("أضف خدمة واحدة على الأقل");
      if (!s.planner.date || !s.planner.location)
        throw Error("أكمل تاريخ وموقع المناسبة");
      let id = "MN-" + (1088 + s.orders.length - 12);
      const lines = structuredClone(s.cart);
      const order = {
        id,
        customerId: s.session.id,
        customer: s.session.name,
        occasion: structuredClone(s.planner),
        lines,
        status: "REQUESTED",
        discount: s.coupon ? pricing(lines).total * 0.1 : 0,
        version: 1,
        createdAt: at,
        timeline: [{ status: "REQUESTED", at }],
        notes: [],
        approvals: [],
        contract: null,
        execution: "CONFIRMED",
        tasks: [false, false, false],
        paid: 0,
      };
      s.orders.unshift(order);
      s.activeOrder = id;
      s.cart = [];
      s.coupon = 0;
      notify("استلمنا طلبك " + id, "/bookings/" + id);
      log("إرسال طلب", id, null, "REQUESTED");
      break;
    }
    case "SELECT_ORDER":
      s.activeOrder = p.id;
      break;
    case "REVIEW":
      requireRole("staff", "admin");
      unlocked();
      if (o.status === "REQUESTED") transition("INTERNAL_REVIEW");
      transition("SUPPLIER_CONFIRMATION");
      break;
    case "SUPPLIER_RESPONSE": {
      requireRole("supplier", "admin", "staff");
      unlocked();
      if (["REQUESTED", "INTERNAL_REVIEW"].includes(o.status)) {
        if (o.status === "REQUESTED") transition("INTERNAL_REVIEW");
        transition("SUPPLIER_CONFIRMATION");
      }
      let line = o.lines.find((l) => l.id === p.lineId);
      if (role === "supplier" && line.supplierId !== s.session.supplierId)
        throw Error("هذا الطلب مخصص لمورد آخر");
      if (!p.reason && p.response === "REJECTED")
        throw Error("يرجى ذكر سبب عدم التوفر والبديل");
      let before = line.response;
      o.approvals = [];
      o.ownerApproved = false;
      o.contract = null;
      o.quoteSnapshot = null;
      line.response = p.response;
      if (p.cost !== undefined) {
        if (!Number.isFinite(Number(p.cost)) || Number(p.cost) < 0)
          throw Error("تكلفة المورد غير صحيحة");
        line.cost = Number(p.cost);
      }
      if (p.leadTime) line.leadTime = p.leadTime;
      line.alternative = p.reason || "";
      log("رد المورد", o.id, before, line.response);
      if (
        o.lines.every(
          (l) => l.response === "CONFIRMED_SUPPLIER" && l.cost !== null,
        )
      )
        transition("QUOTE_READY");
      else if (p.response === "REJECTED") transition("SUPPLIER_UNAVAILABLE");
      notify("تم تحديث توفر خدمة في طلبك " + o.id, "/bookings/" + o.id);
      break;
    }
    case "ALTERNATIVE":
      requireRole("admin", "staff");
      unlocked();
      {
        let l = o.lines.find((l) => l.id === p.lineId);
        l.response = "CONFIRMED_SUPPLIER";
        l.alternative = "تم اعتماد المورد البديل";
        log("اختيار مورد بديل", o.id, "REJECTED", "CONFIRMED_SUPPLIER");
        if (
          o.lines.every(
            (l) => l.response === "CONFIRMED_SUPPLIER" && l.cost !== null,
          )
        )
          transition("QUOTE_READY");
        break;
      }
    case "PRICE":
      requireRole("admin", "staff");
      if (o.contract?.status === "SIGNED")
        throw Error("العقد موقع، أنشئ ملحق تعديل");
      {
        const before = pricing(o.lines, o.discount);
        if (p.lines) {
          if (
            p.lines.some(
              (l) =>
                !Number.isFinite(l.price) ||
                l.price <= 0 ||
                l.qty < 1 ||
                (l.cost !== null && (!Number.isFinite(l.cost) || l.cost < 0)),
            )
          )
            throw Error("قيم التسعير غير صحيحة");
          o.lines = p.lines;
        }
        o.contract = null;
        o.quoteSnapshot = null;
        if (p.discount !== undefined) {
          if (
            Number(p.discount) < 0 ||
            Number(p.discount) > pricing(o.lines).subtotal
          )
            throw Error("الخصم خارج الحدود المسموحة");
          o.discount = Number(p.discount);
        }
        o.approvals = [];
        o.version++;
        const x = pricing(o.lines, o.discount);
        o.ownerApproved = false;
        if (x.margin !== null && x.margin < s.settings.threshold)
          transition("NEEDS_OWNER_APPROVAL");
        else transition("QUOTE_READY");
        log("تحديث التسعير", o.id, before, x);
        break;
      }
    case "APPROVE_INTERNAL":
      requireRole("admin", "staff");
      unlocked();
      if (!p.reason?.trim()) throw Error("سبب الاعتماد مطلوب");
      if (o.approvals.some((a) => a.actorId === s.session.id))
        throw Error("لا يمكن اعتماد المرحلتين من المستخدم نفسه");
      o.approvals.push({ actorId: s.session.id, role, at, reason: p.reason });
      if (role === "admin") o.ownerApproved = true;
      log("اعتماد داخلي", o.id, "بانتظار الاعتماد", o.approvals);
      break;
    case "PUBLISH":
      requireRole("admin", "staff");
      unlocked();
      {
        const x = pricing(o.lines, o.discount);
        if (
          !o.lines.every((l) => l.response === "CONFIRMED_SUPPLIER") ||
          x.cost === null
        )
          throw Error("يجب تأكيد جميع الموردين والتكاليف أولًا");
        if (x.margin < s.settings.threshold && !o.ownerApproved)
          throw Error("الهامش أقل من الحد، يلزم اعتماد المالك");
        if (
          s.settings.doubleApproval &&
          !o.approvals.some((a) => a.role === "staff")
        )
          throw Error("تحتاج مراجعة موظف مستقل أولًا");
        if (!o.ownerApproved) throw Error("يلزم اعتماد المالك");
        o.validUntil = new Date(Date.now() + 7 * 86400000).toISOString();
        o.quoteSnapshot = structuredClone(o.lines);
        transition("CUSTOMER_REVIEW");
        notify("عرض السعر جاهز لمراجعتك", "/quote/" + o.id);
        break;
      }
    case "QUOTE_ACCEPT":
      requireRole("customer");
      if (o.customerId !== s.session.id) throw Error("الطلب لا يخص هذا الحساب");
      if (o.validUntil && new Date(o.validUntil) < new Date())
        throw Error("انتهت صلاحية العرض، اطلب تجديده");
      if (o.status !== "CUSTOMER_REVIEW")
        throw Error("العرض غير جاهز للموافقة");
      transition("CONTRACT_PENDING");
      o.contract = {
        version: o.version,
        status: "APPROVED",
        snapshot: structuredClone(o.quoteSnapshot || o.lines),
        total: pricing(o.lines, o.discount).total,
        signature: "",
        paymentSchedule: [
          s.settings.deposit,
          s.settings.second,
          100 - s.settings.deposit - s.settings.second,
        ],
        clauses: s.settings.cancellation,
      };
      transition("CONTRACT_APPROVED");
      break;
    case "CHANGES":
      requireRole("customer");
      if (!p.reason?.trim()) throw Error("يرجى كتابة تفاصيل التعديل");
      if (o.contract?.status === "SIGNED") {
        o.amendment = {
          id: "AM-" + Date.now(),
          status: "REQUESTED",
          reason: p.reason,
          lines: [],
          paid: 0,
        };
        log("طلب ملحق تعديل", o.id, null, o.amendment);
        notify("تم استلام طلب تعديل حجزك", "/bookings/" + o.id);
      } else {
        transition("NEEDS_CHANGES");
        o.notes.push({ text: p.reason, at, actor });
      }
      break;
    case "AMENDMENT_CREATE":
      requireRole("admin", "staff");
      if (!o.amendment) throw Error("لا يوجد طلب تعديل");
      o.amendment.lines = [
        {
          ...s.services.find((x) => x.id === p.serviceId),
          qty: 1,
          response: "WAITING",
        },
      ];
      o.amendment.status = "SUPPLIER_CONFIRMATION";
      log("إنشاء عرض ملحق", o.id, null, o.amendment);
      break;
    case "AMENDMENT_CONFIRM":
      requireRole("supplier", "admin");
      if (
        role === "supplier" &&
        o.amendment.lines[0].supplierId !== s.session.supplierId
      )
        throw Error("المورد غير مخوّل");
      o.amendment.lines[0].response = "CONFIRMED_SUPPLIER";
      o.amendment.status = "CUSTOMER_REVIEW";
      log("تأكيد ملحق", o.id, "WAITING", "CUSTOMER_REVIEW");
      break;
    case "AMENDMENT_ACCEPT":
      requireRole("customer");
      if (o.amendment?.status !== "CUSTOMER_REVIEW")
        throw Error("الملحق غير جاهز");
      o.amendment.status = "SIGNED";
      o.amendment.signature = actor;
      o.timeline.push({ status: "تم توقيع ملحق إضافة خدمة", at });
      break;
    case "SIGN":
      requireRole("customer");
      if (o.contract?.status !== "APPROVED")
        throw Error("العقد غير جاهز للتوقيع");
      if (!p.consent || !p.signature?.trim())
        throw Error("يلزم الموافقة على الشروط وإدخال التوقيع");
      o.contract.status = "SIGNED";
      o.contract.signature = p.signature;
      o.contract.signatureImage = p.image || null;
      o.contract.signedAt = at;
      o.contract.metadata = "DEMO-IP 192.0.2.1";
      transition("SIGNED");
      notify("تم توقيع العقد بنجاح", "/checkout/" + o.id);
      break;
    case "PAY": {
      requireRole("customer");
      signed();
      s.activeOrder = o.id;
      if (o.customerId !== s.session.id) throw Error("الطلب غير مخوّل");
      const milestone = Number(p.milestone || 0);
      if (![0, 1, 2].includes(milestone)) throw Error("مرحلة دفع غير صحيحة");
      const amounts = o.contract.paymentSchedule || [
        s.settings.deposit,
        s.settings.second,
        100 - s.settings.deposit - s.settings.second,
      ];
      const total =
        o.contract.total || pricing(o.contract.snapshot, o.discount).total;
      const prior = s.payments.filter(
        (x) => x.orderId === o.id && x.status === "PAID" && !x.amendment,
      );
      if (
        s.payments.some(
          (x) =>
            x.orderId === o.id &&
            x.status === "PENDING" &&
            x.milestone === milestone &&
            !!x.amendment === !!p.amendment,
        )
      )
        throw Error("توجد عملية معلقة لنفس الدفعة. أكّد إشعار البوابة أولًا");
      if (!p.amendment && prior.some((x) => x.milestone === milestone))
        throw Error("هذه الدفعة مسددة بالفعل");
      if (!p.amendment && !s.settings.earlyPayment && milestone > 0) {
        const due =
          new Date(o.occasion.date).getTime() -
          (milestone === 1 ? 30 : 7) * 86400000;
        if (Date.now() < due) throw Error("هذه الدفعة غير مستحقة بعد");
        if (!prior.some((x) => x.milestone === milestone - 1))
          throw Error("يجب دفع الدفعة السابقة أولًا");
      }
      if (p.amendment && o.amendment?.status !== "SIGNED")
        throw Error("يجب اعتماد الملحق");
      let status =
        p.scenario === "decline"
          ? "FAILED"
          : p.scenario === "pending"
            ? "PENDING"
            : "PAID";
      const pay = {
        id: "PAY-" + Date.now(),
        orderId: o.id,
        amount: p.amendment
          ? pricing(o.amendment.lines).total
          : Math.round(((total * amounts[milestone]) / 100) * 1000) / 1000,
        milestone,
        status,
        method: p.method || "KNET تجريبي",
        at,
        receipt: "RC-" + Date.now(),
        history: [
          { status: "PROCESSING", at },
          { status, at },
        ],
        amendment: !!p.amendment,
      };
      s.payments.unshift(pay);
      s.lastPayment = pay.id;
      if (status === "PAID") {
        if (p.amendment) {
          o.amendment.paid = pay.amount;
          o.amendment.status = "CONFIRMED";
          o.timeline.push({ status: "تم دفع فرق الملحق", at });
        } else {
          o.paid += pay.amount;
          if (!["PREPARATION", "IN_PROGRESS", "COMPLETED"].includes(o.status))
            transition("CONFIRMED");
        }
        notify(
          "تم استلام دفعة " + money(pay.amount) + " د.ك",
          "/bookings/" + o.id,
        );
      } else if (status === "FAILED") {
        if (o.paid === 0) transition("PAYMENT_FAILED");
        notify("تعذر الدفع، يمكنك المحاولة مجددًا", "/checkout/" + o.id);
      } else if (o.paid === 0) transition("PAYMENT_PENDING");
      log("محاكاة دفع", pay.id, null, pay);
      break;
    }
    case "WEBHOOK": {
      requireRole("admin", "customer");
      const pay = s.payments.find((x) => x.id === p.paymentId);
      if (!pay || pay.status !== "PENDING") throw Error("العملية ليست معلقة");
      o = s.orders.find((x) => x.id === pay.orderId);
      if (role === "customer" && o.customerId !== s.session.id)
        throw Error("غير مخول");
      pay.status = "PAID";
      if (pay.amendment) {
        o.amendment.status = "CONFIRMED";
        o.amendment.paid = pay.amount;
      } else {
        o.paid += pay.amount;
        if (!["PREPARATION", "IN_PROGRESS", "COMPLETED"].includes(o.status))
          transition("CONFIRMED");
      }
      notify("تم تأكيد التحويل وإصدار الإيصال");
      log("تأكيد webhook", pay.id, "PENDING", "PAID");
      break;
    }
    case "REFUND": {
      requireRole("admin");
      const pay = s.payments.find((x) => x.id === p.paymentId);
      if (!pay || pay.status !== "PAID")
        throw Error("العملية غير قابلة للاسترداد");
      const amount = Number(p.amount);
      if (amount <= 0 || amount > pay.amount - (pay.refunded || 0) || !p.reason)
        throw Error("تحقق من مبلغ الاسترداد والسبب");
      pay.refundStatus = "REFUND_PENDING";
      pay.refundAmount = amount;
      pay.refundReason = p.reason;
      log("طلب استرداد", pay.id, "PAID", "REFUND_PENDING");
      break;
    }
    case "REFUND_SETTLE":
      requireRole("admin");
      {
        const pay = s.payments.find((x) => x.id === p.paymentId);
        if (pay?.refundStatus !== "REFUND_PENDING")
          throw Error("لا يوجد استرداد معلق");
        pay.refunded = (pay.refunded || 0) + pay.refundAmount;
        pay.refundStatus = "REFUNDED";
        if (pay.refunded === pay.amount) pay.status = "REFUNDED";
        o = s.orders.find((x) => x.id === pay.orderId);
        if (pay.amendment) {
          o.amendment.paid = Math.max(0, o.amendment.paid - pay.refundAmount);
          if (o.amendment.paid === 0) o.amendment.status = "REFUNDED";
          o.timeline.push({ status: "تم استرداد مبلغ من ملحق التعديل", at });
        } else {
          o.paid = Math.max(0, o.paid - pay.refundAmount);
        }
        notify("تم إصدار إشعار دائن بقيمة " + money(pay.refundAmount) + " د.ك");
        log("تسوية استرداد", pay.id, "REFUND_PENDING", "REFUNDED");
        break;
      }
    case "CANCEL":
      requireRole("customer");
      if (!p.reason) throw Error("سبب الإلغاء مطلوب");
      o.cancellation = { reason: p.reason, at };
      transition("DISPUTED");
      break;
    case "CANCEL_APPROVE":
      requireRole("admin");
      if (!p.reason) throw Error("سبب الاعتماد مطلوب");
      transition("CANCELLED");
      notify("تم اعتماد طلب الإلغاء");
      break;
    case "EXECUTION":
      requireRole("supplier", "admin", "staff");
      const executionLines = [...o.lines,...(o.amendmentHistory || []).flatMap(a=>a.lines || []),...(o.amendment?.status === "CONFIRMED" ? o.amendment.lines : [])];
      if (
        role === "supplier" &&
        !executionLines.some((l) => l.supplierId === s.session.supplierId)
      )
        throw Error("غير مخول");
      if (
        ![
          "CONFIRMED",
          "PREPARATION",
          "IN_PROGRESS",
          "COMPLETED",
          "DISPUTED",
        ].includes(o.status)
      )
        throw Error("لا يبدأ التنفيذ قبل تأكيد الحجز والدفع");
      for (const l of executionLines)
        if (role !== "supplier" || l.supplierId === s.session.supplierId)
          l.execution = p.status;
      const states = executionLines.map((l) => l.execution || "CONFIRMED");
      o.execution = states.includes("Issue")
        ? "Issue"
        : states.every((x) => x === "Completed")
          ? "Completed"
          : states.some((x) =>
                ["On the way", "Delivered", "Completed"].includes(x),
              )
            ? "On the way"
            : states.some((x) => x === "Preparing")
              ? "Preparing"
              : "CONFIRMED";
      transition(
        {
          Preparing: "PREPARATION",
          "On the way": "IN_PROGRESS",
          Delivered: "IN_PROGRESS",
          Completed: "COMPLETED",
          Issue: "DISPUTED",
          CONFIRMED: "CONFIRMED",
        }[o.execution],
      );
      break;
    case "TASK":
      requireRole("admin", "staff");
      o.tasks[p.index] = !o.tasks[p.index];
      log("تحديث مهمة", o.id, !o.tasks[p.index], o.tasks[p.index]);
      break;
    case "NOTE":
      requireRole("admin", "staff");
      if (p.text.trim()) {
        o.notes.push({ actor, text: p.text, at });
        log("ملاحظة داخلية", o.id, null, p.text);
      }
      break;
    case "CATEGORY_SAVE": {
      requireRole("admin");
      if (!p.name?.trim()) throw Error("اسم الفئة مطلوب");
      s.categories ||= [...categories];
      if (s.categories.includes(p.name) && p.oldName !== p.name)
        throw Error("الفئة موجودة بالفعل");
      if (p.oldName) {
        s.categories = s.categories.map((c) => (c === p.oldName ? p.name : c));
        s.services = s.services.map((x) =>
          x.category === p.oldName ? { ...x, category: p.name } : x,
        );
      } else s.categories.push(p.name);
      log("حفظ فئة", p.name, p.oldName || null, p.name);
      break;
    }
    case "CATEGORY_DELETE": {
      requireRole("admin");
      if (s.services.some((x) => x.category === p.name))
        throw Error("انقل الخدمات المرتبطة إلى فئة أخرى قبل حذف الفئة");
      s.categories = (s.categories || categories).filter((c) => c !== p.name);
      log("حذف فئة", p.name, p.name, null);
      break;
    }
    case "CATALOG_SAVE":
    case "PACKAGE_SAVE":
      requireRole("admin");
      {
        const list = action === "CATALOG_SAVE" ? s.services : s.packages;
        let old = list.find((x) => x.id === p.id);
        if (!p.title?.trim() || Number(p.price) <= 0)
          throw Error("الاسم والسعر الصحيح مطلوبان");
        if (old) Object.assign(old, p);
        else
          list.push({
            ...p,
            id: crypto.randomUUID(),
            image: p.image || "flowers",
            rating: 4.9,
            reviews: 0,
            available: true,
            serviceIds: [],
            capacity: 100,
          });
        log(action, p.id || p.title, old || null, p);
        break;
      }
    case "CATALOG_DELETE":
    case "PACKAGE_DELETE":
      requireRole("admin");
      {
        const key = action === "CATALOG_DELETE" ? "services" : "packages";
        s[key] = s[key].filter((x) => x.id !== p.id);
        log(action, p.id, "active", "deleted");
        break;
      }
    case "SUPPLIER_SAVE":
      requireRole("admin");
      {
        let v = s.suppliers.find((x) => x.id === p.id);
        if (v) Object.assign(v, p);
        else
          s.suppliers.push({
            ...p,
            id: crypto.randomUUID(),
            rating: 4.8,
            response: 100,
            reliability: 100,
          });
        log("تحديث مورد", p.id, null, p);
        break;
      }
    case "USER_SAVE":
      requireRole("admin");
      {
        let u = s.users.find((x) => x.id === p.id);
        if (u) Object.assign(u, p);
        else
          s.users.push({
            ...p,
            id: crypto.randomUUID(),
            active: true,
            mfa: false,
          });
        log("تحديث مستخدم", p.id, null, p);
        break;
      }
    case "SETTINGS":
      requireRole("admin");
      if (p.deposit < 1 || p.second < 0 || p.threshold < 0 || p.threshold > 100)
        throw Error("قيم الإعدادات غير صحيحة");
      if (p.deposit + p.second > 100)
        throw Error("مجموع نسب الدفعات يتجاوز 100%");
      log("حفظ الإعدادات", "settings", s.settings, p);
      s.settings = { ...s.settings, ...p };
      break;
    case "TICKET":
      if (!p.message?.trim()) throw Error("يرجى كتابة رسالتك");
      s.tickets.unshift({
        id: "T-" + Date.now(),
        userId: s.session?.id || "guest",
        name: s.session?.name || p.name || "زائر",
        message: p.message,
        status: "OPEN",
        at,
      });
      notify("تم استلام رسالتك، المنسق يتابعها", "/support");
      break;
    case "TICKET_REPLY":
      requireRole("admin", "staff");
      {
        let t = s.tickets.find((x) => x.id === p.id);
        t.reply = p.reply;
        t.status = "RESOLVED";
        notify("تم الرد على تذكرتك", "/support");
        break;
      }
    case "FEEDBACK":
      requireRole("customer");
      o.feedback = p;
      log("تقييم المناسبة", o.id, null, p);
      break;
    case "ATTACH":
      requireRole("supplier", "admin", "staff");
      o.attachments = [
        ...(o.attachments || []),
        { name: p.name, size: p.size, actor, at },
      ];
      log("إرفاق مستند", o.id, null, p.name);
      break;
    case "READ":
      s.notifications = s.notifications.map((n) =>
        n.userId === s.session?.id ? { ...n, read: true } : n,
      );
      break;
    case "OFFLINE":
      s.offline = !s.offline;
      break;
    case "EXPIRE":
      requireRole("admin");
      unlocked();
      o.validUntil = "2020-01-01";
      transition("EXPIRED");
      break;
    case "RENEW":
      requireRole("admin", "staff", "customer");
      if (role === "customer") {
        transition("NEEDS_CHANGES");
        notify("تم إرسال طلب تجديد العرض");
      } else {
        o.validUntil = new Date(Date.now() + 7 * 86400000).toISOString();
        transition("CUSTOMER_REVIEW");
      }
      break;
    default:
      throw Error("إجراء غير معروف: " + action);
  }
  return s;
}
