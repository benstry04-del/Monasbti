import React,{useEffect,useState} from 'react';
import {api,isDemo} from './store';
export function useRecordPage(kind:string,params:any,fallback:any[],revision?:number){
  const key=JSON.stringify(params),[page,setPage]=useState(1),[result,setResult]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [previous,setPrevious]=useState(key);
  if(previous!==key){setPrevious(key);setPage(1);setResult(null);}
  useEffect(()=>{
    if(isDemo)return;
    let current=true;setBusy(true);setError('');
    const timer=setTimeout(()=>api.records(kind,{...JSON.parse(key),page}).then((r:any)=>{if(current)setResult(r);}).catch((e:any)=>{if(current)setError(e.message);}).finally(()=>{if(current)setBusy(false);}),150);
    return()=>{current=false;clearTimeout(timer);};
  },[kind,key,page,revision,retry]);
  return {counts:result?.counts,summary:result?.summary,items:isDemo?fallback:result?.items || [],total:isDemo?fallback.length:result?.total || 0,page,pages:result?.pages || 0,busy:(busy && result?.page !== page) || (!isDemo && !result && !error),error,setPage,retry:()=>setRetry(n=>n+1)};
}
export function RecordPager({data}:any){
  if(isDemo)return null;
  return <div className="record-pager" aria-label="ترقيم النتائج" aria-busy={data.busy}>
    {data.error?<><p role="alert">{data.error}</p><button onClick={data.retry}>إعادة المحاولة</button></>:<>
      <span role="status">{data.busy?'جارٍ تحميل النتائج…':`${data.total} نتيجة · الصفحة ${data.page} من ${Math.max(1,data.pages)}`}</span>
      <button disabled={data.busy || data.page<=1} onClick={()=>data.setPage(data.page-1)}>السابق</button>
      <button disabled={data.busy || data.page>=data.pages} onClick={()=>data.setPage(data.page+1)}>التالي</button>
    </>}
  </div>;
}
export function downloadRecords(kind:string,params:any={}){
  const a=document.createElement('a');a.href='/api/records/'+kind+'/export?'+new URLSearchParams(params);a.download='';document.body.appendChild(a);a.click();a.remove();
}

export function useServerValue(load:()=>Promise<any>,key:string,revision?:number){
  const [result, setResult] = useState<{ key: string, value: any } | null>(null);
  const [failure, setFailure] = useState<{ key: string, message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (isDemo) return;
    let live = true;
    setFailure(null);
    load().then(value => { if (live) setResult({ key, value }); })
      .catch(error => { if (live) setFailure({ key, message: error.message }); });
    return () => { live = false; };
  }, [key, revision, retry]);
  return {
    value: result?.key === key ? result.value : null,
    error: failure?.key === key ? failure.message : "",
    retry: () => setRetry(n => n + 1),
  };
}
