# هَبّ السعد | HABB ALSAAD
## Master Specification — Splash, First Experience, Promotional Film & Loading Motion System

**Document purpose:** تنفيذ تجربة افتتاح وتحميل وحركة متكاملة داخل تطبيق هَبّ السعد، مطابقة للهوية البصرية الحالية، قابلة للتنفيذ مباشرة بواسطة Codex داخل المشروع القائم.

**Status:** Implementation-ready specification  
**Priority:** P0 — Brand-critical experience  
**Scope:** Frontend motion experience + state orchestration + media integration + responsive behavior + performance + QA  

---

# 0. أمر التنفيذ الرئيسي إلى Codex

اقرأ هذه الوثيقة كاملة قبل تعديل أي ملف. استكشف المشروع الحالي وStack المستخدم والبنية والـRouting والـState Management والـDesign System ثم نفّذ هذه التجربة داخل التطبيق القائم دون كسر أي مسار أو منطق حالي.

هذه ليست شاشة Splash واحدة؛ المطلوب بناء **Motion Experience System** موحّد يتكون من أربع تجارب مترابطة:

1. **First Experience Film** — فيديو سينمائي 20 ثانية يظهر تلقائيًا في أول تجربة فقط.
2. **Featured Promotional Placement** — موضع دعائي مميز داخل التطبيق لإعادة مشاهدة الفيلم يدويًا في أي وقت.
3. **Returning Splash** — شاشة افتتاح قصيرة في كل دخول لاحق، بها الشعار وعناصر المناسبات ثلاثية الأبعاد مع التفكك والتجميع.
4. **Loading Motion System** — نظام تحميل ذكي موحّد لكل التطبيق بدل Spinner تقليدي، ويستخدم نفس عالم الشعار والعناصر ثلاثية الأبعاد.

كل هذه التجارب يجب أن تبدو كجزء واحد من نفس العلامة التجارية، لا كأربع إضافات منفصلة.

**قاعدة حاسمة:** لا تجعل الفيديو 20 ثانية يظهر في كل مرة. الفيديو يظهر تلقائيًا مرة واحدة فقط في أول تجربة، وبعدها يكون متاحًا يدويًا من الموضع الدعائي. الدخول المتكرر يستخدم Splash قصير فقط.

---

# 1. الهدف التجريبي

المطلوب أن تكون لحظة فتح هَبّ السعد نفسها جزءًا من المنتج والهوية. المستخدم لا يرى شاشة تحميل، بل يرى عالم المناسبة يتكوّن أمامه.

الرسالة البصرية الأساسية:

> **هَبّ السعد لا يعرض خدمات المناسبة فقط؛ بل يبني اللحظة من الصفر.**

اللغة الحركية الموحدة:

- الشعار يتفكك إلى عناصر مناسبات.
- العناصر تدور أو تنزلق أو تتفتح أو تتجمع.
- شريط/نسيج Burgundy + Champagne Gold مستوحى من الشعار يعمل كـVisual Conductor.
- العناصر تعود وتلتئم لتكوّن شعار **هَبّ السعد**.
- لا يوجد أي Loading Spinner تقليدي في التجارب الرئيسية.

---

# 2. مصدر الهوية البصرية الملزم

استخدم شعار هَبّ السعد المرفق بالمشروع كمرجع بصري أساسي ولا تعِد رسمه أو تغيّر نسبه أو ألوانه بصورة عشوائية.

## 2.1 Palette الأساسية

ابدأ بهذه القيم ثم اضبطها بصريًا بما يطابق ملف الشعار النهائي:

| Token | Value | Usage |
|---|---:|---|
| `brand.burgundy.900` | `#4B0D1D` | الخلفيات الداكنة، الشعار، الظلال الرئيسية |
| `brand.burgundy.700` | `#6F2B33` | الحالات الثانوية، التدرجات |
| `brand.rosewood.500` | `#945A4E` | تفاصيل انتقالية |
| `brand.roseGold.500` | `#B78065` | المعادن الدافئة والتوهج |
| `brand.champagne.400` | `#D1A385` | حواف ذهبية ناعمة |
| `brand.blush.200` | `#DEBDA5` | المساحات الناعمة |
| `brand.ivory.100` | `#F0E5DC` | الخلفيات الفاتحة |
| `brand.pearl` | `#FFF9F5` | الخلفية الأساسية |

يمكن إضافة Accent محدود جدًا من:
- Muted Sage
- Dusty Mauve
- Champagne glow

لا تستخدم Neon أو ألوان Tech زرقاء افتراضية أو Gradient AI نمطي.

