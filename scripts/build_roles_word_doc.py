import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls
import os

def create_element(name):
    return OxmlElement(name)

def set_p_rtl(p, align=WD_ALIGN_PARAGRAPH.RIGHT):
    p.alignment = align
    pPr = p._p.get_or_add_pPr()
    pBidi = create_element('w:pBidi')
    pBidi.set(qn('w:val'), '1')
    pPr.append(pBidi)

def add_run_rtl(p, text, font_name="Arial", size_pt=11, bold=False, italic=False, color=None):
    run = p.add_run(text)
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    run.bold = bold
    run.italic = italic
    if color:
        run.font.color.rgb = color
    
    rPr = run._r.get_or_add_rPr()
    rFonts = create_element('w:rFonts')
    rFonts.set(qn('w:ascii'), font_name)
    rFonts.set(qn('w:hAnsi'), font_name)
    rFonts.set(qn('w:cs'), font_name)
    rPr.append(rFonts)
    
    rtl = create_element('w:rtl')
    rtl.set(qn('w:val'), '1')
    rPr.append(rtl)
    return run

def set_table_rtl(table):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    tblPr = table._tbl.tblPr
    bidiVisual = create_element('w:bidiVisual')
    bidiVisual.set(qn('w:val'), '1')
    tblPr.append(bidiVisual)

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_padding(cell, top=140, bottom=140, left=180, right=180):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def set_table_borders(table, color="D9C3B0", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'<w:tblBorders {nsdecls("w")}><w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/><w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/><w:left w:val="none"/><w:right w:val="none"/><w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/><w:insideV w:val="none"/></w:tblBorders>')
    tblPr.append(borders)

def set_box_borders(cell, border_color="C69A61", sz="12"):
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(f'<w:tcBorders {nsdecls("w")}><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="single" w:sz="{sz}" w:space="0" w:color="{border_color}"/></w:tcBorders>')
    tcPr.append(tcBorders)

