# هَبّ السعد | HABB ALSAAD

React/TypeScript مع Fastify وPostgreSQL. الواجهة والهوية والحركة المعتمدة محفوظة. التشغيل الافتراضي يستخدم الخادم وقاعدة بيانات فعلية ولا يستخدم حسابات أو بيانات العرض.

## التشغيل المحلي

يلزم Node.js 22 أو أحدث. نفّذ `npm ci`، انسخ `.env.example` إلى `.env` واضبط مفاتيح Cookie وAES ثابتة، ثم `npm start`. يبدأ Vite على http://localhost:5173 وAPI على3001 بقاعدة تطوير فارغة دائمة. إنشاء المالك يتم صراحةً عبر `npm run db:bootstrap` بعد ضبط BOOTSTRAP. إرسال البريد يحتاج SMTP، والعامل الخلفي المنفصل يحتاج PostgreSQL خارجيًا؛ لا تشغله على نفس مجلد PGlite.

## التحقق والوثائق

`npm run setup:prepare` يجهز ملف الأسرار المحلي وحقول بيانات الشركة دون استبدال الموجود. طريقة الإدخال والتطبيق في [دليل إدخال الإعدادات](docs/production/CONFIGURATION-ENTRY.md).

نفّذ `npm test` و`npm run build`، ثم `npx playwright install chromium` و`npm run test:e2e:real`. الأمر `npm run audit:launch` يفحص بوابات الإطلاق ويخرج NO_GO إذا نقصت المتطلبات.

- [تقرير الجاهزية والنتائج والمخاطر](docs/production/READINESS.md)
- [المعمارية](docs/production/ARCHITECTURE.md) و[قاعدة البيانات](docs/production/DATABASE.md)
- [واجهات API والصلاحيات](docs/production/API.md)
- [التكاملات والأسرار](docs/production/INTEGRATIONS.md)
- [تسويات الموردين وربط التحويلات](docs/production/SUPPLIER-SETTLEMENTS.md)
- [النشر](docs/production/DEPLOYMENT.md) و[دليل التشغيل والاستعادة](docs/production/RUNBOOK.md)
- [الحركة](docs/motion/README.md)

`npm run dev:demo` فقط يشغّل العرض المحلي القديم؛ [وثيقته المؤرشفة](docs/production/PROTOTYPE-README.md) وحساباته ورمزه الثابت تخص العرض وحده. Seed الخادم يتطلب ENABLE_DEMO وكلمة مرور صريحة وممنوع في Production.

الإطلاق التجاري يتطلب إعداد الشركة والسياسات والمزودين واجتياز Staging والنسخ والاستعادة والدفع قبل استقبال أموال العملاء.
