export const contentFields = [
  ["home.hero.title","الرئيسية","المقدمة","العنوان","يا هلا ومسهلا.. زارتنا البركة"],
  ["home.hero.subtitle","الرئيسية","المقدمة","العنوان الفرعي","كل مناسبة تبيّض الوجه.. تبدي من هني"],
  ["home.hero.cta","الرئيسية","المقدمة","زر التخطيط","سمّوا وابدوا حكايتكم"],
  ["home.hero.link","الرئيسية","المقدمة","رابط زر التخطيط","/planner"],
  ["home.welcome.title","الرئيسية","الترحيب","العنوان","خلّ مناسبتكم تمشي على سنع"],
  ["home.welcome.text","الرئيسية","الترحيب","الوصف","خذوا فكرة عن الخدمات، اختاروا اللي يناسبكم، واحفظوا تجهيزاتكم بحسابكم علشان تردّون لها بأي وقت."],
  ["home.welcome.visible","الرئيسية","الترحيب","إظهار القسم","true"],
  ["global.header.services","عام","الشريط العلوي","رابط الخدمات","الخدمات"],
  ["global.header.packages","عام","الشريط العلوي","رابط الباقات","الباقات"],
  ["global.header.login","عام","الشريط العلوي","زر الدخول","تسجيل الدخول"],
  ["motion.splash.title","الحركة","شاشة الترحيب","العنوان","يا هلا ومسهلا"],
  ["motion.splash.loading","الحركة","شاشة الترحيب","نص التحميل","لحظة… نزهّب لكم المكان"],
  ["booking.cart.title","الحجز","السلة","العنوان","سلة مناسبتكم"],
  ["booking.cart.submit","الحجز","السلة","زر الإرسال","إرسال الطلب للمراجعة"],
  ["auth.register.title","الحساب","التسجيل","العنوان","خلّنا نبدأ حكايتكم"],
  ["auth.login.title","الحساب","الدخول","العنوان","يا هلا بعودتكم"],
  ["home.hero.image","الرئيسية","المقدمة","الصورة","/assets/hero-kuwait.jpg"],
  ["home.promo.title","الرئيسية","الفيلم الدعائي","العنوان","شوفي كيف تبدأ الحكاية"],
  ["home.promo.text","الرئيسية","الفيلم الدعائي","الوصف","20 ثانية من الفراغ… إلى ليلة كاملة"],
  ["home.promo.cta","الرئيسية","الفيلم الدعائي","زر التشغيل","شاهد التجربة"],
  ["home.promo.visible","الرئيسية","الفيلم الدعائي","إظهار الفيلم","true"],
  ["home.promo.image","الرئيسية","الفيلم الدعائي","صورة الفيلم",""],
  ["home.promo.video","الرئيسية","الفيلم الدعائي","مسار فيديو الحملة",""],
  ["global.footer.text","عام","التذييل","نبذة","نحوّل كل مناسبة لحكاية كويتية راقية تبيّض الوجه. بروح السنع والذرابة، واهتمام فائق بأدق التفاصيل والمواجيب."],
  ["global.footer.services","عام","التذييل","رابط الخدمات","خدماتنا ونقوتنا"],
  ["global.footer.packages","عام","التذييل","رابط الباقات","الباقات المزهّبة"],
  ["global.footer.contact","عام","التذييل","رابط التواصل","تواصلوا ويانا"],
  ["pages.about.title","صفحات الموقع","عن المنصة","العنوان",""],
  ["pages.faq.title","صفحات الموقع","الأسئلة الشائعة","العنوان","أسئلتكم واستفساراتكم بكل وضوح"],
  ["pages.contact.title","صفحات الموقع","التواصل","العنوان","تواصلوا ويانا.. زارتنا البركة"],
  ["notifications.booking.body","الإشعارات","حالة الطلب","قالب البريد","{العنوان} {الرابط}"],
];

export const homeSections = ["welcome","promo","occasions","audience","packages","steps","reviews","banner"];
const homeLabels = ["الترحيب","الفيلم الدعائي","المناسبات","الفئات","الباقات","خطوات الحجز","الآراء","الدعوة الأخيرة"];
contentFields.push(
  ["home.sections.order","الرئيسية","ترتيب الأقسام","ترتيب الأقسام",homeSections.join(",")],
  ["home.hero.text","الرئيسية","المقدمة","النص التعريفي",""],
  ...homeSections.slice(2).flatMap((section,index)=>[
    ["home."+section+".visible","الرئيسية",homeLabels[index+2],"إظهار القسم","true"],
    ["home."+section+".title","الرئيسية",homeLabels[index+2],"العنوان",""],
    ["home."+section+".text","الرئيسية",homeLabels[index+2],"الوصف",""],
  ]),
  ["home.welcome.cta","الرئيسية","الترحيب","زر التسجيل","افتحوا حساب وابدوا"],
  ["home.banner.cta","الرئيسية","الدعوة الأخيرة","نص الزر","ودّكم نبدي نزهّب؟"],
  ["home.banner.link","الرئيسية","الدعوة الأخيرة","رابط الزر","/planner"],
  ...["login","register","verify","forgot-password","reset-password"].flatMap(mode=>
    ["title","intro","submit"].filter(field=>!contentFields.some(item=>item[0]==="auth."+mode+"."+field))
      .map(field=>["auth."+mode+"."+field,"الحساب",mode,{title:"العنوان",intro:"الوصف",submit:"زر الإرسال"}[field],""])
  ),
  ...["generic","services","venues","hospitality","quote","contract","payment","verification","success"]
    .map(context=>["motion.loading."+context,"الحركة","التحميل","رسالة "+context,""]),
  ...["booking","prices","amendments","payments","cancellation","suppliers","privacy"].flatMap(topic=>[
    ["pages.faq."+topic+".question","صفحات الموقع","الأسئلة الشائعة",topic+" · السؤال",""],
    ...(["payments","cancellation","privacy"].includes(topic)?[]:[["pages.faq."+topic+".answer","صفحات الموقع","الأسئلة الشائعة",topic+" · الجواب",""]]),
  ]),
  ["pages.about.body","صفحات الموقع","عن المنصة","النبذة",""],
  ["booking.planner.title","الحجز","المخطط","العنوان",""],
  ["booking.cart.guest","الحجز","السلة","زر الزائر","سجّلوا الدخول لإرسال الطلب"],
);
