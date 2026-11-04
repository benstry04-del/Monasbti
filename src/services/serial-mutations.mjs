// Preserve user action order and prevent older command snapshots replacing newer ones.
export function createSerialExecutor() {
  let tail=Promise.resolve();
  return operation=>{
    const next=tail.then(operation);
    tail=next.then(()=>undefined,()=>undefined);
    return next;
  };
}