## 2.2 لغة المواد

- brushed champagne gold
- rose-gold edges
- premium burgundy velvet/silk
- warm ivory satin
- polished marble
- crystal/glass
- dark premium wood
- subtle Kuwaiti geometric texture

## 2.3 عناصر الـ3D الأساسية

أنشئ/استخدم مجموعة موحّدة من العناصر التالية:

- قطعة من الشعار / Ribbon Segment
- وردة / Floral Cluster
- كرسي فاخر
- طاولة مناسبات
- شمعة أو Candle Stand
- ثريا / Chandelier fragment
- دلة وفنجان بصورة راقية
- بطاقة دعوة
- قطعة قماش/ستارة
- إطار/قوس كوشة
- خاتم أو رمز زفاف بصورة ثانوية لا مسيطرة
- Confetti metallic particles بشكل بالغ الرقي وليس احتفاليًا طفوليًا

كل العناصر بنفس Lighting وMaterial language.

---

# 3. معمارية التجربة الكاملة

## 3.1 الحالة A — First Experience Film

**متى؟** أول تشغيل فعلي للمستخدم على الجهاز/المتصفح أو عند إصدار نسخة Intro جديدة يتم رفع `introVersion` لها.

**المدة:** 20 ثانية.

**السلوك:**
1. التطبيق يبدأ بخلفية Pearl/Ivory ثابتة لمدة قصيرة جدًا أثناء التحقق من حالة المستخدم.
2. إذا كانت `introSeenVersion < currentIntroVersion` يبدأ الفيلم تلقائيًا Full Screen.
3. تشغيل الفيديو `muted` افتراضيًا حتى يعمل Autoplay على الويب والموبايل.
4. زر Sound صغير أنيق يسمح بتفعيل الصوت.
5. يظهر زر **تخطي** بعد 2.5–3 ثوانٍ، لا من أول Frame.
6. عند اكتمال الفيلم أو التخطي: يتم حفظ المشاهدة ثم الانتقال إلى التطبيق بسلاسة عبر Logo Morph، وليس Cut مباشر.
7. لا يعاد تشغيل الفيلم تلقائيًا في الجلسات التالية.

### حالة المشاهدة

Prototype:
```ts
habbIntroSeenVersion = "1"
habbIntroCompletedAt = ISO_DATE
habbIntroSkipped = true | false
```

Production-ready abstraction:
- localStorage/IndexedDB للحالة المحلية.
- وإذا كان المستخدم Logged In وكان Backend يسمح: مزامنة preference إلى Profile حتى لا يشاهد المقدمة مجددًا على كل جهاز إذا قرر المنتج ذلك.

**لا تربط التنفيذ نهائيًا بـlocalStorage داخل Component نفسه.** أنشئ `ExperienceStateService` أو abstraction مشابهة.

---

# 4. Storyboard الفيلم الأول — 20 ثانية

Codex لا يعيد توليد الفيلم. يعامل الفيديو النهائي كـBrand Asset ويقوم بدمجه باحتراف. إذا لم يكن ملف الفيديو النهائي موجودًا أثناء التطوير، أنشئ Placeholder cinematic يطابق المدة والمنطق، ولا توقف بناء باقي النظام.

## 0–2 ثانية
- أبواب قاعة تجمع بين التراث الكويتي والقاعة الحديثة.
- فتح هادئ ومهيب.
- خلف الباب قاعة فارغة تمامًا.

## 2–4 ثانية
- دخول الكاميرا.
- Ribbon Burgundy/Gold يمر في الفراغ.
- الأرضية والإضاءة تبدأ في الاستيقاظ.

## 4–10 ثانية
- ثريات تتجمع.
- الطاولات تدخل وتتوزع.
- الكراسي تتموضع.
- المفارش وأدوات المائدة والضيافة تظهر بتتابع مادي مقنع.

## 10–14 ثانية
- Bloom للورد.
- ستائر وتفاصيل وإضاءة وشموع.
- القاعة تصبح حية.

## 14–18 ثانية
- Ribbon يصل للكوشة.
- بناء الكوشة من عناصر الشعار والورد والقوس والإضاءة.

## 18–19 ثانية
- ظهور العروسين على الكوشة بصورة راقية ومحترمة؛ لا تركيز على تفاصيل الوجه.

## 19–20 ثانية
- جزيئات Burgundy/Gold/Ivory تتجمع في شعار هَبّ السعد النهائي.
- يمكن إظهار tagline صغير جدًا:
  **من أول هبّة… تبدأ الحكاية**

---

# 5. موضع الفيلم الدعائي داخل التطبيق

