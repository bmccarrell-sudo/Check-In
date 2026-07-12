import { useState, useEffect, useRef, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import jsQR from "jsqr";
import { sGet, sSet } from "../storage.js";

// ─────────────────────────────────────────────────────────────────────────────
//  CAMP IDENTITY  ·  To create the Launch Pad app, change only this block
// ─────────────────────────────────────────────────────────────────────────────
const CAMP_ID    = "launch";
const CAMP_LABEL = "Launch Pad Leadership";
const CAMP_EMOJI = "🚀";
const CAMP_COLOR = "#43A832";   // logo green · Launch Pad
const CAMP_DK    = "#1C7A0A";   // dark green for text on light bg
const SK = {                     // storage keys — unique per camp
  campers: "lp-v1-campers",
  staff:   "lp-v1-staff",
  ce:      "lp-v1-ce",
  se:      "lp-v1-se",
  pin:     "lp-v1-pin",
};
// ─────────────────────────────────────────────────────────────────────────────

// ── ACFC Palette ──────────────────────────────────────────────────────────────
const C = {
  bg:"#F2F8F3", surface:"#E3EFE5", card:"#FFFFFF", border:"#B4D8BA",
  shadow:"0 1px 4px rgba(0,50,20,0.09)",
  text:"#0A180C", sub:"#0F4020", muted:"#5A7D62",
  navy:"#081C30",
  green:"#43A832", greenDk:"#1C7A0A",
  blue:"#1565C0",  blueDk:"#0D47A1",
  purple:"#6A1B9A",purpleDk:"#4A0D7A",
  yellow:"#FFD700", yellowDk:"#7A6200",
  grey:"#C2C2C2",
  red:"#DC2626", redBg:"#FEF2F2", redBdr:"#FECACA",
  alertBg:"#FFFBEB", alertBdr:"#F59E0B", alertTxt:"#92400E",
};

// ── Status / Actions ──────────────────────────────────────────────────────────
const CSTATUS = {
  pending:    { label:"Not Arrived",  color:C.muted,    dot:"○" },
  beforecare: { label:"Before Care", color:C.blueDk,   dot:"◑" },
  arrived:    { label:"Present",      color:C.greenDk,  dot:"●" },
  restroom:   { label:"Potty Break", color:C.yellowDk, dot:"◉" },
  aftercare:  { label:"After Care",  color:C.purpleDk, dot:"◑" },
  out:        { label:"Checked Out", color:C.muted,    dot:"○" },
};

const CACTION = {
  beforecare: { label:"Before Care Arrival",  icon:"🌅", color:C.purple, dk:C.purpleDk,    next:"beforecare" },
  arrive:     { label:"Camp Check-In",        icon:"✅", color:C.green,    dk:C.greenDk,  next:"arrived"    },
  restroom:   { label:"Potty Break",          icon:"🚻", color:C.yellow,   dk:C.yellowDk, next:"restroom"   },
  return:     { label:"Return from Break",    icon:"↩",  color:C.green,    dk:C.greenDk,  next:"arrived"    },
  aftercare:  { label:"After Care Check-In",  icon:"🌙", color:C.purple, dk:C.purpleDk,    next:"aftercare"  },
  checkout:   { label:"Check Out (Staff)",    icon:"🚪", color:C.red,      dk:C.red,      next:"out"        },
  pickup:     { label:"Parent Pickup",        icon:"🚗", color:C.sub,      dk:C.sub,      next:"out"        },
  reenter:    { label:"Re-enter Camp",        icon:"↩",  color:C.green,    dk:C.greenDk,  next:"arrived"    },
};

const CALLOWED = {
  pending:    ["beforecare","arrive"],
  beforecare: ["arrive","pickup"],
  arrived:    ["restroom","aftercare","checkout","pickup"],
  restroom:   ["return","checkout","pickup"],
  aftercare:  ["checkout","pickup"],
  out:        ["reenter"],
};

const SSTATUS = {
  pending:    { label:"Not Clocked In", color:C.muted,   dot:"○" },
  active:     { label:"Clocked In",     color:C.greenDk, dot:"●" },
  clocked_out:{ label:"Clocked Out",    color:C.muted,   dot:"○" },
};

// ── Utilities ─────────────────────────────────────────────────────────────────
const uid     = () => `${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const tFull   = iso => new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric"}) + " · " + new Date(iso).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const tShort  = iso => new Date(iso).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const minsAgo = iso => Math.floor((Date.now()-new Date(iso))/60000);
const nowTime = () => { const n=new Date(); return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`; };
const toISO   = t => { const [h,m]=t.split(":").map(Number); const d=new Date(); d.setHours(h,m,0,0); return d.toISOString(); };

const qrStaff  = id => `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent("STAFF:"+id)}&color=14172A&bgcolor=ffffff&margin=10`;
const qrCamper = id => `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent("CAMP:"+id)}&color=14172A&bgcolor=ffffff&margin=10`;
const qrParent = id => `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent("PARENT:"+id)}&color=4E38B8&bgcolor=ffffff&margin=10`;

const deriveCS = (id,evs) => { const l=[...evs].filter(e=>e.camperId===id).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))[0]; return l?(CACTION[l.action]?.next??"pending"):"pending"; };
const deriveSS = (id,evs) => { const l=[...evs].filter(e=>e.staffId===id).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp))[0]; return !l?"pending":l.action==="clockin"?"active":"clocked_out"; };


// ── Primitives ────────────────────────────────────────────────────────────────
const Card = ({children,style:s}) => <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,boxShadow:C.shadow,...s}}>{children}</div>;

function Btn({children,onClick,color=CAMP_COLOR,ghost,small,full,disabled,style:sx}){
  const isYellow = color===C.yellow||color===CAMP_COLOR;
  return <button onClick={onClick} disabled={disabled} style={{padding:small?"8px 16px":"12px 22px",fontSize:small?13:14,fontWeight:700,borderRadius:10,cursor:disabled?"default":"pointer",fontFamily:"inherit",opacity:disabled?0.5:1,width:full?"100%":undefined,background:ghost?"transparent":color,border:`1.5px solid ${ghost?C.border:color}`,color:ghost?C.muted:(isYellow?C.text:"#fff"),...sx}}>{children}</button>;
}

function Field({value,onChange,placeholder,onKeyDown,area,style:s}){
  const base={padding:"11px 14px",borderRadius:10,border:`1.5px solid ${C.border}`,background:C.card,color:C.text,fontSize:15,outline:"none",fontFamily:"inherit",width:"100%",boxSizing:"border-box",...s};
  return area?<textarea value={value} onChange={onChange} placeholder={placeholder} style={{...base,resize:"vertical"}}/>:<input value={value} onChange={onChange} placeholder={placeholder} onKeyDown={onKeyDown} style={base}/>;
}

function Badge({children,color,dk}){
  return <span style={{display:"inline-block",fontSize:11,background:color+"22",color:dk||color,border:`1px solid ${color}44`,padding:"2px 8px",borderRadius:10,fontWeight:700}}>{children}</span>;
}

