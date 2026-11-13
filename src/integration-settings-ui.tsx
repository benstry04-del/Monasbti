import React,{useState,useEffect} from 'react';
import {api,isDemo} from './store';
import {Field,Btn,Empty,Badge,StatusAlert} from './main';
const choices:any={sandbox:'اختبار',live:'إنتاج',bridge:'جهة ربط خارجية',smtp:'خادم بريد',resend:'بريد مع تتبع التسليم',clickwrap:'موافقة موثقة',true:'نعم',false:'لا'};
function IntegrationCard({item,reload}:any){
  const initial=()=>Object.fromEntries(item.fields.map((f:any)=>[f.name,f.secret?'':f.value]));
  const [values,setValues]=useState<any>(initial),[password,setPassword]=useState(''),[clear,setClear]=useState<string[]>([]),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  useEffect(()=>{setValues(initial());setClear([]);},[item.revision]);
  async function run(action:string){
    setBusy(true);setError('');setMessage('');
    try{const result=await api.integrationAction(item.id,action,{password,revision:item.revision,...(action==='save'?{values,clearSecrets:clear}:{}),...(action==='activate' && item.id==='signature'?{certifiedProviderConfirmed:confirmed}:{})});
      setMessage(result.message || (action==='save'?'حُفظت المسودة مشفرة؛ الخدمة العاملة لم تتغير.':action==='disable'?'أُوقفت العمليات الجديدة؛ تستمر متابعة العمليات السابقة.':'تمت العملية'));
      setPassword('');setValues((v:any)=>Object.fromEntries(item.fields.map((f:any)=>[f.name,f.secret?'':v[f.name]])));await reload();
    }catch(e:any){setError(e.message);}finally{setPassword('');setBusy(false);}
  }
  return <section className="card integration-card" aria-label={item.label}>
    <div className="row-between"><h3>{item.label}</h3><Badge status={item.enabled?'ACTIVE':'INACTIVE'}>{item.enabled?'مفعّل':'غير مفعّل'}</Badge></div>
    {item.revision>0 && <p><small>المسودة {item.revision} · النسخة المفعّلة {item.activeRevision}</small></p>}
    {item.enabled && item.revision!==item.activeRevision && <StatusAlert tone="warning">مسودة جديدة؛ تظل النسخة السابقة عاملة حتى ينجح الفحص والتفعيل.</StatusAlert>}
    {item.restart && <StatusAlert tone="info">هذه بيانات الاستضافة المطلوبة. تطبيق النطاق وقاعدة البيانات والنسخ على الخادم يتطلب نشرًا فعليًا؛ حفظها هنا لا يغيّر بيئة التشغيل.</StatusAlert>}
    {item.id==='payouts' && <p>أدخل بيانات جهة التحويل المعتمدة. حساب دفع العملاء لا يفعّل تحويلات الموردين تلقائيًا.</p>}
    {item.id==='signature' && <p>هذا الربط اختياري. تعتمد الصفة القانونية على الجهة واتفاقك التجاري معها.</p>}
    {item.fields.map((f:any)=><div key={f.name}><Field label={f.label}>
      {f.enum?<select aria-label={f.label} value={values[f.name] || f.default || ''} onChange={e=>setValues({...values,[f.name]:e.target.value})}>{!f.default && <option value="">اختر</option>}{f.enum.map((v:string)=><option value={v} key={v}>{choices[v] || v}</option>)}</select>:<input aria-label={f.label} type={f.secret?'password':f.url?'url':'text'} value={values[f.name] || ''} autoComplete={f.secret?'new-password':'off'} spellCheck={false} maxLength={16000} onChange={e=>setValues({...values,[f.name]:e.target.value})} placeholder={f.secret && f.configured?'محفوظ؛ اتركه فارغًا للاحتفاظ به':''} />}
      {f.secret && <small>{f.configured?'يوجد مفتاح محفوظ ولن يُعرض مجددًا':'لم يُدخل مفتاح بعد'}</small>}
    </Field>{f.secret && f.configured && <label className="check"><input type="checkbox" checked={clear.includes(f.name)} onChange={e=>setClear(e.target.checked?[...clear,f.name]:clear.filter(k=>k!==f.name))} />حذف المفتاح المحفوظ: {f.label}</label>}</div>)}
    {item.id==='signature' && values.ESIGNATURE_MODE==='bridge' && <label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />أؤكد اعتماد جهة التوقيع تجاريًا ومراجعة شروطها</label>}
    <Field label="كلمة مرور المالك لتأكيد التغيير"><input type="password" value={password} autoComplete="current-password" onChange={e=>setPassword(e.target.value)} /></Field>
    {message && <StatusAlert tone="success" role="status">{message}</StatusAlert>}{error && <StatusAlert tone="error" role="alert">{error}</StatusAlert>}
    {item.lastCheck?.message && <StatusAlert tone="info">آخر فحص: {item.lastCheck.message}</StatusAlert>}
    <div className="button-row"><Btn intent="secondary" loading={busy} disabled={busy || !password} onClick={()=>run('save')}>حفظ المسودة</Btn>
      {!item.restart && <><Btn variant="outline" intent="warn" loading={busy} disabled={busy || !password || !item.revision} onClick={()=>run('check')}>اختبار دون خصم أو إرسال</Btn><Btn intent="success" loading={busy} disabled={busy || !password || !item.revision || (item.id==='signature' && values.ESIGNATURE_MODE==='bridge' && !confirmed)} onClick={()=>run('activate')}>اختبار وتفعيل</Btn>{item.enabled && <Btn variant="text" intent="danger" loading={busy} disabled={busy || !password} onClick={()=>run('disable')}>إيقاف العمليات الجديدة</Btn>}</>}
    </div>
  </section>;
}
export function IntegrationSettings(){
  const [items,setItems]=useState<any[]>([]),[error,setError]=useState(''),[ready,setReady]=useState(false);
  async function load(){try{const data=await api.adminIntegrations();setItems(data.items);setError('');}catch(e:any){setError(e.message);}finally{setReady(true);}}
  useEffect(()=>{if(!isDemo)load();},[]);
  if(isDemo)return <Empty title="الربط والتفعيل متاح في النظام الفعلي" to={null} />;
  return <div className="integrations-view"><h2>الربط والتفعيل</h2><p>للمالك فقط. الأسرار محفوظة مشفرة على الخادم، ولا تظهر بعد الحفظ. اختبر المسودة ثم فعّلها عندما توفر الحسابات الفعلية.</p>{error && <StatusAlert tone="error" role="alert" action={<Btn intent="warn" onClick={load}>إعادة المحاولة</Btn>}>{error}</StatusAlert>}{!ready && <StatusAlert tone="in-progress" role="status">جارٍ تحميل إعدادات الربط…</StatusAlert>}<div className="grid two">{items.map(item=><IntegrationCard key={item.id} item={item} reload={load} />)}</div></div>;
}
export function DeliveryHistory({id}:{id?:string}={}){
  const [data,setData]=useState<any>(null),[page,setPage]=useState(1),[status,setStatus]=useState(''),[error,setError]=useState('');
  const [detail,setDetail]=useState<any>(null);
  useEffect(()=>{
    if(!id)return;
    let current=true;
    api.delivery(id).then(value=>{if(current)setDetail(value);})
      .catch(failure=>{if(current)setError(failure.message);});
    return()=>{current=false;};
  },[id]);
  const names:any={SENDING:'جارٍ الإرسال',ACCEPTED:'قبلتها الجهة',SENT:'أرسلتها الجهة',DELIVERED:'تم التسليم',READ:'تمت القراءة',DELAYED:'متأخرة',FAILED:'تعذر التسليم',BOUNCED:'مرتدة',COMPLAINED:'شكوى من المستلم',UNKNOWN:'القبول غير مؤكد'};
  async function load(){try{setData(await api.deliveries(page,status));setError('');}catch(e:any){setError(e.message);}}
  useEffect(()=>{if(isDemo)return;load();const timer=setInterval(()=>{if(!document.hidden)load();},15000);return()=>clearInterval(timer);},[page,status]);
  if(isDemo)return <Empty title="سجل التسليم متاح في النظام الفعلي" to={null} />;
  if(id) return <section className="card settings-form">
    <Btn variant="outline" to="/admin/deliveries">عودة لسجل الإشعارات</Btn>
    {error && <StatusAlert tone="error" role="alert">{error}</StatusAlert>}
    {!error && !detail && <p role="status">جارٍ تحميل التفاصيل…</p>}
    {detail && <>
      <h2>حالة تسليم الإشعار</h2>
      <div className="list-row"><b>{detail.item.channel}</b><Badge status={detail.item.status}>{names[detail.item.status]}</Badge><span>{detail.item.provider}</span></div>
      <p>المرجع {detail.item.provider_message_id || detail.item.id}</p>
      {detail.item.error_code && <p>رمز التعذّر {detail.item.error_code}</p>}
      <h3>تسلسل التحديثات</h3>
      {detail.events.length ? detail.events.map((item,index)=><div className="list-row" key={index}>
        <Badge status={item.status}>{names[item.status]}</Badge><time>{new Date(item.created_at).toLocaleString("ar-KW")}</time><span>{item.error_code}</span>
      </div>) : <p>لا توجد تحديثات إضافية من جهة الإرسال.</p>}
    </>}
  </section>;
  return <section className="card"><h2>تسليم الإشعارات</h2><p>قبول الجهة للرسالة يختلف عن تسليمها؛ لا يُسجل التسليم إلا بإشعار موثق.</p><Field label="حالة التسليم"><select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">جميع الحالات</option>{Object.entries(names).map(([k,v])=><option key={k} value={k}>{String(v)}</option>)}</select></Field>{error && <StatusAlert tone="error" role="alert" action={<Btn intent="warn" onClick={load}>إعادة المحاولة</Btn>}>{error}</StatusAlert>}{!data && !error && <StatusAlert tone="in-progress" role="status">جارٍ التحميل…</StatusAlert>}{data && <><div className="table-scroll"><table><thead><tr><th>القناة</th><th>الحالة</th><th>مرجع الجهة</th><th>آخر تحديث</th></tr></thead><tbody>{data.items.map((r:any)=><tr key={r.id}><td>{r.channel==='EMAIL'?'بريد إلكتروني':r.channel==='WHATSAPP'?'واتساب':'رسالة نصية'}</td><td><Badge status={r.status}>{names[r.status] || r.status}</Badge></td><td><bdi>{r.provider_message_id || 'لم يصل مرجع بعد'}</bdi><Btn variant="text" to={"/admin/deliveries/"+r.id}>التفاصيل</Btn>{r.error_code && <small>{r.error_code}</small>}</td><td>{new Date(r.updated_at).toLocaleString('ar-KW')}</td></tr>)}</tbody></table></div>{!data.items.length && <p>لا توجد محاولات إرسال مسجلة.</p>}<div className="button-row"><Btn variant="outline" intent="info" disabled={page===1} onClick={()=>setPage(page-1)}>السابقة</Btn><span>الصفحة {page}</span><Btn variant="outline" intent="info" disabled={!data.hasMore} onClick={()=>setPage(page+1)}>التالية</Btn></div></>}</section>;
}