بعد انتهاء أول تجربة لا يختفي الاستثمار في الفيلم. يجب إضافة Featured Promotional Placement واضح داخل الصفحة الرئيسية.

## 5.1 المكان الأساسي

ضع بطاقة Cinematic كبيرة بعد Hero / Intro Section مباشرة وقبل استعراض الباقات أو الخدمات الرئيسية.

### Desktop
- Full-width أو 12-column cinematic card.
- Aspect ratio تقريبي 16:9 أو 2:1 حسب Layout الحالي.
- Poster image من لقطة الباب المفتوح أو القاعة قبل/بعد.
- Overlay خفيف Burgundy gradient.
- نص:
  **شوفي كيف تبدأ الحكاية**
  **20 ثانية من الفراغ… إلى ليلة كاملة**
- CTA: `شاهد التجربة`.

### Mobile
- Card بعرض الشاشة مع Radius كبير.
- لا Autoplay كامل أثناء Scroll.
- يمكن استخدام Preview loop من 2–3 ثوانٍ بلا صوت فقط عند ظهور البطاقة في viewport إذا كان الأداء يسمح.
- عند الضغط يفتح الفيلم Full-screen / cinematic modal.

## 5.2 قواعد التشغيل

- لا يعيد تشغيل الفيلم تلقائيًا في كل زيارة.
- التشغيل يدوي من البطاقة.
- احفظ Resume progress اختياريًا داخل الجلسة.
- Esc / Swipe Down / Close يغلق المشغل.
- عند الإغلاق يعود المستخدم لنفس Scroll position.

---

# 6. Returning Splash — في كل دخول لاحق

هذه هي شاشة الافتتاح اليومية/المتكررة.

**المدة المستهدفة:** 2.4–3.2 ثانية فقط.  
**الحد الأقصى:** 4 ثوانٍ في الحالات الطبيعية.

## 6.1 التسلسل الحركي

### 0.00–0.45s — Arrival
- خلفية Warm Ivory.
- يظهر Glow خفيف جدًا في المنتصف.
- تبدأ نقاط/Fragments معدنية صغيرة بالدخول.

### 0.45–1.30s — Disassembly / World Reveal
- يظهر الشعار لحظيًا ثم تتفكك أجزاء منه بانسيابية.
- تتحول القطع إلى Miniature 3D Objects مرتبطة بالمناسبات:
  - وردة
  - كرسي
  - شمعة
  - دلة/فنجان
  - جزء ثريا
  - بطاقة دعوة
  - قطعة قماش
- العناصر لا تنتشر عشوائيًا؛ تتحرك على Orbits محسوبة حول المركز.

### 1.30–2.30s — Reassembly
- Ribbon يمر بينها.
- العناصر تتجه للمنتصف.
- كل عنصر يتحول أو يختفي داخل جزء من الشعار.
- الشعار يُعاد بناؤه قطعة قطعة.

### 2.30–3.00s — Brand Lock
- يظهر الشعار النهائي كاملًا.
- Micro shimmer على حافة Gold فقط.
- يظهر اسم `هَبّ السعد` بثبات.
- Transition بالـMask/Blur إلى الصفحة المطلوبة.

## 6.2 قاعدة لا يمكن كسرها

لا تنتظر 3 ثوانٍ اصطناعيًا إذا كان التطبيق جاهزًا بسرعة كبيرة. استخدم `minimumDisplayTime` تقريبي 1.2–1.5 ثانية ثم اسمح بإتمام الحركة مبكرًا أو اختصار آخر Segment بصورة طبيعية.

إذا كان التطبيق يحتاج تحميلًا أطول، تتحول شاشة Splash نفسها إلى Loading State بدل عمل Splash ثم شاشة Loading ثانية.

---

# 7. Loading Motion System

المطلوب استبدال مفهوم Spinner العام بنظام متعدد المستويات.

## 7.1 Thresholds

| زمن العملية | السلوك |
|---|---|
| أقل من 350ms | لا تعرض Loader لمنع الوميض |
| 350ms–1.2s | Micro Loader داخل العنصر نفسه |
| 1.2s–3s | Branded Component Loader |
| أكثر من 3s | Full Loading Experience مع Status text |

## 7.2 النوع 1 — Micro Loader

لأزرار مثل:
- إضافة للسلة
- حفظ المفضلة
- اعتماد تعديل صغير

التصميم:
- Button يحتفظ بحجمه.
- الأيقونة تتحول إلى 3 نقاط Gold صغيرة أو Fragment صغير يدور نصف دورة.
- لا Spinner أبيض افتراضي.
- النص يمكن أن يتحول إلى `جاري الإضافة…`.