function AllergyAlert({allergies}){
  return (
    <div style={{background:C.alertBg,border:`2px solid ${C.alertBdr}`,borderRadius:12,padding:"14px 16px",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
        <span style={{fontSize:22}}>⚠️</span>
        <span style={{fontWeight:800,fontSize:13,color:C.alertTxt,textTransform:"uppercase",letterSpacing:"0.08em"}}>Allergy Alert</span>
      </div>
      <div style={{fontSize:16,fontWeight:700,color:"#78350F",lineHeight:1.4}}>{allergies}</div>
    </div>
  );
}

// ── PIN Keypad ────────────────────────────────────────────────────────────────
function PinModal({storedPin,onSuccess,onClose,title="Admin Access"}){
  const [input,setInput]=useState(""); const [err,setErr]=useState(false);
  function press(d){ const n=input+d; setInput(n); if(n.length===4){ if(n===storedPin){onSuccess();}else{setErr(true);setTimeout(()=>{setErr(false);setInput("");},700);} } }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(27,29,44,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:20}}>
      <div style={{background:C.card,borderRadius:24,padding:"36px 28px",width:"100%",maxWidth:320,boxShadow:"0 20px 60px rgba(27,29,44,0.3)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:36,marginBottom:10}}>🔒</div>
          <div style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:4}}>{title}</div>
          <div style={{fontSize:13,color:C.muted}}>Enter 4-digit admin PIN</div>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:16,marginBottom:28}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:16,height:16,borderRadius:"50%",transition:"all 0.15s",background:err?C.red:i<input.length?CAMP_COLOR:C.border}}/>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d,i)=>d===""?<div key={i}/>:(
            <button key={i} onClick={()=>d==="⌫"?setInput(p=>p.slice(0,-1)):press(String(d))}
              style={{padding:"18px 0",borderRadius:12,border:`1.5px solid ${C.border}`,background:d==="⌫"?C.surface:C.card,color:C.text,fontSize:d==="⌫"?20:22,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              {d}
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{width:"100%",padding:13,borderRadius:10,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:15}}>Cancel</button>
      </div>
    </div>
  );
}

