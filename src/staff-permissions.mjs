export const staffSections = {
  orders: "orders.view", quotes: "orders.view", approvals: "orders.approve", contracts: "contracts.view",
  events: "orders.view", customers: "customers.view", suppliers: "suppliers.view", catalog: "catalog.view",
  packages: "catalog.view", payments: "payments.view", reports: "reports.view", audit: "audit.view",
  deliveries: "notifications.view", expenses: "expenses.view", procurement: "procurement.view", content: "content.view",
};
export const staffPermissionLabels = {
  "orders.view":"عرض الطلبات والمناسبات", "orders.create":"إنشاء طلب نيابة عن العميل",
  "orders.edit":"تعديل الطلبات والأسعار", "orders.cancel":"رفض وإلغاء طلب قبل العقد", "orders.approve":"اعتماد العروض وإرسالها",
  "orders.export":"تصدير الطلبات", "contracts.view":"عرض العقود وتنزيلها", "contracts.edit":"إصدار نسخة معدلة من العقد",
  "customers.view":"عرض العملاء", "customers.create":"إنشاء حساب عميل ودعوته",
  "suppliers.view":"عرض الموردين", "suppliers.edit":"إدارة الموردين والتوفر",
  "catalog.view":"عرض الكتالوج", "catalog.edit":"إنشاء وتعديل الخدمات والباقات", "catalog.delete":"أرشفة الخدمات والباقات",
  "payments.view":"عرض الدفعات", "payments.export":"تصدير الدفعات",
  "notifications.view":"عرض الإشعارات وسجل التسليم", "reports.view":"عرض التقارير", "audit.view":"عرض سجل التدقيق", "audit.export":"تصدير سجل التدقيق",
  "costs.view":"عرض التكاليف", "profit.view":"عرض الربحية", "discounts.view":"إدارة الخصومات",
  "expenses.view":"عرض المصروفات", "expenses.edit":"إدارة المصروفات",
  "procurement.view":"عرض طلبات التوريد", "procurement.edit":"إدارة طلبات التوريد",
  "content.view":"عرض المحتوى", "content.edit":"تحرير مسودات المحتوى", "content.publish":"نشر المحتوى",
};
export const hasPermission = (actor, permission) => actor?.role === "admin" ||
  (actor?.role === "staff" && (actor.staffRoleId ? actor.permissions?.includes(permission) :
    !["expenses","procurement","content"].includes(permission?.split(".")[0])));

export const actionPermission = {
  SELECT_ORDER:"orders.view", REVIEW:"orders.edit", ORDER_REVIEW_DECISION:"orders.edit",
  ORDER_DETAILS:"orders.edit", CONTRACT_REVISE:"contracts.edit", AMENDMENT_CONFIRM:"suppliers.edit",
  PRICE:"orders.edit", NOTE:"orders.edit", TASK:"orders.edit", EXECUTION:"orders.edit",
  ALTERNATIVE:"orders.edit", RENEW:"orders.edit", AMENDMENT_CREATE:"orders.edit",
  SUPPLIER_RESPONSE:"suppliers.edit", AVAILABILITY:"suppliers.edit", SUPPLIER_SAVE:"suppliers.edit",
  CATALOG_SAVE:"catalog.edit", CATALOG_DELETE:"catalog.delete", PACKAGE_SAVE:"catalog.edit", PACKAGE_DELETE:"catalog.delete",
  APPROVE_INTERNAL:"orders.approve", PUBLISH:"orders.approve", AMENDMENT_APPROVE:"orders.approve",
  ASSISTED_SUBMIT:"orders.create",
};