## 7.3 النوع 2 — Branded Section Loader

لتحميل:
- الخدمات
- الباقات
- المفضلة
- بيانات لوحة العميل

التصميم:
- Mini stage 3D على مساحة 80–140px.
- 3–5 عناصر صغيرة تتحرك في Orbit وتجمع حرف/جزء من الشعار.
- Skeletons بنفس Radius وألوان الواجهة حولها.

## 7.4 النوع 3 — Full-screen Loader

لعمليات مثل:
- تسجيل الدخول الأول
- تحميل Dashboard كبيرة
- تجهيز عرض السعر
- حفظ/توليد العقد
- بدء الدفع
- إعادة المزامنة بعد عملية مهمة

### Progress-aware animation
إذا كان progress حقيقيًا متاحًا، اربط الحركة به:

- 0–20%: particles تظهر.
- 20–45%: عناصر المناسبة تدخل Orbit.
- 45–70%: Ribbon يجمع العناصر.
- 70–90%: نصف الشعار يتكوّن.
- 90–100%: Logo Lock + transition.

**ممنوع** إظهار رقم نسبة مزيف إذا لم يكن هناك progress حقيقي.

إذا لم يكن Progress معروفًا، استخدم Loop قصير لا نهائي من 2.2–2.8 ثانية بدون percentage.

---

# 8. Contextual Loading — التحميل حسب العملية

اجعل الـLoading أذكى من مجرد شعار واحد دائمًا.

## 8.1 تحميل القاعات
- مصغّر باب/قوس.
- يفتح تدريجيًا.
- تظهر ثريا صغيرة.

النص المحتمل:
`نجهّز لك أجمل القاعات…`

## 8.2 تحميل خدمات الضيافة
- Dallah + cup تظهر من Fragment الشعار.
- بخار خفيف جدًا يتحول إلى Ribbon.

النص:
`نرتّب تفاصيل الضيافة…`

## 8.3 بناء عرض السعر
- بطاقات/أرقام وFragments تدخل في Document frame.

النص:
`نجمع تفاصيل مناسبتك…`

## 8.4 تجهيز العقد
- خط Gold يرسم إطار Document ثم Lock icon.

النص:
`نجهّز العرض والعقد للمراجعة…`

## 8.5 الدفع
- لا تستخدم مؤثرات احتفالية قبل نجاح الدفع.
- Loader رسمي وأهدأ.
- Logo fragment + secure ring.

النص:
`جاري تأمين عملية الدفع…`

## 8.6 نجاح الدفع
- هنا فقط يمكن إجراء micro-celebration:
  - Gold shimmer
  - small floral bloom
  - check mark من Ribbon

النص:
`تمت الدفعة بنجاح`

---

# 9. Motion Design Tokens

أنشئ ملف Tokens مركزيًا ولا تكتب durations/easings عشوائيًا داخل Components.

```ts
export const motionTokens = {
  duration: {
    instant: 0.12,
    fast: 0.22,
    standard: 0.42,
    elegant: 0.72,
    splashSegment: 0.9,
  },
  easing: {
    standard: [0.22, 1, 0.36, 1],
    enter: [0.16, 1, 0.3, 1],
    exit: [0.7, 0, 0.84, 0],
    luxury: [0.25, 0.8, 0.2, 1],
  }
}
```

## قواعد الحركة

- no bounce في الهوية الرئيسية.
- no elastic cartoon motion.
- no aggressive overshoot.
- primary movement = glide / unfold / bloom / orbit / lock.
- Scale changes صغيرة جدًا: غالبًا 0.96 → 1.00.
- Blur transitions: 6–12px max عند الحاجة.
- Gold shimmer مرة واحدة فقط عند Brand Lock.

---

# 10. معمارية Frontend المقترحة

تكيف مع Stack الحالي. إذا كان المشروع React/Next.js استخدم البنية التالية أو ما يعادلها:

```text
src/
  experience/
    ExperienceOrchestrator.tsx
    experience-state.ts
    experience-events.ts
    motion-tokens.ts

  components/brand-motion/
    FirstExperienceFilm.tsx
    ReturningSplash.tsx
    BrandedLoader.tsx
    MicroLoader.tsx
    ContextualLoader.tsx
    LogoAssembler.tsx
    EventObjectOrbit.tsx
    RibbonMotion.tsx
    PromoFilmCard.tsx
    CinematicPlayer.tsx

  assets/brand-motion/
    logo/
    video/
    posters/
    audio/
    models/
    textures/

  hooks/
    useFirstExperience.ts
    useReducedMotionSafe.ts
    useLoadingExperience.ts

  services/
    experienceStateService.ts
    mediaPreloadService.ts
```