def build_roles_document():
    doc = Document()
    
    # 1. Page Margins (Normal: 1 inch = 1440 dxa)
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)
        section.different_first_page_header_footer = False

    # Color Palette definitions
    C_PLUM = RGBColor(0x3E, 0x24, 0x28)      # #3E2428
    C_BROWN = RGBColor(0x5A, 0x2D, 0x2D)     # #5A2D2D
    C_GOLD = RGBColor(0xC6, 0x9A, 0x61)      # #C69A61
    C_DARK = RGBColor(0x22, 0x22, 0x22)      # #222222
    C_GRAY = RGBColor(0x66, 0x66, 0x66)      # #666666
    C_GREEN = RGBColor(0x2E, 0x8B, 0x57)     # #2E8B57
    C_WHITE = RGBColor(0xFF, 0xFF, 0xFF)     # #FFFFFF

    HEX_HEADER = "5A2D2D"
    HEX_GOLD = "C69A61"
    HEX_IVORY = "FBF7F2"
    HEX_SAND = "F4ECE4"
    HEX_WHITE = "FFFFFF"
    HEX_ROW_ALT = "FDF9F5"
    HEX_LIGHT_GREEN = "EAF5EE"
    HEX_BORDER = "D9C3B0"

    # --- Header Section with Logo ---
    logo_path = os.path.abspath("public/assets/habb-alsaad-logo-clean.png")
    if not os.path.exists(logo_path):
        logo_path = os.path.abspath("public/assets/habb-alsaad-logo.png")

    p_logo = doc.add_paragraph()
    set_p_rtl(p_logo, WD_ALIGN_PARAGRAPH.CENTER)
    if os.path.exists(logo_path):
        run_logo = p_logo.add_run()
        run_logo.add_picture(logo_path, width=Inches(1.8))
        p_logo.paragraph_format.space_after = Pt(6)

    # Document Title
    p_title = doc.add_paragraph()
    set_p_rtl(p_title, WD_ALIGN_PARAGRAPH.CENTER)
    add_run_rtl(p_title, "مَنَصَّة هَبّ السَّعْد | HABB ALSAAD", font_name="Arial", size_pt=22, bold=True, color=C_BROWN)
    p_title.paragraph_format.space_after = Pt(2)

    # Subtitle
    p_sub = doc.add_paragraph()
    set_p_rtl(p_sub, WD_ALIGN_PARAGRAPH.CENTER)
    add_run_rtl(p_sub, "دليل الحسابات التجريبية، بيانات الدخول، ومصفوفة صلاحيات النظام", font_name="Arial", size_pt=14, bold=True, color=C_GOLD)
    p_sub.paragraph_format.space_after = Pt(4)

    # Metadata note
    p_meta = doc.add_paragraph()
    set_p_rtl(p_meta, WD_ALIGN_PARAGRAPH.CENTER)
    add_run_rtl(p_meta, "وثيقة تشغيلية معتمدة • الإصدار التجريبي v1.3 • الكويت", font_name="Arial", size_pt=10, italic=True, color=C_GRAY)
    p_meta.paragraph_format.space_after = Pt(14)

    # Divider Table
    t_div = doc.add_table(rows=1, cols=1)
    t_div.alignment = WD_TABLE_ALIGNMENT.CENTER
    c_div = t_div.rows[0].cells[0]
    c_div.width = Inches(6.8)
    set_cell_background(c_div, HEX_GOLD)
    p_div = c_div.paragraphs[0]
    p_div.paragraph_format.space_before = Pt(1)
    p_div.paragraph_format.space_after = Pt(1)
    add_run_rtl(p_div, " ", size_pt=2)
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # --- Section 1: Unified Credentials Box ---
    p_sec1 = doc.add_paragraph()
    set_p_rtl(p_sec1, WD_ALIGN_PARAGRAPH.RIGHT)
    add_run_rtl(p_sec1, "1. بيانات الدخول الموحدة وبيئة التشغيل السريعة", font_name="Arial", size_pt=14, bold=True, color=C_BROWN)
    p_sec1.paragraph_format.space_after = Pt(6)

    t_box = doc.add_table(rows=1, cols=1)
    set_table_rtl(t_box)
    c_box = t_box.rows[0].cells[0]
    c_box.width = Inches(6.8)
    set_cell_background(c_box, HEX_IVORY)
    set_cell_padding(c_box, top=160, bottom=160, left=200, right=200)
    set_box_borders(c_box, border_color="C69A61", sz="16")

    items = [
        ("الرابط الأساسي للمنصة المحلية:", "http://localhost:5173", True),
        ("صفحة تسجيل الدخول العامة:", "/auth/login", True),
        ("كلمة المرور الموحدة لجميع الحسابات:", "Monasabati2026!", True),
        ("رمز التحقق التجريبي (OTP):", "123456", True),
        ("غرفة العرض السريعة (تبديل الأدوار بنقرة زر دون كلمة مرور):", "/demo", True),
        ("تسجيل حساب عميل جديد بالكامل:", "/auth/register  (يقبل أي بيانات تجريبية مع OTP: 123456)", False),
    ]

    p_first = c_box.paragraphs[0]
    set_p_rtl(p_first, WD_ALIGN_PARAGRAPH.RIGHT)
    add_run_rtl(p_first, "📌 مفاتيح الوصول السريع للمنصة:", font_name="Arial", size_pt=12, bold=True, color=C_BROWN)
    p_first.paragraph_format.space_after = Pt(6)

    for label, val, is_code in items:
        p_item = c_box.add_paragraph()
        set_p_rtl(p_item, WD_ALIGN_PARAGRAPH.RIGHT)
        p_item.paragraph_format.space_after = Pt(3)
        add_run_rtl(p_item, "• " + label + " ", font_name="Arial", size_pt=10.5, bold=True, color=C_DARK)
        if is_code:
            add_run_rtl(p_item, val, font_name="Courier New", size_pt=11, bold=True, color=C_BROWN)
        else:
            add_run_rtl(p_item, val, font_name="Arial", size_pt=10, bold=False, color=C_GRAY)

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # --- Section 2: Roles Summary Table ---
    p_sec2 = doc.add_paragraph()
    set_p_rtl(p_sec2, WD_ALIGN_PARAGRAPH.RIGHT)
    add_run_rtl(p_sec2, "2. جدول الحسابات والأدوار ونقاط الوصول", font_name="Arial", size_pt=14, bold=True, color=C_BROWN)
    p_sec2.paragraph_format.space_after = Pt(6)

    headers = ["الدور", "الاسم التمثيلي", "البريد الإلكتروني", "رابط البداية", "شرح الدور في سطر واحد"]
    col_widths = [Inches(1.0), Inches(1.1), Inches(1.4), Inches(0.9), Inches(2.4)]

    roles_data = [
        ("العميل\n(Customer)", "سارة العتيبي", "customer@demo.kw", "/dashboard", "تصفح الخدمات، تخطيط المناسبة عبر معالج من 6 خطوات، مراجعة عروض الأسعار، توقيع العقد، وسداد الدفعات وتتبع الحجز."),
        ("المورد\n(Supplier)", "دار المناسبات\n(وهويات v1/v4/v5/v8)", "supplier@demo.kw", "/supplier", "استقبال طلبات الحجز الموجهة له، تأكيد التوافر أو الاعتذار وتقديم بديل مع التكلفة، وتحديث مراحل التنفيذ الميداني."),
        ("منسقة المناسبات\n(Staff)", "ريم المنسقة", "staff@demo.kw", "/admin", "مراجعة الطلبات وتحديد الأسعار وهوامش الربح والتواصل مع الموردين واعتماد المرحلة الأولى للعرض دون صلاحيات الاسترداد."),
        ("المالك / المدير\n(Admin)", "أمل محمد", "admin@demo.kw", "/admin", "التحكم الكامل بالمنصة، اعتماد استثناءات الخصومات والتسعير، تنفيذ الاسترداد المالي، وإدارة الفريق وسجل التدقيق."),
    ]

    table = doc.add_table(rows=len(roles_data) + 1, cols=5)
    set_table_rtl(table)
    set_table_borders(table, color="D9C3B0", sz="4")

    # Header Row
    hdr_cells = table.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].width = col_widths[i]
        set_cell_background(hdr_cells[i], HEX_HEADER)
        set_cell_padding(hdr_cells[i], top=120, bottom=120, left=100, right=100)
        p = hdr_cells[i].paragraphs[0]
        set_p_rtl(p, WD_ALIGN_PARAGRAPH.CENTER)
        add_run_rtl(p, title, font_name="Arial", size_pt=10, bold=True, color=C_WHITE)

    # Data Rows
    for row_idx, data in enumerate(roles_data):
        row_cells = table.rows[row_idx + 1].cells
        bg_color = HEX_WHITE if row_idx % 2 == 0 else HEX_ROW_ALT
        for col_idx, text in enumerate(data):
            row_cells[col_idx].width = col_widths[col_idx]
            set_cell_background(row_cells[col_idx], bg_color)
            set_cell_padding(row_cells[col_idx], top=100, bottom=100, left=100, right=100)
            p = row_cells[col_idx].paragraphs[0]
            align = WD_ALIGN_PARAGRAPH.CENTER if col_idx in [0, 1, 2, 3] else WD_ALIGN_PARAGRAPH.RIGHT
            set_p_rtl(p, align)
            
            is_bold = (col_idx == 0 or col_idx == 1)
            is_code = (col_idx == 2 or col_idx == 3)
            font_name = "Courier New" if is_code else "Arial"
            text_color = C_BROWN if col_idx == 0 else (C_DARK if col_idx != 3 else C_BROWN)
            size = 9 if col_idx == 4 else 9.5
            add_run_rtl(p, text, font_name=font_name, size_pt=size, bold=is_bold, color=text_color)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # --- Section 3: Detailed Roles Breakdown ---
    p_sec3 = doc.add_paragraph()
    set_p_rtl(p_sec3, WD_ALIGN_PARAGRAPH.RIGHT)
    add_run_rtl(p_sec3, "3. الدليل التفصيلي للمسارات والمسؤوليات لكل دور", font_name="Arial", size_pt=14, bold=True, color=C_BROWN)
    p_sec3.paragraph_format.space_after = Pt(6)

    role_details = [
        {
            "title": "أولاً: دور العميل (Customer — سارة العتيبي)",
            "cred": "البريد: customer@demo.kw | كلمة المرور: Monasabati2026! | المسار: /dashboard",
            "routes": "/planner, /cart, /request-review, /quote/[id], /contract/[id], /checkout/[id], /payment-result, /dashboard, /bookings/[id], /favorites, /notifications, /profile, /support",
            "desc": [
                "تخطيط المناسبة عبر معالج تفاعلي من 6 خطوات: نوع المناسبة، التاريخ، المنطقة، عدد الضيوف، الميزانية، وتحديد الخدمات مع حفظ تلقائي للمسودة.",
                "مراجعة السلة وحسابات الأسعار التقديرية وتطبيق أكواد الخصم الترويجية (مثل MONASABATI10).",
                "استلام ومراجعة عروض الأسعار الصادرة من الإدارة، والموافقة عليها أو طلب تعديلات عليها.",
                "مراجعة بنود العقد القانوني وجدول الدفعات وسياسة الإلغاء، ثم توقيع العقد إلكترونياً (رسماً أو كتابة).",
                "سداد الدفعات المستحقة (30% عربون عند التعاقد، 40% قبل المناسبة بـ30 يوماً، 30% ختامية قبل 7 أيام) وتجربة حالات الدفع (نجاح، رفض البطاقة، تحقق 3DS، أو دفع معلق).",
                "متابعة لوحة الحجز الشخصية: العد التنازلي للمناسبة، شريط التقدم الزمني، حالة الموردين، وإمكانية طلب ملحق خدمات إضافي بعد الحجز."
            ]
        },
        {
            "title": "ثانياً: دور المورد (Supplier — دار المناسبات)",
            "cred": "البريد: supplier@demo.kw | كلمة المرور: Monasabati2026! | المسار: /supplier",
            "routes": "/supplier, /supplier/requests, /supplier/requests/[id], /supplier/jobs, /supplier/profile",
            "desc": [
                "بوابة مستقلة خاصة بالموردين تتيح تمثيل مختلف الموردين (مثل v1 للقاعات، v4 للزهور، v5 للبوفيه، v8 للتصوير) عبر غرفة العرض /demo.",
                "استلام طلبات الخدمات الموجهة للمورد وفحص تفاصيل المناسبة والتاريخ والمتطلبات الخاصة.",
                "تأكيد توفر الخدمة فوراً، أو الاعتذار عن تقديمها مع إمكانية اقتراح بديل وتحديد التكلفة والمدة التقديرية.",
                "إدارة التنفيذ الميداني للمناسبة وتحديث الحالة اللحظية: (قيد التحضير ➔ في الطريق ➔ تم التسليم/التركيب ➔ مكتمل / تسجيل عائق أو مشكلة).",
                "مستوى حماية للخصوصية والبيانات المالية: المورد يرى فقط طلباته وتكاليفه الخاصة، ولا يستطيع الاطلاع على أرباح الشركة أو أسعار البيع النهائية للعميل."
            ]
        },
        {
            "title": "ثالثاً: دور منسقة المناسبات والعمليات (Staff — ريم المنسقة)",
            "cred": "البريد: staff@demo.kw | كلمة المرور: Monasabati2026! | المسار: /admin",
            "routes": "/admin, /admin/orders, /admin/orders/[id], /admin/quotes, /admin/contracts, /admin/suppliers, /admin/catalog, /admin/packages, /admin/events, /admin/customers",
            "desc": [
                "استقبال طلبات العملاء فور إرسالها من السلة ومراجعة التفضيلات والجدول الزمني وموقع المناسبة.",
                "بناء وتعديل عروض الأسعار: اختيار تكلفة المورد لكل بند، تحديد سعر البيع للعميل، واحتساب هوامش الربح تلقائياً.",
                "التنسيق المباشر مع الموردين المعتذرين، واعتماد البدائل المقترحة أو تسجيل تأكيدات هاتفية موثقة.",
                "تسجيل اعتماد الموظف المبدئي (Staff Approval) وإرسال العرض للمالك في حال وجود خصومات أو استثناءات.",
                "محددات الصلاحية الصارمة: الموظفة لا تستطيع تنفيذ عمليات الاسترداد المالي (Refunds)، ولا تملك صلاحية اعتماد الاستثناءات السعرية التي تقل عن الحد الأدنى للهامش، ولا تستطيع تعديل صلاحيات المستخدمين."
            ]
        },
        {
            "title": "رابعاً: دور المالك / الإدارة العامة (Admin / Owner — أمل محمد)",
            "cred": "البريد: admin@demo.kw | كلمة المرور: Monasabati2026! | المسار: /admin",
            "routes": "/admin/approvals, /admin/payments, /admin/users, /admin/audit, /admin/reports, /admin/settings (بالإضافة لكافة مسارات النظام)",
            "desc": [
                "مركز الموافقات الاستثنائية: فحص طلبات الخصم والهوامش السعرية المنخفضة (NEEDS_OWNER_APPROVAL) مع تسجيل سبب الاعتماد الموثق.",
                "اعتماد وإصدار عروض الأسعار والعقود الرسمية الموجهة للعملاء (تطبيق مبدأ الرقابة الثنائية Double Approval).",
                "إدارة المدفوعات والسيادة المالية: تنفيذ عمليات الاسترداد الجزئي أو الكلي (Refunds) وإصدار الإشعارات الدائنة للعملاء.",
                "إدارة مستخدمي النظام وفريق العمل: إضافة موظفين جدد، تحديد الصلاحيات، تفعيل أو تعطيل الحسابات، وفحص حالة التحقق الثنائي MFA.",
                "سجل التدقيق الشامل (Audit Log): رقابة أمنية كاملة تسجل هوية الفاعل وتوقيته والقيم السابقة والجديدة وسبب الإجراء لكل عملية حساسة.",
                "تقارير الأداء المالي والتشغيلي: الإيرادات، الأرباح الإجمالية والصافية، معدلات تحويل العقود، وأداء وموثوقية الموردين."
            ]
        }
    ]

    for item in role_details:
        t_card = doc.add_table(rows=1, cols=1)
        set_table_rtl(t_card)
        c_card = t_card.rows[0].cells[0]
        c_card.width = Inches(6.8)
        set_cell_background(c_card, HEX_IVORY)
        set_cell_padding(c_card, top=120, bottom=120, left=160, right=160)
        set_box_borders(c_card, border_color="5A2D2D", sz="10")

        p_t = c_card.paragraphs[0]
        set_p_rtl(p_t, WD_ALIGN_PARAGRAPH.RIGHT)
        add_run_rtl(p_t, item["title"], font_name="Arial", size_pt=12, bold=True, color=C_BROWN)
        p_t.paragraph_format.space_after = Pt(3)

        p_c = c_card.add_paragraph()
        set_p_rtl(p_c, WD_ALIGN_PARAGRAPH.RIGHT)
        add_run_rtl(p_c, "🔑 " + item["cred"], font_name="Courier New", size_pt=9.5, bold=True, color=C_GOLD)
        p_c.paragraph_format.space_after = Pt(3)

        p_r = c_card.add_paragraph()
        set_p_rtl(p_r, WD_ALIGN_PARAGRAPH.RIGHT)
        add_run_rtl(p_r, "🌐 المسارات المتاحة: ", font_name="Arial", size_pt=9.5, bold=True, color=C_DARK)
        add_run_rtl(p_r, item["routes"], font_name="Courier New", size_pt=8.5, color=C_GRAY)
        p_r.paragraph_format.space_after = Pt(6)

        for d in item["desc"]:
            p_d = c_card.add_paragraph()
            set_p_rtl(p_d, WD_ALIGN_PARAGRAPH.RIGHT)
            p_d.paragraph_format.space_after = Pt(2.5)
            add_run_rtl(p_d, "✔ ", font_name="Arial", size_pt=9.5, bold=True, color=C_GREEN)
            add_run_rtl(p_d, d, font_name="Arial", size_pt=9.5, color=C_DARK)

        doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # --- Section 4: Permissions Matrix ---
    doc.add_page_break()

    p_sec4 = doc.add_paragraph()
    set_p_rtl(p_sec4, WD_ALIGN_PARAGRAPH.RIGHT)
    add_run_rtl(p_sec4, "4. مصفوفة الصلاحيات المقارنة بين الأدوار", font_name="Arial", size_pt=14, bold=True, color=C_BROWN)
    p_sec4.paragraph_format.space_after = Pt(6)

    matrix_headers = ["الوظيفة / الصلاحية", "العميل", "المورد", "منسقة العمليات", "المالك / المدير"]
    matrix_widths = [Inches(2.6), Inches(1.0), Inches(1.0), Inches(1.1), Inches(1.1)]

    matrix_rows = [
        ("تخطيط المناسبة وحجز الخدمات من الكتالوج", "✔ نعم", "✖ لا", "✔ مساعدة", "✔ نعم"),
        ("توقيع العقد وسداد الدفعات المالية للمناسبة", "✔ نعم", "✖ لا", "✖ لا", "✖ لا"),
        ("تأكيد توافر خدمات المورد وتحديث التنفيذ الميداني", "✖ لا", "✔ نعم (خاص به)", "✔ تسجيل موثق", "✔ نعم"),
        ("بناء وتعديل عروض الأسعار وتحديد هوامش الربح", "✖ لا", "✖ لا", "✔ نعم", "✔ نعم"),
        ("تسجيل اعتماد الموظف المبدئي (Staff Approval)", "✖ لا", "✖ لا", "✔ نعم", "✔ نعم"),
        ("اعتماد استثناءات الخصم والتسعير (Owner Approval)", "✖ لا", "✖ لا", "✖ لا (محظور)", "✔ نعم"),
        ("تنفيذ وإصدار عمليات الاسترداد المالي (Refunds)", "✖ لا", "✖ لا", "✖ لا (محظور)", "✔ نعم"),
        ("إدارة المستخدمين وإيقاف وتفعيل الحسابات", "✖ لا", "✖ لا", "✖ لا (محظور)", "✔ نعم"),
        ("الاطلاع على سجل التدقيق الأمني (Audit Logs)", "✖ لا", "✖ لا", "✖ لا", "✔ نعم"),
        ("تعديل إعدادات المنصة وسياسات الحجز والإلغاء", "✖ لا", "✖ لا", "✖ لا", "✔ نعم"),
    ]

    t_mat = doc.add_table(rows=len(matrix_rows) + 1, cols=5)
    set_table_rtl(t_mat)
    set_table_borders(t_mat, color="D9C3B0", sz="4")

    # Header
    for i, h in enumerate(matrix_headers):
        cell = t_mat.rows[0].cells[i]
        cell.width = matrix_widths[i]
        set_cell_background(cell, HEX_HEADER)
        set_cell_padding(cell, top=100, bottom=100, left=80, right=80)
        p = cell.paragraphs[0]
        set_p_rtl(p, WD_ALIGN_PARAGRAPH.CENTER)
        add_run_rtl(p, h, font_name="Arial", size_pt=9.5, bold=True, color=C_WHITE)

    # Rows
    for r_idx, r_data in enumerate(matrix_rows):
        row_cells = t_mat.rows[r_idx + 1].cells
        bg_color = HEX_WHITE if r_idx % 2 == 0 else HEX_ROW_ALT
        for c_idx, val in enumerate(r_data):
            cell = row_cells[c_idx]
            cell.width = matrix_widths[c_idx]
            set_cell_background(cell, bg_color)
            set_cell_padding(cell, top=80, bottom=80, left=80, right=80)
            p = cell.paragraphs[0]
            align = WD_ALIGN_PARAGRAPH.RIGHT if c_idx == 0 else WD_ALIGN_PARAGRAPH.CENTER
            set_p_rtl(p, align)
            
            color = C_DARK
            if "✔" in val:
                color = C_GREEN
            elif "✖" in val:
                color = RGBColor(0x99, 0x33, 0x33)
                
            add_run_rtl(p, val, font_name="Arial", size_pt=9, bold=(c_idx == 0 or "✔" in val), color=color)

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # --- Section 5: Step-by-Step Test Journey ---
    p_sec5 = doc.add_paragraph()
    set_p_rtl(p_sec5, WD_ALIGN_PARAGRAPH.RIGHT)
    add_run_rtl(p_sec5, "5. دليل سيناريو العرض التفاعلي الكامل (End-to-End Demo Journey)", font_name="Arial", size_pt=14, bold=True, color=C_BROWN)
    p_sec5.paragraph_format.space_after = Pt(6)

    steps = [
        ("الخطوة 1: رحلة العميل — إنشاء الطلب", "يدخل العميل (أو يسجل حساباً جديداً عبر /auth/register)، ويفتح مخطط المناسبة (/planner)، ويختار التاريخ والموقع والضيوف والخدمات، ثم يرسل السلة للمراجعة."),
        ("الخطوة 2: رحلة المورد — تأكيد الخدمات", "من غرفة العرض (/demo) يتم اختيار هوية المورد (v1 للقاعة، v4 للزهور، v5 للبوفيه، v8 للتصوير). يؤكد المورد الخدمات المطلوبة أو يعتذر ويقترح بديلاً."),
        ("الخطوة 3: رحلة المنسقة — مراجعة العرض", "تدخل منسقة العمليات (staff@demo.kw) لمسار الطلب (/admin/orders)، تعتمد بديل المورد، تضبط هوامش الربح، وتسجل اعتماد الموظف المبدئي."),
        ("الخطوة 4: رحلة المالك — الاعتماد الثنائي", "إذا تضمن العرض خصماً كبيراً يقل عن الهامش (مثل 1,000 د.ك)، يدخل المالك (admin@demo.kw) لمركز الموافقات (/admin/approvals) ويعتمد الاستثناء ويرسل العرض."),
        ("الخطوة 5: رحلة العميل — توقيع العقد والدفع", "يفتح العميل عرض السعر (/quote/MN-XXXX)، يوافق عليه، يراجع بنود العقد ويوقعه إلكترونياً، ثم يسدد الدفعة الأولى (30%) عبر بوابة الدفع المحاكاة."),
        ("الخطوة 6: التنفيذ والمتابعة", "تتحول المناسبة إلى 'حجز مؤكد'، ويتابع المورد التنفيذ الميداني (/supplier/jobs)، وتدير الإدارة جدول الفعاليات والمهام (/admin/events)."),
    ]

    for step_title, step_desc in steps:
        p_step = doc.add_paragraph()
        set_p_rtl(p_step, WD_ALIGN_PARAGRAPH.RIGHT)
        p_step.paragraph_format.space_after = Pt(3)
        add_run_rtl(p_step, "🔹 " + step_title + ": ", font_name="Arial", size_pt=10, bold=True, color=C_BROWN)
        add_run_rtl(p_step, step_desc, font_name="Arial", size_pt=9.5, color=C_DARK)

    # Footer note
    doc.add_paragraph().paragraph_format.space_after = Pt(10)
    p_ft = doc.add_paragraph()
    set_p_rtl(p_ft, WD_ALIGN_PARAGRAPH.CENTER)
    add_run_rtl(p_ft, "تم إنشاء هذه الوثيقة آلياً كدليل رسمي شامل لمنصة هَبّ السعد (مناسبتي) — جميع الحقوق محفوظة 2026 ©", font_name="Arial", size_pt=8.5, italic=True, color=C_GRAY)

    # Save Document
    output_filename = "MONASABATI_ROLES_AND_ACCESS_GUIDE.docx"
    output_path = os.path.abspath(output_filename)
    doc.save(output_path)
    print(f"Document successfully created at: {output_path}")
    return output_path

if __name__ == "__main__":
    build_roles_document()
