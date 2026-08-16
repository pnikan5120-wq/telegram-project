require("dotenv").config();
const express=require("express"),crypto=require("crypto"),path=require("path");
const {saveQuote,history,addAlert,getActiveAlerts}=require("./db");
const {primaryOrNull}=require("./providers");
const app=express();app.use(express.json({limit:"32kb"}));
app.use(express.static(path.join(__dirname,"..","public")));

const cfg={
 port:+process.env.PORT||3000,botToken:process.env.BOT_TOKEN||"",
 goldPrimaryUrl:process.env.GOLD_PRIMARY_URL||"",goldPrimaryKey:process.env.GOLD_PRIMARY_KEY||"",
 fxPrimaryUrl:process.env.FX_PRIMARY_URL||"",fxPrimaryKey:process.env.FX_PRIMARY_KEY||"",
 cryptoPrimaryUrl:process.env.CRYPTO_PRIMARY_URL||"",cryptoPrimaryKey:process.env.CRYPTO_PRIMARY_KEY||"",
 maxAgeGold:+process.env.MAX_AGE_GOLD||30,maxAgeFx:+process.env.MAX_AGE_FX||30,maxAgeCrypto:+process.env.MAX_AGE_CRYPTO||15
};
function validate(initData){
 if(!initData||!cfg.botToken)return false;
 const p=new URLSearchParams(initData),hash=p.get("hash"),auth=+p.get("auth_date");
 if(!hash||!auth||Date.now()/1000-auth>86400)return false;
 const s=[...p.entries()].filter(x=>x[0]!=="hash").sort((a,b)=>a[0].localeCompare(b[0])).map(x=>x[0]+"="+x[1]).join("\n");
 const key=crypto.createHmac("sha256","WebAppData").update(cfg.botToken).digest();
 const exp=crypto.createHmac("sha256",key).update(s).digest("hex");
 return exp.length===hash.length && crypto.timingSafeEqual(Buffer.from(exp),Buffer.from(hash));
}
const cache=new Map();
async function getAsset(asset){
 const hit=cache.get(asset);if(hit&&Date.now()-hit.time<5000)return hit.q;
 let q=null;
 try{
   if(asset==="gold18")q=await primaryOrNull(cfg,"gold");
   if(asset==="usd")q=await primaryOrNull(cfg,"fx");
   if(asset==="usdt")q=await primaryOrNull(cfg,"crypto");
 }catch{}
 if(q){saveQuote(asset,q);cache.set(asset,{q,time:Date.now()});}
 return q;
}
app.get("/api/market",async(req,res)=>{
 const out={status:"UNVERIFIED",quotes:{},serverTime:new Date().toISOString()};
 for(const a of ["gold18","usd","usdt"]){const q=await getAsset(a);if(q)out.quotes[a]=q}
 if(out.quotes.gold18)out.quotes.mesghal={value:out.quotes.gold18.value*4.6083*(17/18),unit:"IRR",timestamp:out.quotes.gold18.timestamp,source:"derived"};
 out.status=Object.keys(out.quotes).length>=4?"LIVE":"PARTIAL";
 res.set("Cache-Control","no-store");res.json(out);
});
app.get("/api/history/:asset",(req,res)=>res.json(history(req.params.asset,200)));
app.post("/api/alerts",(req,res)=>{
 if(!validate(req.body?.initData))return res.status(401).json({ok:false,error:"invalid_telegram_data"});
 const p=new URLSearchParams(req.body.initData),u=JSON.parse(p.get("user")||"{}");
 const asset=req.body.asset,target=Number(req.body.target),direction=req.body.direction==="below"?"below":"above";
 if(!["gold18","usd","usdt"].includes(asset)||!Number.isFinite(target))return res.status(400).json({ok:false,error:"invalid_alert"});
 const id=crypto.randomUUID();addAlert({id,userId:String(u.id),asset,target,direction,createdAt:new Date().toISOString()});
 res.json({ok:true,id});
});
app.get("/health",(req,res)=>res.json({ok:true,time:new Date().toISOString()}));
app.listen(cfg.port,()=>console.log("Nebze Bazar v5 on",cfg.port));