## 10.1 ExperienceOrchestrator

هو المسؤول الوحيد عن تحديد ما يظهر عند Boot:

```text
BOOT
 ↓
read user preference + intro version + reduced motion
 ↓
FIRST VISIT? ─ yes → FIRST_EXPERIENCE_FILM → APP
      │
      no
      ↓
RETURNING_SPLASH
      ↓
APP_READY? ─ no → CONTINUE_AS_LOADING
      │
      yes
      ↓
APP
```

لا توزع هذا المنطق بين `App.tsx` وNavbar وPages بصورة غير منظمة.

---

# 11. 3D Rendering Strategy

استخدم التقنية الأخف التي تحقق النتيجة المطلوبة داخل Stack الحالي.

## الخيار المفضل للـ3D الحقيقي
- Three.js / React Three Fiber عند وجود React.
- glTF/GLB assets.
- Meshopt أو Draco compression.
- KTX2/WebP/AVIF textures.

## متى لا تستخدم WebGL؟
إذا كان الجهاز ضعيفًا أو WebGL غير متاح أو `prefers-reduced-motion` مفعّل:
- استخدم Rive/Lottie/Pre-rendered transparent video fallback.
- حافظ على نفس Timing والهوية.

**لا تجعل التطبيق يعتمد وظيفيًا على WebGL حتى يعمل.** الحركة Enhancement وليست شرطًا للوصول للمحتوى.

---

# 12. Media Assets Contract

## 12.1 الفيديو الرئيسي
وفر نسخ متعددة:

```text
intro-master-4k.mp4       // archive/master
intro-1080.mp4            // desktop fallback
intro-1080.webm           // desktop preferred where supported
intro-720-mobile.mp4      // mobile
intro-720-mobile.webm     // mobile preferred
intro-poster.avif
intro-poster.webp
```

- `playsInline`
- muted by default
- no browser-native controls في first experience
- custom sound/skip controls only
- CDN/cache long-lived مع versioned filename

## 12.2 Splash assets

- `habb-logo.svg` إن توفر Vector approved.
- `habb-logo-transparent.webp/png` fallback.
- GLB models صغيرة.
- Ribbon asset procedural أو mesh.
- لا تستخدم صورة الشعار كـtexture منخفضة الجودة وتكبرها.

## 12.3 Audio

- Intro soundtrack منفصل إن كان ذلك أنسب لمرونة التحكم.
- Signature sound 0.6–1.2 ثانية عند تكوّن الشعار.
- جميع الأصوات Respect mute state.

---

# 13. Performance Budget

هذه التجربة يجب أن تكون مبهرة **بدون أن تصبح سبب بطء التطبيق**.

## أهداف
- Returning Splash: 60fps على أجهزة متوسطة حديثة.
- لا تجمّد Main Thread.
- لا تحمل فيديو 20 ثانية بالكامل قبل أن يعرف النظام أنه First Visit أو المستخدم طلب إعادة تشغيله.
- استعمل Poster فورًا.
- Preload `metadata` أولًا، ثم media حسب الحاجة.

## ميزانية تقريبية
- 3D assets للـReturning Splash: يفضّل أقل من 2–3MB إجماليًا بعد الضغط.
- Loader assets الأساسية: أقل من 500KB قدر الإمكان.
- Mobile intro video: اضغطه بقوة مع الحفاظ على الجودة؛ استخدم Adaptive source حسب الجهاز والشبكة.

## Slow network
إذا لم يصبح الفيديو جاهزًا سريعًا:
- لا تعرض شاشة سوداء.
- اعرض Poster + subtle animated logo.
- إذا تجاوز الانتظار threshold منطقي، اسمح للمستخدم بدخول التطبيق مع زر `شاهد التجربة لاحقًا`.

---

# 14. Responsive Behavior

صمم Mobile-first واختبر فعليًا لا بمحاكاة CSS فقط.

## Breakpoints المرجعية
- 320–374px: small phones
- 375–430px: standard/current phones
- 431–767px: large phones / small tablets
- 768–1023px: tablets
- 1024–1439px: laptop/desktop
- 1440px+: wide desktop

## Returning Splash

### Mobile portrait
- Logo 44–56vw max.
- 3D orbit لا يخرج خارج Safe Area.
- العناصر التي تمر خلف Dynamic Island/Notch لا تحمل معلومات مهمة.

### Tablet
- توسع المدار مع الحفاظ على Logo center.

