function finite(n){return Number.isFinite(Number(n))?Number(n):null}
function quote(value,unit,timestamp,source){
  if(finite(value)===null || !timestamp || !source) return null;
  return {value:finite(value),unit,timestamp,source};
}
async function fetchJSON(url,key){
  if(!url) return null;
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),6000);
  try{
    const r=await fetch(url,{headers:key?{"Authorization":`Bearer ${key}`}:{},signal:c.signal});
    if(!r.ok) throw new Error(`HTTP_${r.status}`);
    return await r.json();
  }finally{clearTimeout(timer)}
}
/*
IMPORTANT:
Do not guess a provider's response fields.
For each provider, map its documented response exactly here.
The placeholder adapters intentionally return null until credentials + schema
are configured. This prevents false prices.
*/
async function primaryOrNull(cfg,asset){
  const url=cfg[asset+"PrimaryUrl"],key=cfg[asset+"PrimaryKey"];
  if(!url) return null;
  const d=await fetchJSON(url,key);
  // TODO: map documented provider schema here.
  return null;
}
module.exports={quote,primaryOrNull};
