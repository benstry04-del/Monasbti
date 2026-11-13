import React, { useEffect, useState } from "react";
import { api, useStore } from "./store";
import { Btn, Field, Link, Price, Badge, StatusAlert, go } from "./main";
import { downloadXlsx } from "./excel-export.mjs";
import { FileSpreadsheet, Download, Printer, Mail, Plus } from "lucide-react";
import { hasPermission } from "./staff-permissions.mjs";
import { contentFields, homeSections } from "./content-fields.mjs";
import { occasions, pricePackage } from "./domain.mjs";

const entries = (event: React.FormEvent<HTMLFormElement>) =>
  Object.fromEntries(new FormData(event.currentTarget));
const statusLabels = {DRAFT:"مسودة",SENT:"مرسل",RECEIVED:"مستلم",CANCELLED:"ملغى"};
function useLoad(path: string) {
  const [data,setData] = useState<any>(null);
  const [error,setError] = useState("");
  const [revision,refresh] = useState(0);
  useEffect(() => {
    let live=true;
    setData(null);
    setError("");
    if (!path) return;
    api.backoffice(path).then(result => { if (live) setData(result); })
      .catch(failure => { if (live) setError(failure.message); });
    return () => { live=false; };
  },[path,revision]);
  return {data,error,refresh:()=>refresh(value=>value+1)};
}
function Notice({error}: {error:string}) {
  return error ? <StatusAlert tone="error" role="alert">{error}</StatusAlert> : null;
}