function ChangePinModal({storedPin,onSave,onClose}){
  const [step,setStep]=useState("current"); const [input,setInput]=useState(""); const [newPin,setNewPin]=useState(""); const [err,setErr]=useState("");
  function press(d){ const n=input+d; setInput(n); if(n.length===4){
    if(step==="current"){ if(n===storedPin){setStep("new");setInput("");}else{setErr("Incorrect PIN");setTimeout(()=>{setErr("");setInput("");},700);} }
    else if(step==="new"){ setNewPin(n);setStep("confirm");setInput(""); }
    else{ if(n===newPin){onSave(n);}else{setErr("PINs don't match");setTimeout(()=>{setErr("");setInput("");setStep("new");setNewPin("");},700);} }
  } }
  const titles={current:"Current PIN",new:"New PIN",confirm:"Confirm New PIN"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(27,29,44,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:600,padding:20}}>
      <div style={{background:C.card,borderRadius:24,padding:"36px 28px",width:"100%",maxWidth:320,boxShadow:"0 20px 60px rgba(27,29,44,0.3)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:36,marginBottom:10}}>🔑</div>
          <div style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:4}}>{titles[step]}</div>
          {err&&<div style={{fontSize:13,color:C.red,fontWeight:600,marginTop:4}}>{err}</div>}
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:16,marginBottom:28}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:16,height:16,borderRadius:"50%",transition:"all 0.15s",background:err?C.red:i<input.length?CAMP_COLOR:C.border}}/>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d,i)=>d===""?<div key={i}/>:(
            <button key={i} onClick={()=>d==="⌫"?setInput(p=>p.slice(0,-1)):press(String(d))}
              style={{padding:"18px 0",borderRadius:12,border:`1.5px solid ${C.border}`,background:d==="⌫"?C.surface:C.card,color:C.text,fontSize:d==="⌫"?20:22,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{d}</button>
          ))}
        </div>
        <button onClick={onClose} style={{width:"100%",padding:13,borderRadius:10,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:15}}>Cancel</button>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function CampApp(){
  const [tab,   setTab]  = useState("home");   // home|scan|log|admin
  const [adminTab,setAdminTab]=useState("staff");

  const [campers,setCampers]=useState([]); const [staff,setStaff]=useState([]);
  const [ce,setCe]=useState([]); const [se,setSe]=useState([]);
  const [loading,setLoading]=useState(true);

  const [storedPin,setStoredPin]=useState("1234");
  const [unlocked, setUnlocked] =useState(false);
  const [showPin,  setShowPin]  =useState(false);
  const [showChangePin,setShowChangePin]=useState(false);

  // Staff form
  const [sName,setSName]=useState(""); const [sRole,setSRole]=useState("Staff");
  const [sBulk,setSBulk]=useState(""); const [sShowB,setSShowB]=useState(false);

  // Camper form
  const [cName,setCName]=useState(""); const [cGroup,setCGroup]=useState("");
  const [cBefore,setCBefore]=useState(false); const [cAfter,setCAfter]=useState(false);
  const [cParent,setCParent]=useState(""); const [cAllergy,setCAllergy]=useState("");
  const [cBulk,setCBulk]=useState(""); const [cShowB,setCShowB]=useState(false);

  const [manualQ,setManualQ]=useState("");

  // Scanner
  const [scanning,setScanning]=useState(false); const [scanFlash,setScanFlash]=useState(false);
  const [scanErr,setScanErr]=useState(null); const [lastAct,setLastAct]=useState(null);

  // Modals
  const [staffModal,setStaffModal]=useState(null); const [clockTime,setClockTime]=useState("");
  const [camperModal,setCamperModal]=useState(null); const [pickupModal,setPickupModal]=useState(null);
  const [qrModal,setQrModal]=useState(null); const [qrTab,setQrTab]=useState("camper");

  const vRef=useRef(null),cvRef=useRef(null),streamRef=useRef(null);
  const rafRef=useRef(null),jsRef=useRef(jsQR),coolRef=useRef(false);
  const campersRef=useRef([]),staffRef=useRef([]);
  useEffect(()=>{campersRef.current=campers;},[campers]);
  useEffect(()=>{staffRef.current=staff;},[staff]);

  useEffect(()=>{ load(); const t=setInterval(load,8000); return ()=>clearInterval(t); },[]);

  async function load(){
    const [c,s,cev,sev,pin]=await Promise.all([sGet(SK.campers),sGet(SK.staff),sGet(SK.ce),sGet(SK.se),sGet(SK.pin)]);
    if(c){setCampers(c);campersRef.current=c;} if(s){setStaff(s);staffRef.current=s;}
    if(cev) setCe(cev); if(sev) setSe(sev); if(pin) setStoredPin(pin);
    setLoading(false);
  }

  async function saveCampers(n){setCampers(n);campersRef.current=n;await sSet(SK.campers,n);}
  async function saveStaff(n){setStaff(n);staffRef.current=n;await sSet(SK.staff,n);}

  async function appendCE(camperId,action){
    const c=campersRef.current.find(x=>x.id===camperId); if(!c) return null;
    const ev={id:uid(),camperId,camperName:c.name,action,timestamp:new Date().toISOString()};
    const latest=(await sGet(SK.ce))||[]; const n=[ev,...latest].slice(0,3000);
    setCe(n); await sSet(SK.ce,n); return ev;
  }

  async function appendSE(staffId,action,ts){
    const s=staffRef.current.find(x=>x.id===staffId); if(!s) return null;
    const ev={id:uid(),staffId,staffName:s.name,role:s.role,action,timestamp:ts||new Date().toISOString()};
    const latest=(await sGet(SK.se))||[]; const n=[ev,...latest].slice(0,2000);
    setSe(n); await sSet(SK.se,n); return ev;
  }

  // CRUD
  async function addStaff(){ if(!sName.trim()) return; await saveStaff([...staff,{id:uid(),name:sName.trim(),role:sRole,createdAt:new Date().toISOString()}]); setSName(""); }
  async function addStaffBulk(){ const names=sBulk.split("\n").map(n=>n.trim()).filter(Boolean); if(!names.length) return; await saveStaff([...staff,...names.map(n=>({id:uid(),name:n,role:sRole,createdAt:new Date().toISOString()}))]); setSBulk("");setSShowB(false); }
  async function removeStaff(id){ await saveStaff(staff.filter(s=>s.id!==id)); }

  async function addCamper(){ if(!cName.trim()) return; await saveCampers([...campers,{id:uid(),name:cName.trim(),group:cGroup.trim(),beforecare:cBefore,aftercare:cAfter,parentName:cParent.trim(),allergies:cAllergy.trim(),createdAt:new Date().toISOString()}]); setCName("");setCGroup("");setCParent("");setCAllergy("");setCBefore(false);setCAfter(false); }
  async function addCamperBulk(){ const names=cBulk.split("\n").map(n=>n.trim()).filter(Boolean); if(!names.length) return; await saveCampers([...campers,...names.map(n=>({id:uid(),name:n,group:cGroup.trim(),beforecare:cBefore,aftercare:cAfter,parentName:"",allergies:"",createdAt:new Date().toISOString()}))]); setCBulk("");setCShowB(false); }
  async function removeCamper(id){ await saveCampers(campers.filter(c=>c.id!==id)); }
  async function toggleFlag(id,flag){ await saveCampers(campers.map(c=>c.id===id?{...c,[flag]:!c[flag]}:c)); }
  async function updateAllergy(id,val){ await saveCampers(campers.map(c=>c.id===id?{...c,allergies:val}:c)); }

  // Scanner
  async function startScan(){
    setScanErr(null);setLastAct(null);
    // jsQR loaded via npm import — no dynamic loading needed
    try{ const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment",width:{ideal:1280}}}); streamRef.current=stream;setScanning(true); setTimeout(()=>{ if(!vRef.current) return; vRef.current.srcObject=stream; vRef.current.onloadedmetadata=()=>{vRef.current.play();tick();}; },80); }
    catch{ setScanErr("Camera access denied. Use the manual list below."); }
  }
  function stopScan(){ streamRef.current?.getTracks().forEach(t=>t.stop()); if(rafRef.current) cancelAnimationFrame(rafRef.current); streamRef.current=null;setScanning(false); }

  function tick(){
    const vid=vRef.current,cvs=cvRef.current; if(!vid||!cvs||!jsRef.current) return;
    if(vid.readyState===vid.HAVE_ENOUGH_DATA){
      cvs.width=vid.videoWidth;cvs.height=vid.videoHeight;
      const ctx=cvs.getContext("2d",{willReadFrequently:true}); ctx.drawImage(vid,0,0);
      if(!coolRef.current){ const img=ctx.getImageData(0,0,cvs.width,cvs.height); const code=jsRef.current(img.data,img.width,img.height);
        if(code?.data){ const raw=code.data; let found=false;
          if(raw.startsWith("STAFF:")){ const s=staffRef.current.find(x=>x.id===raw.slice(6)); if(s){coolRef.current=true;setScanFlash(true);openStaff(s);setTimeout(()=>setScanFlash(false),500);found=true;} }
          if(raw.startsWith("CAMP:")){ const c=campersRef.current.find(x=>x.id===raw.slice(5)); if(c){coolRef.current=true;setScanFlash(true);openCamper(c,false);setTimeout(()=>setScanFlash(false),500);found=true;} }
          if(raw.startsWith("PARENT:")){ const c=campersRef.current.find(x=>x.id===raw.slice(7)); if(c){coolRef.current=true;setScanFlash(true);openCamper(c,true);setTimeout(()=>setScanFlash(false),500);found=true;} }
          if(!found){ setScanErr("QR not found. Make sure you're using this camp's app."); setTimeout(()=>setScanErr(null),3000); }
        }
      }
    }
    rafRef.current=requestAnimationFrame(tick);
  }

  async function openStaff(s){ const fresh=(await sGet(SK.se))||[]; setSe(fresh); stopScan(); setClockTime(nowTime()); setStaffModal({staff:s,status:deriveSS(s.id,fresh)}); }
  async function openCamper(c,isParent){ const fresh=(await sGet(SK.ce))||[]; setCe(fresh); const status=deriveCS(c.id,fresh); stopScan(); if(isParent) setPickupModal({camper:c,status}); else setCamperModal({camper:c,status}); }
  async function doClock(action){ const ev=await appendSE(staffModal.staff.id,action,toISO(clockTime)); setLastAct({type:"staff",name:staffModal.staff.name,action,ev}); setStaffModal(null);coolRef.current=false; }
  async function doCamperAction(action){ const ev=await appendCE(camperModal.camper.id,action); setLastAct({type:"camper",name:camperModal.camper.name,action,ev}); setCamperModal(null);coolRef.current=false; }
  async function doPickup(){ const ev=await appendCE(pickupModal.camper.id,"pickup"); setLastAct({type:"camper",name:pickupModal.camper.name,action:"pickup",ev}); setPickupModal(null);coolRef.current=false; }

  async function changePin(p){ setStoredPin(p); await sSet(SK.pin,p); setShowChangePin(false); }

  // Derived
  const csMap=useMemo(()=>{const m={};campers.forEach(c=>{m[c.id]=deriveCS(c.id,ce);});return m;},[campers,ce]);
  const ssMap=useMemo(()=>{const m={};staff.forEach(s=>{m[s.id]=deriveSS(s.id,se);});return m;},[staff,se]);

  const counts=useMemo(()=>({
    staffIn:   staff.filter(s=>ssMap[s.id]==="active").length,
    before:    Object.values(csMap).filter(s=>s==="beforecare").length,
    inCamp:    Object.values(csMap).filter(s=>["arrived","restroom"].includes(s)).length,
    restroom:  Object.values(csMap).filter(s=>s==="restroom").length,
    aftercare: Object.values(csMap).filter(s=>s==="aftercare").length,
    out:       Object.values(csMap).filter(s=>s==="out").length,
  }),[ssMap,csMap,staff,campers]);

  const onBreak   =useMemo(()=>campers.filter(c=>csMap[c.id]==="restroom").map(c=>({camper:c,since:ce.find(e=>e.camperId===c.id&&e.action==="restroom")?.timestamp})).sort((a,b)=>new Date(a.since)-new Date(b.since)),[campers,csMap,ce]);
  const beforeList=useMemo(()=>campers.filter(c=>csMap[c.id]==="beforecare"),[campers,csMap]);
  const afterList =useMemo(()=>campers.filter(c=>csMap[c.id]==="aftercare"),[campers,csMap]);
  const activeStaff=useMemo(()=>staff.filter(s=>ssMap[s.id]==="active"),[staff,ssMap]);
  const todayOut  =useMemo(()=>{const today=new Date().toDateString();return ce.filter(e=>["checkout","pickup"].includes(e.action)&&new Date(e.timestamp).toDateString()===today);},[ce]);
  const rstChart  =useMemo(()=>{const h={};ce.filter(e=>e.action==="restroom").forEach(e=>{const n=new Date(e.timestamp).getHours();const l=`${n%12||12}${n<12?"am":"pm"}`;if(!h[n])h[n]={hour:l,n,Breaks:0};h[n].Breaks++;});return Object.values(h).sort((a,b)=>a.n-b.n);},[ce]);
  const mCampers  =useMemo(()=>{const q=manualQ.toLowerCase();return campers.filter(c=>!q||c.name.toLowerCase().includes(q));},[campers,manualQ]);
  const mStaff    =useMemo(()=>{const q=manualQ.toLowerCase();return staff.filter(s=>!q||s.name.toLowerCase().includes(q));},[staff,manualQ]);
  const allLogs   =useMemo(()=>[...ce.map(e=>({...e,_t:"camper"})),...se.map(e=>({...e,_t:"staff"}))].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)),[ce,se]);

  function exportCSV(){
    const rows=["Name,Type,Group,Allergies,Action,Time",...ce.map(e=>{const cam=campers.find(c=>c.id===e.camperId);return `"${e.camperName}","Camper","${cam?.group||""}","${cam?.allergies||""}","${CACTION[e.action]?.label||e.action}","${tFull(e.timestamp)}"`;}),...se.map(e=>`"${e.staffName}","${e.role}","","","${e.action==="clockin"?"Clock In":"Clock Out"}","${tFull(e.timestamp)}"`)];
    const a=Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([rows.join("\n")],{type:"text/csv"})),download:`${CAMP_ID}-log-${new Date().toISOString().slice(0,10)}.csv`});a.click();
  }

  function goTab(t){ if(t==="admin"){ if(unlocked){setTab("admin");}else{setShowPin(true);} return; } if(t!=="scan") stopScan(); setTab(t); }

  if(loading) return <div style={{background:C.bg,height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui"}}><span style={{color:CAMP_DK,fontWeight:700,fontSize:16}}>{CAMP_EMOJI} Loading…</span></div>;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'Inter',system-ui,sans-serif",color:C.text,paddingBottom:72}}>

      {/* Header */}
      <div style={{background:C.navy,borderBottom:`3px solid ${CAMP_COLOR}`,height:58,padding:"0 20px",display:"flex",alignItems:"center",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>{CAMP_EMOJI}</span>
          <div>
            <div style={{fontWeight:800,fontSize:15,color:"#fff",letterSpacing:"0.02em"}}>{CAMP_LABEL}</div>
            <div style={{fontSize:10,color:"#9BA3C0",letterSpacing:"0.05em",textTransform:"uppercase"}}>Camp Check-In</div>
          </div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:12,fontSize:12,alignItems:"center"}}>
          <span style={{color:"#74C94A",fontWeight:700}}>👷 {counts.staffIn}</span>
          <span style={{color:CAMP_COLOR==="#FFE500"?"#F5D800":CAMP_COLOR,fontWeight:700}}>● {counts.inCamp}</span>
          <span style={{color:"#B8A7F8"}}>🌙 {counts.aftercare}</span>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:600,margin:"0 auto",padding:"20px 14px 0"}}>

        {/* ── HOME / DASHBOARD ── */}
        {tab==="home" && (
          <div>
            {/* Stat row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
              {[["● In Camp",counts.inCamp,C.greenDk],[`${CAMP_EMOJI} Total`,campers.length,CAMP_DK],["🚻 Break",counts.restroom,C.yellowDk]].map(([lbl,val,col])=>(
                <Card key={lbl} style={{padding:"14px 12px",textAlign:"center"}}>
                  <div style={{fontSize:26,fontWeight:800,color:col,lineHeight:1}}>{val}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:4}}>{lbl}</div>
                </Card>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
              {[["🌅 Before Care",counts.before,C.purpleDk],["🌙 After Care",counts.aftercare,C.purpleDk],["🚗 Out",counts.out,C.muted]].map(([lbl,val,col])=>(
                <Card key={lbl} style={{padding:"14px 12px",textAlign:"center"}}>
                  <div style={{fontSize:26,fontWeight:800,color:col,lineHeight:1}}>{val}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:4}}>{lbl}</div>
                </Card>
              ))}
            </div>

            {/* Staff clocked in */}
            {activeStaff.length>0&&(
              <Card style={{padding:16,marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:13,color:C.blueDk,marginBottom:10}}>👷 Staff On Site ({activeStaff.length})</div>
                <div style={{display:"grid",gap:8}}>
                  {activeStaff.map(s=>{ const lastIn=se.find(e=>e.staffId===s.id&&e.action==="clockin"); return (
                    <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:C.bg,borderRadius:10,border:`1px solid ${C.green}33`}}>
                      <div><div style={{fontWeight:600,fontSize:14,color:C.text}}>{s.name}</div><div style={{fontSize:11,color:C.muted}}>{s.role}</div></div>
                      {lastIn&&<div style={{fontSize:12,color:C.muted}}>since {tShort(lastIn.timestamp)}</div>}
                    </div>
                  ); })}
                </div>
              </Card>
            )}

            {/* Before care */}
            {beforeList.length>0&&(
              <Card style={{padding:16,marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:13,color:C.blueDk,marginBottom:10}}>🌅 Before Care ({beforeList.length})</div>
                <div style={{display:"grid",gap:7}}>
                  {beforeList.map(c=>(
                    <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:C.bg,borderRadius:10}}>
                      <div><div style={{fontWeight:600,fontSize:14,color:C.text}}>{c.name}</div>{c.allergies&&<div style={{fontSize:11,color:C.alertTxt,fontWeight:600}}>⚠ {c.allergies}</div>}</div>
                      {c.group&&<div style={{fontSize:12,color:C.muted}}>{c.group}</div>}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Potty breaks */}
            <Card style={{padding:16,marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:13,color:C.yellowDk,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                🚻 Potty Breaks
                <span style={{fontSize:11,background:C.yellow+"44",color:C.yellowDk,padding:"1px 8px",borderRadius:10,fontWeight:600,border:`1px solid ${C.yellow}`}}>{onBreak.length}</span>
              </div>
              {onBreak.length===0?<div style={{color:C.muted,fontSize:14}}>All clear ✓</div>:(
                <div style={{display:"grid",gap:8}}>
                  {onBreak.map(({camper,since})=>{ const mins=since?minsAgo(since):null; const warn=mins!==null&&mins>=8; return (
                    <div key={camper.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:C.bg,borderRadius:10,border:`1px solid ${warn?C.red+"55":C.border}`}}>
                      <div><div style={{fontWeight:600,fontSize:14,color:C.text}}>{camper.name}</div>{camper.allergies&&<div style={{fontSize:11,color:C.alertTxt,fontWeight:600}}>⚠ {camper.allergies}</div>}{camper.group&&<div style={{fontSize:11,color:C.muted}}>{camper.group}</div>}</div>
                      <div style={{textAlign:"right"}}>
                        {mins!==null&&<div style={{fontSize:16,fontWeight:800,color:warn?C.red:C.yellowDk}}>{mins}m{warn?" ⚠":""}</div>}
                        {since&&<div style={{fontSize:11,color:C.muted}}>{tShort(since)}</div>}
                      </div>
                    </div>
                  ); })}
                </div>
              )}
            </Card>

            {/* After care */}
            {afterList.length>0&&(
              <Card style={{padding:16,marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:13,color:C.purpleDk,marginBottom:10}}>🌙 After Care ({afterList.length})</div>
                <div style={{display:"grid",gap:7}}>
                  {afterList.map(c=>(
                    <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:C.bg,borderRadius:10,border:`1px solid ${C.purple}33`}}>
                      <div><div style={{fontWeight:600,fontSize:14,color:C.text}}>{c.name}</div>{c.allergies&&<div style={{fontSize:11,color:C.alertTxt,fontWeight:600}}>⚠ {c.allergies}</div>}</div>
                      {c.group&&<div style={{fontSize:12,color:C.muted}}>{c.group}</div>}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Today's checkouts */}
            {todayOut.length>0&&(
              <Card style={{padding:16,marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:10}}>Today's Checkouts ({todayOut.length})</div>
                <div style={{display:"grid",gap:7}}>
                  {todayOut.map(e=>{ const ac=CACTION[e.action]; return (
                    <div key={e.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 12px",background:C.bg,borderRadius:10}}>
                      <span style={{fontSize:18}}>{ac?.icon}</span>
                      <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:C.text}}>{e.camperName}</div></div>
                      <div style={{textAlign:"right"}}><div style={{fontSize:12,color:ac?.dk,fontWeight:600}}>{ac?.label}</div><div style={{fontSize:11,color:C.muted}}>{tShort(e.timestamp)}</div></div>
                    </div>
                  ); })}
                </div>
              </Card>
            )}

            {/* Chart */}
            {rstChart.length>0&&(
              <Card style={{padding:16,marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:12}}>🚻 Breaks by Hour</div>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={rstChart} barCategoryGap="40%">
                    <XAxis dataKey="hour" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} allowDecimals={false} width={20}/>
                    <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12}} cursor={{fill:C.surface}}/>
                    <Bar dataKey="Breaks" fill={CAMP_COLOR} radius={[4,4,0,0]} name="Breaks"/>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
        )}

        {/* ── SCANNER ── */}
        {tab==="scan" && (
          <div>
            {lastAct&&(
              <div style={{background:C.card,border:`1.5px solid ${lastAct.type==="staff"?C.green:(CACTION[lastAct.action]?.color||C.green)}44`,borderRadius:14,padding:"14px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12,boxShadow:C.shadow}}>
                <span style={{fontSize:26}}>{lastAct.type==="staff"?(lastAct.action==="clockin"?"⏰":"⏹"):(CACTION[lastAct.action]?.icon||"✅")}</span>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:lastAct.type==="staff"?C.greenDk:(CACTION[lastAct.action]?.dk||C.greenDk)}}>
                    {lastAct.type==="staff"?(lastAct.action==="clockin"?"Clocked In":"Clocked Out"):(CACTION[lastAct.action]?.label||"")} — {lastAct.name}
                  </div>
                  {lastAct.ev&&<div style={{fontSize:12,color:C.muted}}>{tFull(lastAct.ev.timestamp)}</div>}
                </div>
              </div>
            )}
            {scanErr&&<div style={{background:C.redBg,border:`1.5px solid ${C.redBdr}`,borderRadius:12,padding:"12px 16px",marginBottom:14,color:C.red,fontSize:14,fontWeight:500}}>⚠ {scanErr}</div>}

            <Card style={{padding:20,marginBottom:14,textAlign:"center"}}>
              {scanning?(
                <>
                  <div style={{position:"relative",borderRadius:12,overflow:"hidden",maxWidth:400,margin:"0 auto 14px"}}>
                    <video ref={vRef} muted playsInline style={{width:"100%",display:"block",borderRadius:12}}/>
                    <canvas ref={cvRef} style={{display:"none"}}/>
                    <div style={{position:"absolute",inset:0,pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <div style={{width:180,height:180,borderRadius:14,border:`3px solid ${scanFlash?C.green:CAMP_COLOR}`,boxShadow:"0 0 0 9999px rgba(27,29,44,0.5)",transition:"border-color 0.2s"}}/>
                    </div>
                  </div>
                  <div style={{color:C.muted,fontSize:14,marginBottom:14}}>Staff badge · Camper QR · Parent code</div>
                  <Btn color={C.red} onClick={stopScan}>Stop Camera</Btn>
                </>
              ):(
                <>
                  <div style={{fontSize:60,marginBottom:12}}>📷</div>
                  <div style={{fontWeight:800,color:C.text,fontSize:18,marginBottom:6}}>QR Scanner</div>
                  <div style={{color:C.muted,fontSize:14,marginBottom:22,lineHeight:1.5}}>Reads staff badges, camper check-in QRs,<br/>and parent pickup codes.</div>
                  <Btn onClick={startScan} style={{fontSize:16,padding:"14px 32px"}}>Start Camera</Btn>
                </>
              )}
            </Card>

            <Card style={{padding:18}}>
              <div style={{fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Manual Log</div>
              <Field value={manualQ} onChange={e=>setManualQ(e.target.value)} placeholder="Search name…" style={{marginBottom:12}}/>
              {mStaff.length>0&&(<>
                <div style={{fontSize:12,color:C.purpleDk,fontWeight:700,marginBottom:8}}>👷 Staff</div>
                <div style={{display:"grid",gap:7,marginBottom:14}}>
                  {mStaff.slice(0,5).map(s=>{ const st=SSTATUS[ssMap[s.id]||"pending"]; return (
                    <button key={s.id} onClick={()=>openStaff(s)} style={{padding:"12px 14px",background:C.bg,border:`1px solid ${C.border}`,color:C.text,borderRadius:10,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10,fontFamily:"inherit",fontSize:14}}>
                      <span>👷</span><span style={{fontWeight:600,flex:1}}>{s.name}</span>
                      <span style={{fontSize:12,color:st.color,fontWeight:600}}>{st.dot} {st.label}</span>
                    </button>
                  ); })}
                </div>
              </>)}
              {mCampers.length>0&&(<>
                <div style={{fontSize:12,color:CAMP_DK,fontWeight:700,marginBottom:8}}>{CAMP_EMOJI} Campers</div>
                <div style={{display:"grid",gap:7,maxHeight:280,overflowY:"auto"}}>
                  {mCampers.map(c=>{ const st=CSTATUS[csMap[c.id]||"pending"]; return (
                    <button key={c.id} onClick={()=>openCamper(c,false)} style={{padding:"12px 14px",background:C.bg,border:`1px solid ${c.allergies?C.alertBdr:C.border}`,color:C.text,borderRadius:10,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10,fontFamily:"inherit",fontSize:14}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600}}>{c.name}</div>
                        {c.allergies&&<div style={{fontSize:11,color:C.alertTxt,fontWeight:600}}>⚠ {c.allergies}</div>}
                      </div>
                      {c.aftercare&&<span style={{fontSize:11,color:C.purpleDk}}>🌙</span>}
                      {c.group&&<span style={{color:C.muted,fontSize:12}}>{c.group}</span>}
                      <span style={{fontSize:12,color:st.color,fontWeight:600,flexShrink:0}}>{st.dot} {st.label}</span>
                    </button>
                  ); })}
                </div>
              </>)}
            </Card>
          </div>
        )}

        {/* ── LOG ── */}
        {tab==="log" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
              <Btn ghost small onClick={exportCSV} style={{color:C.sub}}>↓ Export CSV</Btn>
            </div>
            {allLogs.length===0?<div style={{textAlign:"center",color:C.muted,padding:"60px 0",fontSize:15}}>No events logged yet.</div>:(
              <div style={{display:"grid",gap:8}}>
                {allLogs.map((e,i)=>(
                  e._t==="camper"?(
                    <Card key={e.id} style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12,border:`1px solid ${i===0?CAMP_COLOR+"66":C.border}`}}>
                      <span style={{fontSize:20,width:26,flexShrink:0,textAlign:"center"}}>{CACTION[e.action]?.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:600,fontSize:14,color:C.text}}>{e.camperName}</div>
                      </div>
                      <div style={{textAlign:"right"}}><div style={{fontSize:12,fontWeight:600,color:CACTION[e.action]?.dk||C.sub}}>{CACTION[e.action]?.label}</div><div style={{fontSize:11,color:C.muted}}>{tFull(e.timestamp)}</div></div>
                    </Card>
                  ):(
                    <Card key={e.id} style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                      <span style={{fontSize:20,width:26,flexShrink:0,textAlign:"center"}}>{e.action==="clockin"?"⏰":"⏹"}</span>
                      <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:C.text}}>{e.staffName}</div><div style={{fontSize:12,color:C.muted}}>{e.role}</div></div>
                      <div style={{textAlign:"right"}}><div style={{fontSize:12,fontWeight:600,color:e.action==="clockin"?C.greenDk:C.muted}}>{e.action==="clockin"?"Clock In":"Clock Out"}</div><div style={{fontSize:11,color:C.muted}}>{tFull(e.timestamp)}</div></div>
                    </Card>
                  )
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ADMIN DATABASE ── */}
        {tab==="admin" && unlocked && (
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,flexWrap:"wrap",gap:10}}>
              <span style={{fontSize:13,color:C.greenDk,fontWeight:600}}>🔓 Admin Access</span>
              <div style={{display:"flex",gap:8}}>
                <Btn small ghost onClick={()=>setShowChangePin(true)} style={{color:C.purpleDk,borderColor:C.purple}}>🔑 Change PIN</Btn>
                <Btn small ghost onClick={()=>{setUnlocked(false);setTab("home");}} style={{color:C.red,borderColor:C.redBdr}}>🔒 Lock</Btn>
              </div>
            </div>

            <div style={{display:"flex",gap:8,marginBottom:20}}>
              {[["staff","👷 Staff"],["campers",`${CAMP_EMOJI} Campers`]].map(([key,label])=>(
                <button key={key} onClick={()=>setAdminTab(key)} style={{flex:1,padding:"12px 16px",borderRadius:12,border:`2px solid ${adminTab===key?CAMP_COLOR:C.border}`,background:adminTab===key?CAMP_COLOR+"14":C.card,color:adminTab===key?CAMP_DK:C.muted,fontFamily:"inherit",cursor:"pointer",fontWeight:adminTab===key?700:500,fontSize:14,boxShadow:C.shadow}}>{label}</button>
              ))}
            </div>

            {/* Staff management */}
            {adminTab==="staff"&&(
              <div>
                <Card style={{padding:18,marginBottom:18}}>
                  <div style={{fontSize:11,fontWeight:700,color:CAMP_DK,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>Add Staff / Volunteer</div>
                  <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                    {["Staff","Volunteer"].map(r=>(
                      <button key={r} onClick={()=>setSRole(r)} style={{padding:"7px 16px",borderRadius:20,border:`1.5px solid ${sRole===r?CAMP_COLOR:C.border}`,background:sRole===r?CAMP_COLOR:"transparent",color:sRole===r?(CAMP_COLOR===C.yellow?C.text:"#fff"):C.muted,fontSize:13,fontWeight:sRole===r?700:500,cursor:"pointer",fontFamily:"inherit"}}>{r}</button>
                    ))}
                  </div>
                  {!sShowB?(
                    <div style={{display:"flex",gap:10}}>
                      <Field value={sName} onChange={e=>setSName(e.target.value)} placeholder="Full name" onKeyDown={e=>e.key==="Enter"&&addStaff()} style={{flex:1}}/>
                      <Btn onClick={addStaff} color={CAMP_COLOR}>+ Add</Btn>
                      <Btn ghost onClick={()=>setSShowB(true)} style={{color:C.sub}}>Bulk</Btn>
                    </div>
                  ):(
                    <div>
                      <Field area value={sBulk} onChange={e=>setSBulk(e.target.value)} placeholder={"Coach Davis\nMs. Johnson"} style={{height:80,marginBottom:10}}/>
                      <div style={{display:"flex",gap:8}}><Btn onClick={addStaffBulk} color={CAMP_COLOR}>Add All</Btn><Btn ghost onClick={()=>setSShowB(false)} style={{color:C.sub}}>Cancel</Btn></div>
                    </div>
                  )}
                </Card>
                {staff.length===0?<div style={{textAlign:"center",color:C.muted,padding:"30px 0"}}>No staff yet.</div>:(
                  <div style={{display:"grid",gap:10}}>
                    {staff.map(s=>{ const st=SSTATUS[ssMap[s.id]||"pending"]; return (
                      <Card key={s.id} style={{padding:"13px 16px",display:"flex",alignItems:"center",gap:14}}>
                        <div onClick={()=>setQrModal({type:"staff",entity:s})} style={{width:54,height:54,background:C.bg,borderRadius:8,overflow:"hidden",flexShrink:0,cursor:"pointer",border:`1px solid ${C.border}`}}>
                          <img src={qrStaff(s.id)} alt="" style={{width:"100%",height:"100%",display:"block"}}/>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:15,color:C.text}}>{s.name}</div>
                          <div style={{fontSize:12,color:CAMP_DK,marginTop:2}}>{s.role}</div>
                          <div style={{fontSize:11,color:st.color,fontWeight:600,marginTop:2}}>{st.dot} {st.label}</div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                          <Btn small ghost onClick={()=>setQrModal({type:"staff",entity:s})} style={{color:C.sub}}>QR</Btn>
                          <Btn small color={CAMP_COLOR} onClick={()=>openStaff(s)}>Clock</Btn>
                          <Btn small ghost onClick={()=>removeStaff(s.id)} style={{color:C.red,borderColor:C.redBdr}}>✕</Btn>
                        </div>
                      </Card>
                    ); })}
                  </div>
                )}
              </div>
            )}

            {/* Camper management */}
            {adminTab==="campers"&&(
              <div>
                <Card style={{padding:18,marginBottom:18}}>
                  <div style={{fontSize:11,fontWeight:700,color:CAMP_DK,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14}}>Add Camper</div>
                  {!cShowB?(
                    <div>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
                        <Field value={cName} onChange={e=>setCName(e.target.value)} placeholder="Camper full name" onKeyDown={e=>e.key==="Enter"&&addCamper()} style={{flex:"2 1 150px"}}/>
                        <Field value={cGroup} onChange={e=>setCGroup(e.target.value)} placeholder="Group / Cabin" style={{flex:"1 1 100px"}}/>
                      </div>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
                        <Field value={cParent} onChange={e=>setCParent(e.target.value)} placeholder="Parent / Guardian name" style={{flex:"1 1 160px"}}/>
                        {[["🌅 BC",cBefore,()=>setCBefore(!cBefore)],["🌙 AC",cAfter,()=>setCAfter(!cAfter)]].map(([lbl,val,fn])=>(
                          <label key={lbl} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:14,color:C.sub,userSelect:"none"}}>
                            <input type="checkbox" checked={val} onChange={fn} style={{width:16,height:16,accentColor:C.purple}}/>{lbl}
                          </label>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                        <Field value={cAllergy} onChange={e=>setCAllergy(e.target.value)} placeholder="⚠ Allergies (e.g. Peanuts, Bees)" style={{flex:"1 1 180px",borderColor:cAllergy?C.alertBdr:C.border}}/>
                        <Btn onClick={addCamper} color={CAMP_COLOR}>+ Add</Btn>
                        <Btn ghost onClick={()=>setCShowB(true)} style={{color:C.sub}}>Bulk</Btn>
                      </div>
                    </div>
                  ):(
                    <div>
                      <div style={{fontSize:12,color:C.muted,marginBottom:8}}>One name per line</div>
                      <Field area value={cBulk} onChange={e=>setCBulk(e.target.value)} placeholder={"Emma Johnson\nLiam Torres"} style={{height:80,marginBottom:10}}/>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                        <Field value={cGroup} onChange={e=>setCGroup(e.target.value)} placeholder="Group / Cabin" style={{flex:1,minWidth:100}}/>
                        {[["🌅",cBefore,()=>setCBefore(!cBefore)],["🌙",cAfter,()=>setCAfter(!cAfter)]].map(([lbl,val,fn])=>(
                          <label key={lbl} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:15,userSelect:"none"}}>
                            <input type="checkbox" checked={val} onChange={fn} style={{width:15,height:15,accentColor:C.purple}}/>{lbl}
                          </label>
                        ))}
                        <Btn onClick={addCamperBulk} color={CAMP_COLOR}>Add All</Btn>
                        <Btn ghost onClick={()=>setCShowB(false)} style={{color:C.sub}}>Cancel</Btn>
                      </div>
                    </div>
                  )}
                </Card>

                {campers.length===0?<div style={{textAlign:"center",color:C.muted,padding:"30px 0"}}>No campers yet.</div>:(
                  <div style={{display:"grid",gap:10}}>
                    {campers.map(c=>{ const st=CSTATUS[csMap[c.id]||"pending"]; return (
                      <Card key={c.id} style={{padding:"13px 16px",border:`1px solid ${c.allergies?C.alertBdr:C.border}`}}>
                        <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                          <div onClick={()=>{setQrModal({type:"camper",entity:c});setQrTab("camper");}} style={{width:54,height:54,background:C.bg,borderRadius:8,overflow:"hidden",flexShrink:0,cursor:"pointer",border:`1px solid ${C.border}`}}>
                            <img src={qrCamper(c.id)} alt="" style={{width:"100%",height:"100%",display:"block"}}/>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:700,fontSize:15,color:C.text,marginBottom:4}}>{c.name}</div>
                            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                              {c.beforecare&&<Badge color={C.blue} dk={C.blueDk}>🌅 BC</Badge>}
                              {c.aftercare&&<Badge color={C.purple} dk={C.purpleDk}>🌙 AC</Badge>}
                              {c.group&&<Badge color={C.grey} dk={C.sub}>{c.group}</Badge>}
                              {c.parentName&&<Badge color={C.grey} dk={C.sub}>👤 {c.parentName}</Badge>}
                            </div>
                            <input value={c.allergies||""} onChange={e=>updateAllergy(c.id,e.target.value)} placeholder="⚠ Add allergies…"
                              style={{width:"100%",padding:"6px 10px",borderRadius:8,border:`1.5px solid ${c.allergies?C.alertBdr:C.border}`,background:c.allergies?C.alertBg:"transparent",color:c.allergies?C.alertTxt:C.muted,fontSize:12,outline:"none",fontFamily:"inherit",fontWeight:c.allergies?600:400,boxSizing:"border-box"}}/>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end",flexShrink:0}}>
                            <span style={{fontSize:11,color:st.color,fontWeight:600}}>{st.dot} {st.label}</span>
                            <Btn small ghost onClick={()=>{setQrModal({type:"camper",entity:c});setQrTab("camper");}} style={{color:C.sub}}>🎒 QR</Btn>
                            <Btn small style={{background:C.purple+"18",border:`1.5px solid ${C.purple}55`,color:C.purpleDk}} onClick={()=>{setQrModal({type:"camper",entity:c});setQrTab("parent");}}>🚗 Parent</Btn>
                            <Btn small color={CAMP_COLOR} onClick={()=>openCamper(c,false)}>Log</Btn>
                            <Btn small ghost onClick={()=>removeCamper(c.id)} style={{color:C.red,borderColor:C.redBdr}}>✕</Btn>
                          </div>
                        </div>
                      </Card>
                    ); })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Navigation ── */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100,boxShadow:"0 -2px 12px rgba(27,29,44,0.08)"}}>
        {[["home","📊","Home"],["scan","📷","Scan"],["log","📝","Log"],["admin","📋",unlocked?"Admin":"Admin 🔒"]].map(([key,icon,label])=>{
          const isActive=tab===key;
          return (
            <button key={key} onClick={()=>goTab(key)} style={{flex:1,padding:"10px 4px 12px",background:"transparent",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontFamily:"inherit"}}>
              <span style={{fontSize:24,filter:isActive?"none":"grayscale(0.4) opacity(0.6)"}}>{icon}</span>
              <span style={{fontSize:10,fontWeight:isActive?700:500,color:isActive?CAMP_DK:C.muted}}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── PIN Modals ── */}
      {showPin&&<PinModal storedPin={storedPin} onSuccess={()=>{setUnlocked(true);setShowPin(false);setTab("admin");}} onClose={()=>setShowPin(false)}/>}
      {showChangePin&&<ChangePinModal storedPin={storedPin} onSave={async p=>{await changePin(p);}} onClose={()=>setShowChangePin(false)}/>}

      {/* ── Staff Clock Modal ── */}
      {staffModal&&(
        <div onClick={()=>{setStaffModal(null);coolRef.current=false;}} style={{position:"fixed",inset:0,background:"rgba(27,29,44,0.72)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:300,padding:"0 14px 14px"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.purple}44`,borderRadius:22,padding:"28px 22px",width:"100%",maxWidth:440,boxShadow:"0 -4px 30px rgba(27,29,44,0.18)"}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:10,fontWeight:700,color:C.purpleDk,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:6}}>👷 Staff Check-In</div>
              <div style={{fontWeight:800,fontSize:22,color:C.text}}>{staffModal.staff.name}</div>
              <div style={{fontSize:13,color:C.purpleDk,marginTop:2}}>{staffModal.staff.role} · {CAMP_LABEL}</div>
              <div style={{marginTop:10}}>
                <span style={{display:"inline-block",padding:"4px 14px",borderRadius:20,fontSize:12,fontWeight:600,background:SSTATUS[staffModal.status]?.color+"22",color:SSTATUS[staffModal.status]?.color,border:`1.5px solid ${SSTATUS[staffModal.status]?.color}44`}}>
                  {SSTATUS[staffModal.status]?.dot} {SSTATUS[staffModal.status]?.label}
                </span>
              </div>
            </div>
            <div style={{background:C.bg,borderRadius:12,padding:"14px 16px",marginBottom:16}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>{staffModal.status==="active"?"Clock-Out Time":"Clock-In Time"}</div>
              <input type="time" value={clockTime} onChange={e=>setClockTime(e.target.value)} style={{width:"100%",padding:"12px",borderRadius:10,border:`1.5px solid ${C.border}`,background:C.card,color:C.text,fontSize:24,outline:"none",fontFamily:"inherit",textAlign:"center"}}/>
              <div style={{fontSize:11,color:C.muted,marginTop:6,textAlign:"center"}}>Adjust if logging retroactively</div>
            </div>
            {staffModal.status!=="active"
              ?<button onClick={()=>doClock("clockin")} style={{width:"100%",padding:17,borderRadius:14,fontFamily:"inherit",marginBottom:10,border:`1.5px solid ${C.green}55`,background:C.green+"18",color:C.greenDk,cursor:"pointer",fontWeight:800,fontSize:18}}>⏰  Clock In</button>
              :<button onClick={()=>doClock("clockout")} style={{width:"100%",padding:17,borderRadius:14,fontFamily:"inherit",marginBottom:10,border:`1.5px solid ${C.redBdr}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:800,fontSize:18}}>⏹  Clock Out</button>
            }
            <button onClick={()=>{setStaffModal(null);coolRef.current=false;}} style={{width:"100%",padding:13,borderRadius:12,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:15}}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Camper Action Modal ── */}
      {camperModal&&(
        <div onClick={()=>{setCamperModal(null);coolRef.current=false;}} style={{position:"fixed",inset:0,background:"rgba(27,29,44,0.72)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:300,padding:"0 14px 14px"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:22,padding:"24px 22px",width:"100%",maxWidth:440,boxShadow:"0 -4px 30px rgba(27,29,44,0.18)"}}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:CAMP_DK,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:6}}>{CAMP_EMOJI} Camper Activity</div>
              <div style={{fontWeight:800,fontSize:22,color:C.text}}>{camperModal.camper.name}</div>
              {camperModal.camper.group&&<div style={{fontSize:13,color:C.muted,marginTop:2}}>{camperModal.camper.group}</div>}
              <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:8,flexWrap:"wrap"}}>
                {camperModal.camper.beforecare&&<Badge color={C.purple} dk={C.purpleDk}>🌅 Before Care</Badge>}
                {camperModal.camper.aftercare&&<Badge color={C.purple} dk={C.purpleDk}>🌙 After Care</Badge>}
                {camperModal.camper.parentName&&<Badge color={C.grey} dk={C.sub}>👤 {camperModal.camper.parentName}</Badge>}
              </div>
              <div style={{marginTop:10}}>
                <span style={{display:"inline-block",padding:"4px 14px",borderRadius:20,fontSize:12,fontWeight:600,background:CSTATUS[camperModal.status]?.color+"22",color:CSTATUS[camperModal.status]?.color,border:`1.5px solid ${CSTATUS[camperModal.status]?.color}44`}}>
                  {CSTATUS[camperModal.status]?.dot} {CSTATUS[camperModal.status]?.label}
                </span>
              </div>
            </div>
            {camperModal.camper.allergies&&<AllergyAlert allergies={camperModal.camper.allergies}/>}
            <div style={{display:"grid",gap:10,marginBottom:10}}>
              {CALLOWED[camperModal.status]?.map(a=>{ const ac=CACTION[a]; return (
                <button key={a} onClick={()=>doCamperAction(a)} style={{padding:"15px",borderRadius:14,fontFamily:"inherit",border:`1.5px solid ${ac.color}55`,background:ac.color+"18",color:ac.color===C.yellow?C.yellowDk:ac.dk,cursor:"pointer",fontWeight:700,fontSize:16,width:"100%"}}>
                  {ac.icon}  {ac.label}
                </button>
              ); })}
            </div>
            <button onClick={()=>{setCamperModal(null);coolRef.current=false;}} style={{width:"100%",padding:13,borderRadius:12,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:15}}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Parent Pickup Modal ── */}
      {pickupModal&&(
        <div onClick={()=>{setPickupModal(null);coolRef.current=false;}} style={{position:"fixed",inset:0,background:"rgba(27,29,44,0.75)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:300,padding:"0 14px 14px"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`2px solid ${C.purple}55`,borderRadius:22,padding:"28px 22px",width:"100%",maxWidth:440,boxShadow:"0 -4px 30px rgba(27,29,44,0.18)"}}>
            <div style={{textAlign:"center",marginBottom:18}}>
              <div style={{fontSize:10,fontWeight:700,color:C.purpleDk,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8}}>🚗 Parent Pickup</div>
              <div style={{fontWeight:800,fontSize:24,color:C.text,marginBottom:4}}>{pickupModal.camper.name}</div>
              {pickupModal.camper.group&&<div style={{fontSize:13,color:C.muted,marginBottom:4}}>{pickupModal.camper.group}</div>}
              {pickupModal.camper.parentName&&<div style={{fontSize:14,color:C.sub,marginTop:4}}>Expected: <strong style={{color:C.text}}>{pickupModal.camper.parentName}</strong></div>}
              <div style={{marginTop:10}}>
                <span style={{display:"inline-block",padding:"4px 14px",borderRadius:20,fontSize:12,fontWeight:600,background:CSTATUS[pickupModal.status]?.color+"22",color:CSTATUS[pickupModal.status]?.color}}>{CSTATUS[pickupModal.status]?.dot} {CSTATUS[pickupModal.status]?.label}</span>
              </div>
            </div>
            {pickupModal.camper.allergies&&<AllergyAlert allergies={pickupModal.camper.allergies}/>}
            <div style={{background:C.bg,borderRadius:12,padding:"12px 14px",marginBottom:16,textAlign:"center",fontSize:14,color:C.sub,lineHeight:1.5}}>Verify the parent or authorized guardian is present before releasing this camper.</div>
            <button onClick={doPickup} style={{width:"100%",padding:19,borderRadius:16,fontFamily:"inherit",marginBottom:10,border:`1.5px solid ${C.purple}`,background:C.purple+"18",color:C.purpleDk,cursor:"pointer",fontWeight:800,fontSize:19}}>🚗  Confirm Parent Pickup</button>
            <button onClick={()=>{setPickupModal(null);coolRef.current=false;}} style={{width:"100%",padding:13,borderRadius:12,border:`1.5px solid ${C.border}`,background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:15}}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── QR Modal ── */}
      {qrModal&&(
        <div onClick={()=>setQrModal(null)} style={{position:"fixed",inset:0,background:"rgba(27,29,44,0.78)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:22,padding:"28px 28px",textAlign:"center",maxWidth:320,width:"100%",boxShadow:"0 20px 60px rgba(27,29,44,0.25)"}}>
            {qrModal.type==="staff"?(
              <>
                <div style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:2}}>{qrModal.entity.name}</div>
                <div style={{fontSize:13,color:CAMP_DK,marginBottom:18}}>{qrModal.entity.role} · {CAMP_EMOJI} {CAMP_LABEL}</div>
                <div style={{background:C.bg,padding:14,borderRadius:14,display:"inline-block",marginBottom:14,border:`2px solid ${CAMP_COLOR}55`}}>
                  <img src={qrStaff(qrModal.entity.id)} alt="QR" style={{width:200,height:200,display:"block"}}/>
                </div>
                <div style={{fontSize:12,color:C.muted,marginBottom:20,lineHeight:1.6}}>Print and give to this staff member.<br/>Scan to clock in or clock out.</div>
              </>
            ):(
              <>
                <div style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:2}}>{qrModal.entity.name}</div>
                {qrModal.entity.group&&<div style={{fontSize:13,color:C.muted,marginBottom:4}}>{qrModal.entity.group}</div>}
                {qrModal.entity.allergies&&<div style={{background:C.alertBg,border:`1px solid ${C.alertBdr}`,borderRadius:8,padding:"6px 12px",marginBottom:10,fontSize:12,color:C.alertTxt,fontWeight:600}}>⚠ {qrModal.entity.allergies}</div>}
                <div style={{display:"flex",borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`,marginBottom:18,marginTop:10}}>
                  {[["camper",`${CAMP_EMOJI} Camper Badge`,CAMP_COLOR,CAMP_DK],["parent","🚗 Parent Pickup",C.purple,C.purpleDk]].map(([key,label,col,dk])=>(
                    <button key={key} onClick={()=>setQrTab(key)} style={{flex:1,padding:"11px 6px",border:"none",fontFamily:"inherit",background:qrTab===key?col+"18":"transparent",color:qrTab===key?dk:C.muted,fontSize:12,fontWeight:qrTab===key?700:500,cursor:"pointer"}}>{label}</button>
                  ))}
                </div>
                <div style={{background:C.bg,padding:14,borderRadius:14,display:"inline-block",marginBottom:14,border:`2px solid ${qrTab==="camper"?CAMP_COLOR:C.purple}55`}}>
                  <img src={qrTab==="camper"?qrCamper(qrModal.entity.id):qrParent(qrModal.entity.id)} alt="QR" style={{width:200,height:200,display:"block"}}/>
                </div>
                <div style={{fontSize:12,color:C.muted,marginBottom:20,lineHeight:1.6}}>
                  {qrTab==="camper"?"Pin to lanyard. Staff scans to log activities.":"Print and give to parent. Staff scans at pickup."}
                </div>
              </>
            )}
            <Btn full ghost onClick={()=>setQrModal(null)} style={{color:C.sub}}>Close</Btn>
          </div>
        </div>
      )}

      <style>{`*{box-sizing:border-box;}input::placeholder,textarea::placeholder{color:#838AAA;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:#C8CEDB;border-radius:2px;}button:hover:not(:disabled){opacity:0.88;}`}</style>
    </div>
  );
}
