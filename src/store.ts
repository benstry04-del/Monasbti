import { useSyncExternalStore } from "react";
import { loadingExperience, requestId } from "./experience/loading-controller";
import { createSerialExecutor } from "./services/serial-mutations.mjs";
export const isDemo = import.meta.env.MODE === "demo";
const initialState: any = {
  version: 3,
  session: null,
  services: [],
  packages: [],
  suppliers: [],
  cart: [],
  favorites: [],
  orders: [],
  payments: [],
  notifications: [],
  audit: [],
  tickets: [],
  users: [],
  accounts: [],
  categories: ["جميع الخدمات"],
  activeOrder: null,
  settings: { brand: "هَبّ السعد", deposit: 30, second: 40, threshold: 20 },
  planner: {
    step: 0,
    type: "حفل زفاف",
    date: "",
    location: "",
    guests: 1,
    budget: 0,
    notes: "",
  },
  runtime: { mode: "real", ready: false, error: "" },
};
let state = initialState;
const authChangeKey = "habb:auth-change";
let csrf = "",
  pending: Promise<any> | null = null;
let transportEpoch = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());
let demo: any = null;
if (isDemo) demo = await import("./demo-store");
async function request(path: string, body?: any, options: any = {}) {
  const startedAt = transportEpoch;
  const key = options.key || requestId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch("/api" + path, {
      method: body !== undefined ? "POST" : "GET",
      credentials: "same-origin",
      headers: {
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        "X-CSRF-Token": csrf,
        "X-App-Route": location.pathname,
        "Idempotency-Key": key,
        "X-Idempotency-Key": key,
        ...options.headers,
      },
      ...(body !== undefined
        ? { body: body instanceof FormData ? body : JSON.stringify(body) }
        : {}),
      signal: controller.signal,
    });
    const data = await response
      .json()
      .catch(() => ({ message: "تعذر قراءة استجابة الخادم" }));
    if (!response.ok)
      throw Object.assign(
        Error(data.message || data.error?.message || "تعذر إتمام الطلب"),
        { status: response.status, code: data.code || data.error?.code },
      );
    if (body !== undefined) transportEpoch++;
    if (data.csrfToken && (body !== undefined || startedAt === transportEpoch))
      csrf = data.csrfToken;
    return data;
  } finally {
    clearTimeout(timer);
  }
}
function clearAccountData(session = null) {
  state = { ...initialState, settings: state.settings, runtime: state.runtime, session };
}
function notifyAuthChange() {
  try { localStorage.setItem(authChangeKey, requestId()); } catch {}
}
async function refresh(force = false) {
  if (force && pending) await pending.catch(() => {});
  if (pending) return pending;
  const startedAt = transportEpoch, route=location.pathname;
  pending = (async () => {
    let session: any;
    try {
      ({ user: session } = await request("/auth/session"));
      const data = await request("/state?route="+encodeURIComponent(route));
      if (startedAt !== transportEpoch || route!==location.pathname) return state;
      state = {
        ...(data.state || data),
        runtime: { mode: "real", ready: true, error: "", route, refreshedAt: Date.now() },
      };
      emit();
      return state;
    } catch (e: any) {
      if (startedAt !== transportEpoch || route!==location.pathname) return state;
      if (session !== undefined && session?.id !== state.session?.id) clearAccountData(session);
      state = {
        ...state,
        runtime: { mode: "real", ready: true, error: e.message },
      };
      emit();
      throw e;
    } finally {
      pending = null;
    }
  })();
  return pending;
}
const realApi: any = {
  reportSummary(params:any){return request('/report-summary?'+new URLSearchParams(params));},
  calendar(month:string){return request('/calendar?month='+month);},
  records(kind:string,params:any={}){return request('/records/'+kind+'?'+new URLSearchParams(Object.entries(params).filter(([,v])=>v!==undefined && v!==null).map(([k,v])=>[k,String(v)])));},
  adminIntegrations(){return request('/admin/integrations');},
  deliveries(page=1,status=''){return request('/notification-deliveries?page='+page+'&status='+encodeURIComponent(status));},
  integrationAction(id:string,action:string,payload:any){return request('/admin/integrations/'+encodeURIComponent(id)+'/'+action,payload);},
  settlements(page=1) { return request('/settlements?page='+page); },
  settlementEligibility() { return request('/settlements/eligible'); },
  async settlementAction(path:string,payload:any={}) { return request('/settlements'+path,payload); },
  get: () => state,
  refresh,
  availability(date: string) {
    return loadingExperience.run({ context: "venues" }, () =>
      request("/availability/batch?date=" + encodeURIComponent(date)),
    );
  },
  async send(action: string, payload: any = {}) {
    if(action==='SIGN' && (state.settings.signatureMode==='bridge' || state.orders.find((o:any)=>o.id===payload.id)?.externalSignature)){
      const created=await request('/signatures',{bookingId:payload.id,consent:payload.consent,signature:payload.signature});
      for(let i=0;i<15;i++){
        const current=await request('/signatures/'+created.id);
        if(current.status==='COMPLETED')return refresh(true);
        if(current.signingURL){location.assign(current.signingURL);return new Promise(()=>{});}
        if(['DECLINED','EXPIRED','MANUAL_REVIEW'].includes(current.status))throw Error('طلب التوقيع يحتاج مراجعة الفريق أو إعادة إصدار العقد');
        await new Promise(resolve=>setTimeout(resolve,2000));
      }
      throw Error('جارٍ تجهيز رابط جهة التوقيع؛ تابع من صفحة العقد بعد قليل');
    }
    if (action === "PAYMENT_REFRESH") {
      await request("/payments/" + payload.paymentId + "/refresh", {});
      return refresh(true);
    }
    if (action === "REFUND_REFRESH") return refresh(true);
    if (action === "LOGOUT") {
      try {
        await request("/auth/logout", {});
      } catch (error: any) {
        if (error.code !== "CSRF_REJECTED") throw error;
        await request("/auth/session");
        await request("/auth/logout", {});
      }
      clearAccountData();
      emit();
      notifyAuthChange();
      return state;
    }
    if (
      ["LOGIN", "OFFLINE", "EXPIRE", "WEBHOOK", "REFUND_SETTLE"].includes(
        action,
      )
    )
      throw Error("هذه المحاكاة غير متاحة في النظام الفعلي");
    if (action === "PAY") {
      const result = await request("/payments/checkout", {
        bookingId: payload.id,
        milestone: payload.milestone,
        amendment: payload.amendment,
        method: payload.method,
      });
      if (result.paymentURL) location.assign(result.paymentURL);
      else {
        await refresh(true);
        throw Error("عملية الدفع محفوظة وتحتاج التحقق من المزود. لم يتم تأكيد الدفع؛ تابع حالتها قبل المحاولة مجددًا.");
      }
      return state;
    }
    if (action === "REFUND") {
      await request("/payments/" + payload.paymentId + "/refunds", {
        amount: payload.amount,
        reason: payload.reason,
      });
      return refresh(true);
    }
    if (action === "USER_SAVE" && !payload.id) {
      await request("/auth/invite", payload);
      return refresh(true);
    }
    return loadingExperience.run(
      {
        context: loadingExperience.contextForAction(
          action,
          payload,
          state.services,
        ),
      },
      async () => {
        const data = await request("/commands", { action, payload });
        state = {
          ...(data.state || data),
          runtime: { mode: "real", ready: true, error: "", refreshedAt: Date.now() },
        };
        emit();
        return state;
      },
    );
  },
  async authenticate(email: string, password: string) {
    const result = await request("/auth/login", { email, password });
    notifyAuthChange();
    await refresh(true).catch(() => {});
    return result;
  },
  async register(profile: any, password: string) {
    return request("/auth/register", {
      name: profile.name,
      email: profile.email,
      mobile: profile.mobile,
      password,
      location: profile.location,
    });
  },
  async verify(email: string, code: string) {
    const result = await request("/auth/verify", { email, code });
    notifyAuthChange();
    await refresh(true).catch(() => {});
    return result;
  },
  async resend(email: string) {
    return request("/auth/resend", { email });
  },
  async forgot(email: string) {
    return request("/auth/forgot-password", { email });
  },
  async resetPassword(token: string, password: string) {
    return request("/auth/reset-password", { token, password });
  },
  async upload(file: File, bookingId: string) {
    const form = new FormData();
    form.append("file", file);
    const result = await request(
      "/files?bookingId=" + encodeURIComponent(bookingId),
      form,
    );
    await refresh(true);
    return result;
  },
  async reconcile(record: string, paymentId: string) {
    await request("/payments/" + encodeURIComponent(record) + "/reconcile", {
      paymentId,
    });
    return refresh(true);
  },
  reset() {
    throw Error("لا يمكن مسح بيانات النظام الفعلي من المتصفح");
  },
};
const executeMutation = createSerialExecutor();
const sendReal = realApi.send;
realApi.send = (action:string,payload:any={}) => executeMutation(()=>sendReal(action,payload));
export const api: any = isDemo ? demo.api : realApi;
export function useStore() {
  const live = useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => state,
  );
  const demoState = isDemo ? demo.useStore() : null;
  return isDemo ? demoState : live;
}
if (!isDemo) {
  refresh().catch(() => {});
  setInterval(() => {
    if (!document.hidden) refresh().catch(() => {});
  }, 15000);
  addEventListener("popstate",()=>refresh(true).catch(()=>{}));
  addEventListener("online", () => refresh().catch(() => {}));
  addEventListener("storage", event => {
    if (event.key === authChangeKey) refresh(true).catch(() => {});
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh(true).catch(() => {});
  });
}

