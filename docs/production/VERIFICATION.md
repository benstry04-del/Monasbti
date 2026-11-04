## تغيير الدخول — 3 نوفمبر 2026

أُلغي إعداد تطبيق المصادقة والتحقق به لجميع الأدوار بطلب المالك. نتائج `password-login-tests.tap`:118 ناجحة؛ تشمل دخول الحسابات الأربعة مباشرة حتى عند وجود إعداد مصادقة سابق، مع رفض الأدوار غير المخولة. تم كذلك اختبار تسجيل الدخول الفعلي لحسابات نسخة التجربة الأربعة على4302 (HTTP200، بلا تحديات مصادقة). اختبار المتصفح بعد التعديل في `password-login-e2e.log`. بقيت إعادة كلمة مرور المالك للتغييرات الحساسة، والصلاحيات، والتدقيق والموافقتان المستقلتان.

# أحدث تحقق — 2 نوفمبر 2026

- الاختبارات الآلية:118 ناجحة دون إخفاق (`unit-tests.tap`).
- الترقيم والإسقاطات والتقارير المالية والصلاحيات والتقويم:6 اختبارات إضافية للمسار على PostgreSQL18.3 محلي معزول، إضافة إلى اختبارات إعدادات المالك والتوقيع وتتبع الرسائل على PostgreSQL.
- Chromium E2E: الملف النهائي `e2e-tests.log`، ويشمل التسجيل والتخطيط والتعاقد والملحق والتسوية، إعدادات المالك وإخفاء الأسرار ورفض وصول الموظف، التقرير وتاريخ العميل وقوائم المورد، وفحص العرض والأحجام المعتمدة.
- axe:تسع حالات (الرئيسية والخدمات والدخول ×390/768/1440) دون مخالفات وقت التحقق (`accessibility.json`). الاختبار آلي ومحدود بهذه الصفحات، ولا يمثل تدقيق قارئ شاشة أو أجهزة فعلية.
- حمل10,000 حجز،12 اتصالًا،10 ثوانٍ لكل من القوائم والنظرة العامة؛ نتائج كاملة في `load-records.json` دون أخطاء. هذه قياسات محلية وليست ضمان استضافة.
- النسخة المحلية المستعادة:31 جدولًا مع مقارنة المحتوى وchecksums؛ نتائج العقود/التسويات الأقدم محفوظة منفصلة. لا يوجد اعتماد استعادة على استضافة تجارية.
- صفر ثغرات npm معروفة وقت الفحص (`dependency-audit.json`)؛ فحص أسرار حزمة المتصفح ناجح.
- تكوين Compose مقبول بنيويًا؛ تشغيل Docker وTLS الفعلي محجوبان بغياب المحرك/الاستضافة، ولم يُعرضا كاختبار ناجح.

التفاصيل السابقة أدناه سجل تاريخي؛ القرار الجاري والبوابات المفتوحة في READINESS.md.

# Verification evidence — 2026-11-01

These are locally executed checks, not live merchant or deployed-container certification.

| Check | Actual result |
|---|---|
| `npm test` | 97 passed / 0 failed; [TAP log](unit-tests.tap) |
| Dedicated PostgreSQL18.3 business suite | 12 passed / 0 failed; [TAP log](postgresql-tests.tap) |
| PostgreSQL integration/payment suite | 14 passed / 0 failed; [TAP log](postgresql-payment-tests.tap); provider responses are fixtures |
| PostgreSQL supplier-settlement suite | 7 passed / 0 failed; [TAP log](postgresql-settlement-tests.tap) |
| Settlement backup/restore | 27 table counts and14 frozen settlement/approval records match; [result](settlement-restore-verification.json); this fixture DB has no signed contracts |
| Production mode with restricted PG role | API200, DDL/audit/migration mutation denied; [result](postgresql-runtime.json) |
| Isolated dump/restore | 25 table counts, three signed contract SHA256 values and migration receipts matched; [result](restore-verification.json) |
| `npm run build` | TypeScript/Vite passed; [build log](build.log); lazy Three chunk advisory remains |
| Client bundle configured-secret scan | PASSED; [result](client-secret-scan.json); no configured server secret found in JS/CSS/HTML |
| `npm audit --omit=dev` | 0 known vulnerabilities |
| `npm run test:e2e:real` | 3 passed, 0 failed, approximately2.9 minutes on Chromium; [log](e2e-tests.log) |
| `npm run audit:launch` | NO_GO; [configuration result](launch-audit.json) |

Real E2E runs an isolated actual API/database server. Only provider responses, test identities/catalog and the test-only retrieval of the issued email OTP are fixtures. No browser payment-success simulation is counted as a real payment test.

Covered browser journeys:

1. Customer registration, issued six-digit verification, reload-persistent session and server denial of admin reports.
2. Public home/catalog/auth without horizontal overflow or page errors at widths320,360,390,430,768,1024,1366,1440,1920 and landscape844.
3. Customer booking creation, supplier UI confirmation, real invoice file upload/private download and customer access denial, separate staff/owner MFA and approval, published quote, customer consent/signature and server contract download; separately reviewed amendment, explicit checkbox/name consent and immutable version download. The scenario additionally requests a supplier settlement, records independent staff/owner approval and verifies supplier-only visibility and a disabled unconfigured transfer control. Operational completion uses a test-only fixture, and no real bank transfer is simulated as success. Supplier/admin/checkout/settlement views were checked at320,390,768,1024,1440,1920 and landscape844.

Browser testing found and drove fixes for static SPA500 responses, race-prone state refresh, supplier upload placement and public asset requests exhausting API quotas. The full three-test run passed after these fixes. No timeouts or errors were silently ignored to produce the passing result.

Visual inspection preserved the approved brand, typography, cards, imagery, spacing and mobile navigation:

- [Desktop checkout capture](real-checkout-desktop.png)
- [Mobile checkout capture](real-checkout-mobile.png)

Reproduce external PostgreSQL checks on a newly created, disposable database only: set TEST_DATABASE_URL and run `node --import ./tests/env-test.mjs --test tests/business.test.mjs`. The test inserts fixture records and expects an empty schema. For restricted-role checks, also set CONFIRM_ISOLATED_DATABASE=true and run `node tests/pg-runtime.mjs`; it provisions a test runtime role and rotates its password. Never target a live/shared cluster. Restore comparison uses explicit TEST_DATABASE_URL and TEST_RESTORE_URL with `node tests/pg-restore-verify.mjs` after pg_dump/pg_restore.

CI includes these business/role checks on PostgreSQL17 plus browser tests and image build. Remote CI execution, container startup/TLS, physical devices, complete English localization, penetration/load/accessibility reviews and actual merchant/sender tests remain outside the verified evidence. See READINESS.md before making a launch decision.

Supplier settlement captures: [admin desktop](supplier-settlements-desktop.png), [supplier mobile](supplier-settlements-mobile.png). Provider transport/terminal-state validation uses isolated fixtures; it is not bank certification.
