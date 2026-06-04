import { useState, useMemo } from "react";
import AdminWorkspace from "./src/adminDashboard";

// ── SUPABASE SCHEMA (run in Supabase SQL Editor for production) ──────────────
// create table tickets (id uuid default gen_random_uuid() primary key,
//   submitted_at timestamptz default now(), name text, phone text, email text,
//   addr text, city text, project_type text, project_label text,
//   len numeric, wid numeric, sqft numeric, thick text, finish text,
//   tear text, grade text, access_ok text, timeline text, notes text,
//   rough_low numeric, rough_high numeric, final_quote numeric,
//   status text default 'New Request', follow_up_date date,
//   file_count int default 0, file_names text[], admin_notes text,
//   updated_at timestamptz default now());
// create table ticket_history (id uuid default gen_random_uuid() primary key,
//   ticket_id uuid references tickets(id) on delete cascade,
//   status text, note text, created_at timestamptz default now());
// Storage bucket: "ticket-files" | Auth: Supabase email/password for admins
// ENV: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
// ─────────────────────────────────────────────────────────────────────────────

const B = {
  dark:"#1A1A1A", dark2:"#252525", mid:"#3A3A3A", gray:"#696969",
  lgray:"#A8A094", border:"#DDD5C5", sand:"#F5F0E8", sandD:"#EDE5D3",
  tan:"#C4A882", bronze:"#8B6914", bronzeL:"#B8900F",
  green:"#2D4A2D", green2:"#3A5C3A", white:"#FFFFFF",
};

const BRAND_LOGO_SRC = "/branding/main_logo.png";

const STAT = {
  "New Request":        {c:"#1A5276",bg:"#D6EAF8"},
  "Needs Review":       {c:"#784212",bg:"#FDEBD0"},
  "Rough Estimate Sent":{c:"#6C3483",bg:"#F4ECF7"},
  "Site Visit Needed":  {c:"#922B21",bg:"#FADBD8"},
  "Scheduled":          {c:"#1A5632",bg:"#D5F5E3"},
  "Final Quote Sent":   {c:"#1B4F72",bg:"#D6EAF8"},
  "Won":                {c:"#145A32",bg:"#A9DFBF"},
  "Lost":               {c:"#4D5656",bg:"#EAEDED"},
};
const STAT_LIST = Object.keys(STAT);

const SERVICES = [
  {id:"flatwork", icon:"ti-road", title:"Concrete Flatwork",
   sub:"Driveways, patios, sidewalks, slabs, and parking lots — poured and finished with precision.",
   pts:["Driveways & parking lots","Patios & pool decks","Sidewalks & walkways","Commercial & industrial slabs","Shop floors & garage slabs","Post-frame building pads"]},
  {id:"stamped", icon:"ti-palette", title:"Stamped & Decorative Concrete",
   sub:"Stamped patterns, color stains, and decorative finishes that make your concrete stand out.",
   pts:["Stamped patios & driveways","Stone, brick & wood patterns","Color stains & dyes","Exposed aggregate","Saw-cut designs","Pool surrounds & outdoor living"]},
  {id:"masonry", icon:"ti-wall", title:"Masonry Services",
   sub:"Block walls, retaining walls, columns, steps, and custom stonework built to last.",
   pts:["Block foundations & stem walls","Retaining walls","Decorative columns & pillars","Steps & staircases","Outdoor kitchens & fireplaces","Landscape walls"]},
  {id:"polebarn", icon:"ti-building-warehouse", title:"Pole Barn / Post-Frame",
   sub:"Workshops, barns, equipment sheds, and agricultural buildings across Middle Georgia.",
   pts:["Equipment & machinery storage","Horse barns & agricultural buildings","Workshops & garages","Hay storage & farm buildings","Commercial storage buildings","Concrete slab or pier foundations"]},
  {id:"foundations", icon:"ti-building-fortress", title:"Block Foundations & Columns",
   sub:"Block stem walls, crawl space foundations, and structural or decorative columns.",
   pts:["Block stem walls","Crawl space perimeter foundations","Poured concrete footings","Structural & decorative columns","Footing excavation & forming","Residential & commercial"]},
];

const AREAS = ["Thomaston","Griffin","Barnesville","Forsyth","Zebulon","Macon","Milner","Williamson","Concord","McDonough","Locust Grove"];

const GALLERY_ITEMS = [
  {label:"Broom Finish Driveway",loc:"Griffin, GA",type:"Flatwork",hue:"#2C2C2C"},
  {label:"Stamped Flagstone Patio",loc:"Thomaston, GA",type:"Stamped",hue:"#3D2E1E"},
  {label:"Commercial Warehouse Slab",loc:"Forsyth, GA",type:"Flatwork",hue:"#1E2C1E"},
  {label:"Decorative Pool Deck",loc:"Macon, GA",type:"Decorative",hue:"#1E2A3A"},
  {label:"Block Retaining Wall",loc:"Barnesville, GA",type:"Masonry",hue:"#2A2A1E"},
  {label:"40x60 Pole Barn Slab",loc:"Zebulon, GA",type:"Pole Barn",hue:"#1E2E24"},
  {label:"Stamped Brick Driveway",loc:"McDonough, GA",type:"Stamped",hue:"#3A2818"},
  {label:"CMU Block Foundation",loc:"Locust Grove, GA",type:"Foundation",hue:"#262626"},
  {label:"Exposed Aggregate Patio",loc:"Forsyth, GA",type:"Decorative",hue:"#2A1E2A"},
  {label:"Sidewalk Replacement",loc:"Griffin, GA",type:"Flatwork",hue:"#222828"},
  {label:"Entry Gate Columns",loc:"Thomaston, GA",type:"Masonry",hue:"#2E2820"},
  {label:"Equipment Barn Slab",loc:"Milner, GA",type:"Pole Barn",hue:"#1E2820"},
];

const ago = n => new Date(Date.now()-n*86400000).toISOString();
const DEMO_TICKETS = [
  {id:"T-001",at:ago(0),name:"Mike Johnson",phone:"(770) 555-0142",email:"mikej@gmail.com",addr:"214 Maple Ridge Rd",city:"Griffin, GA",ptype:"Driveway",len:60,wid:14,sqft:840,thick:'4"',finish:"Broom",tear:"Yes",grade:"No",access:"Easy",timeline:"ASAP",notes:"Old asphalt needs to come out first. Want clean broom finish throughout.",rLow:7500,rHigh:10500,quote:null,status:"New Request",followUp:"",files:["driveway_front.jpg","driveway_side.jpg"],history:[{s:"New Request",d:ago(0),n:"Submitted via website"}],adminNotes:""},
  {id:"T-002",at:ago(1),name:"Sarah & Tom Davis",phone:"(678) 555-0287",email:"davis.family@email.com",addr:"88 Birchwood Circle",city:"Thomaston, GA",ptype:"Stamped Patio",len:24,wid:16,sqft:384,thick:'4"',finish:"Stamped",tear:"No",grade:"Not Sure",access:"Easy",timeline:"~1 Month",notes:"Want flagstone stamp pattern. Backyard, some slope toward the fence line.",rLow:6800,rHigh:10200,quote:null,status:"Needs Review",followUp:"2026-06-05",files:["backyard1.jpg","backyard2.jpg","sketch.pdf"],history:[{s:"New Request",d:ago(1),n:"Submitted via website"},{s:"Needs Review",d:ago(1),n:"Need to check slope — grading may be needed"}],adminNotes:"Slope needs attention. If significant add $600-900. Customer is motivated — wants done before summer."},
  {id:"T-003",at:ago(3),name:"Robert Tanner",phone:"(404) 555-0311",email:"rtanner@outlook.com",addr:"Hwy 74 W, Lot 12",city:"Barnesville, GA",ptype:"Pole Barn Slab",len:60,wid:40,sqft:2400,thick:'6"',finish:"Broom",tear:"No",grade:"Yes",access:"Easy",timeline:"1-2 Weeks",notes:"40x60 slab for metal building. Dirt work started. Need 6 inch with wire mesh.",rLow:18000,rHigh:25000,quote:22800,status:"Final Quote Sent",followUp:"2026-06-06",files:["lot_survey.pdf"],history:[{s:"New Request",d:ago(3),n:"Submitted via website"},{s:"Site Visit Needed",d:ago(3),n:"Need to see grade and site conditions"},{s:"Scheduled",d:ago(2),n:"Site visit scheduled Tuesday 10am"},{s:"Final Quote Sent",d:ago(1),n:"Quote emailed: $22,800"}],adminNotes:"Good customer. Site relatively flat. Following up Friday."},
  {id:"T-004",at:ago(5),name:"Linda Weston",phone:"(770) 555-0419",email:"lindaw@gmail.com",addr:"421 Pecan Grove Dr",city:"Forsyth, GA",ptype:"Sidewalk",len:45,wid:4,sqft:180,thick:'4"',finish:"Broom",tear:"Yes",grade:"No",access:"Easy",timeline:"Flexible",notes:"Old cracked sidewalk from driveway to front porch needs full replacement.",rLow:1500,rHigh:2400,quote:1900,status:"Won",followUp:"",files:[],history:[{s:"New Request",d:ago(5),n:"Submitted via website"},{s:"Rough Estimate Sent",d:ago(5),n:"Sent range via text"},{s:"Final Quote Sent",d:ago(4),n:"Quote: $1,900 incl. tear-out"},{s:"Won",d:ago(3),n:"Customer accepted. Scheduled next week."}],adminNotes:"Small job complete. Deposit collected."},
  {id:"T-005",at:ago(7),name:"James Holley",phone:"(404) 555-0572",email:"jholley@email.net",addr:"15 Commerce Park Blvd",city:"McDonough, GA",ptype:"Commercial Slab",len:80,wid:50,sqft:4000,thick:'6"',finish:"Smooth",tear:"No",grade:"Yes",access:"Easy",timeline:"ASAP",notes:"Warehouse expansion slab. 4000 sqft for heavy equipment use. Need reinforced.",rLow:30000,rHigh:42000,quote:null,status:"Needs Review",followUp:"2026-06-04",files:["site_plan.pdf","warehouse_layout.pdf"],history:[{s:"New Request",d:ago(7),n:"Submitted via website"},{s:"Needs Review",d:ago(6),n:"Commercial — review engineering requirements"}],adminNotes:"Need geotechnical report. Rebar req for heavy equipment adds cost. Call Monday."},
  {id:"T-006",at:ago(2),name:"Derek Fountain",phone:"(678) 555-0833",email:"dfountain@icloud.com",addr:"619 Lakeview Trl",city:"Locust Grove, GA",ptype:"Columns",len:0,wid:0,sqft:0,thick:"N/A",finish:"N/A",tear:"No",grade:"No",access:"Easy",timeline:"1-2 Weeks",notes:"4 brick columns, 6 feet tall each, for a new front entrance gate with caps.",rLow:4000,rHigh:10000,quote:null,status:"Site Visit Needed",followUp:"2026-06-07",files:["gate_reference.jpg"],history:[{s:"New Request",d:ago(2),n:"Submitted via website"},{s:"Needs Review",d:ago(2),n:"Column work — need footing depth info"},{s:"Site Visit Needed",d:ago(1),n:"Visiting to confirm spec and footing"}],adminNotes:"4 columns ~6ft. Wide range — confirm footing depth and cap design on site."},
  {id:"T-007",at:ago(10),name:"Carla Simmons",phone:"(478) 555-0688",email:"csimmons@yahoo.com",addr:"302 Old Mill Rd",city:"Macon, GA",ptype:"Decorative Pool Deck",len:20,wid:20,sqft:400,thick:'4"',finish:"Decorative",tear:"No",grade:"No",access:"Easy",timeline:"~1 Month",notes:"Pool deck needs decorative overlay. Prefer a light cool-deck style finish.",rLow:4800,rHigh:7200,quote:5600,status:"Scheduled",followUp:"2026-06-10",files:["pool_area.jpg","pool_deck.jpg"],history:[{s:"New Request",d:ago(10),n:"Submitted via website"},{s:"Rough Estimate Sent",d:ago(10),n:"Range sent via email"},{s:"Site Visit Needed",d:ago(8),n:"Check existing deck condition"},{s:"Final Quote Sent",d:ago(6),n:"Quote: $5,600 for decorative overlay"},{s:"Scheduled",d:ago(4),n:"Scheduled for June 10"}],adminNotes:"Overlay job June 10. Check for cracks day before — add $300-500 if crack repair needed."},
  {id:"T-008",at:ago(14),name:"Harold & Brenda Puckett",phone:"(770) 555-0724",email:"hpuckett@gmail.com",addr:"County Road 34",city:"Zebulon, GA",ptype:"Block Foundation",len:28,wid:36,sqft:1008,thick:"N/A",finish:"N/A",tear:"No",grade:"Yes",access:"Not Sure",timeline:"Flexible",notes:"Shop building block foundation plus interior slab. Rural property, some grade work.",rLow:8500,rHigh:14000,quote:null,status:"Lost",followUp:"",files:[],history:[{s:"New Request",d:ago(14),n:"Submitted via website"},{s:"Rough Estimate Sent",d:ago(13),n:"Sent rough range"},{s:"Lost",d:ago(8),n:"Customer went with lower bid"}],adminNotes:"Lost to price. Rural access uncertainty may have inflated estimate."},
];

