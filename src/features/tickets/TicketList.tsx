import { useMemo, useState } from "react";
import Logo from "../../components/common/Logo";
import Pill from "../../components/common/Pill";
import { B, INP } from "../../theme";
import { fmtDate, fmtMoney, fmtRange } from "../../utils/formatters";
import { STATUS_LIST, type Ticket } from "./ticketTypes";

interface TicketListProps {
  tickets: Ticket[];
  onSelect: (ticket: Ticket) => void;
  onLogout: () => void;
  setPage: (page: "home") => void;
}
export default function TicketList({ tickets, onSelect, onLogout, setPage }: TicketListProps) {
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("All");
  const [sortBy,setSortBy]=useState("date");

  const filtered = useMemo(()=>{
    let t = tickets;
    if(statusFilter!=="All") t=t.filter(x=>x.status===statusFilter);
    if(search.trim()){const s=search.toLowerCase();t=t.filter(x=>x.name.toLowerCase().includes(s)||x.city.toLowerCase().includes(s)||x.ptype.toLowerCase().includes(s));}
    if(sortBy==="date") t=[...t].sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime());
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
              {STATUS_LIST.map(s=><option key={s} value={s}>{s}</option>)}
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
          {["All",...STATUS_LIST].map(s=>(
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