### Desktop
- العناصر تتحرك في Space أوسع.
- لا تكبّر الشعار أكثر من اللازم.
- استخدم subtle depth/parallax.

## Landscape phones
- لا تقص الشعار.
- قلل العناصر الجانبية.
- استخدم compact timeline.

---

# 15. Safe Areas & Native/PWA Considerations

- استخدم `env(safe-area-inset-top)` وbottom عند PWA/iOS.
- منع scroll أثناء Full Screen Intro/Splash.
- استعادة scroll عند الدخول.
- لا تمنع Back gesture بصورة مزعجة.
- إذا كانت التجربة داخل native wrapper، استخدم status-bar color متناسق مع Ivory/Burgundy.

---

# 16. Accessibility & User Control

## prefers-reduced-motion
عند تفعيله:
- لا تلغِ الهوية بالكامل.
- اعرض Logo fade + gentle shimmer لمدة 0.8–1.2 ثانية.
- لا Orbits ولا Camera movement ولا Parallax.
- الفيلم الأول لا يعمل تلقائيًا؛ اعرض Poster مع CTA `تشغيل الفيديو`.

## Keyboard
- Skip / Sound / Close قابلة للوصول بـTab.
- Focus واضح لكن متناسق مع الهوية.
- Esc يغلق Promotional Player.

## Screen reader
- 3D decorative elements `aria-hidden=true`.
- Video controls لها labels واضحة.
- لا تجعل النص المهم داخل Canvas فقط.

---

# 17. حالة الخطأ وFallback

لا تسمح بفشل Animation أن يمنع دخول التطبيق.

## إذا فشل الفيديو
- Poster + Logo motion.
- بعد 1–1.5 ثانية اسمح بالدخول.
- سجل telemetry event.

## إذا فشل WebGL
- fallback animation.

## إذا فشل Asset واحد من عناصر 3D
- أكمل ببقية العناصر.
- لا تظهر broken-image icon.

## إذا كانت الذاكرة منخفضة
- قلل particle count.
- استبدل 3D models بـ2.5D sprites عند الضرورة.

---

# 18. Analytics / Telemetry

أنشئ Events قابلة للربط بأي analytics layer حالي دون hard-coding provider داخل الـComponents:

```text
brand_intro_impression
brand_intro_started
brand_intro_sound_enabled
brand_intro_skipped
brand_intro_completed
brand_intro_failed
brand_promo_card_impression
brand_promo_video_opened
brand_promo_video_completed
returning_splash_shown
returning_splash_fallback_used
loading_experience_shown
loading_experience_long_operation
```

Metadata مفيد:
- device class
- connection type إن توفر بطريقة privacy-safe
- intro version
- reduced motion true/false
- duration to ready

---

# 19. First-run State Machine

```text
UNKNOWN
  ↓ resolve
NEW_USER / NEW_INTRO_VERSION
  ↓
PREPARE_INTRO
  ├─ ready → PLAYING
  ├─ fail  → FALLBACK
  ↓
PLAYING
  ├─ complete → MARK_SEEN → TRANSITION_TO_APP
  └─ skip     → MARK_SEEN → TRANSITION_TO_APP

RETURNING_USER
  ↓
RETURNING_SPLASH
  ├─ app ready → LOGO_LOCK → ENTER_APP
  └─ app not ready → LOADING_CONTINUATION → ENTER_APP
```

---

# 20. Loading State Contract للمطورين

وفر API موحدًا بدل أن يخترع كل مطور Loader خاصًا به.

مثال conceptual:

```ts
showLoadingExperience({
  scope: 'fullscreen' | 'section' | 'button',
  context: 'venues' | 'hospitality' | 'quote' | 'contract' | 'payment' | 'generic',
  progress?: number,
  message?: string,
})
```

أو Component:

```tsx
<BrandedLoader
  mode="section"
  context="quote"
  progress={quoteBuildProgress}
/>
```

**قاعدة:** النصوص الافتراضية تأتي من Mapping مركزي وليس hard-coded في كل صفحة.

---

# 21. Copy System — اللهجة الكويتية الراقية

استخدم Copy قصيرة ومطمئنة، لا كوميدية ولا مبالغ فيها.

أمثلة:

### Generic
- `لحظة… نرتّبها لك`
- `نجهّز التفاصيل…`

### Venues
- `نفتح لك أجمل الخيارات…`

### Services
- `نرتّب لك الخدمات المناسبة…`

### Quote
- `نجمع تفاصيل مناسبتك…`

### Contract
- `نجهّز العرض والعقد للمراجعة…`

### Payment
- `جاري تأمين عملية الدفع…`