// ── UTILITIES ──────────────────────────────────────────────────
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—";
const fmtTime = iso => iso ? new Date(iso).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "—";
const fmtMoney = n => n != null ? "$"+Number(n).toLocaleString() : "—";
const fmtRange = (lo,hi) => lo && hi ? `$${Number(lo).toLocaleString()} – $${Number(hi).toLocaleString()}` : "—";

const DP = {b1:7,b2:10,mj:1500,st1:8,st2:15,de1:4,de2:8,th1:1,th2:2,tr1:2.5,tr2:4.5,gr1:500,gr2:1500,ac1:300,ac2:800,pb1:7,pb2:11,bl1:25,bl2:45,co1:800,co2:2500,re1:400,re2:1800};
const TYPES = [{id:"driveway",label:"Driveway",sqft:true},{id:"patio",label:"Patio",sqft:true},{id:"sidewalk",label:"Sidewalk",sqft:true},{id:"slab",label:"General Slab",sqft:true},{id:"stamped",label:"Stamped Concrete",sqft:true},{id:"decorative",label:"Decorative Concrete",sqft:true},{id:"repair",label:"Concrete Repair",sqft:false},{id:"pole_barn",label:"Pole Barn Slab",sqft:true},{id:"block",label:"Block Foundation",sqft:true},{id:"columns",label:"Columns",sqft:false},{id:"other",label:"Other / Not Sure",sqft:true}];

function calcEst(form, P) {
  const t=form.type; let sqft=0,lo=0,hi=0,rows=[],notes=[];
  if(t==="columns"){const n=parseInt(form.cols)||1;lo=n*P.co1;hi=n*P.co2;rows.push({l:`${n} column${n>1?"s":""} × $${P.co1}–$${P.co2} each`,lo,hi});notes.push("Column pricing depends on size, height, design, and footing requirements.");return fin(sqft,lo,hi,rows,notes,P);}
  if(t==="repair"){sqft=(form.len&&form.wid)?parseFloat(form.len)*parseFloat(form.wid):0;lo=P.re1;hi=P.re2;rows.push({l:"Concrete repair — rough all-in range",lo,hi});notes.push("Repair pricing is highly variable. Scope confirmed on site visit.");return fin(sqft,lo,hi,rows,notes,P);}
  sqft=parseFloat(form.len)*parseFloat(form.wid);
  if(t==="block"){const pr=2*(parseFloat(form.len)+parseFloat(form.wid));lo=pr*P.bl1;hi=pr*P.bl2;rows.push({l:`~${Math.round(pr)} lin ft × $${P.bl1}–$${P.bl2}/ft`,lo,hi});notes.push("Final pricing depends on wall height, block type, and footing design.");if(form.grade!=="no"){rows.push({l:(form.grade==="ns"?"Possible ":"")+"Grading/prep",lo:P.gr1,hi:P.gr2});lo+=P.gr1;hi+=P.gr2;}if(form.access!=="yes"){rows.push({l:(form.access==="ns"?"Possible ":"")+"Difficult access",lo:P.ac1,hi:P.ac2});lo+=P.ac1;hi+=P.ac2;}return fin(sqft,lo,hi,rows,notes,P);}
  if(t==="pole_barn"){lo=sqft*P.pb1;hi=sqft*P.pb2;rows.push({l:`${sqft.toLocaleString()} sqft × $${P.pb1}–$${P.pb2}/sqft`,lo,hi});}
  else{lo=sqft*P.b1;hi=sqft*P.b2;rows.push({l:`${sqft.toLocaleString()} sqft × $${P.b1}–$${P.b2}/sqft (base)`,lo,hi});const isSt=t==="stamped"||form.finish==="stamped";const isDe=t==="decorative"||form.finish==="decorative";if(isSt){const sl=sqft*P.st1,sh=sqft*P.st2;rows.push({l:`Stamped finish (+$${P.st1}–$${P.st2}/sqft)`,lo:sl,hi:sh});lo+=sl;hi+=sh;}else if(isDe){const dl=sqft*P.de1,dh=sqft*P.de2;rows.push({l:`Decorative/stain (+$${P.de1}–$${P.de2}/sqft)`,lo:dl,hi:dh});lo+=dl;hi+=dh;}}
  if(form.thick==="6"&&sqft>0){const tl=sqft*P.th1,th=sqft*P.th2;rows.push({l:`6"+ thick slab (+$${P.th1}–$${P.th2}/sqft)`,lo:tl,hi:th});lo+=tl;hi+=th;}
  if(form.tear!=="no"&&sqft>0){const px=form.tear==="ns"?"Possible ":"",rl=sqft*P.tr1,rh=sqft*P.tr2;rows.push({l:`${px}Tear-out/removal (+$${P.tr1}–$${P.tr2}/sqft)`,lo:rl,hi:rh});lo+=rl;hi+=rh;if(form.tear==="ns")notes.push("Tear-out included as possible — confirm on site visit.");}
  if(form.grade!=="no"){const px=form.grade==="ns"?"Possible ":"";rows.push({l:`${px}Grading/prep`,lo:P.gr1,hi:P.gr2});lo+=P.gr1;hi+=P.gr2;if(form.grade==="ns")notes.push("Grading included as possible — confirm on site visit.");}
  if(form.access!=="yes"){const px=form.access==="ns"?"Possible ":"";rows.push({l:`${px}Difficult access`,lo:P.ac1,hi:P.ac2});lo+=P.ac1;hi+=P.ac2;if(form.access==="ns")notes.push("Access upcharge possible — confirm on site visit.");}
  return fin(sqft,lo,hi,rows,notes,P);
}
function fin(sqft,lo,hi,rows,notes,P){if(lo<P.mj||hi<P.mj)notes.push(`Minimum job price of $${P.mj.toLocaleString()} applied.`);lo=Math.max(lo,P.mj);hi=Math.max(hi,P.mj);lo=Math.round(lo/50)*50;hi=Math.round(hi/50)*50;if(lo===hi)hi=lo+500;return{sqft,lo,hi,rows,notes};}

// ── SMALL COMPONENTS ──────────────────────────────────────────
function Logo({light=true, sm=false}) {
  return (
    <img src={BRAND_LOGO_SRC} alt="Southern Oak Concrete & Construction" style={{display:"block",height:sm?34:56,width:"auto"}} />
  );
}

function Pill({label, status}) {
  const cfg = STAT[status]||{c:"#555",bg:"#eee"};
  return <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,background:cfg.bg,color:cfg.c,fontWeight:700,fontSize:".68rem",whiteSpace:"nowrap"}}>{label||status}</span>;
}