export function RolesManager() {
  const {data,error,refresh}=useLoad("/roles");
  const [role,setRole]=useState<any>(null);
  const [failure,setFailure]=useState("");
  const [busy,setBusy]=useState(false);
  const staff=useStore().users.filter(user=>user.role==="staff");
  async function submit(event, path, input) {
    event.preventDefault();
    setBusy(true);
    setFailure("");
    try { await api.backoffice(path,input); refresh(); }
    catch(error) { setFailure(error.message); }
    finally { setBusy(false); }
  }
  return <div className="grid two">
    <section className="card settings-form">
      <h2>الأدوار الوظيفية</h2>
      <Notice error={error || failure}/>
      <Btn intent="success" onClick={()=>setRole({name:"",active:true,permissions:[]})}>إضافة دور</Btn>
      {data?.roles.map(item=><div className="list-row" key={item.id}>
        <b>{item.name}</b><small>{item.members} موظف</small> <Badge status={item.active?"ACTIVE":"INACTIVE"}>{item.active?"نشط":"معطّل"}</Badge>
        <Btn variant="outline" intent="secondary" onClick={()=>setRole(item)}>عرض وتعديل</Btn>
        {Number(item.members)===0 && <Btn variant="text" intent="danger" disabled={busy} onClick={async()=>{
          if (!confirm("حذف هذا الدور؟")) return;
          setBusy(true);setFailure("");
          try {await api.backoffice("/roles/"+item.id+"/delete",{});setRole(null);refresh();}
          catch(error){setFailure(error.message);}
          finally{setBusy(false);}
        }}>حذف</Btn>}
      </div>)}
      <form onSubmit={event=>{
        const input=entries(event);
        submit(event,"/role-assignments",{userId:input.userId,roleId:input.roleId || null});
      }}>
        <h3>تعيين دور لموظف</h3>
        <Field label="الموظف"><select name="userId" required><option value="">اختيار</option>
          {staff.map(user=><option value={user.id} key={user.id}>{user.name} · {user.email}</option>)}</select></Field>
        <Field label="الدور"><select name="roleId"><option value="">دور التشغيل الأساسي</option>
          {data?.roles.filter(item=>item.active).map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
        <Btn type="submit" intent="success" loading={busy} disabled={busy}>حفظ التعيين</Btn>
      </form>
    </section>
    {role && <form className="card settings-form" key={role.id || "new"} onSubmit={event=>{
      const input=new FormData(event.currentTarget);
      submit(event,"/roles",{id:role.id,name:input.get("name"),active:input.has("active"),permissions:input.getAll("permission")});
    }}>
      <Field label="اسم الدور"><input name="name" required minLength={2} maxLength={100} defaultValue={role.name}/></Field>
      <label className="check-label"><input type="checkbox" name="active" defaultChecked={role.active}/> دور نشط</label>
      <fieldset><legend>الصلاحيات</legend>
        {Object.entries(data?.permissions || {}).map(([key,label])=><label className="check-label" key={key}>
          <input type="checkbox" name="permission" value={key} defaultChecked={role.permissions.includes(key)}/>{String(label)}
        </label>)}
      </fieldset>
      <Btn type="submit" intent="success" loading={busy} disabled={busy}>حفظ الدور</Btn>
    </form>}
  </div>;
}

export function AssistedBooking({s,act}) {
  const [step,setStep]=useState(0);
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<any[]>([]);
  const [customer,setCustomer]=useState<any>(null);
  const [occasion,setOccasion]=useState<any>(null);
  const [items,setItems]=useState<any[]>([]);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [selection,setSelection]=useState("");
  const selectedPackage = selection.startsWith("package|") ?
    s.packages.find(item=>item.id===selection.split("|")[1]) : null;
  async function run(work) {
    setBusy(true);setError("");
    try { await work(); }
    catch(error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <section className="card settings-form">
    <div className="tabs" aria-label="خطوات الحجز">{["العميل","المناسبة","الخدمات والباقات","المراجعة"].map((title,index)=>
      <button type="button" key={title} aria-current={step===index?"step":undefined} disabled={index>step} onClick={()=>setStep(index)}>{title}</button>)}</div>
    <Notice error={error}/>
    {step===0 && <>
      <form onSubmit={event=>{event.preventDefault();run(async()=>{
        setResults((await api.records("customers",{q:query,pageSize:20})).items);
      });}}>
        <Field label="بحث عن عميل"><input required value={query} onChange={event=>setQuery(event.target.value)} placeholder="الاسم أو البريد أو الهاتف"/></Field>
        <Btn type="submit" intent="info" loading={busy} disabled={busy}>بحث</Btn>
      </form>
      {results.map(item=><div className="list-row" key={item.id}><span>{item.name} · {item.email}</span>
        <Btn intent="primary" onClick={()=>{setCustomer(item);setStep(1);}}>اختيار العميل</Btn></div>)}
      {hasPermission(s.session,"customers.create") && <details><summary>إضافة عميل وإرسال دعوة</summary>
        <form onSubmit={event=>{event.preventDefault();const input=entries(event);run(async()=>{
          const result=await api.inviteCustomer(input);
          setCustomer({...input,id:result.id});
          setStep(1);
        });}}>
          <Field label="اسم العميل"><input required name="name" minLength={2}/></Field>
          <Field label="البريد"><input required name="email" type="email"/></Field>
          <Field label="الهاتف"><input name="mobile" type="tel"/></Field>
          <Btn type="submit" intent="success" loading={busy} disabled={busy}>إنشاء الحساب ودعوته</Btn>
        </form>
      </details>}
    </>}
    {step===1 && <form onSubmit={event=>{
      event.preventDefault(); const input=entries(event); setOccasion({...input,guests:Number(input.guests)});setStep(2);
    }}>
      <p>{customer.name} · {customer.email}</p>
      <Field label="نوع المناسبة"><select name="type" defaultValue={occasion?.type}>{occasions.map(type=><option key={type}>{type}</option>)}</select></Field>
      <Field label="التاريخ"><input required name="date" type="date" defaultValue={occasion?.date}/></Field>
      <Field label="الموقع"><input required name="location" defaultValue={occasion?.location}/></Field>
      <Field label="عدد الضيوف"><input required name="guests" type="number" min={1} defaultValue={occasion?.guests || 1}/></Field>
      <Field label="ملاحظات"><textarea name="notes" defaultValue={occasion?.notes}/></Field>
      <Btn type="submit" intent="primary">اختيار الخدمات</Btn>
    </form>}
    {step===2 && <>
      <form onSubmit={event=>{
        event.preventDefault(); const input=entries(event);
        const [kind,id]=String(input.item).split("|");
        const product=(kind==="package"?s.packages:s.services).find(item=>item.id===id);
        if (!product) return;
        if (items.some(item=>item.id===id && item.kind===kind)) {setError("العنصر موجود؛ احذفه أولًا لتغيير اختياره.");return;}
        const extras = new FormData(event.currentTarget).getAll("extra");
        const qty = kind==="package" ? 1 : Number(input.qty);
        try {
          const amount = kind==="package"
            ? pricePackage(product,s.services,occasion.guests,input.option,extras).total : product.price*qty;
          setError("");
          setItems([...items,{id,kind,qty,option:input.option,extras,name:product.title,amount}]);
        } catch(error) { setError(error.message); }
      }}>
        <Field label="الخدمة أو الباقة"><select required name="item" value={selection} onChange={event=>setSelection(event.target.value)}><option value="">اختيار</option>
          <optgroup label="الخدمات">{s.services.map(item=><option key={item.id} value={"service|"+item.id}>{item.title}</option>)}</optgroup>
          <optgroup label="الباقات">{s.packages.map(item=><option key={item.id} value={"package|"+item.id}>{item.title}</option>)}</optgroup>
        </select></Field>
        {!selection.startsWith("package|") && <Field label="كمية الخدمة"><input name="qty" type="number" min={1} max={10000} defaultValue={1} required/></Field>}
        {selectedPackage?.configuration?.options.length ? <Field label="خيار الباقة">
          <select key={selectedPackage.id} name="option">
            {selectedPackage.configuration.options.map(option=><option key={option.name}>{option.name}</option>)}
          </select>
        </Field> : <Field label="خيار التخصيص"><input name="option" maxLength={120}/></Field>}
        {!!selectedPackage?.configuration?.extraServiceIds.length && <fieldset key={selectedPackage.id}>
          <legend>الخدمات الإضافية</legend>
          {s.services.filter(service=>selectedPackage.configuration.extraServiceIds.includes(service.id)).map(service=>
            <label className="check-label" key={service.id}><input name="extra" type="checkbox" value={service.id}/>{service.title}</label>
          )}
        </fieldset>}
        <Btn type="submit" intent="success">إضافة</Btn>
      </form>
      {items.map((item,index)=><div className="list-row" key={item.kind+item.id}><b>{item.name}</b><span>{item.qty}</span>
        <Btn variant="text" intent="danger" onClick={()=>setItems(items.filter((_,position)=>position!==index))}>حذف</Btn></div>)}
      <Btn intent="primary" onClick={()=>setStep(3)} disabled={!items.length}>مراجعة الطلب</Btn>
    </>}
    {step===3 && <form onSubmit={async event=>{
      event.preventDefault(); const input=entries(event);setBusy(true);
      try {
        const result=await act("ASSISTED_SUBMIT",{customerId:customer.id,occasion,
          items:items.map(({name,amount,...item})=>item),discount:Number(input.discount || 0)});
        if (result?.activeOrder) go("/admin/orders/"+result.activeOrder);
      } finally {setBusy(false);}
    }}>
      <p>{customer.name} · {occasion.type} · {occasion.date} · {occasion.guests} ضيف</p>
      <ul>{items.map(item=><li key={item.id}>{item.name}{item.kind==="service" && " × "+item.qty}</li>)}</ul>
      {hasPermission(s.session,"discounts.view") && <Field label="الخصم بالدينار"><input name="discount" type="number" min={0} step=".001" defaultValue={0}/></Field>}
      <p>الإجمالي التقديري <Price value={items.reduce((sum,item)=>sum+item.amount,0)}/></p>
      <p>بعد إنشاء الطلب يمكن إصدار العرض ومتابعة العقد من تفاصيله.</p>
      <Btn type="submit" intent="success" loading={busy} disabled={busy}>إنشاء الطلب</Btn>
    </form>}
  </section>;
}

export function BackofficeRecords({kind,id,s}) {
  const [page,setPage]=useState(1);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const purchase=kind==="procurement", base="/admin/"+kind;
  const endpoint="/records/"+kind;
  const query = new URLSearchParams(location.search);
  query.set("page",String(page));
  const listing=useLoad(id?"":endpoint+"?"+query);
  const detail=useLoad(id && id!=="new"?endpoint+"/"+id:"");
  const record=detail.data?.record;
  const data=record?.data || {};
  const [lines,setLines]=useState<any[]>([]);
  useEffect(()=>setLines(record?.data?.items || [{name:"",serviceId:null,quantity:1,unitCost:0}]),[record?.id]);
  const canEdit=hasPermission(s.session,kind+".edit");
  const title=purchase?"طلب التوريد":"المصروف";
  if (!id) return <section className="card settings-form">
    <Notice error={listing.error}/>
    <div className="button-row">
      {canEdit && <Btn intent="success" to={base+"/new"}><Plus size={16} aria-hidden="true" />إضافة {title}</Btn>}
      {!!listing.data?.items?.length && <Btn variant="outline" intent="info" onClick={() => {
        const rows = listing.data.items.map((item: any) => purchase
          ? [item.id, item.data?.items?.[0]?.name || "", item.delivery_date?.slice(0, 10) || "", Number(item.amount_minor || 0) / 1000, Number(item.paid_minor || 0) / 1000, { code: item.status, label: statusLabels[item.status] || item.status }]
          : [item.id, item.data?.category || "", item.data?.recipient || "", item.expense_date?.slice(0, 10) || "", item.data?.method || "", Number(item.amount_minor || 0) / 1000, Number(item.paid_minor || 0) / 1000, { code: item.archived ? "ARCHIVED" : "ACTIVE", label: item.archived ? "مؤرشف" : "نشط" }]);
        const totalAmount = listing.data.items.reduce((sum: number, item: any) => sum + Number(item.amount_minor || 0) / 1000, 0);
        const totalPaid = listing.data.items.reduce((sum: number, item: any) => sum + Number(item.paid_minor || 0) / 1000, 0);
        downloadXlsx(kind + ".xlsx", {
          sheets: [{
            name: purchase ? "طلبات التوريد" : "المصروفات",
            title: purchase ? "هَبّ السعد — سجل طلبات التوريد" : "هَبّ السعد — سجل المصروفات التشغيلية",
            columns: purchase
              ? [{ header: "المرجع", type: "code", width: 18 }, { header: "الصنف الرئيسي", type: "text", width: 26 }, { header: "تاريخ التسليم", type: "date", width: 15 }, { header: "الإجمالي (د.ك)", type: "currency", width: 17 }, { header: "المدفوع (د.ك)", type: "currency", width: 17 }, { header: "الحالة", type: "status", width: 16 }]
              : [{ header: "المرجع", type: "code", width: 18 }, { header: "التصنيف", type: "text", width: 20 }, { header: "المستفيد", type: "text", width: 20 }, { header: "التاريخ", type: "date", width: 15 }, { header: "الوسيلة", type: "text", width: 15 }, { header: "المبلغ (د.ك)", type: "currency", width: 16 }, { header: "المدفوع (د.ك)", type: "currency", width: 16 }, { header: "الحالة", type: "status", width: 15 }],
            rows,
            totals: purchase ? ["الإجمالي", `${rows.length} طلب`, "", totalAmount, totalPaid, ""] : ["الإجمالي", `${rows.length} مصروف`, "", "", "", totalAmount, totalPaid, ""],
          }],
        });
      }}><FileSpreadsheet size={16} aria-hidden="true" />تصدير Excel</Btn>}
    </div>
    {listing.data?.items.map(item=><div className="list-row" key={item.id}>
      <Link to={base+"/"+item.id}>{purchase?item.data.items[0]?.name:item.data.category}</Link>
      <span>{item.delivery_date?.slice(0,10) || item.expense_date?.slice(0,10)}</span>
      {purchase && item.status && <Badge status={item.status}>{statusLabels[item.status] || item.status}</Badge>}
      {!purchase && <Badge status={item.archived ? "ARCHIVED" : "ACTIVE"}>{item.archived ? "مؤرشف" : "نشط"}</Badge>}
      <Price value={Number(item.amount_minor)/1000}/>
    </div>)}
    {listing.data?.items.length===0 && <p>لا توجد سجلات.</p>}
    <div className="button-row">
      <Btn variant="outline" intent="info" disabled={page===1} onClick={()=>setPage(page-1)}>السابق</Btn>
      <Btn variant="outline" intent="info" disabled={!listing.data?.hasNext} onClick={()=>setPage(page+1)}>التالي</Btn>
    </div>
  </section>;
  if (id!=="new" && !record) return <section className="card"><Notice error={detail.error}/>{!detail.error && <StatusAlert tone="in-progress" role="status">جارٍ التحميل…</StatusAlert>}</section>;
  if (!canEdit && !record) return <Notice error="هذا الإجراء غير مخوّل"/>;
  return <section className="card settings-form">
    <div className="button-row">
      <Link className="btn ghost intent-primary" to={base}>العودة للقائمة</Link>
      {record && purchase && <a className="btn outline intent-info" href={"/api/backoffice"+endpoint+"/"+id+"/print?format=pdf"} download><Download size={16} aria-hidden="true" />تنزيل PDF</a>}
      {record && purchase && <a className="btn outline intent-info" target="_blank" rel="noreferrer" href={"/api/backoffice"+endpoint+"/"+id+"/print"}><Printer size={16} aria-hidden="true" />فتح للطباعة أو الحفظ PDF</a>}
      {record && purchase && <a className="btn outline intent-secondary" href={`mailto:?subject=${encodeURIComponent("طلب توريد "+id)}&body=${encodeURIComponent(data.items.map(line=>line.name+" × "+line.quantity).join("\n")+"\n"+String(record.delivery_date).slice(0,10)+"\n"+data.notes)}`}><Mail size={16} aria-hidden="true" />مشاركة بالبريد</a>}
    </div>
    {record && <div className="list-row"><span>{record.id}</span><Price value={Number(record.amount_minor)/1000}/>
      <span>المتبقي <Price value={(Number(record.amount_minor)-Number(record.paid_minor))/1000}/></span></div>}
    <Notice error={error}/>
    <form key={record?.version || "new"} onSubmit={async event=>{
      event.preventDefault(); const form=entries(event);setError("");setBusy(true);
      try {
        const attachment=form.attachment as File;
        const fileId=attachment?.size ? (await api.upload(attachment)).id : data.fileId || null;
        const shared={version:record?.version,bookingId:form.bookingId || null,supplierId:form.supplierId || null,
          date:form.date,paid:Math.round(Number(form.paid)*1000),notes:form.notes,invoice:form.invoice,fileId};
        const input=purchase?{...shared,status:form.status,items:lines}:
          {...shared,category:form.category,recipient:form.recipient,method:form.method,recurring:form.recurring,
            archived:form.archived==="on",amount:Math.round(Number(form.amount)*1000)};
        const saved=await api.backoffice(endpoint+"/"+id,input);
        if (id==="new") go(base+"/"+saved.id); else detail.refresh();
      } catch(error){setError(error.message);}
      finally {setBusy(false);}
    }}>
      <fieldset disabled={!canEdit || busy || record?.archived || record?.status==="CANCELLED"}>
        <Field label={purchase?"تاريخ التسليم":"تاريخ المصروف"}><input required name="date" type="date" defaultValue={data.date}/></Field>
        <Field label="المورد"><select name="supplierId" required={purchase} defaultValue={data.supplierId || ""}>
          <option value="">اختيار</option>{s.suppliers.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
        <Field label="مرجع الحجز (اختياري)"><input name="bookingId" defaultValue={data.bookingId}/></Field>
        {purchase ? <>
          <Field label="الحالة"><select name="status" defaultValue={record?.status || "DRAFT"}>
            {Object.entries(statusLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></Field>
          {lines.map((line,index)=><div className="grid three" key={index}>
            <Field label="الخدمة المرتبطة"><select value={line.serviceId || ""} onChange={event=>{
              const item=s.services.find(item=>item.id===event.target.value);
              setLines(lines.map((value,position)=>position===index?{...value,serviceId:item?.id || null,name:item?.title || value.name}:value));
            }}><option value="">صنف يدوي</option>{s.services.map(item=><option value={item.id} key={item.id}>{item.title}</option>)}</select></Field>
            <Field label="الصنف"><input value={line.name} required onChange={event=>setLines(lines.map((item,position)=>position===index?{...item,name:event.target.value}:item))}/></Field>
            <Field label="الكمية"><input type="number" min={1} value={line.quantity} required onChange={event=>setLines(lines.map((item,position)=>position===index?{...item,quantity:Number(event.target.value)}:item))}/></Field>
            <Field label="تكلفة الوحدة"><input type="number" min=".001" step=".001" value={line.unitCost/1000} required onChange={event=>setLines(lines.map((item,position)=>position===index?{...item,unitCost:Math.round(Number(event.target.value)*1000)}:item))}/></Field>
            <Btn variant="text" intent="danger" disabled={lines.length===1} onClick={()=>setLines(lines.filter((_,position)=>position!==index))}>إزالة الصنف</Btn>
          </div>)}
          <Btn variant="outline" intent="secondary" onClick={()=>setLines([...lines,{name:"",serviceId:null,quantity:1,unitCost:0}])}>إضافة صنف</Btn>
        </> : <>
          <Field label="التصنيف"><input required name="category" defaultValue={data.category}/></Field>
          <Field label="المستفيد"><input name="recipient" defaultValue={data.recipient}/></Field>
          <Field label="المبلغ بالدينار"><input name="amount" required type="number" min=".001" step=".001" defaultValue={record?Number(record.amount_minor)/1000:undefined}/></Field>
          <Field label="طريقة الدفع"><input name="method" required defaultValue={data.method}/></Field>
          <Field label="التكرار"><select name="recurring" defaultValue={data.recurring || "none"}>
            <option value="none">مرة واحدة</option><option value="monthly">شهري</option><option value="yearly">سنوي</option></select></Field>
          {record && <label className="check-label"><input name="archived" type="checkbox" defaultChecked={record.archived}/> أرشفة السجل</label>}
        </>}
        <Field label="المدفوع بالدينار"><input name="paid" required type="number" min={0} step=".001" defaultValue={record?Number(record.paid_minor)/1000:0}/></Field>
        <Field label="مرجع الفاتورة"><input name="invoice" defaultValue={data.invoice}/></Field>
        <Field label="إرفاق مستند"><input type="file" name="attachment" accept="application/pdf,image/png,image/jpeg,image/webp"/></Field>
        <Field label="الملاحظات والشروط"><textarea name="notes" defaultValue={data.notes}/></Field>
        {canEdit && <Btn type="submit" intent="success" loading={busy}>حفظ {title}</Btn>}
      </fieldset>
    </form>
    {data.fileId && <a href={"/api/files/"+data.fileId}>تنزيل المستند</a>}
    {data.bookingId && <Link to={"/admin/orders/"+data.bookingId}>فتح الحجز المرتبط</Link>}
    {data.supplierId && <Link to={"/admin/suppliers/"+data.supplierId}>فتح ملف المورد</Link>}
    {!!detail.data?.history.length && <><h3>سجل التغييرات</h3>{detail.data.history.map((item,index)=><p key={index}>{item.name} · {new Date(item.created_at).toLocaleString("ar-KW")}</p>)}</>}
  </section>;
}

export function ContentManager({s}) {
  const [search,setSearch]=useState("");
  const [group,setGroup]=useState("الرئيسية");
  const [field,setField]=useState(contentFields[0]);
  const [value,setValue]=useState(s.content?.[contentFields[0][0]] ?? contentFields[0][4]);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [previewWidth,setPreviewWidth]=useState("100%");
  const revision=useLoad("/content/"+field[0]);
  const fields=contentFields.filter(item=>search?(item.join(" ")+" "+(s.content?.[item[0]] || "")).includes(search):item[1]===group);
  const canEdit=hasPermission(s.session,"content.edit"), canPublish=hasPermission(s.session,"content.publish");
  async function save(input) {
    setBusy(true);setError("");
    try {await api.backoffice("/content/"+field[0],input);revision.refresh();await api.refresh(true);}
    catch(error){setError(error.message);}
    finally{setBusy(false);}
  }
  const preview="/"+(field[0].startsWith("auth.")?"auth/"+field[0].split(".")[1]:
    field[0].startsWith("booking.cart.")?"cart":field[0].startsWith("booking.planner.")?"planner":field[0].startsWith("pages.")?field[0].split(".")[1]:"")+"?contentPreview=1";
  return <div className="grid two">
    <section className="card settings-form">
      <Field label="بحث المحتوى"><input type="search" value={search} onChange={event=>setSearch(event.target.value)}/></Field>
      <Field label="الصفحة"><select value={group} onChange={event=>setGroup(event.target.value)}>
        {[...new Set(contentFields.map(item=>item[1]))].map(item=><option key={item}>{item}</option>)}</select></Field>
      {fields.map(item=><div className="list-row" key={item[0]}>
        <span>{item[1]} · {item[2]}</span><Btn variant="text" intent="secondary" onClick={()=>{setField(item);setValue(s.content?.[item[0]] ?? item[4]);}}>{item[3]}</Btn>
      </div>)}
    </section>
    <section className="card settings-form">
      <h2>{field[2]} · {field[3]}</h2>
      <Notice error={error || revision.error}/>
      {field[0]==="home.sections.order" ? <ol>
        {(value || homeSections.join(",")).split(",").map((section,index,order)=><li className="list-row" key={section}>
          <span>{contentFields.find(item=>item[0]==="home."+section+".visible")?.[2] || section}</span>
          {[-1,1].map(direction=><Btn key={direction} variant="outline"
            disabled={!canEdit || index+direction<0 || index+direction>=order.length}
            onClick={()=>{
              const next=[...order];
              [next[index],next[index+direction]]=[next[index+direction],next[index]];
              setValue(next.join(","));
            }}>{direction<0?"لأعلى":"لأسفل"}</Btn>)}
        </li>)}
      </ol> : <Field label="القيمة">{field[0].endsWith(".visible") ?
        <select disabled={!canEdit} value={value} onChange={event=>setValue(event.target.value)}>
          <option value="true">ظاهر</option><option value="false">مخفي</option>
        </select> : <textarea rows={4} disabled={!canEdit} value={value} onChange={event=>setValue(event.target.value)}/>}
      </Field>}
      {canEdit && /\.(image|video)$/.test(field[0]) && <Field label="رفع وسائط">
        <input type="file" disabled={busy} accept={field[0].endsWith(".image")?"image/png,image/jpeg,image/webp":"video/mp4,video/webm"} onChange={async event=>{
          const file=event.target.files?.[0];
          if (!file) return;
          setBusy(true);setError("");
          try {
            const form=new FormData();
            form.append("file",file);
            const result=await api.backoffice("/content-media",form);
            setValue(result.path);
          } catch(error) {setError(error.message);}
          finally {setBusy(false);}
        }}/>
      </Field>}
      <div className="button-row">
        {canEdit && <Btn intent="secondary" loading={busy} disabled={busy} onClick={()=>save({action:"draft",value})}>حفظ مسودة</Btn>}
        <Btn variant="outline" intent="info" onClick={()=>{
          sessionStorage.setItem("habb:content-preview",JSON.stringify({[field[0]]:value}));
          const frame=document.querySelector<HTMLIFrameElement>("#content-preview");
          if(frame) frame.src=preview;
        }}>معاينة الصفحة</Btn>
      </div>
      <Field label="عرض المعاينة"><select value={previewWidth} onChange={event=>setPreviewWidth(event.target.value)}>
        <option value="100%">عرض المساحة</option><option value="390px">هاتف</option><option value="1024px">تابلت أو كمبيوتر</option>
      </select></Field>
      <div style={{maxWidth:"100%",overflow:"auto"}}>
        <iframe id="content-preview" title="معاينة محتوى الموقع" style={{width:previewWidth,minHeight:380,border:0}}/>
      </div>
      <h3>النسخ السابقة</h3>
      {revision.data?.map(item=><div className="list-row" key={item.id}>
        <span><Badge status={item.current?"ACTIVE":item.published_at?"SENT":"DRAFT"}>{item.current?"منشورة":item.published_at?"إصدار سابق":"مسودة"}</Badge> · {new Date(item.created_at).toLocaleString("ar-KW")}</span>
        <Btn variant="text" intent="info" onClick={()=>setValue(item.value)}>عرض</Btn>
        {canPublish && !item.current && <Btn intent={item.published_at?"warn":"success"} loading={busy} disabled={busy} onClick={()=>save({action:"publish",id:item.id})}>{item.published_at?"استعادة":"نشر"}</Btn>}
      </div>)}
    </section>
  </div>;
}

const fieldLabels = {
  id:"المرجع", name:"الاسم", title:"العنوان", email:"البريد", mobile:"الهاتف", status:"الحالة",
  role:"الدور", active:"نشط", available:"متاح", category:"التصنيف", price:"السعر بالدينار",
  cost:"التكلفة بالدينار", capacity:"السعة", amount:"المبلغ بالدينار", refunded:"المسترد بالدينار",
  method:"طريقة الدفع", receipt:"مرجع الإيصال", at:"التاريخ", action:"الإجراء", actor:"المستخدم",
  entity:"السجل المرتبط", bookingCount:"عدد الحجوزات", paidTotal:"المدفوع", description:"الوصف",
};
export function RecordDetails({kind,id,back}) {
  const s=useStore();
  const detail=useServerValueForRecord(kind,id);
  const row=detail.data?.items[0];
  if (detail.error || !row) return <section className="card settings-form"><Link className="btn ghost intent-primary" to={back}>العودة للقائمة</Link>
    {detail.error ? <StatusAlert tone="error" role="alert">{detail.error}</StatusAlert> : <StatusAlert tone={detail.data?"inactive":"in-progress"} role="status">{detail.data?"السجل غير موجود":"جارٍ تحميل التفاصيل…"}</StatusAlert>}
  </section>;
  const related=s.suppliers.find(item=>item.id===row.supplierId);
  return <section className="card settings-form">
    <Link className="btn ghost intent-primary" to={back}>العودة للقائمة</Link>
    <h2>{row.name || row.title || row.receipt || row.action || row.id}</h2>
    <dl className="grid two">
      {Object.entries(fieldLabels).filter(([key])=>row[key]!==undefined && row[key]!==null)
        .map(([key,label])=><div key={key}><dt>{label}</dt><dd>{key==="status"?<Badge status={row[key]} />:key==="active"?<Badge status={row[key]?"ACTIVE":"INACTIVE"}>{row[key]?"نعم":"لا"}</Badge>:typeof row[key]==="boolean"?(row[key]?"نعم":"لا"):String(row[key])}</dd></div>)}
    </dl>
    {related && <Link to={"/admin/suppliers/"+related.id}>{related.name}</Link>}
    {row.orderId && <Link to={"/admin/orders/"+row.orderId}>الحجز المرتبط</Link>}
    {kind==="payments" && <div className="button-row">
      <a className="btn outline intent-info" href={"/api/documents/receipt/"+row.id+"?format=pdf"} download><Download size={16} aria-hidden="true" />تنزيل الإيصال PDF</a>
      <a className="btn outline intent-info" href={"/api/documents/receipt/"+row.id} download><Download size={16} aria-hidden="true" />تنزيل الإيصال HTML</a>
    </div>}
    {kind==="payments" && <section>
      <h3>عمليات الاسترداد</h3>
      {row.refunds?.length ? row.refunds.map(refund=><div className="list-row" key={refund.id}>
        <span>{refund.id}</span><Price value={refund.amount}/>
        <Badge status={refund.status}/><time>{new Date(refund.created_at).toLocaleDateString("ar-KW")}</time>
      </div>) : <p>لا توجد عمليات استرداد لهذا الدفع.</p>}
    </section>}
    {row.recentBookings?.map(item=><Link className="list-row" key={item.id} to={"/admin/orders/"+item.id}>{item.id} · {item.occasion?.type}</Link>)}
    {row.serviceIds?.map(id=><Link className="list-row" key={id} to={"/admin/catalog/"+id}>{s.services.find(item=>item.id===id)?.title || id}</Link>)}
    {kind==="audit" && (row.before || row.after) && <details><summary>بيانات العملية</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify({قبل:row.before,بعد:row.after},null,2)}</pre></details>}
  </section>;
}
function useServerValueForRecord(kind,id) {
  const [data,setData]=useState<any>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    let live=true;
    api.records(kind,{id,pageSize:1}).then(result=>{if(live)setData(result);})
      .catch(failure=>{if(live)setError(failure.message);});
    return()=>{live=false;};
  },[kind,id]);
  return {data,error};
}
