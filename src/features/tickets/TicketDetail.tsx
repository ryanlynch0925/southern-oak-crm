import { useState } from "react";
import Pill from "../../components/common/Pill";
import SButton from "../../components/common/SButton";
import { B, INP } from "../../theme";
import { fmtDate, fmtRange, fmtTime } from "../../utils/formatters";
import { STATUS_LIST, STATUS_STYLES, type Ticket, type TicketStatus } from "./ticketTypes";

interface TicketDetailProps {
  ticket: Ticket;
  onBack: () => void;
  onUpdate: (ticket: Ticket) => void;
}
export default function TicketDetail({ ticket, onBack, onUpdate }: TicketDetailProps) {
  const [t,setT]=useState({...ticket});
  const [note,setNote]=useState("");
  const [saved,setSaved]=useState(false);

  const save=()=>{
    onUpdate(t);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };

  const changeStatus=(newStatus: TicketStatus)=>{
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
            <SButton onClick={save} v="green" sm>
              <i className="ti ti-device-floppy" style={{marginRight:5,fontSize:13,verticalAlign:-2}} aria-hidden="true"/>Save Changes
            </SButton>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1000,margin:"0 auto",padding:"20px 16px 60px"}}>
        {/* Header */}
        <div style={{background:B.white,borderRadius:8,padding:"20px",border:"0.5px solid var(--color-border-tertiary)",marginBottom:16,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <h1 style={{fontSize:"1.2rem",fontWeight:700,color:B.dark,marginBottom:4}}>{t.name}</h1>
            <div style={{fontSize:".82rem",color:B.gray}}>{t.ptype} - {t.city} - Submitted {fmtDate(t.at)}</div>
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
                {[["Name",t.name],["Phone",t.phone||"-"],["Email",t.email||"-"],["Address",t.addr||"-"],["City",t.city||"-"]].map(([l,v])=>(
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
                {[["Project type",t.ptype],["Dimensions",t.len&&t.wid?`${t.len} ft x ${t.wid} ft`:"N/A"],["Square footage",t.sqft>0?`~${t.sqft.toLocaleString()} sqft`:"N/A"],["Thickness",t.thick||"-"],["Finish",t.finish||"-"],["Tear-out",t.tear||"-"],["Grading",t.grade||"-"],["Access",t.access||"-"],["Timeline",t.timeline||"-"]].map(([l,v])=>(
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
                <SButton onClick={addNote} sm><i className="ti ti-plus" style={{fontSize:13}} aria-hidden="true"/></SButton>
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
                      <div style={{width:10,height:10,borderRadius:"50%",background:(STATUS_STYLES[h.s]||{c:B.lgray}).c,marginTop:3}}/>
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
                {STATUS_LIST.map(s=>(
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
                  <i className="ti ti-phone" style={{fontSize:14,color:B.bronze}} aria-hidden="true"/>Call {t.phone||"-"}
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