function SBtn({children,onClick,v="primary",sm=false,full=false,style={}}) {
  const pads = sm?"6px 14px":"10px 20px";
  const vs = {
    primary:{background:B.bronze,color:B.white,border:"none"},
    dark:{background:B.dark,color:B.white,border:"none"},
    green:{background:B.green,color:B.white,border:"none"},
    outline:{background:"transparent",color:B.white,border:"1.5px solid rgba(255,255,255,.5)"},
    outlineDark:{background:"transparent",color:B.mid,border:"1.5px solid "+B.border},
    danger:{background:"#C0392B",color:B.white,border:"none"},
    success:{background:"#1E8449",color:B.white,border:"none"},
  };
  return <button onClick={onClick} style={{padding:pads,borderRadius:6,fontSize:sm?".78rem":".88rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:full?"block":"inline-block",width:full?"100%":undefined,textAlign:"center",...(vs[v]||vs.primary),...style}}>{children}</button>;
}

function Pills2({label,value,onChange,opts}) {
  return (
    <div style={{marginBottom:12}}>
      <label style={{display:"block",fontSize:".8rem",fontWeight:700,color:B.dark,marginBottom:5}}>{label}</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {opts.map(o=><button key={o.v} onClick={()=>onChange(o.v)} style={{padding:"6px 12px",borderRadius:20,border:"1.5px solid "+(value===o.v?B.green:B.border),background:value===o.v?"#deeade":B.white,color:value===o.v?B.green:B.gray,fontWeight:600,fontSize:".76rem",cursor:"pointer",fontFamily:"inherit"}}>{o.l}</button>)}
      </div>
    </div>
  );
}

const INP = {width:"100%",padding:"9px 12px",border:"1.5px solid #DDD5C5",borderRadius:6,fontSize:".88rem",fontFamily:"inherit",background:B.white,color:B.dark,outline:"none",boxSizing:"border-box"};

// ── NAV ──────────────────────────────────────────────────────
function Nav({page, setPage, adminMode, setAdminMode}) {
  const [open,setOpen] = useState(false);
  const links = [{k:"home",l:"Home"},{k:"services",l:"Services"},{k:"gallery",l:"Gallery"},{k:"about",l:"About"},{k:"contact",l:"Contact"}];
  return (
    <div style={{background:B.dark,borderBottom:"1px solid rgba(255,255,255,.06)"}}>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:64}}>
        <div onClick={()=>{setPage("home");setAdminMode(false);}}><Logo/></div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {links.map(l=><button key={l.k} className="desktopNav" onClick={()=>{setPage(l.k);setOpen(false);}} style={{background:"none",border:"none",color:page===l.k?B.tan:"rgba(255,255,255,.7)",fontWeight:page===l.k?700:500,fontSize:".82rem",cursor:"pointer",padding:"6px 10px",fontFamily:"inherit"}}>
            {l.l}
          </button>)}
          <button onClick={()=>setPage("estimate")} style={{background:B.bronze,border:"none",color:B.white,fontWeight:700,fontSize:".78rem",cursor:"pointer",padding:"8px 14px",borderRadius:6,fontFamily:"inherit",marginLeft:4}}>
            <i className="ti ti-file-description" style={{marginRight:5,fontSize:14,verticalAlign:-2}} aria-hidden="true"/>Free Estimate
          </button>
          <a href="tel:4048614594" style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",color:B.white,fontWeight:700,fontSize:".78rem",padding:"8px 12px",borderRadius:6,textDecoration:"none",marginLeft:2}}>
            <i className="ti ti-phone" style={{marginRight:4,fontSize:13,verticalAlign:-2}} aria-hidden="true"/>(404) 861-4594
          </a>
          <button className="desktopAdminLink" onClick={()=>{setAdminMode(true);setOpen(false);}} style={{background:"transparent",border:"1px solid rgba(255,255,255,.18)",color:"rgba(255,255,255,.78)",fontWeight:700,fontSize:".78rem",cursor:"pointer",padding:"8px 12px",borderRadius:6,fontFamily:"inherit",marginLeft:2}}>
            <i className="ti ti-shield-lock" style={{marginRight:5,fontSize:13,verticalAlign:-2}} aria-hidden="true"/>Admin Sign In
          </button>
          <button className="mobileNavToggle" onClick={()=>setOpen(o=>!o)} style={{background:"none",border:"1px solid rgba(255,255,255,.2)",color:B.white,padding:"7px 10px",borderRadius:6,cursor:"pointer",marginLeft:2}}>
            <i className={open?"ti ti-x":"ti ti-menu-2"} style={{fontSize:18}} aria-hidden="true"/>
          </button>
        </div>
      </div>
      {open&&<div style={{background:B.dark2,borderTop:"1px solid rgba(255,255,255,.08)",padding:"8px 16px 12px"}}>
        {links.map(l=><div key={l.k} onClick={()=>{setPage(l.k);setOpen(false);}} style={{padding:"10px 0",color:page===l.k?B.tan:"rgba(255,255,255,.8)",fontWeight:600,fontSize:".88rem",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,.06)"}}>{l.l}</div>)}
        <div onClick={()=>{setAdminMode(true);setOpen(false);}} style={{padding:"10px 0",color:"rgba(255,255,255,.5)",fontWeight:600,fontSize:".8rem",cursor:"pointer"}}>
          <i className="ti ti-shield-lock" style={{marginRight:6,fontSize:13}} aria-hidden="true"/>Admin Login
        </div>
      </div>}
    </div>
  );
}

// ── FOOTER ─────────────────────────────────────────────────────
function Footer({setPage, setAdminMode}) {
  return (
    <div style={{background:B.dark,color:"rgba(255,255,255,.7)",marginTop:0}}>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"40px 16px 24px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:32,marginBottom:32}}>
          <div>
            <Logo/>
            <p style={{fontSize:".78rem",marginTop:14,lineHeight:1.6,color:"rgba(255,255,255,.55)"}}>Professional concrete and masonry construction serving Middle Georgia.</p>
            <a href="tel:4048614594" style={{display:"flex",alignItems:"center",gap:7,marginTop:12,color:B.tan,fontWeight:700,fontSize:".85rem",textDecoration:"none"}}>
              <i className="ti ti-phone" style={{fontSize:16}} aria-hidden="true"/>(404) 861-4594
            </a>
          </div>
          <div>
            <div style={{color:B.white,fontWeight:700,marginBottom:12,fontSize:".82rem",textTransform:"uppercase",letterSpacing:1}}>Services</div>
            {SERVICES.map(s=><div key={s.id} onClick={()=>setPage("services")} style={{fontSize:".78rem",marginBottom:7,cursor:"pointer",color:"rgba(255,255,255,.6)"}}>{s.title}</div>)}
          </div>
          <div>
            <div style={{color:B.white,fontWeight:700,marginBottom:12,fontSize:".82rem",textTransform:"uppercase",letterSpacing:1}}>Service Area</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"4px 10px"}}>
              {AREAS.map(a=><span key={a} style={{fontSize:".74rem",color:"rgba(255,255,255,.55)"}}>{a}, GA</span>)}
            </div>
          </div>
          <div>
            <div style={{color:B.white,fontWeight:700,marginBottom:12,fontSize:".82rem",textTransform:"uppercase",letterSpacing:1}}>Contact</div>
            <div style={{fontSize:".78rem",color:"rgba(255,255,255,.6)",lineHeight:1.9}}>
              <div><i className="ti ti-map-pin" style={{marginRight:6,color:B.tan}} aria-hidden="true"/>Thomaston, GA 30286</div>
              <div><i className="ti ti-clock" style={{marginRight:6,color:B.tan}} aria-hidden="true"/>Mon–Sat 7am–6pm</div>
              <div onClick={()=>setPage("estimate")} style={{cursor:"pointer",color:B.tan,fontWeight:600,marginTop:8}}>
                <i className="ti ti-arrow-right" style={{marginRight:5}} aria-hidden="true"/>Request Free Estimate
              </div>
            </div>
          </div>
        </div>
        <div style={{borderTop:"1px solid rgba(255,255,255,.1)",paddingTop:16,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <span style={{fontSize:".72rem",color:"rgba(255,255,255,.35)"}}>© 2026 Southern Oak Concrete & Construction. All rights reserved.</span>
          <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
            <button onClick={()=>{setAdminMode(true);window.scrollTo({top:0,behavior:"smooth"});}} style={{background:"none",border:"none",padding:0,fontSize:".72rem",color:"rgba(255,255,255,.35)",cursor:"pointer",fontFamily:"inherit"}}>
              Admin sign in
            </button>
            <button onClick={()=>setPage("home")} style={{background:"none",border:"none",padding:0,fontSize:".72rem",color:"rgba(255,255,255,.25)",cursor:"pointer",fontFamily:"inherit"}}>Thomaston, GA</button>
            <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} style={{background:"none",border:"none",padding:0,fontSize:".72rem",color:"rgba(255,255,255,.25)",cursor:"pointer",fontFamily:"inherit"}}>
              Back to top
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── HOME PAGE ──────────────────────────────────────────────────
function HomePage({setPage}) {
  return (
    <div>
      {/* Hero */}
      <div style={{background:"linear-gradient(160deg,#141414 0%,#1E2E1E 60%,#1A1A1A 100%)",padding:"80px 16px 72px",textAlign:"center"}}>
        <div style={{maxWidth:720,margin:"0 auto"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(196,168,130,.12)",border:"1px solid rgba(196,168,130,.25)",borderRadius:20,padding:"5px 14px",marginBottom:20}}>
            <i className="ti ti-map-pin" style={{fontSize:13,color:B.tan}} aria-hidden="true"/>
            <span style={{fontSize:".72rem",color:B.tan,fontWeight:600,letterSpacing:.5}}>Serving Thomaston & Middle Georgia</span>
          </div>
          <h1 style={{fontSize:"2.4rem",fontWeight:700,color:B.white,lineHeight:1.2,margin:"0 0 16px"}}>
            Concrete & Masonry<br/><span style={{color:B.tan}}>Built to Last.</span>
          </h1>
          <p style={{fontSize:"1rem",color:"rgba(255,255,255,.65)",lineHeight:1.7,marginBottom:28,maxWidth:560,margin:"0 auto 28px"}}>
            Driveways, patios, slabs, stamped concrete, block foundations, and pole barn construction — residential and commercial. Free estimates. No pressure.
          </p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <SBtn onClick={()=>setPage("estimate")} style={{fontSize:"1rem",padding:"13px 28px"}}>
              <i className="ti ti-file-description" style={{marginRight:7,fontSize:16,verticalAlign:-2}} aria-hidden="true"/>Get a Free Estimate
            </SBtn>
            <a href="tel:4048614594" style={{display:"inline-block",padding:"13px 24px",borderRadius:6,border:"1.5px solid rgba(255,255,255,.3)",color:B.white,fontWeight:700,fontSize:"1rem",textDecoration:"none"}}>
              <i className="ti ti-phone" style={{marginRight:7,fontSize:16,verticalAlign:-2}} aria-hidden="true"/>Call (404) 861-4594
            </a>
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div style={{background:B.bronze,padding:"14px 16px"}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"flex",justifyContent:"center",gap:32,flexWrap:"wrap"}}>
          {[["ti-shield-check","Licensed & Insured"],["ti-calendar-check","Free Estimates"],["ti-map","Middle Georgia"],["ti-award","Quality Craftsmanship"]].map(([icon,l])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:7,color:B.white,fontWeight:700,fontSize:".78rem"}}>
              <i className={`ti ${icon}`} style={{fontSize:16}} aria-hidden="true"/>{l}
            </div>
          ))}
        </div>
      </div>

      {/* Services */}
      <div style={{background:B.sand,padding:"60px 16px"}}>
        <div style={{maxWidth:1000,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}>
            <h2 style={{fontSize:"1.6rem",fontWeight:700,color:B.dark,marginBottom:8}}>What We Do</h2>
            <p style={{color:B.gray,fontSize:".9rem"}}>Concrete and masonry services for residential and commercial projects across Middle Georgia.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
            {SERVICES.map(s=>(
              <div key={s.id} onClick={()=>setPage("services")} style={{background:B.dark,borderRadius:8,padding:"24px 20px",cursor:"pointer",border:"1px solid rgba(255,255,255,.06)"}}>
                <i className={`ti ${s.icon}`} style={{fontSize:28,color:B.tan,marginBottom:12,display:"block"}} aria-hidden="true"/>
                <div style={{fontWeight:700,color:B.white,fontSize:"1rem",marginBottom:6}}>{s.title}</div>
                <p style={{fontSize:".8rem",color:"rgba(255,255,255,.6)",lineHeight:1.6,marginBottom:14}}>{s.sub}</p>
                <span style={{fontSize:".76rem",color:B.tan,fontWeight:600}}>Learn more <i className="ti ti-arrow-right" style={{fontSize:12,verticalAlign:-1}} aria-hidden="true"/></span>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center",marginTop:28}}>
            <SBtn onClick={()=>setPage("estimate")} style={{fontSize:".95rem",padding:"12px 28px"}}>
              Request a Free Estimate <i className="ti ti-arrow-right" style={{marginLeft:6,fontSize:14,verticalAlign:-2}} aria-hidden="true"/>
            </SBtn>
          </div>
        </div>
      </div>

      {/* Why choose us */}
      <div style={{background:B.white,padding:"56px 16px"}}>
        <div style={{maxWidth:900,margin:"0 auto"}}>
          <h2 style={{textAlign:"center",fontSize:"1.5rem",fontWeight:700,color:B.dark,marginBottom:36}}>Why Southern Oak?</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:24}}>
            {[
              {icon:"ti-eye",t:"No Surprises",d:"Clear estimates, honest pricing, and no hidden charges. You always know what you're getting."},
              {icon:"ti-hammer",t:"Skilled Crews",d:"Experienced concrete and masonry crews who take pride in every pour, every course of block."},
              {icon:"ti-map",t:"Local & Reliable",d:"Based in Thomaston, serving Middle Georgia. We show up on time and finish the job."},
              {icon:"ti-thumb-up",t:"Free Estimates",d:"No pressure, no commitment. Submit your project details online and we'll follow up fast."},
            ].map(({icon,t,d})=>(
              <div key={t} style={{textAlign:"center",padding:"20px 12px"}}>
                <div style={{width:52,height:52,background:B.sand,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
                  <i className={`ti ${icon}`} style={{fontSize:24,color:B.bronze}} aria-hidden="true"/>
                </div>
                <div style={{fontWeight:700,color:B.dark,marginBottom:6,fontSize:".95rem"}}>{t}</div>
                <p style={{fontSize:".8rem",color:B.gray,lineHeight:1.6}}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Service areas */}
      <div style={{background:B.sandD,padding:"48px 16px"}}>
        <div style={{maxWidth:800,margin:"0 auto",textAlign:"center"}}>
          <h2 style={{fontSize:"1.4rem",fontWeight:700,color:B.dark,marginBottom:8}}>Service Area</h2>
          <p style={{color:B.gray,fontSize:".85rem",marginBottom:24}}>We serve Thomaston and surrounding communities throughout Middle Georgia.</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:"8px 12px",justifyContent:"center"}}>
            {AREAS.map(a=>(
              <span key={a} style={{padding:"6px 14px",borderRadius:20,background:B.white,border:"1px solid "+B.border,fontSize:".78rem",fontWeight:600,color:B.mid}}>{a}, GA</span>
            ))}
          </div>
          <p style={{marginTop:20,fontSize:".8rem",color:B.gray}}>Not on this list? Call us — we serve many surrounding areas as well.</p>
        </div>
      </div>

      {/* CTA */}
      <div style={{background:B.green,padding:"56px 16px",textAlign:"center"}}>
        <div style={{maxWidth:600,margin:"0 auto"}}>
          <h2 style={{fontSize:"1.7rem",fontWeight:700,color:B.white,marginBottom:10}}>Ready to get started?</h2>
          <p style={{color:"rgba(255,255,255,.7)",marginBottom:24,fontSize:".95rem"}}>Get a rough estimate online in minutes. No commitment required. We'll follow up to schedule a free site visit.</p>
          <SBtn onClick={()=>setPage("estimate")} style={{fontSize:"1rem",padding:"14px 32px"}}>
            <i className="ti ti-file-description" style={{marginRight:8,fontSize:16,verticalAlign:-2}} aria-hidden="true"/>Start Your Free Estimate
          </SBtn>
        </div>
      </div>
    </div>
  );
}

// ── SERVICES PAGE ──────────────────────────────────────────────
function ServicesPage({setPage}) {
  return (
    <div style={{background:B.sand,minHeight:"100vh"}}>
      <div style={{background:B.dark,padding:"48px 16px 40px",textAlign:"center"}}>
        <h1 style={{fontSize:"2rem",fontWeight:700,color:B.white,marginBottom:8}}>Our Services</h1>
        <p style={{color:"rgba(255,255,255,.6)",fontSize:".9rem"}}>Concrete and masonry work for residential and commercial projects across Middle Georgia.</p>
      </div>
      <div style={{maxWidth:900,margin:"0 auto",padding:"40px 16px 60px"}}>
        {SERVICES.map((s,i)=>(
          <div key={s.id} style={{background:B.white,borderRadius:10,padding:"28px 24px",marginBottom:20,border:"1px solid "+B.border}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:16,marginBottom:16}}>
              <div style={{width:52,height:52,background:B.dark,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <i className={`ti ${s.icon}`} style={{fontSize:24,color:B.tan}} aria-hidden="true"/>
              </div>
              <div>
                <h2 style={{fontSize:"1.2rem",fontWeight:700,color:B.dark,marginBottom:4}}>{s.title}</h2>
                <p style={{color:B.gray,fontSize:".85rem"}}>{s.sub}</p>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:6}}>
              {s.pts.map(pt=>(
                <div key={pt} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",fontSize:".82rem",color:B.mid}}>
                  <i className="ti ti-check" style={{fontSize:14,color:B.bronze,flexShrink:0}} aria-hidden="true"/>{pt}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{textAlign:"center",marginTop:8}}>
          <SBtn onClick={()=>setPage("estimate")} style={{fontSize:"1rem",padding:"13px 28px"}}>
            <i className="ti ti-file-description" style={{marginRight:7,fontSize:15,verticalAlign:-2}} aria-hidden="true"/>Request a Free Estimate
          </SBtn>
        </div>
      </div>
    </div>
  );
}

// ── GALLERY PAGE ────────────────────────────────────────────────
function GalleryPage({setPage}) {
  const cats = ["All",...new Set(GALLERY_ITEMS.map(g=>g.type))];
  const [cat,setCat] = useState("All");
  const shown = cat==="All"?GALLERY_ITEMS:GALLERY_ITEMS.filter(g=>g.type===cat);
  return (
    <div style={{background:B.sand,minHeight:"100vh"}}>
      <div style={{background:B.dark,padding:"48px 16px 40px",textAlign:"center"}}>
        <h1 style={{fontSize:"2rem",fontWeight:700,color:B.white,marginBottom:8}}>Project Gallery</h1>
        <p style={{color:"rgba(255,255,255,.6)",fontSize:".9rem"}}>A sample of recent work across Middle Georgia.</p>
      </div>
      <div style={{maxWidth:1000,margin:"0 auto",padding:"32px 16px 60px"}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:24,justifyContent:"center"}}>
          {cats.map(c=><button key={c} onClick={()=>setCat(c)} style={{padding:"6px 16px",borderRadius:20,border:"1.5px solid "+(cat===c?B.green:B.border),background:cat===c?"#deeade":B.white,color:cat===c?B.green:B.mid,fontWeight:600,fontSize:".76rem",cursor:"pointer",fontFamily:"inherit"}}>{c}</button>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
          {shown.map((g,i)=>(
            <div key={i} style={{borderRadius:8,overflow:"hidden",border:"1px solid "+B.border,background:B.white}}>
              <div style={{height:160,background:g.hue,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                <i className="ti ti-camera" style={{fontSize:36,color:"rgba(255,255,255,.15)"}} aria-hidden="true"/>
                <div style={{position:"absolute",bottom:10,left:10}}>
                  <span style={{background:"rgba(0,0,0,.5)",color:B.white,fontSize:".68rem",fontWeight:700,padding:"3px 9px",borderRadius:4}}>{g.type}</span>
                </div>
              </div>
              <div style={{padding:"12px 14px"}}>
                <div style={{fontWeight:700,color:B.dark,fontSize:".85rem",marginBottom:2}}>{g.label}</div>
                <div style={{fontSize:".73rem",color:B.gray}}>
                  <i className="ti ti-map-pin" style={{marginRight:4,fontSize:12}} aria-hidden="true"/>{g.loc}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{textAlign:"center",marginTop:32}}>
          <p style={{color:B.gray,fontSize:".85rem",marginBottom:16}}>Have a project in mind? Let's talk about it.</p>
          <SBtn onClick={()=>setPage("estimate")}>Get a Free Estimate</SBtn>
        </div>
      </div>
    </div>
  );
}

// ── ABOUT PAGE ─────────────────────────────────────────────────
function AboutPage({setPage}) {
  return (
    <div style={{background:B.sand,minHeight:"100vh"}}>
      <div style={{background:B.dark,padding:"48px 16px 40px",textAlign:"center"}}>
        <h1 style={{fontSize:"2rem",fontWeight:700,color:B.white,marginBottom:8}}>About Southern Oak</h1>
        <p style={{color:"rgba(255,255,255,.6)",fontSize:".9rem"}}>Concrete and masonry built with pride in Middle Georgia.</p>
      </div>
      <div style={{maxWidth:800,margin:"0 auto",padding:"48px 16px 60px"}}>
        <div style={{background:B.white,borderRadius:10,padding:"32px 28px",border:"1px solid "+B.border,marginBottom:20}}>
          <h2 style={{fontSize:"1.3rem",fontWeight:700,color:B.dark,marginBottom:16}}>Our Story</h2>
          <p style={{color:B.mid,lineHeight:1.8,marginBottom:14,fontSize:".9rem"}}>Southern Oak Concrete and Construction is a locally owned concrete and masonry contractor based in Thomaston, Georgia. We serve residential homeowners, farmers, and commercial customers across Middle Georgia with concrete flatwork, stamped and decorative concrete, masonry, pole barn construction, and block foundations.</p>
          <p style={{color:B.mid,lineHeight:1.8,fontSize:".9rem"}}>We built this company on straightforward work: show up on time, do the job right, stand behind what we build. Every project — whether it's a backyard patio or a 5,000 square foot commercial slab — gets the same attention to detail. We don't cut corners on prep work, reinforcement, or finish.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16,marginBottom:24}}>
          {[{icon:"ti-heart",t:"Locally Owned",d:"Thomaston, GA based. We're your neighbors."},{icon:"ti-certificate",t:"Licensed & Insured",d:"Fully licensed and insured for your protection."},{icon:"ti-users",t:"Experienced Crews",d:"Skilled craftsmen with years in the field."},].map(({icon,t,d})=>(
            <div key={t} style={{background:B.white,borderRadius:8,padding:"20px",border:"1px solid "+B.border,textAlign:"center"}}>
              <i className={`ti ${icon}`} style={{fontSize:28,color:B.bronze,marginBottom:10,display:"block"}} aria-hidden="true"/>
              <div style={{fontWeight:700,color:B.dark,marginBottom:5,fontSize:".9rem"}}>{t}</div>
              <p style={{fontSize:".78rem",color:B.gray}}>{d}</p>
            </div>
          ))}
        </div>
        <div style={{textAlign:"center"}}>
          <SBtn onClick={()=>setPage("estimate")} style={{fontSize:".95rem",padding:"12px 28px"}}>Request a Free Estimate</SBtn>
        </div>
      </div>
    </div>
  );
}

// ── CONTACT PAGE ────────────────────────────────────────────────
function ContactPage({setPage}) {
  const [sent,setSent]=useState(false);
  return (
    <div style={{background:B.sand,minHeight:"100vh"}}>
      <div style={{background:B.dark,padding:"48px 16px 40px",textAlign:"center"}}>
        <h1 style={{fontSize:"2rem",fontWeight:700,color:B.white,marginBottom:8}}>Contact Us</h1>
        <p style={{color:"rgba(255,255,255,.6)",fontSize:".9rem"}}>Reach out with questions or to discuss your project.</p>
      </div>
      <div style={{maxWidth:700,margin:"0 auto",padding:"40px 16px 60px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:24}}>
          {[{icon:"ti-phone",l:"Phone",v:"(404) 861-4594",href:"tel:4048614594"},{icon:"ti-map-pin",l:"Location",v:"Thomaston, GA 30286"},{icon:"ti-clock",l:"Hours",v:"Mon–Sat 7am–6pm"}].map(({icon,l,v,href})=>(
            <div key={l} style={{background:B.white,borderRadius:8,padding:"18px 16px",border:"1px solid "+B.border,textAlign:"center"}}>
              <i className={`ti ${icon}`} style={{fontSize:24,color:B.bronze,marginBottom:8,display:"block"}} aria-hidden="true"/>
              <div style={{fontSize:".72rem",color:B.gray,marginBottom:3,textTransform:"uppercase",letterSpacing:.5}}>{l}</div>
              {href?<a href={href} style={{fontWeight:700,color:B.dark,fontSize:".88rem",textDecoration:"none"}}>{v}</a>:<div style={{fontWeight:700,color:B.dark,fontSize:".88rem"}}>{v}</div>}
            </div>
          ))}
        </div>
        <div style={{background:B.white,borderRadius:10,padding:"28px 24px",border:"1px solid "+B.border}}>
          {sent?<div style={{textAlign:"center",padding:"20px 0"}}>
            <i className="ti ti-circle-check" style={{fontSize:40,color:"#1E8449",marginBottom:12,display:"block"}} aria-hidden="true"/>
            <h3 style={{fontWeight:700,color:B.dark,marginBottom:6}}>Message received!</h3>
            <p style={{color:B.gray,fontSize:".85rem"}}>We'll be in touch shortly. For a faster response, <a href="tel:4048614594" style={{color:B.bronze}}>give us a call</a>.</p>
          </div>:<>
            <h2 style={{fontWeight:700,color:B.dark,fontSize:"1.1rem",marginBottom:16}}>Send a Message</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              <div><label style={{display:"block",fontSize:".78rem",fontWeight:700,color:B.dark,marginBottom:4}}>Name</label><input style={INP} placeholder="Your name"/></div>
              <div><label style={{display:"block",fontSize:".78rem",fontWeight:700,color:B.dark,marginBottom:4}}>Phone</label><input style={INP} placeholder="(555) 555-5555" type="tel"/></div>
            </div>
            <div style={{marginBottom:12}}><label style={{display:"block",fontSize:".78rem",fontWeight:700,color:B.dark,marginBottom:4}}>Message</label><textarea style={{...INP,resize:"vertical",minHeight:100}} placeholder="Tell us about your project..."/></div>
            <div style={{display:"flex",gap:10}}>
              <SBtn onClick={()=>setSent(true)} full style={{fontSize:".9rem",padding:"11px 0"}}>
                <i className="ti ti-send" style={{marginRight:7,fontSize:14,verticalAlign:-2}} aria-hidden="true"/>Send Message
              </SBtn>
              <SBtn onClick={()=>setPage("estimate")} v="outlineDark" style={{whiteSpace:"nowrap",fontSize:".85rem",padding:"11px 16px"}}>
                Get Estimate
              </SBtn>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

// ── ESTIMATE FORM ──────────────────────────────────────────────
function EstimatePage({onSubmitTicket}) {
  const [step,setStep]=useState(0);
  const [form,setForm]=useState({type:null,len:"",wid:"",cols:"",thick:"ns",tear:"no",grade:"no",access:"yes",finish:"ns",timeline:"flex",notes:"",name:"",phone:"",email:"",addr:"",city:"",fileCount:0,fileNames:[]});
  const [est,setEst]=useState(null);
  const [done,setDone]=useState(false);
  const F=(k,v)=>setForm(f=>({...f,[k]:v}));
  const go=n=>{setStep(n);};
  const isSpecial=t=>["repair","block","columns"].includes(t);
  const progPct = step===0?0:(step/4)*100;

  const handleSubmit=()=>{
    const e = calcEst(form,DP);
    setEst(e);
    const tType = TYPES.find(t=>t.id===form.type);
    const ticket = {
      id:"T-"+(100+Math.floor(Math.random()*900)),
      at:new Date().toISOString(),
      name:form.name, phone:form.phone, email:form.email,
      addr:form.addr, city:form.city,
      ptype:tType?.label||form.type,
      len:parseFloat(form.len)||0, wid:parseFloat(form.wid)||0,
      sqft:e.sqft, thick:form.thick==="ns"?"Not Sure":form.thick+'"',
      finish:{broom:"Broom",smooth:"Smooth",stamped:"Stamped",decorative:"Decorative",ns:"Not Sure"}[form.finish]||form.finish,
      tear:{yes:"Yes",no:"No",ns:"Not Sure"}[form.tear],
      grade:{yes:"Yes",no:"No",ns:"Not Sure"}[form.grade],
      access:{yes:"Easy",no:"Difficult",ns:"Not Sure"}[form.access],
      timeline:{asap:"ASAP","2wks":"1-2 Weeks","1mo":"~1 Month",flex:"Flexible"}[form.timeline]||form.timeline,
      notes:form.notes, rLow:e.lo, rHigh:e.hi, quote:null,
      status:"New Request", followUp:"",
      files:form.fileNames, adminNotes:"",
      history:[{s:"New Request",d:new Date().toISOString(),n:"Submitted via website estimate form"}],
    };
    onSubmitTicket(ticket);
    setDone(true);
  };

  if(done&&est) return (
    <div style={{background:B.sand,minHeight:"100vh",padding:"40px 16px"}}>
      <div style={{maxWidth:600,margin:"0 auto"}}>
        <div style={{background:"#FFF8E1",borderLeft:"4px solid "+B.bronze,borderRadius:8,padding:"12px 14px",marginBottom:16,fontSize:".8rem",color:"#5C4700",lineHeight:1.5}}>
          <strong style={{display:"block",marginBottom:2}}>Rough Estimate Only — Not a Final Quote</strong>
          Final pricing depends on site visit confirmation, actual measurements, grading, prep, tear-out, access, and other site conditions.
        </div>
        <div style={{background:B.dark,borderRadius:10,overflow:"hidden",marginBottom:16}}>
          <div style={{background:B.green,padding:"14px 18px"}}>
            <div style={{fontWeight:700,color:B.white,fontSize:"1rem"}}>Rough Estimate — {TYPES.find(t=>t.id===form.type)?.label}</div>
            <div style={{fontSize:".74rem",color:"rgba(255,255,255,.7)",marginTop:2}}>For: {form.name}{form.city?" — "+form.city:""}</div>
          </div>
          <div style={{padding:"16px 18px"}}>
            {est.sqft>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.08)",fontSize:".8rem"}}><span style={{color:"rgba(255,255,255,.6)"}}>Estimated area</span><span style={{color:B.white,fontWeight:700}}>{est.sqft.toLocaleString()} sqft</span></div>}
            {est.rows.map((r,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.08)",fontSize:".8rem"}}><span style={{color:"rgba(255,255,255,.6)",flex:1}}>{r.l}</span><span style={{color:B.white,fontWeight:700,whiteSpace:"nowrap"}}>${r.lo.toLocaleString()}–${r.hi.toLocaleString()}</span></div>)}
            {est.notes.length>0&&<div style={{background:"rgba(196,168,130,.1)",borderRadius:6,padding:"9px 11px",marginTop:10,fontSize:".76rem",color:B.tan,lineHeight:1.5}}>{est.notes.map((n,i)=><div key={i}>⚠️ {n}</div>)}</div>}
            <div style={{textAlign:"center",background:"rgba(255,255,255,.05)",border:"2px solid "+B.tan,borderRadius:8,padding:18,marginTop:12}}>
              <div style={{fontSize:".7rem",color:B.lgray,textTransform:"uppercase",letterSpacing:.5}}>Rough Starting Price Range</div>
              <div style={{fontSize:"1.7rem",fontWeight:700,color:B.tan,margin:"4px 0"}}>${est.lo.toLocaleString()} – ${est.hi.toLocaleString()}</div>
              <div style={{fontSize:".68rem",color:B.lgray,fontStyle:"italic"}}>Not a final quote — site visit required to confirm</div>
            </div>
          </div>
        </div>
        <div style={{background:"#D5F5E3",border:"1px solid #A9DFBF",borderRadius:8,padding:"20px",textAlign:"center"}}>
          <i className="ti ti-circle-check" style={{fontSize:32,color:"#1E8449",marginBottom:8,display:"block"}} aria-hidden="true"/>
          <div style={{fontWeight:700,color:"#1E8449",fontSize:"1rem",marginBottom:4}}>Request submitted!</div>
          <p style={{fontSize:".82rem",color:"#1A5632",lineHeight:1.5}}>Thank you, {form.name.split(" ")[0]}! Southern Oak Concrete will be in touch to schedule a free site visit and confirm pricing.</p>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{background:B.sand,minHeight:"100vh"}}>
      <div style={{background:B.dark,padding:"36px 16px 30px",textAlign:"center"}}>
        <h1 style={{fontSize:"1.7rem",fontWeight:700,color:B.white,marginBottom:4}}>Request a Free Estimate</h1>
        <p style={{color:"rgba(255,255,255,.6)",fontSize:".85rem"}}>Fill out the form below and we'll follow up to schedule a site visit.</p>
      </div>
      {step>0&&<div style={{background:B.green,height:4}}><div style={{height:4,background:B.tan,width:progPct+"%",transition:"width .3s"}}/></div>}
      <div style={{maxWidth:600,margin:"0 auto",padding:"28px 16px 60px"}}>
        <div style={{background:"#FFF8E1",borderLeft:"4px solid "+B.bronze,borderRadius:8,padding:"10px 14px",marginBottom:20,fontSize:".78rem",color:"#5C4700",lineHeight:1.5}}>
          <strong>Rough estimate only — not a final quote.</strong> Final pricing requires a site visit and actual measurements.
        </div>

        {step===0&&<div>
          <h2 style={{fontSize:"1rem",fontWeight:700,color:B.dark,marginBottom:4}}>What type of project?</h2>
          <p style={{fontSize:".82rem",color:B.gray,marginBottom:14}}>Select the option that best fits your project.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
            {TYPES.map(t=><div key={t.id} onClick={()=>F("type",t.id)} style={{background:form.type===t.id?"#deeade":B.white,border:"2px solid "+(form.type===t.id?B.green:B.border),borderRadius:8,padding:"12px 10px",textAlign:"center",cursor:"pointer"}}>
              <div style={{fontSize:".76rem",fontWeight:700,color:form.type===t.id?B.green:B.dark,lineHeight:1.3}}>{t.label}</div>
            </div>)}
          </div>
          <SBtn onClick={()=>{if(!form.type){alert("Please select a project type.");return;}go(1);}} full style={{fontSize:".95rem",padding:"12px 0"}}>Next: Project Details <i className="ti ti-arrow-right" style={{marginLeft:6,fontSize:13,verticalAlign:-2}} aria-hidden="true"/></SBtn>
        </div>}

        {step===1&&<div>
          <h2 style={{fontSize:"1rem",fontWeight:700,color:B.dark,marginBottom:3}}>Project details</h2>
          <p style={{fontSize:".82rem",color:B.gray,marginBottom:14}}>Fill in what you know — rough estimates are fine.</p>
          {!isSpecial(form.type)&&form.type!=="repair"&&<div style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:".8rem",fontWeight:700,color:B.dark,marginBottom:4}}>Approximate dimensions</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><span style={{display:"block",fontSize:".72rem",fontWeight:600,color:B.gray,marginBottom:3}}>Length (ft)</span><input style={INP} type="number" placeholder="e.g. 20" min="1" inputMode="numeric" value={form.len} onChange={e=>F("len",e.target.value)}/></div>
              <div><span style={{display:"block",fontSize:".72rem",fontWeight:600,color:B.gray,marginBottom:3}}>Width (ft)</span><input style={INP} type="number" placeholder="e.g. 12" min="1" inputMode="numeric" value={form.wid} onChange={e=>F("wid",e.target.value)}/></div>
            </div>
          </div>}
          {form.type==="columns"&&<div style={{marginBottom:12}}><label style={{display:"block",fontSize:".8rem",fontWeight:700,color:B.dark,marginBottom:4}}>Number of columns</label><input style={INP} type="number" placeholder="e.g. 4" min="1" inputMode="numeric" value={form.cols} onChange={e=>F("cols",e.target.value)}/></div>}
          {!isSpecial(form.type)&&<Pills2 label="Concrete thickness" value={form.thick} onChange={v=>F("thick",v)} opts={[{v:"4",l:'4" Standard'},{v:"5",l:'5"'},{v:"6",l:'6" Heavy'},{v:"ns",l:"Not Sure"}]}/>}
          <Pills2 label="Existing concrete removal?" value={form.tear} onChange={v=>F("tear",v)} opts={[{v:"yes",l:"Yes"},{v:"no",l:"No"},{v:"ns",l:"Not Sure"}]}/>
          <Pills2 label="Grading or dirt work needed?" value={form.grade} onChange={v=>F("grade",v)} opts={[{v:"yes",l:"Yes"},{v:"no",l:"No"},{v:"ns",l:"Not Sure"}]}/>
          <Pills2 label="Easy truck / equipment access?" value={form.access} onChange={v=>F("access",v)} opts={[{v:"yes",l:"Yes — Easy"},{v:"no",l:"No — Difficult"},{v:"ns",l:"Not Sure"}]}/>
          {!isSpecial(form.type)&&<Pills2 label="Desired finish" value={form.finish} onChange={v=>F("finish",v)} opts={[{v:"broom",l:"Broom"},{v:"smooth",l:"Smooth"},{v:"stamped",l:"Stamped"},{v:"decorative",l:"Decorative"},{v:"ns",l:"Not Sure"}]}/>}
          <Pills2 label="Timeline" value={form.timeline} onChange={v=>F("timeline",v)} opts={[{v:"asap",l:"ASAP"},{v:"2wks",l:"1-2 Wks"},{v:"1mo",l:"~1 Month"},{v:"flex",l:"Flexible"}]}/>
          <div style={{marginBottom:12}}><label style={{display:"block",fontSize:".8rem",fontWeight:700,color:B.dark,marginBottom:4}}>Additional notes <span style={{fontWeight:400,color:B.gray}}>(optional)</span></label><textarea style={{...INP,resize:"vertical",minHeight:70}} placeholder="Describe your project, site conditions, special requests..." value={form.notes} onChange={e=>F("notes",e.target.value)}/></div>
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <SBtn onClick={()=>go(0)} v="outlineDark" style={{whiteSpace:"nowrap"}}>← Back</SBtn>
            <SBtn onClick={()=>{
              if(!isSpecial(form.type)&&form.type!=="repair"){if(!form.len||!form.wid||parseFloat(form.len)<=0||parseFloat(form.wid)<=0){alert("Please enter the project length and width.");return;}}
              if(form.type==="columns"&&(!form.cols||parseInt(form.cols)<=0)){alert("Please enter the number of columns.");return;}
              go(2);
            }} full style={{fontSize:".9rem",padding:"11px 0"}}>Next: Photos & Files <i className="ti ti-arrow-right" style={{marginLeft:6,fontSize:13,verticalAlign:-2}} aria-hidden="true"/></SBtn>
          </div>
        </div>}

        {step===2&&<div>
          <h2 style={{fontSize:"1rem",fontWeight:700,color:B.dark,marginBottom:3}}>Photos, plans & drawings</h2>
          <p style={{fontSize:".82rem",color:B.gray,marginBottom:14}}>Optional — but photos help us give a better estimate.</p>
          <div style={{background:"#EDE7D5",borderRadius:8,padding:"9px 12px",fontSize:".76rem",color:B.gray,marginBottom:12}}><strong style={{color:B.dark}}>Helpful uploads:</strong> Site photos, existing concrete, access paths, sketches, or any plans you have.</div>
          <label style={{display:"block",border:"2px dashed "+B.border,borderRadius:8,padding:"22px 14px",textAlign:"center",cursor:"pointer",background:B.white,marginBottom:12}}>
            <i className="ti ti-photo-plus" style={{fontSize:28,color:B.lgray,display:"block",marginBottom:8}} aria-hidden="true"/>
            <p style={{fontSize:".78rem",color:B.gray,lineHeight:1.4}}>Click to upload photos, plans, or sketches<br/><span style={{fontSize:".7rem"}}>JPG, PNG, HEIC, PDF · up to 10 files</span></p>
            <input type="file" multiple accept="image/*,.pdf,.heic" style={{display:"none"}} onChange={e=>{const fs=Array.from(e.target.files).slice(0,10);F("fileCount",fs.length);F("fileNames",fs.map(f=>f.name));}}/>
          </label>
          {form.fileCount>0&&<p style={{fontSize:".76rem",color:B.gray,marginBottom:12}}><i className="ti ti-check" style={{color:"#1E8449",marginRight:4}} aria-hidden="true"/>{form.fileCount} file{form.fileCount!==1?"s":""} selected</p>}
          <div style={{display:"flex",gap:8}}>
            <SBtn onClick={()=>go(1)} v="outlineDark" style={{whiteSpace:"nowrap"}}>← Back</SBtn>
            <SBtn onClick={()=>go(3)} full style={{fontSize:".9rem",padding:"11px 0"}}>Next: Your Info <i className="ti ti-arrow-right" style={{marginLeft:6,fontSize:13,verticalAlign:-2}} aria-hidden="true"/></SBtn>
          </div>
        </div>}

        {step===3&&<div>
          <h2 style={{fontSize:"1rem",fontWeight:700,color:B.dark,marginBottom:3}}>Your contact information</h2>
          <p style={{fontSize:".82rem",color:B.gray,marginBottom:14}}>We'll use this to follow up and schedule your site visit.</p>
          <div style={{marginBottom:12}}><label style={{display:"block",fontSize:".8rem",fontWeight:700,color:B.dark,marginBottom:4}}>Full name *</label><input style={INP} type="text" placeholder="First and last name" value={form.name} onChange={e=>F("name",e.target.value)}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div><label style={{display:"block",fontSize:".8rem",fontWeight:700,color:B.dark,marginBottom:4}}>Phone *</label><input style={INP} type="tel" placeholder="(555) 555-5555" value={form.phone} onChange={e=>F("phone",e.target.value)}/></div>
            <div><label style={{display:"block",fontSize:".8rem",fontWeight:700,color:B.dark,marginBottom:4}}>Email *</label><input style={INP} type="email" placeholder="you@email.com" value={form.email} onChange={e=>F("email",e.target.value)}/></div>
          </div>
          <div style={{marginBottom:12}}><label style={{display:"block",fontSize:".8rem",fontWeight:700,color:B.dark,marginBottom:4}}>Project address <span style={{fontWeight:400,color:B.gray}}>(optional)</span></label><input style={INP} placeholder="123 Main St" value={form.addr} onChange={e=>F("addr",e.target.value)}/></div>
          <div style={{marginBottom:16}}><label style={{display:"block",fontSize:".8rem",fontWeight:700,color:B.dark,marginBottom:4}}>City / area</label><input style={INP} placeholder="City, State" value={form.city} onChange={e=>F("city",e.target.value)}/></div>
          <div style={{display:"flex",gap:8}}>
            <SBtn onClick={()=>go(2)} v="outlineDark" style={{whiteSpace:"nowrap"}}>← Back</SBtn>
            <SBtn onClick={()=>{
              if(!form.name){alert("Please enter your name.");return;}
              if(!form.phone&&!form.email){alert("Please provide a phone number or email.");return;}
              handleSubmit();
            }} v="green" full style={{fontSize:".9rem",padding:"11px 0"}}>
              <i className="ti ti-calculator" style={{marginRight:7,fontSize:14,verticalAlign:-2}} aria-hidden="true"/>Calculate My Estimate
            </SBtn>
          </div>
        </div>}
      </div>
    </div>
  );
}

// ── ADMIN LOGIN ────────────────────────────────────────────────
function AdminLogin({onLogin}) {
  const [pw,setPw]=useState("");
  const [err,setErr]=useState(false);
  return (
    <div style={{minHeight:"100vh",background:"#F0F2F5",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:B.white,borderRadius:12,padding:"36px 28px",maxWidth:380,width:"100%",boxShadow:"0 2px 20px rgba(0,0,0,.08)",border:"0.5px solid var(--color-border-tertiary)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:56,height:56,background:B.green,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
            <i className="ti ti-shield-lock" style={{fontSize:26,color:B.tan}} aria-hidden="true"/>
          </div>
          <h1 style={{fontSize:"1.2rem",fontWeight:700,color:B.dark,marginBottom:4}}>Admin Login</h1>
          <p style={{fontSize:".8rem",color:B.gray}}>Southern Oak Concrete</p>
        </div>
        <div style={{background:"#EBF5FB",border:"1px solid #AED6F1",borderRadius:6,padding:"10px 12px",marginBottom:20,fontSize:".76rem",color:"#1A5276"}}>
          <i className="ti ti-info-circle" style={{marginRight:5,fontSize:13}} aria-hidden="true"/>
          <strong>Demo credentials:</strong> password is <code style={{background:"rgba(0,0,0,.07)",padding:"1px 5px",borderRadius:3}}>admin</code>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:".8rem",fontWeight:700,color:B.dark,marginBottom:4}}>Password</label>
          <input style={INP} type="password" placeholder="Enter admin password" value={pw} onChange={e=>{setPw(e.target.value);setErr(false);}} onKeyDown={e=>{if(e.key==="Enter"){if(pw==="admin")onLogin();else setErr(true);}}}/>
          {err&&<p style={{color:"#C0392B",fontSize:".75rem",marginTop:4}}><i className="ti ti-alert-circle" style={{marginRight:4}} aria-hidden="true"/>Incorrect password. Try "admin" for the demo.</p>}
        </div>
        <SBtn onClick={()=>{if(pw==="admin")onLogin();else setErr(true);}} v="green" full style={{fontSize:".9rem",padding:"11px 0"}}>
          <i className="ti ti-login" style={{marginRight:7,fontSize:14,verticalAlign:-2}} aria-hidden="true"/>Sign In
        </SBtn>
      </div>
    </div>
  );
}

// ── ADMIN TICKET LIST ──────────────────────────────────────────
function TicketList({tickets, onSelect, onLogout, setPage}) {
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("All");
  const [sortBy,setSortBy]=useState("date");

  const filtered = useMemo(()=>{
    let t = tickets;
    if(statusFilter!=="All") t=t.filter(x=>x.status===statusFilter);
    if(search.trim()){const s=search.toLowerCase();t=t.filter(x=>x.name.toLowerCase().includes(s)||x.city.toLowerCase().includes(s)||x.ptype.toLowerCase().includes(s));}
    if(sortBy==="date") t=[...t].sort((a,b)=>new Date(b.at)-new Date(a.at));
    else if(sortBy==="status") t=[...t].sort((a,b)=>a.status.localeCompare(b.status));
    else if(sortBy==="amount") t=[...t].sort((a,b)=>(b.rHigh||0)-(a.rHigh||0));
    return t;
  },[tickets,search,statusFilter,sortBy]);

  const counts = useMemo(()=>({
    total:tickets.length,
    new:tickets.filter(t=>t.status==="New Request").length,
    active:tickets.filter(t=>!["Won","Lost","New Request"].includes(t.status)).length,
    won:tickets.filter(t=>t.status==="Won").length,
  }),[tickets]);

  return (
    <div style={{minHeight:"100vh",background:"#F0F2F5"}}>
      {/* Admin header */}
      <div style={{background:B.dark,padding:"0 16px"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <Logo sm/>
            <div style={{width:1,height:24,background:"rgba(255,255,255,.15)"}}/>
            <span style={{fontSize:".8rem",color:"rgba(255,255,255,.6)",fontWeight:600}}>Admin</span>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setPage("home")} style={{background:"none",border:"1px solid rgba(255,255,255,.2)",color:"rgba(255,255,255,.7)",padding:"6px 12px",borderRadius:6,cursor:"pointer",fontSize:".76rem",fontFamily:"inherit"}}>
              <i className="ti ti-world" style={{marginRight:5,fontSize:12}} aria-hidden="true"/>View Site
            </button>
            <button onClick={onLogout} style={{background:"none",border:"1px solid rgba(255,255,255,.2)",color:"rgba(255,255,255,.7)",padding:"6px 12px",borderRadius:6,cursor:"pointer",fontSize:".76rem",fontFamily:"inherit"}}>
              <i className="ti ti-logout" style={{marginRight:5,fontSize:12}} aria-hidden="true"/>Sign Out
            </button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"24px 16px"}}>
        <div style={{marginBottom:20}}>
          <h1 style={{fontSize:"1.3rem",fontWeight:700,color:B.dark,marginBottom:4}}>Estimate Tickets</h1>
          <p style={{fontSize:".8rem",color:B.gray}}>Manage quote requests and track leads through your pipeline.</p>
        </div>

        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:20}}>
          {[{l:"Total leads",v:counts.total,icon:"ti-file-text"},{l:"New requests",v:counts.new,icon:"ti-bell",c:"#1A5276"},{l:"In progress",v:counts.active,icon:"ti-clock",c:"#784212"},{l:"Won",v:counts.won,icon:"ti-trophy",c:"#1A5632"}].map(({l,v,icon,c})=>(
            <div key={l} style={{background:B.white,borderRadius:8,padding:"16px",border:"0.5px solid var(--color-border-tertiary)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <i className={`ti ${icon}`} style={{fontSize:16,color:c||B.gray}} aria-hidden="true"/>
                <span style={{fontSize:".72rem",color:B.gray,textTransform:"uppercase",letterSpacing:.5}}>{l}</span>
              </div>
              <div style={{fontSize:"1.6rem",fontWeight:700,color:c||B.dark}}>{v}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{background:B.white,borderRadius:8,padding:"14px",border:"0.5px solid var(--color-border-tertiary)",marginBottom:14}}>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{flex:"1 1 200px",position:"relative"}}>
              <i className="ti ti-search" style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:15,color:B.lgray}} aria-hidden="true"/>
              <input style={{...INP,paddingLeft:32}} placeholder="Search by name, city, or project type..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{...INP,width:"auto",cursor:"pointer"}}>
              <option value="All">All Statuses</option>
              {STAT_LIST.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{...INP,width:"auto",cursor:"pointer"}}>
              <option value="date">Sort: Newest</option>
              <option value="status">Sort: Status</option>
              <option value="amount">Sort: Amount</option>
            </select>
          </div>
        </div>

        {/* Status filter pills */}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
          {["All",...STAT_LIST].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)} style={{padding:"4px 12px",borderRadius:20,border:"1.5px solid "+(statusFilter===s?B.green:B.border),background:statusFilter===s?"#deeade":B.white,color:statusFilter===s?B.green:B.mid,fontWeight:600,fontSize:".7rem",cursor:"pointer",fontFamily:"inherit"}}>
              {s==="All"?`All (${counts.total})`:`${s} (${tickets.filter(t=>t.status===s).length})`}
            </button>
          ))}
        </div>

        {/* Ticket cards */}
        {filtered.length===0&&<div style={{background:B.white,borderRadius:8,padding:"40px",textAlign:"center",border:"0.5px solid var(--color-border-tertiary)"}}>
          <i className="ti ti-search" style={{fontSize:32,color:B.lgray,marginBottom:8,display:"block"}} aria-hidden="true"/>
          <p style={{color:B.gray,fontSize:".85rem"}}>No tickets match your search or filter.</p>
        </div>}

        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(t=>(
            <div key={t.id} onClick={()=>onSelect(t)} style={{background:B.white,borderRadius:8,padding:"16px",border:"0.5px solid var(--color-border-tertiary)",cursor:"pointer",display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"center"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:8}}>
                <div>
                  <div style={{fontWeight:700,color:B.dark,fontSize:".9rem"}}>{t.name}</div>
                  <div style={{fontSize:".76rem",color:B.gray,marginTop:2}}>
                    <i className="ti ti-map-pin" style={{marginRight:4,fontSize:12}} aria-hidden="true"/>{t.city}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:".78rem",color:B.mid,fontWeight:600}}>{t.ptype}</div>
                  {t.sqft>0&&<div style={{fontSize:".72rem",color:B.gray}}>{t.sqft.toLocaleString()} sqft</div>}
                </div>
                <div>
                  <div style={{fontSize:".76rem",color:B.gray,marginBottom:3}}>Rough estimate</div>
                  <div style={{fontWeight:700,color:B.dark,fontSize:".85rem"}}>{fmtRange(t.rLow,t.rHigh)}</div>
                  {t.quote&&<div style={{fontSize:".72rem",color:B.green,fontWeight:700}}>Quote: {fmtMoney(t.quote)}</div>}
                </div>
                <div>
                  <div style={{fontSize:".72rem",color:B.gray,marginBottom:4}}>Submitted {fmtDate(t.at)}</div>
                  {t.followUp&&<div style={{fontSize:".72rem",color:B.bronze}}><i className="ti ti-calendar" style={{marginRight:4,fontSize:11}} aria-hidden="true"/>Follow up {t.followUp}</div>}
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                <Pill status={t.status}/>
                <i className="ti ti-chevron-right" style={{fontSize:16,color:B.lgray}} aria-hidden="true"/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ADMIN TICKET DETAIL ────────────────────────────────────────
function TicketDetail({ticket, onBack, onUpdate}) {
  const [t,setT]=useState({...ticket});
  const [note,setNote]=useState("");
  const [saved,setSaved]=useState(false);

  const save=()=>{
    onUpdate(t);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };

  const changeStatus=newStatus=>{
    const entry={s:newStatus,d:new Date().toISOString(),n:"Status updated in admin dashboard"};
    setT(prev=>({...prev,status:newStatus,history:[...(prev.history||[]),entry]}));
  };

  const addNote=()=>{
    if(!note.trim())return;
    setT(prev=>({...prev,adminNotes:prev.adminNotes?(prev.adminNotes+"\n\n"+new Date().toLocaleDateString()+": "+note):(new Date().toLocaleDateString()+": "+note)}));
    setNote("");
  };

  return (
    <div style={{minHeight:"100vh",background:"#F0F2F5"}}>
      <div style={{background:B.dark,padding:"0 16px"}}>
        <div style={{maxWidth:1000,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:56}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={onBack} style={{background:"none",border:"none",color:"rgba(255,255,255,.7)",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",fontSize:".82rem"}}>
              <i className="ti ti-arrow-left" style={{fontSize:16}} aria-hidden="true"/>Back to tickets
            </button>
            <div style={{width:1,height:20,background:"rgba(255,255,255,.15)"}}/>
            <span style={{color:"rgba(255,255,255,.5)",fontSize:".78rem"}}>{t.id}</span>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {saved&&<span style={{fontSize:".75rem",color:"#A9DFBF",fontWeight:600}}>
              <i className="ti ti-check" style={{marginRight:4}} aria-hidden="true"/>Saved
            </span>}
            <SBtn onClick={save} v="green" sm>
              <i className="ti ti-device-floppy" style={{marginRight:5,fontSize:13,verticalAlign:-2}} aria-hidden="true"/>Save Changes
            </SBtn>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1000,margin:"0 auto",padding:"20px 16px 60px"}}>
        {/* Header */}
        <div style={{background:B.white,borderRadius:8,padding:"20px",border:"0.5px solid var(--color-border-tertiary)",marginBottom:16,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <h1 style={{fontSize:"1.2rem",fontWeight:700,color:B.dark,marginBottom:4}}>{t.name}</h1>
            <div style={{fontSize:".82rem",color:B.gray}}>{t.ptype} · {t.city} · Submitted {fmtDate(t.at)}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Pill status={t.status}/>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
          {/* Left column */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* Contact */}
            <div style={{background:B.white,borderRadius:8,padding:"18px",border:"0.5px solid var(--color-border-tertiary)"}}>
              <h3 style={{fontSize:".82rem",fontWeight:700,color:B.dark,textTransform:"uppercase",letterSpacing:.5,marginBottom:14}}>
                <i className="ti ti-user" style={{marginRight:6,color:B.bronze}} aria-hidden="true"/>Customer Info
              </h3>
              <div style={{display:"grid",gap:8}}>
                {[["Name",t.name],["Phone",t.phone||"—"],["Email",t.email||"—"],["Address",t.addr||"—"],["City",t.city||"—"]].map(([l,v])=>(
                  <div key={l} style={{display:"flex",gap:10}}>
                    <span style={{fontSize:".76rem",color:B.gray,minWidth:60}}>{l}</span>
                    <span style={{fontSize:".82rem",color:B.dark,fontWeight:500}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Project details */}
            <div style={{background:B.white,borderRadius:8,padding:"18px",border:"0.5px solid var(--color-border-tertiary)"}}>
              <h3 style={{fontSize:".82rem",fontWeight:700,color:B.dark,textTransform:"uppercase",letterSpacing:.5,marginBottom:14}}>
                <i className="ti ti-tools" style={{marginRight:6,color:B.bronze}} aria-hidden="true"/>Project Details
              </h3>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[["Project type",t.ptype],["Dimensions",t.len&&t.wid?`${t.len} ft × ${t.wid} ft`:"N/A"],["Square footage",t.sqft>0?`~${t.sqft.toLocaleString()} sqft`:"N/A"],["Thickness",t.thick||"—"],["Finish",t.finish||"—"],["Tear-out",t.tear||"—"],["Grading",t.grade||"—"],["Access",t.access||"—"],["Timeline",t.timeline||"—"]].map(([l,v])=>(
                  <div key={l}>
                    <div style={{fontSize:".7rem",color:B.gray,marginBottom:1}}>{l}</div>
                    <div style={{fontSize:".82rem",color:B.dark,fontWeight:500}}>{v}</div>
                  </div>
                ))}
              </div>
              {t.notes&&<div style={{marginTop:14,paddingTop:12,borderTop:"0.5px solid var(--color-border-tertiary)"}}>
                <div style={{fontSize:".72rem",color:B.gray,marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>Customer notes</div>
                <p style={{fontSize:".82rem",color:B.mid,lineHeight:1.6,background:B.sandD,padding:"10px 12px",borderRadius:6}}>{t.notes}</p>
              </div>}
            </div>

            {/* Files */}
            {t.files&&t.files.length>0&&<div style={{background:B.white,borderRadius:8,padding:"18px",border:"0.5px solid var(--color-border-tertiary)"}}>
              <h3 style={{fontSize:".82rem",fontWeight:700,color:B.dark,textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>
                <i className="ti ti-paperclip" style={{marginRight:6,color:B.bronze}} aria-hidden="true"/>Files Uploaded ({t.files.length})
              </h3>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {t.files.map((f,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:B.sandD,borderRadius:6}}>
                  <i className={f.endsWith(".pdf")?"ti ti-file-text":"ti ti-photo"} style={{fontSize:14,color:B.bronze}} aria-hidden="true"/>
                  <span style={{fontSize:".78rem",color:B.mid}}>{f}</span>
                </div>)}
              </div>
            </div>}

            {/* Admin notes */}
            <div style={{background:B.white,borderRadius:8,padding:"18px",border:"0.5px solid var(--color-border-tertiary)"}}>
              <h3 style={{fontSize:".82rem",fontWeight:700,color:B.dark,textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>
                <i className="ti ti-notes" style={{marginRight:6,color:B.bronze}} aria-hidden="true"/>Internal Notes
              </h3>
              {t.adminNotes&&<div style={{background:B.sandD,padding:"10px 12px",borderRadius:6,fontSize:".8rem",color:B.mid,lineHeight:1.6,whiteSpace:"pre-wrap",marginBottom:10}}>{t.adminNotes}</div>}
              <div style={{display:"flex",gap:8}}>
                <input style={{...INP,flex:1}} placeholder="Add a note..." value={note} onChange={e=>setNote(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){addNote();}}}/>
                <SBtn onClick={addNote} sm><i className="ti ti-plus" style={{fontSize:13}} aria-hidden="true"/></SBtn>
              </div>
            </div>

            {/* Status history */}
            <div style={{background:B.white,borderRadius:8,padding:"18px",border:"0.5px solid var(--color-border-tertiary)"}}>
              <h3 style={{fontSize:".82rem",fontWeight:700,color:B.dark,textTransform:"uppercase",letterSpacing:.5,marginBottom:14}}>
                <i className="ti ti-timeline" style={{marginRight:6,color:B.bronze}} aria-hidden="true"/>Status History
              </h3>
              <div style={{display:"flex",flexDirection:"column",gap:0}}>
                {[...(t.history||[])].reverse().map((h,i)=>(
                  <div key={i} style={{display:"flex",gap:10,paddingBottom:12,position:"relative"}}>
                    <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center"}}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:(STAT[h.s]||{c:B.lgray}).c,marginTop:3}}/>
                      {i<(t.history||[]).length-1&&<div style={{width:2,flex:1,background:B.border,margin:"3px 0"}}/>}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <span style={{fontSize:".78rem",fontWeight:700,color:B.dark}}>{h.s}</span>
                        <span style={{fontSize:".68rem",color:B.gray,whiteSpace:"nowrap"}}>{fmtTime(h.d)}</span>
                      </div>
                      {h.n&&<p style={{fontSize:".74rem",color:B.gray,marginTop:2,lineHeight:1.5}}>{h.n}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* Status management */}
            <div style={{background:B.white,borderRadius:8,padding:"18px",border:"0.5px solid var(--color-border-tertiary)"}}>
              <h3 style={{fontSize:".82rem",fontWeight:700,color:B.dark,textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>
                <i className="ti ti-tag" style={{marginRight:6,color:B.bronze}} aria-hidden="true"/>Status
              </h3>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {STAT_LIST.map(s=>(
                  <button key={s} onClick={()=>changeStatus(s)} style={{padding:"8px 12px",borderRadius:6,border:"1.5px solid "+(t.status===s?B.green:B.border),background:t.status===s?"#deeade":B.white,color:t.status===s?B.green:B.mid,fontWeight:t.status===s?700:500,fontSize:".76rem",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span>{s}</span>
                    {t.status===s&&<i className="ti ti-check" style={{fontSize:13,color:B.green}} aria-hidden="true"/>}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimate & quote */}
            <div style={{background:B.white,borderRadius:8,padding:"18px",border:"0.5px solid var(--color-border-tertiary)"}}>
              <h3 style={{fontSize:".82rem",fontWeight:700,color:B.dark,textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>
                <i className="ti ti-coin" style={{marginRight:6,color:B.bronze}} aria-hidden="true"/>Pricing
              </h3>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:".72rem",color:B.gray,marginBottom:2}}>Rough estimate range</div>
                <div style={{fontWeight:700,color:B.dark,fontSize:"1rem"}}>{fmtRange(t.rLow,t.rHigh)}</div>
              </div>
              <div style={{marginBottom:10}}>
                <label style={{display:"block",fontSize:".76rem",fontWeight:700,color:B.dark,marginBottom:4}}>Final quote amount</label>
                <input style={INP} type="number" placeholder="e.g. 8500" value={t.quote||""} onChange={e=>setT(prev=>({...prev,quote:e.target.value?parseFloat(e.target.value):null}))}/>
              </div>
              <div>
                <label style={{display:"block",fontSize:".76rem",fontWeight:700,color:B.dark,marginBottom:4}}>Follow-up date</label>
                <input style={INP} type="date" value={t.followUp||""} onChange={e=>setT(prev=>({...prev,followUp:e.target.value}))}/>
              </div>
            </div>

            {/* Quick actions */}
            <div style={{background:B.white,borderRadius:8,padding:"18px",border:"0.5px solid var(--color-border-tertiary)"}}>
              <h3 style={{fontSize:".82rem",fontWeight:700,color:B.dark,textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>
                <i className="ti ti-bolt" style={{marginRight:6,color:B.bronze}} aria-hidden="true"/>Quick Actions
              </h3>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                <a href={`tel:${t.phone?.replace(/\D/g,"")}`} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:B.sandD,borderRadius:6,textDecoration:"none",color:B.dark,fontSize:".78rem",fontWeight:600}}>
                  <i className="ti ti-phone" style={{fontSize:14,color:B.bronze}} aria-hidden="true"/>Call {t.phone||"—"}
                </a>
                <a href={`mailto:${t.email}`} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:B.sandD,borderRadius:6,textDecoration:"none",color:B.dark,fontSize:".78rem",fontWeight:600}}>
                  <i className="ti ti-mail" style={{fontSize:14,color:B.bronze}} aria-hidden="true"/>Email customer
                </a>
                <button onClick={save} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:B.green,border:"none",borderRadius:6,color:B.white,fontSize:".78rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  <i className="ti ti-device-floppy" style={{fontSize:14}} aria-hidden="true"/>Save all changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("home");
  const [adminMode, setAdminMode] = useState(false);
  const [adminAuth, setAdminAuth] = useState(false);
  const [tickets, setTickets] = useState(() => DEMO_TICKETS.map(ticket => {
    if (ticket.id === "T-002") {
      return {
        ...ticket,
        status: "Estimate Accepted",
        history: [...(ticket.history || []), { s: "Estimate Accepted", d: new Date().toISOString(), n: "Customer approved estimate. Ready for scheduling." }],
      };
    }
    if (ticket.id === "T-006") {
      return {
        ...ticket,
        status: "Ready to Schedule",
        history: [...(ticket.history || []), { s: "Ready to Schedule", d: new Date().toISOString(), n: "Office approved estimate for scheduling." }],
      };
    }
    return ticket;
  }));

  const handleTicketSubmit = ticket => {
    setTickets(prev => [ticket, ...prev]);
  };

  const handleTicketUpdate = updated => {
    setTickets(prev => prev.map(t => t.id===updated.id ? updated : t));
  };

  if (adminMode) {
    if (!adminAuth) return <AdminLogin onLogin={()=>setAdminAuth(true)}/>;
    return <AdminWorkspace tickets={tickets} onUpdateTicket={handleTicketUpdate} onLogout={()=>{setAdminAuth(false);setAdminMode(false);}} setPage={p=>{setAdminMode(false);setPage(p);}}/>;
  }

  const renderPage = () => {
    switch(page) {
      case "home":     return <HomePage setPage={setPage}/>;
      case "services": return <ServicesPage setPage={setPage}/>;
      case "gallery":  return <GalleryPage setPage={setPage}/>;
      case "about":    return <AboutPage setPage={setPage}/>;
      case "contact":  return <ContactPage setPage={setPage}/>;
      case "estimate": return <EstimatePage onSubmitTicket={handleTicketSubmit}/>;
      default:         return <HomePage setPage={setPage}/>;
    }
  };

  return (
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",color:B.dark}}>
      <Nav page={page} setPage={setPage} adminMode={adminMode} setAdminMode={setAdminMode}/>
      {renderPage()}
      <Footer setPage={setPage} setAdminMode={setAdminMode}/>
      {/* Hidden admin trigger */}
      <button onClick={()=>setAdminMode(true)} title="Admin" style={{position:"fixed",bottom:14,right:14,width:34,height:34,background:B.dark,border:"none",borderRadius:"50%",color:"rgba(255,255,255,.3)",fontSize:".8rem",cursor:"pointer",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <i className="ti ti-shield" style={{fontSize:15}} aria-hidden="true"/>
      </button>
    </div>
  );
}
