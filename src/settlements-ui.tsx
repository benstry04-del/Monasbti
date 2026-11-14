import React, { useEffect, useState, useRef } from "react";
import { api, isDemo } from "./store";
import { Btn, Price, Field, Empty, Badge, StatusAlert } from "./main";
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
        <StatusAlert
          tone="error"
          role="alert"
          action={
            <Btn intent="warn" loading={busy} onClick={load} disabled={busy}>
              إعادة المحاولة
            </Btn>
          }
        >
          {error}
        </StatusAlert>
      )}
      {!data && !error && <StatusAlert tone="in-progress" role="status">جارٍ تحميل التسويات…</StatusAlert>}
      {data && (
        <>
          <div className="grid two">
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
            <StatusAlert tone="warning">
              جهة التحويل غير مهيأة. يمكن تسجيل المستحقات ومراجعتها؛ لن يُرسل
              تحويل حتى تكتمل تهيئة الجهة المعتمدة.
            </StatusAlert>
          )}
          {operator && (
            <section className="card">
              <div className="split-row">
                <h3>مستحقات الطلبات المكتملة</h3>
                <Badge status={eligible.length ? "PENDING" : "INACTIVE"}>{eligible.length} مستحق جاهز</Badge>
              </div>
              {eligible.length ? (
                eligible.map((e) => (
                  <div className="list-row" key={e.booking_id + e.supplier_id}>
                    <div>
                      <b>{e.supplier_name}</b>
                      <p>الطلب: <bdi>{e.booking_id}</bdi></p>
                      <small>
                        {e.recipient_ref || "يحتاج مرجع مستفيد في ملف المورد"}
                      </small>
                    </div>
                    <div className="button-row">
                      <Price value={Number(e.remaining_minor) / 1000} />
                      <Btn
                        intent="primary"
                        loading={busy}
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
                <div className="split-row">
                  <h3>{r.snapshot.supplierName}</h3>
                  <Badge status={r.status}>{names[r.status]}</Badge>
                </div>
                <div className="split-row">
                  <small>الطلب: <bdi>{r.booking_id}</bdi></small>
                  <strong><Price value={r.amount} /></strong>
                </div>
                <div className="nested-flat" style={{ marginTop: 10, marginBottom: 10 }}>
                  <p>
                    مرجع المستفيد: <bdi>{r.recipient_ref}</bdi>
                  </p>
                  <small>
                    رقم التسوية: <bdi>{r.id}</bdi>
                  </small>
                  {r.provider_ref && (
                    <p>
                      مرجع جهة التحويل: <bdi>{r.provider_ref}</bdi>
                    </p>
                  )}
                </div>
                <details>
                  <summary>بنود المستحق ({r.snapshot.lines.length})</summary>
                  {r.snapshot.lines.map((l: any) => (
                    <div className="list-row" key={l.id}>
                      <span>{l.title} · {l.qty}</span>
                      <Price value={l.costMinor / 1000} />
                    </div>
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
                      <Btn type="submit" intent="success" loading={busy} disabled={busy}>
                        تسجيل الموافقة المستقلة
                      </Btn>
                    </form>
                  )}
                {session.role === "admin" && r.status === "APPROVED" && (
                  <Btn
                    intent="success"
                    loading={busy}
                    disabled={busy || !data.configured}
                    onClick={() => mutate("/" + r.id + "/submit")}
                  >
                    إرسال التحويل المعتمد
                  </Btn>
                )}
                {operator && ["SUBMITTING", "PENDING"].includes(r.status) && (
                  <Btn
                    variant="outline"
                    intent="info"
                    loading={busy}
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
                      <Btn type="submit" variant="text" intent="danger" loading={busy} disabled={busy}>
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
              intent="info"
              disabled={busy || page === 1}
              onClick={() => setPage(page - 1)}
            >
              السابق
            </Btn>
            <span>الصفحة {page}</span>
            <Btn
              variant="outline"
              intent="info"
              disabled={busy || !data.hasMore}
              onClick={() => setPage(page + 1)}
            >
              التالي
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}