### Success
- `تمت بنجاح`

تجنب استخدام نفس الجملة في كل العمليات.

---

# 22. تفاصيل شاشة Returning Splash بصريًا

## Background
- Warm Pearl/Ivory.
- Vignette بالغ الخفة.
- لا Pattern واضح يشتت.

## Center stage
- شعار هَبّ السعد في مركز بصري دقيق.
- Logo depth خفيف؛ ليس Extruded 3D ضخم.

## Orbit
- Radius يعتمد على الشاشة.
- 5–7 عناصر Desktop.
- 4–5 عناصر Mobile.
- بعض العناصر خلف الشعار وبعضها أمامه لإعطاء Depth.

## Light
- Key light warm soft.
- Rim light Gold.
- Shadow contact خفيف.

## Finish
- Ribbon يلتف مرة واحدة بصورة محسوبة.
- Logo locks.
- background of target page يبدأ بالظهور خلال آخر 250–350ms تحت Mask/Blur transition.

---

# 23. الانتقال إلى الصفحة الفعلية

ممنوع:
- White flash.
- Black flash.
- sudden unmount ثم mount.

المطلوب:
1. الصفحة المقصودة تكون Mounted/Prepared خلف Splash عند الإمكان.
2. أثناء Logo Lock يبدأ background crossfade.
3. الشعار يتحول بصريًا نحو موضع Brand mark في Navbar إن كان ذلك مناسبًا، أو يذوب في الصفحة.
4. Unlock scroll بعد إكمال transition فقط.

---

# 24. Skeletons

حتى مع الـ3D Loader، استخدم Skeletons لأن المستخدم يحتاج فهم شكل المحتوى القادم.

Skeleton style:
- لون Ivory/Blush منخفض contrast.
- Shimmer بطيء جدًا أو لا Shimmer إذا كان Branded loader متحركًا بالفعل.
- نفس border radius للـreal component.
- لا تعرض أكثر من حركة قوية في نفس الجزء.

---

# 25. Payment Specific Rules

لأن الدفع حساس:
- لا تستخدم Animation تجعل المستخدم يظن أن الدفع نجح قبل استجابة Gateway الحقيقية.
- عند redirect/3DS استخدم حالة `بانتظار تأكيد الدفع` واضحة.
- Success animation لا تبدأ إلا بعد verified success state.
- Failure state لا يستخدم ألوان احتفالية؛ اعرض رسالة هادئة وخيارات Retry.

---

# 26. تعريف Done لكل تجربة

## First Experience Film — Done عندما
- يعمل في أول تجربة فقط.
- Skip يعمل.
- Sound toggle يعمل.
- يسجل intro version.
- لا يعاد تلقائيًا بعد المشاهدة.
- يعمل mobile/desktop.
- له fallback.

## Promo Placement — Done عندما
- يظهر في Home.
- يفتح player.
- يغلق ويعيد Scroll position.
- responsive.
- لا يستهلك الفيديو كاملًا دون حاجة أثناء scroll.

## Returning Splash — Done عندما
- يظهر في كل boot لاحق.
- animation سلسة.
- يستمر كـLoader إذا تأخر app readiness.
- لا يضيف delay مصطنع طويل.

## Loading System — Done عندما
- جميع loaders المهمة في التطبيق تستخدم النظام الجديد.
- لا spinner افتراضي في المسارات الأساسية.
- context states مختلفة.
- progress حقيقي فقط حين يتوفر.

---

# 27. QA Matrix

اختبر على الأقل:

### Mobile
- iPhone 13/14-like viewport
- iPhone Pro Max-like viewport
- 360x800 Android
- 320px width

### Tablet
- iPad portrait
- iPad landscape

### Desktop
- 1366x768
- 1440x900
- 1920x1080

### Network
- Fast Wi-Fi
- Fast 4G
- Slow 4G simulation
- Offline after first cache where applicable

### Settings
- reduced motion ON/OFF
- muted/unmuted
- first visit
- returning visit
- intro version bumped

---

# 28. Acceptance Criteria — Visual

- الهوية مطابقة لشعار هَبّ السعد وليست UI AI generic.
- Burgundy/Gold/Ivory هي المهيمنة.
- العناصر ثلاثية الأبعاد تبدو من نفس العالم.
- لا Emoji ولا icons عامة مكان 3D assets.
- لا Spinner دائري افتراضي في Full-screen experiences.
- لا Bounce/Elastic مبالغ فيه.
- لا clipping على الشاشات الصغيرة.
- لا distortion للشعار.
- Arabic text صحيح.
- الحركة 60fps قدر الإمكان.

