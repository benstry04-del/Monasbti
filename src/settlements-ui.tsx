import React, { useEffect, useState, useRef } from "react";
import { api, isDemo } from "./store";
import { Btn, Price, Field, Empty } from "./main";
const names: any = {
  IN_REVIEW: "بانتظار الموافقتين",
  APPROVED: "معتمدة للتحويل",
  SUBMITTING: "جارٍ إرسال التحويل",
  PENDING: "قيد تحقق جهة التحويل",
  SETTLED: "تم التحويل والتحقق",
  FAILED: "رفض نهائي من جهة التحويل",
  CANCELLED: "ملغاة قبل الإرسال",
};
export function Settlements({ session }: any) {
  const [data, setData] = useState<any>(null),
    [eligible, setEligible] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1);
  const operator = ["admin", "staff"].includes(session.role);
  const epoch = useRef(0);
  async function load() {
    const ticket = ++epoch.current;
    setError("");
    try {
      const [d, e] = await Promise.all([
        api.settlements(page),
        operator ? api.settlementEligibility() : Promise.resolve({ items: [] }),
      ]);
      if (ticket !== epoch.current) return;
      setData(d);
      setEligible(e.items);
    } catch (e: any) {
      if (ticket === epoch.current) setError(e.message);
    }
  }
  useEffect(() => {
    if (isDemo) return;
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 15000);
    return () => {
      ++epoch.current;
      clearInterval(timer);
    };
  }, [page, session.id]);
  async function mutate(path: string, payload: any = {}) {
    setBusy(true);
    setError("");
    try {
      await api.settlementAction(path, payload);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (isDemo)
    return <Empty title="التسويات متاحة في النظام الفعلي" to={null} />;
  return (
    <div className="settlements-view">
      <h2>تسويات مستحقات الموردين</h2>
      {error && (
        <div role="alert" className="error">
          <p>{error}</p>
          <Btn onClick={load} disabled={busy}>
            إعادة المحاولة
          </Btn>
        </div>
      )}
      {!data && !error && <p role="status">جارٍ تحميل التسويات…</p>}
      {data && (
        <>
          <div className="kpi-grid">
            <section className="card kpi">
              <span>تحويلات مؤكدة من الجهة</span>
              <Price value={Number(data.totals.settled_minor) / 1000} />
            </section>
            <section className="card kpi">
              <span>قيد الاعتماد والتحويل</span>
              <Price value={Number(data.totals.reserved_minor) / 1000} />
            </section>
          </div>
          {operator && !data.configured && (
            <p className="info">
              جهة التحويل غير مهيأة. يمكن تسجيل المستحقات ومراجعتها؛ لن يُرسل
              تحويل حتى تكتمل تهيئة الجهة المعتمدة.
            </p>
          )}
          {operator && (
            <section className="card">
              <h3>مستحقات الطلبات المكتملة</h3>
              {eligible.length ? (
                eligible.map((e) => (
                  <div className="list-row" key={e.booking_id + e.supplier_id}>
                    <div>
                      <b>{e.supplier_name}</b>
                      <p>{e.booking_id}</p>
                      <small>
                        {e.recipient_ref || "يحتاج مرجع مستفيد في ملف المورد"}
                      </small>
                    </div>
                    <Price value={Number(e.remaining_minor) / 1000} />
                    <Btn
                      disabled={busy || !e.recipient_ref}
                      onClick={() =>
                        mutate("", {
                          bookingId: e.booking_id,
                          supplierId: e.supplier_id,
                        })
                      }
                    >
                      طلب تسوية المستحق
                    </Btn>
                  </div>
                ))
              ) : (
                <p>لا توجد مستحقات مكتملة غير محجوزة للتسوية.</p>
              )}
            </section>
          )}
          {!data.items.length && (
            <Empty title="لا توجد تسويات مسجلة" to={null} />
          )}
          <div className="grid two">
            {data.items.map((r: any) => (
              <section className="card" key={r.id}>
                <h3>{r.snapshot.supplierName}</h3>
                <p>{r.booking_id}</p>
                <p>
                  <strong>{names[r.status]}</strong> ·{" "}
                  <Price value={r.amount} />
                </p>
                <p>
                  مرجع المستفيد: <bdi>{r.recipient_ref}</bdi>
                </p>
                <small>
                  التسوية: <bdi>{r.id}</bdi>
                </small>
                {r.provider_ref && (
                  <p>
                    مرجع جهة التحويل: <bdi>{r.provider_ref}</bdi>
                  </p>
                )}
                <details>
                  <summary>بنود المستحق</summary>
                  {r.snapshot.lines.map((l: any) => (
                    <p key={l.id}>
                      {l.title} · {l.qty} × <Price value={l.costMinor / 1000} />
                    </p>
                  ))}
                </details>
                {operator && (
                  <p>
                    الموافقات:{" "}
                    {r.approvals
                      .map((a: any) =>
                        a.role === "admin" ? "المالك" : "الموظف",
                      )
                      .join("، ") || "لا توجد"}
                  </p>
                )}
                {operator &&
                  r.status === "IN_REVIEW" &&
                  !r.approvals.some((a: any) => a.role === session.role) && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const reason = new FormData(e.currentTarget).get(
                          "reason",
                        );
                        mutate("/" + r.id + "/approve", { reason });
                      }}
                    >
                      <Field label="سبب اعتماد التسوية">
                        <input
                          name="reason"
                          minLength={3}
                          maxLength={1000}
                          required
                        />
                      </Field>
                      <Btn type="submit" disabled={busy}>
                        تسجيل الموافقة المستقلة
                      </Btn>
                    </form>
                  )}
                {session.role === "admin" && r.status === "APPROVED" && (
                  <Btn
                    disabled={busy || !data.configured}
                    onClick={() => mutate("/" + r.id + "/submit")}
                  >
                    إرسال التحويل المعتمد
                  </Btn>
                )}
                {operator && ["SUBMITTING", "PENDING"].includes(r.status) && (
                  <Btn
                    variant="outline"
                    disabled={busy || !data.configured}
                    onClick={() => mutate("/" + r.id + "/refresh")}
                  >
                    التحقق من جهة التحويل
                  </Btn>
                )}
                {session.role === "admin" &&
                  ["IN_REVIEW", "APPROVED"].includes(r.status) && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        mutate("/" + r.id + "/cancel", {
                          reason: new FormData(e.currentTarget).get("reason"),
                        });
                      }}
                    >
                      <Field label="سبب إلغاء التسوية">
                        <input
                          name="reason"
                          minLength={3}
                          required
                          maxLength={1000}
                        />
                      </Field>
                      <Btn type="submit" variant="text" disabled={busy}>
                        إلغاء قبل إرسال التحويل
                      </Btn>
                    </form>
                  )}
              </section>
            ))}
          </div>
          <div className="button-row">
            <Btn
              variant="outline"
              disabled={busy || page === 1}
              onClick={() => setPage(page - 1)}
            >
              الصفحة السابقة
            </Btn>
            <span>الصفحة {page}</span>
            <Btn
              variant="outline"
              disabled={busy || !data.hasMore}
              onClick={() => setPage(page + 1)}
            >
              الصفحة التالية
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}
