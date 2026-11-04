# Prototype UI data audit — historical finding register

Current status (30 October 2026): chart series, period/date filters, category allocation, funnel, calendar, auth/MFA, hosted payment flow, contract/receipt links, supplier uploads/private downloads, team invitations, availability editor, real alternatives and independently approved amendments have implementations and test coverage. Money uses shared integer-fils calculations; actual completed feedback supplies ratings. Punctuality was not inferred from completion: the UI names the computed completion ratio explicitly. FAQ privacy/payment text now uses configured policies/schedule.

Open release concerns: real business policies/contact data, complete English localization (direction toggle is not full translation), native-device/assistive-technology checks, full owner-history pagination and capacity/load certification. See READINESS.md for current evidence. The table below preserves the original findings; it does not represent an open-task checklist.

Snapshot during conversion; line numbers refer to the initial implementation and may move as fixes land. This is a finding register, not a claim that every finding remains open.

| Location | Finding / necessary real source |
|---|---|
| `src/operations.tsx:99` Sparkline | Path is fixed SVG geometry, repeated across customer/admin/supplier KPI cards. Derive period series from bookings/payments or display neutral no-data line. |
| `src/operations.tsx:121` Chart | Static revenue/cost/profit point arrays; changing period chooses a different illustration. Derive dated monthly buckets and money-axis from real posted transactions/contracts. |
| `src/operations.tsx:272` Admin header | Fixed Friday23October2026. Use current locale date. |
| `src/operations.tsx:372` AdminOverview | Growth +40% or+22% is fixed. Compare matching period DB aggregates; no growth rate when denominator0. |
| `src/operations.tsx:409` Revenue donut legend | Fixed45/22/18/10/5%. Allocate real paid revenue to contract lines/categories, accounting for refunds; conic-gradient must use same data as legend. |
| `src/operations.tsx:459` payment bars | Fixed76% and30%. Derive each amount / relevant total; empty data displays0. |
| `src/operations.tsx:1830` CalendarMini | Fixed December2026/31days, matches day-of-month only across all years/months. Need navigable year/month and full ISO date filters. |
| `src/operations.tsx:1960` Reports | KPI totals real client-state computations, but report period not included in filtering. Filter bookedAt/postedAt within actual start/end dates before all totals and chart series. |
| `src/operations.tsx:2039` Funnel | Counts computed but widths fixed100−index×17. Use actual count / starting cohort. |
| `src/operations.tsx:2065` Supplier performance | response/reliability/rating originate from seeded supplier metadata. Compute from response timestamps, promised/actual execution dates and customer feedback. Display no-history when denominator0. |
| `src/operations.tsx:2477` Supplier KPI | Same seeded rates and illustrative Sparkline. Use supplier-scoped DB metrics. |
| `src/main.tsx:1173,2008,2139` date validation | Fixed October2026 cutoff. Compare to Kuwait business-date policy server side; input minimum derived current date. |
| `src/main.tsx:1724–1986` original Auth | FixedOTP/demo-password/client-only account creation. Replace with server-issued verification challenge/reset token, real session cookie, MFA challenge. Never retain password in sessionStorage. |
| `src/main.tsx:3123` Contract | Prototype-only legal disclaimer/default clauses; require configured company details and commercially reviewed contract/cancellation policy. Need immutable server document/hash/version and signature evidence. |
| `src/main.tsx:3356–3576` payment UI | Scenario dropdown/fixed3DS and browser-generated receipt. Replace with provider-hosted checkout, verified webhook/reconciliation, server-generated receipt; browser return never sets PAID. |
| `src/operations.tsx:3008` Demo | Arbitrary role impersonation/reset/offline/expiry controls must be excluded from production routing and server allowlist; demo remains explicit opt-in development only. |
| Public marketing cards/testimonials | Approved marketing copy can remain; numeric service rating/review and availability must not originate from illustrative seed in production. |
| Static support phone/email/company data | Must be configured real contact/company/legal values before launch; cannot infer investor's commercial registration or receiving account. |

Global state must be filtered before transmission: customers own bookings/files/payments, suppliers assigned lines only and no customer retail margin, staff permitted operational scope, owner privileged changes. Hiding a UI card is not authorization.