---

# 29. Acceptance Criteria — Functional

1. مستخدم جديد → يرى الفيلم مرة واحدة.
2. مستخدم جديد يضغط Skip → يدخل التطبيق ولا يعاد الفيلم تلقائيًا لاحقًا.
3. مستخدم عائد → يرى Returning Splash وليس الفيلم.
4. رفع `introVersion` → يسمح بإظهار Intro الجديد مرة واحدة وفق policy.
5. الفيلم متاح دائمًا يدويًا من Featured Promo Card.
6. Splash إذا انتهت بينما البيانات لم تجهز → تتحول إلى Loader seamlessly.
7. الدفع → لا success animation قبل النجاح الحقيقي.
8. reduced-motion → fallback آمن.
9. فشل WebGL/video → لا يمنع الدخول.
10. كل التجارب responsive ولا تسبب horizontal overflow.

---

# 30. خطة التنفيذ المقترحة لـCodex

## Phase 1 — Audit
- اكتشف Stack الحالي.
- حدد App boot entry.
- حدد Router.
- حدد global state/data fetching.
- حدد Home placement.
- حدد loaders الحالية.

## Phase 2 — Foundation
- motion tokens.
- experience state service.
- orchestrator.
- media asset contract.
- reduced motion hook.

## Phase 3 — First Experience
- cinematic player.
- first-run logic.
- skip/sound.
- fallback.

## Phase 4 — Returning Splash
- 3D/2.5D motion.
- disassembly/reassembly.
- transition to app.

## Phase 5 — Loading System
- micro/section/full loaders.
- contextual mappings.
- migrate critical screens.

## Phase 6 — Promotional Placement
- Home cinematic card.
- modal/player.
- viewport optimization.

## Phase 7 — QA
- all breakpoints.
- slow network.
- reduced motion.
- memory/performance.
- first/returning states.

## Phase 8 — Final Polish
- remove dead code.
- no console errors.
- no placeholder assets visible.
- document asset replacement points.

---

# 31. ممنوعات التنفيذ

Codex يجب ألا:

- يغيّر تصميم التطبيق الحالي بالكامل لتنفيذ هذه الميزة.
- يعيد رسم شعار هَبّ السعد من عنده.
- يستخدم Spinner افتراضي كحل نهائي.
- يشغّل فيديو 20 ثانية عند كل فتح.
- يفرض delay 3 ثوانٍ حتى لو التطبيق جاهز.
- يعرض نسبة Progress وهمية.
- يحمل 20-second video لكل مستخدم عائد بلا حاجة.
- يستخدم 3D ضخم يضر الأداء.
- يربط نجاح الدفع بـAnimation بدل state حقيقية.
- يترك أزرار Skip/Sound غير فعالة.
- يتجاهل reduced-motion.

---

# 32. أمر نهائي قابل للنسخ إلى Codex

> استكشف المشروع كاملًا أولًا، ثم نفّذ وثيقة `HABB_ALSAAD_SPLASH_MOTION_LOADING_MASTER_SPEC` كجزء أصيل من التطبيق القائم. لا تنشئ Demo منفصلًا. نفّذ First Experience Film مرة واحدة فقط، Featured Promotional Replay داخل الصفحة الرئيسية، Returning 3D Splash في كل دخول لاحق، ونظام Loading متكامل ومراعي للسياق عبر التطبيق. اجعل التصميم مطابقًا تمامًا لهوية هَبّ السعد والشعار المرفق، Responsive على جميع الأجهزة، performant، accessible، وله fallbacks. لا تترك أي زر ميت أو Spinner افتراضي في المسارات الأساسية. اختبر first-run/returning/reduced-motion/slow-network/payment states، ثم أصلح كل الأخطاء البصرية والمنطقية قبل اعتبار المهمة مكتملة.

---

# 33. النتيجة النهائية المطلوبة

عند اكتمال التنفيذ يجب أن يشعر المستخدم أن:

- أول دخول = **فيلم علامة تجارية استثنائي**.
- كل دخول لاحق = **لحظة افتتاح قصيرة يعرف منها فورًا أنه داخل هَبّ السعد**.
- أي انتظار داخل التطبيق = **جزء من عالم المناسبة وليس توقفًا تقنيًا**.
- الفيلم يمكن العودة إليه من **موضع دعائي مقصود** بدل فرضه على المستخدم.
- الهوية الحركية يمكن توسيعها مستقبلًا للإعلانات، الفيديوهات، الشاشات داخل القاعات، والـSocial Media.

**هَبّ السعد — من أول هبّة… تبدأ الحكاية.**
