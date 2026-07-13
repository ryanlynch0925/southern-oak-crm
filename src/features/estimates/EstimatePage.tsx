import { useRef, useState } from "react";
import SButton from "../../components/common/SButton";
import Pills from "../../components/common/Pills";
import { B, INP } from "../../theme";
import { fmtRange } from "../../utils/formatters";
import type { Ticket } from "../tickets/ticketTypes";
import { calcEst } from "./estimateCalculator";
import { DP, getDecisionMeta, getInitialEstimateForm, NO_DECISION_FEEDBACK_OPTIONS, TYPES } from "./estimateConfig";
import { submitPublicEstimate } from "./estimateService";
import type { EstimateDecisionKey, EstimateResult } from "./estimateTypes";

interface EstimatePageProps {
  onSubmitTicket: (ticket: Ticket) => void;
  onUpdateTicket: (ticket: Ticket) => void;
  onReturnHome: () => void;
}

interface DecisionTicketExtras {
  id?: string;
  timestamp?: string;
  at?: string;
  notificationId?: string;
  feedbackReason?: string;
  feedbackComment?: string;
}

const toNullableNumber = value => {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseThicknessInches = value => {
  const matched = String(value || "").match(/\d+(\.\d+)?/);
  return matched ? Number(matched[0]) : null;
};

const buildPublicEstimatePayload = (ticket: Ticket) => {
  const jobAddress = [ticket.addr, ticket.city].filter(Boolean).join(", ");

  return {
    name: ticket.name,
    phone: ticket.phone,
    email: ticket.email,
    street_address: ticket.addr,
    city: ticket.city,
    state: "GA",
    customer_type: "residential",
    customer_notes: ticket.notes,
    job_type: ticket.ptype,
    job_address: jobAddress || ticket.addr,
    description: ticket.notes,
    estimated_amount: null,
    length_ft: toNullableNumber(ticket.len),
    width_ft: toNullableNumber(ticket.wid),
    square_feet: toNullableNumber(ticket.sqft),
    thickness_in: parseThicknessInches(ticket.thick),
    finish_type: ticket.finish,
    tear_out: ticket.tear,
    grading: ticket.grade,
    site_access: ticket.access,
    desired_timeline: ticket.timeline,
    rough_estimate_low: toNullableNumber(ticket.rLow),
    rough_estimate_high: toNullableNumber(ticket.rHigh),
    final_quote_amount: toNullableNumber(ticket.quote),
    estimate_decision: ticket.estimateDecision,
    decision_question: ticket.decisionQuestion,
    decision_at: ticket.decisionAt,
    decision_feedback_reason: ticket.decisionFeedbackReason,
    decision_feedback_comment: ticket.decisionFeedbackComment,
    notes: ticket.notes,
    attachments: (ticket.files || []).map(name => ({ name })),
    notifications: ticket.notifications || [],
    source: "website",
  };
};

export default function EstimatePage({ onSubmitTicket, onUpdateTicket, onReturnHome }: EstimatePageProps) {
  const [step,setStep]=useState(0);
  const [form,setForm]=useState(getInitialEstimateForm);
  const [est,setEst]=useState<EstimateResult | null>(null);
  const [decision,setDecision]=useState<EstimateDecisionKey | null>(null);
  const [decisionTicketId,setDecisionTicketId]=useState("");
  const [decisionTimestamp,setDecisionTimestamp]=useState("");
  const [decisionDatabaseId,setDecisionDatabaseId]=useState("");
  const [showEmailPreview,setShowEmailPreview]=useState(false);
  const [noFeedbackReason,setNoFeedbackReason]=useState("");
  const [noFeedbackComment,setNoFeedbackComment]=useState("");
  const [isSubmitting,setIsSubmitting]=useState(false);
  const [submitError,setSubmitError]=useState("");
  const submittingRef = useRef(false);
  const F=(k,v)=>setForm(f=>({...f,[k]:v}));
  const go=n=>{setStep(n);};
  const isSpecial=t=>["repair","block","columns"].includes(t);
  const progPct = step===0?0:(Math.min(step,4)/4)*100;

  const resetEstimateFlow = () => {
    setStep(0);
    setForm(getInitialEstimateForm());
    setEst(null);
    setDecision(null);
    setDecisionTicketId("");
    setDecisionTimestamp("");
    setDecisionDatabaseId("");
    setShowEmailPreview(false);
    setNoFeedbackReason("");
    setNoFeedbackComment("");
  };

  const returnHome = () => {
    resetEstimateFlow();
    onReturnHome();
  };

  const handleSubmit=()=>{
    const e = calcEst(form,DP);
    setEst(e);
    setStep(4);
  };

  const buildDecisionTicket = (decisionKey: EstimateDecisionKey, extras: DecisionTicketExtras = {}) => {
    if (!est) return null;
    const meta = getDecisionMeta(decisionKey);
    if (!meta) return null;
    const timestamp = extras.timestamp || new Date().toISOString();
    const tType = TYPES.find(t=>t.id===form.type);
    const notificationMessage = decisionKey === "yes"
      ? "Customer approved the estimate range. Review and follow up for site visit planning."
      : "Customer said the estimate range does not work right now. Owner follow-up call recommended.";
    const feedbackNote = extras.feedbackReason
      ? ` Feedback reason: ${extras.feedbackReason}.${extras.feedbackComment ? ` Additional feedback: ${extras.feedbackComment}` : ""}`
      : "";
    return {
      id: extras.id || "T-"+(100+Math.floor(Math.random()*900)),
      at: extras.at || timestamp,
      name:form.name, phone:form.phone, email:form.email,
      addr:form.addr, city:form.city,
      ptype:tType?.label||form.type||"",
      len:parseFloat(form.len)||0, wid:parseFloat(form.wid)||0,
      sqft:est.sqft, thick:form.thick==="ns"?"Not Sure":form.thick+'"',
      finish:{broom:"Broom",smooth:"Smooth",stamped:"Stamped",decorative:"Decorative",ns:"Not Sure"}[form.finish]||form.finish,
      tear:{yes:"Yes",no:"No",ns:"Not Sure"}[form.tear],
      grade:{yes:"Yes",no:"No",ns:"Not Sure"}[form.grade],
      access:{yes:"Easy",no:"Difficult",ns:"Not Sure"}[form.access],
      timeline:{asap:"ASAP","2wks":"1-2 Weeks","1mo":"~1 Month",flex:"Flexible"}[form.timeline]||form.timeline,
      notes:form.notes, rLow:est.lo, rHigh:est.hi, quote:null,
      status:meta.status as Ticket["status"],
      estimateDecision:decisionKey,
      estimateDecisionLabel:meta.label,
      decisionQuestion:"Does this estimate range work for your project?",
      decisionAt:timestamp,
      decisionFeedbackReason: extras.feedbackReason || "",
      decisionFeedbackComment: extras.feedbackComment || "",
      followUp:decisionKey==="no"?new Date(Date.now()+3*86400000).toISOString().slice(0,10):"",
      files:form.fileNames,
      adminNotes:"",
      notifications:[{
        id: extras.notificationId || `notif-${Date.now()}`,
        type:meta.notificationType,
        title:meta.notificationTitle,
        message:notificationMessage,
        createdAt:timestamp,
      }],
      history:[
        {s:"New Request",d:timestamp,n:"Submitted via website estimate form"},
        {s:"Rough Estimate Sent",d:timestamp,n:`Online rough estimate range shown: ${fmtRange(est.lo, est.hi)}.`},
        {s:meta.status,d:timestamp,n:`Customer selected "${meta.answer}". ${notificationMessage}${feedbackNote}`},
      ],
    } as Ticket;
  };

  const submitDecision = async (decisionKey: EstimateDecisionKey) => {
    if (submittingRef.current) return;
    const ticket = buildDecisionTicket(decisionKey);
    if (!ticket) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const estimateUuid = await submitPublicEstimate(buildPublicEstimatePayload(ticket));
      const savedTicket = { ...ticket, databaseId: estimateUuid };
      onSubmitTicket(savedTicket);
      setDecision(decisionKey);
      setDecisionTicketId(savedTicket.id);
      setDecisionTimestamp(savedTicket.decisionAt);
      setDecisionDatabaseId(estimateUuid);
      if (decisionKey === "yes") {
        setShowEmailPreview(false);
      }
    } catch (error) {
      console.error("Unable to submit public estimate:", error);
      setSubmitError(error?.message || "Unable to submit estimate request. Please try again.");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const submitNoFeedback = () => {
    if (!decisionTicketId || !noFeedbackReason) {
      alert("Please select a feedback reason.");
      return;
    }
    const timestamp = decisionTimestamp || new Date().toISOString();
    const ticket = buildDecisionTicket("no", {
      id: decisionTicketId,
      timestamp,
      at: timestamp,
      notificationId: `notif-${decisionTicketId}`,
      feedbackReason: noFeedbackReason,
      feedbackComment: noFeedbackComment.trim(),
    });
    if (!ticket) return;
    onUpdateTicket({ ...ticket, databaseId: decisionDatabaseId || undefined });
    setShowEmailPreview(true);
  };

  const emailPreview = decision === "yes"
    ? {
      subject: "Southern Oak Estimate Request Received",
      body: [
        "Thank you for submitting your estimate request with Southern Oak Concrete & Construction.",
        "",
        "We received your project details and your estimate is now in review. Someone from our team will reach out soon to discuss your project, confirm details, and talk through next steps.",
        "",
        "Please remember that online estimates are rough starting price ranges only. Final pricing depends on site visit confirmation, actual measurements, grading, prep, tear-out, access, and other site conditions.",
        "",
        "Thank you,",
        "Southern Oak Concrete & Construction",
      ].join("\n"),
    }
    : {
      subject: "Southern Oak Estimate Feedback Received",
      body: [
        "Thank you for using the Southern Oak Concrete & Construction online estimator.",
        "",
        "We received your feedback and saved your project details. If your plans, timing, or budget change, we would be happy to help you take another look.",
        "",
        "Please remember that online estimates are rough starting price ranges only. Final pricing depends on site visit confirmation, actual measurements, grading, prep, tear-out, access, and other site conditions.",
        "",
        "Thank you,",
        "Southern Oak Concrete & Construction",
      ].join("\n"),
    };

  if(decision==="yes"&&est) return (
    <div style={{background:B.sand,minHeight:"100vh",padding:"40px 16px"}}>
      <div style={{maxWidth:600,margin:"0 auto"}}>
        <div style={{background:"#FFF8E1",borderLeft:"4px solid "+B.bronze,borderRadius:8,padding:"12px 14px",marginBottom:16,fontSize:".8rem",color:"#5C4700",lineHeight:1.5}}>
          <strong style={{display:"block",marginBottom:2}}>Rough Estimate Only - Not a Final Quote</strong>
          Final pricing depends on site visit confirmation, actual measurements, grading, prep, tear-out, access, and other site conditions.
        </div>
        <div style={{background:B.dark,borderRadius:10,overflow:"hidden",marginBottom:16}}>
          <div style={{background:B.green,padding:"14px 18px"}}>
            <div style={{fontWeight:700,color:B.white,fontSize:"1rem"}}>Rough Estimate - {TYPES.find(t=>t.id===form.type)?.label}</div>
            <div style={{fontSize:".74rem",color:"rgba(255,255,255,.7)",marginTop:2}}>For: {form.name}{form.city?" - "+form.city:""}</div>
          </div>
          <div style={{padding:"16px 18px"}}>
            {est.sqft>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.08)",fontSize:".8rem"}}><span style={{color:"rgba(255,255,255,.6)"}}>Estimated area</span><span style={{color:B.white,fontWeight:700}}>{est.sqft.toLocaleString()} sqft</span></div>}
            {est.rows.map((r,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.08)",fontSize:".8rem"}}><span style={{color:"rgba(255,255,255,.6)",flex:1}}>{r.l}</span><span style={{color:B.white,fontWeight:700,whiteSpace:"nowrap"}}>${r.lo.toLocaleString()} - ${r.hi.toLocaleString()}</span></div>)}
            {est.notes.length>0&&<div style={{background:"rgba(196,168,130,.1)",borderRadius:6,padding:"9px 11px",marginTop:10,fontSize:".76rem",color:B.tan,lineHeight:1.5}}>{est.notes.map((n,i)=><div key={i}>Note: {n}</div>)}</div>}
            <div style={{textAlign:"center",background:"rgba(255,255,255,.05)",border:"2px solid "+B.tan,borderRadius:8,padding:18,marginTop:12}}>
              <div style={{fontSize:".7rem",color:B.lgray,textTransform:"uppercase",letterSpacing:.5}}>Rough Starting Price Range</div>
              <div style={{fontSize:"1.7rem",fontWeight:700,color:B.tan,margin:"4px 0"}}>${est.lo.toLocaleString()} - ${est.hi.toLocaleString()}</div>
              <div style={{fontSize:".68rem",color:B.lgray,fontStyle:"italic"}}>Not a final quote - site visit required to confirm</div>
            </div>
          </div>
        </div>
        <div style={{background:"#D5F5E3",border:"1px solid #A9DFBF",borderRadius:8,padding:"20px",textAlign:"center"}}>
          <i className="ti ti-circle-check" style={{fontSize:32,color:"#1E8449",marginBottom:8,display:"block"}} aria-hidden="true"/>
          <div style={{fontWeight:700,color:"#1E8449",fontSize:"1rem",marginBottom:4}}>Estimate request submitted for review.</div>
          <p style={{fontSize:".82rem",color:"#1A5632",lineHeight:1.5,marginBottom:8}}>Thank you! Your estimate request has been submitted for review. Someone from Southern Oak Concrete & Construction will reach out soon to discuss your project and next steps.</p>
          <div style={{fontSize:".76rem",color:"#1A5632",fontWeight:600,marginBottom:14}}>Saved decision: Yes, I'd like to move forward</div>
          <SButton onClick={()=>setShowEmailPreview(true)} v="green" style={{minWidth:160}}>Continue</SButton>
        </div>
      </div>
      {showEmailPreview&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",padding:"20px 16px",overflowY:"auto",zIndex:3000}}>
          <div style={{maxWidth:640,margin:"40px auto",background:B.white,borderRadius:12,border:"1px solid "+B.border,overflow:"hidden",boxShadow:"0 18px 50px rgba(0,0,0,.18)"}}>
            <div style={{padding:"16px 18px",borderBottom:"1px solid "+B.border,background:B.sand}}>
              <div style={{fontSize:"1.05rem",fontWeight:700,color:B.dark}}>Demo Email Preview</div>
            </div>
            <div style={{padding:"18px"}}>
              <div style={{background:"#FFF8E1",borderLeft:"4px solid "+B.bronze,borderRadius:8,padding:"12px 14px",marginBottom:16,fontSize:".8rem",color:"#5C4700",lineHeight:1.5}}>
                This email preview is for demonstration purposes only. On the live website, this modal will not appear. The customer will receive this email automatically.
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:".72rem",fontWeight:700,color:B.gray,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Subject</div>
                <div style={{fontSize:".9rem",fontWeight:700,color:B.dark}}>{emailPreview.subject}</div>
              </div>
              <div>
                <div style={{fontSize:".72rem",fontWeight:700,color:B.gray,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Body</div>
                <div style={{background:B.sand,borderRadius:8,padding:"14px",fontSize:".82rem",color:B.mid,lineHeight:1.65,whiteSpace:"pre-wrap"}}>{emailPreview.body}</div>
              </div>
              <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}>
                <SButton onClick={returnHome} v="green">Return Home</SButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if(decision==="no"&&est) return (
    <div style={{background:B.sand,minHeight:"100vh",padding:"40px 16px"}}>
      <div style={{maxWidth:600,margin:"0 auto"}}>
        <div style={{background:"#FFF8E1",borderLeft:"4px solid "+B.bronze,borderRadius:8,padding:"12px 14px",marginBottom:16,fontSize:".8rem",color:"#5C4700",lineHeight:1.5}}>
          <strong style={{display:"block",marginBottom:2}}>Rough Estimate Only - Not a Final Quote</strong>
          Final pricing depends on site visit confirmation, actual measurements, grading, prep, tear-out, access, and other site conditions.
        </div>
        <div style={{background:B.dark,borderRadius:10,overflow:"hidden",marginBottom:16}}>
          <div style={{background:B.green,padding:"14px 18px"}}>
            <div style={{fontWeight:700,color:B.white,fontSize:"1rem"}}>Rough Estimate - {TYPES.find(t=>t.id===form.type)?.label}</div>
            <div style={{fontSize:".74rem",color:"rgba(255,255,255,.7)",marginTop:2}}>For: {form.name}{form.city?" - "+form.city:""}</div>
          </div>
          <div style={{padding:"16px 18px"}}>
            {est.sqft>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.08)",fontSize:".8rem"}}><span style={{color:"rgba(255,255,255,.6)"}}>Estimated area</span><span style={{color:B.white,fontWeight:700}}>{est.sqft.toLocaleString()} sqft</span></div>}
            {est.rows.map((r,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.08)",fontSize:".8rem"}}><span style={{color:"rgba(255,255,255,.6)",flex:1}}>{r.l}</span><span style={{color:B.white,fontWeight:700,whiteSpace:"nowrap"}}>${r.lo.toLocaleString()} - ${r.hi.toLocaleString()}</span></div>)}
            {est.notes.length>0&&<div style={{background:"rgba(196,168,130,.1)",borderRadius:6,padding:"9px 11px",marginTop:10,fontSize:".76rem",color:B.tan,lineHeight:1.5}}>{est.notes.map((n,i)=><div key={i}>Note: {n}</div>)}</div>}
            <div style={{textAlign:"center",background:"rgba(255,255,255,.05)",border:"2px solid "+B.tan,borderRadius:8,padding:18,marginTop:12}}>
              <div style={{fontSize:".7rem",color:B.lgray,textTransform:"uppercase",letterSpacing:.5}}>Rough Starting Price Range</div>
              <div style={{fontSize:"1.7rem",fontWeight:700,color:B.tan,margin:"4px 0"}}>${est.lo.toLocaleString()} - ${est.hi.toLocaleString()}</div>
              <div style={{fontSize:".68rem",color:B.lgray,fontStyle:"italic"}}>Not a final quote - site visit required to confirm</div>
            </div>
          </div>
        </div>
        <div style={{background:B.white,borderRadius:10,padding:"20px",border:"1px solid "+B.border}}>
          <div style={{fontSize:".72rem",fontWeight:700,color:B.bronze,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>Follow-up Feedback</div>
          <h2 style={{fontSize:"1.08rem",fontWeight:700,color:B.dark,marginBottom:6}}>Can you tell us why this estimate range does not work for your project right now?</h2>
          <div style={{display:"grid",gap:8,marginBottom:14}}>
            {NO_DECISION_FEEDBACK_OPTIONS.map(option=>(
              <label key={option} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",border:"1px solid "+(noFeedbackReason===option?B.bronze:B.border),borderRadius:8,background:noFeedbackReason===option?"#FFF8E1":B.white,cursor:"pointer"}}>
                <input type="radio" name="no-feedback-reason" value={option} checked={noFeedbackReason===option} onChange={e=>setNoFeedbackReason(e.target.value)} style={{marginTop:2}}/>
                <span style={{fontSize:".82rem",color:B.dark,lineHeight:1.4}}>{option}</span>
              </label>
            ))}
          </div>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:".78rem",fontWeight:700,color:B.dark,marginBottom:4}}>Additional feedback</label>
            <textarea style={{...INP,resize:"vertical",minHeight:90}} placeholder="Additional feedback" value={noFeedbackComment} onChange={e=>setNoFeedbackComment(e.target.value)}/>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end"}}>
            <SButton onClick={submitNoFeedback} v="green">Submit Feedback</SButton>
          </div>
        </div>
      </div>
      {showEmailPreview&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",padding:"20px 16px",overflowY:"auto",zIndex:3000}}>
          <div style={{maxWidth:640,margin:"40px auto",background:B.white,borderRadius:12,border:"1px solid "+B.border,overflow:"hidden",boxShadow:"0 18px 50px rgba(0,0,0,.18)"}}>
            <div style={{padding:"16px 18px",borderBottom:"1px solid "+B.border,background:B.sand}}>
              <div style={{fontSize:"1.05rem",fontWeight:700,color:B.dark}}>Demo Email Preview</div>
            </div>
            <div style={{padding:"18px"}}>
              <div style={{background:"#FFF8E1",borderLeft:"4px solid "+B.bronze,borderRadius:8,padding:"12px 14px",marginBottom:16,fontSize:".8rem",color:"#5C4700",lineHeight:1.5}}>
                This email preview is for demonstration purposes only. On the live website, this modal will not appear. The customer will receive this email automatically.
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:".72rem",fontWeight:700,color:B.gray,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Subject</div>
                <div style={{fontSize:".9rem",fontWeight:700,color:B.dark}}>{emailPreview.subject}</div>
              </div>
              <div>
                <div style={{fontSize:".72rem",fontWeight:700,color:B.gray,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Body</div>
                <div style={{background:B.sand,borderRadius:8,padding:"14px",fontSize:".82rem",color:B.mid,lineHeight:1.65,whiteSpace:"pre-wrap"}}>{emailPreview.body}</div>
              </div>
              <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}>
                <SButton onClick={returnHome} v="green">Return Home</SButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if(step===4&&est) return (
    <div style={{background:B.sand,minHeight:"100vh",padding:"40px 16px"}}>
      <div style={{maxWidth:600,margin:"0 auto"}}>
        <div style={{background:"#FFF8E1",borderLeft:"4px solid "+B.bronze,borderRadius:8,padding:"12px 14px",marginBottom:16,fontSize:".8rem",color:"#5C4700",lineHeight:1.5}}>
          <strong style={{display:"block",marginBottom:2}}>Rough Estimate Only - Not a Final Quote</strong>
          Final pricing depends on site visit confirmation, actual measurements, grading, prep, tear-out, access, and other site conditions.
        </div>
        <div style={{background:B.dark,borderRadius:10,overflow:"hidden",marginBottom:16}}>
          <div style={{background:B.green,padding:"14px 18px"}}>
            <div style={{fontWeight:700,color:B.white,fontSize:"1rem"}}>Rough Estimate - {TYPES.find(t=>t.id===form.type)?.label}</div>
            <div style={{fontSize:".74rem",color:"rgba(255,255,255,.7)",marginTop:2}}>For: {form.name}{form.city?" - "+form.city:""}</div>
          </div>
          <div style={{padding:"16px 18px"}}>
            {est.sqft>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.08)",fontSize:".8rem"}}><span style={{color:"rgba(255,255,255,.6)"}}>Estimated area</span><span style={{color:B.white,fontWeight:700}}>{est.sqft.toLocaleString()} sqft</span></div>}
            {est.rows.map((r,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.08)",fontSize:".8rem"}}><span style={{color:"rgba(255,255,255,.6)",flex:1}}>{r.l}</span><span style={{color:B.white,fontWeight:700,whiteSpace:"nowrap"}}>${r.lo.toLocaleString()} - ${r.hi.toLocaleString()}</span></div>)}
            {est.notes.length>0&&<div style={{background:"rgba(196,168,130,.1)",borderRadius:6,padding:"9px 11px",marginTop:10,fontSize:".76rem",color:B.tan,lineHeight:1.5}}>{est.notes.map((n,i)=><div key={i}>Note: {n}</div>)}</div>}
            <div style={{textAlign:"center",background:"rgba(255,255,255,.05)",border:"2px solid "+B.tan,borderRadius:8,padding:18,marginTop:12}}>
              <div style={{fontSize:".7rem",color:B.lgray,textTransform:"uppercase",letterSpacing:.5}}>Rough Starting Price Range</div>
              <div style={{fontSize:"1.7rem",fontWeight:700,color:B.tan,margin:"4px 0"}}>${est.lo.toLocaleString()} - ${est.hi.toLocaleString()}</div>
              <div style={{fontSize:".68rem",color:B.lgray,fontStyle:"italic"}}>Not a final quote - site visit required to confirm</div>
            </div>
          </div>
        </div>
        <div style={{background:B.white,borderRadius:10,padding:"20px",border:"1px solid "+B.border}}>
          <div style={{fontSize:".72rem",fontWeight:700,color:B.bronze,textTransform:"uppercase",letterSpacing:.6,marginBottom:6}}>Decision Step</div>
          <h2 style={{fontSize:"1.08rem",fontWeight:700,color:B.dark,marginBottom:6}}>Does this estimate range work for your project?</h2>
          <p style={{fontSize:".82rem",color:B.gray,lineHeight:1.5,marginBottom:14}}>Choose the option that fits best. We'll save your estimate details either way so Southern Oak can follow up appropriately.</p>
          {submitError&&<div style={{background:"#FDEDEC",border:"1px solid #F5B7B1",borderRadius:8,padding:"10px 12px",color:"#922B21",fontSize:".78rem",lineHeight:1.45,marginBottom:12}}>
            <i className="ti ti-alert-circle" style={{marginRight:6}} aria-hidden="true"/>{submitError}
          </div>}
          <div style={{display:"grid",gap:10}}>
            <button disabled={isSubmitting} onClick={()=>submitDecision("yes")} style={{padding:"14px 16px",borderRadius:8,border:"none",background:B.green,color:B.white,fontWeight:700,fontSize:".88rem",cursor:isSubmitting?"not-allowed":"pointer",opacity:isSubmitting?0.75:1,fontFamily:"inherit",textAlign:"left"}}>
              {isSubmitting ? "Submitting..." : "1. Yes, I'd like to move forward"}
            </button>
            <button disabled={isSubmitting} onClick={()=>submitDecision("no")} style={{padding:"14px 16px",borderRadius:8,border:"1.5px solid "+B.border,background:B.white,color:B.mid,fontWeight:700,fontSize:".88rem",cursor:isSubmitting?"not-allowed":"pointer",opacity:isSubmitting?0.75:1,fontFamily:"inherit",textAlign:"left"}}>
              {isSubmitting ? "Submitting..." : "2. No, not at this time"}
            </button>
          </div>
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <SButton onClick={()=>go(3)} v="outlineDark" style={{whiteSpace:"nowrap"}}>Back</SButton>
          </div>
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
          <strong>Rough estimate only - not a final quote.</strong> Final pricing requires a site visit and actual measurements.
        </div>

        {step===0&&<div>
          <h2 style={{fontSize:"1rem",fontWeight:700,color:B.dark,marginBottom:4}}>What type of project?</h2>
          <p style={{fontSize:".82rem",color:B.gray,marginBottom:14}}>Select the option that best fits your project.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
            {TYPES.map(t=><div key={t.id} onClick={()=>F("type",t.id)} style={{background:form.type===t.id?"#deeade":B.white,border:"2px solid "+(form.type===t.id?B.green:B.border),borderRadius:8,padding:"12px 10px",textAlign:"center",cursor:"pointer"}}>
              <div style={{fontSize:".76rem",fontWeight:700,color:form.type===t.id?B.green:B.dark,lineHeight:1.3}}>{t.label}</div>
            </div>)}
          </div>
          <SButton onClick={()=>{if(!form.type){alert("Please select a project type.");return;}go(1);}} full style={{fontSize:".95rem",padding:"12px 0"}}>Next: Project Details <i className="ti ti-arrow-right" style={{marginLeft:6,fontSize:13,verticalAlign:-2}} aria-hidden="true"/></SButton>
        </div>}

        {step===1&&<div>
          <h2 style={{fontSize:"1rem",fontWeight:700,color:B.dark,marginBottom:3}}>Project details</h2>
          <p style={{fontSize:".82rem",color:B.gray,marginBottom:14}}>Fill in what you know - rough estimates are fine.</p>
          {!isSpecial(form.type)&&form.type!=="repair"&&<div style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:".8rem",fontWeight:700,color:B.dark,marginBottom:4}}>Approximate dimensions</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div><span style={{display:"block",fontSize:".72rem",fontWeight:600,color:B.gray,marginBottom:3}}>Length (ft)</span><input style={INP} type="number" placeholder="e.g. 20" min="1" inputMode="numeric" value={form.len} onChange={e=>F("len",e.target.value)}/></div>
              <div><span style={{display:"block",fontSize:".72rem",fontWeight:600,color:B.gray,marginBottom:3}}>Width (ft)</span><input style={INP} type="number" placeholder="e.g. 12" min="1" inputMode="numeric" value={form.wid} onChange={e=>F("wid",e.target.value)}/></div>
            </div>
          </div>}
          {form.type==="columns"&&<div style={{marginBottom:12}}><label style={{display:"block",fontSize:".8rem",fontWeight:700,color:B.dark,marginBottom:4}}>Number of columns</label><input style={INP} type="number" placeholder="e.g. 4" min="1" inputMode="numeric" value={form.cols} onChange={e=>F("cols",e.target.value)}/></div>}
          {!isSpecial(form.type)&&<Pills label="Concrete thickness" value={form.thick} onChange={v=>F("thick",v)} opts={[{v:"4",l:'4" Standard'},{v:"5",l:'5"'},{v:"6",l:'6" Heavy'},{v:"ns",l:"Not Sure"}]}/>}
          <Pills label="Existing concrete removal?" value={form.tear} onChange={v=>F("tear",v)} opts={[{v:"yes",l:"Yes"},{v:"no",l:"No"},{v:"ns",l:"Not Sure"}]}/>
          <Pills label="Grading or dirt work needed?" value={form.grade} onChange={v=>F("grade",v)} opts={[{v:"yes",l:"Yes"},{v:"no",l:"No"},{v:"ns",l:"Not Sure"}]}/>
          <Pills label="Easy truck / equipment access?" value={form.access} onChange={v=>F("access",v)} opts={[{v:"yes",l:"Yes - Easy"},{v:"no",l:"No - Difficult"},{v:"ns",l:"Not Sure"}]}/>
          {!isSpecial(form.type)&&<Pills label="Desired finish" value={form.finish} onChange={v=>F("finish",v)} opts={[{v:"broom",l:"Broom"},{v:"smooth",l:"Smooth"},{v:"stamped",l:"Stamped"},{v:"decorative",l:"Decorative"},{v:"ns",l:"Not Sure"}]}/>}
          <Pills label="Timeline" value={form.timeline} onChange={v=>F("timeline",v)} opts={[{v:"asap",l:"ASAP"},{v:"2wks",l:"1-2 Wks"},{v:"1mo",l:"~1 Month"},{v:"flex",l:"Flexible"}]}/>
          <div style={{marginBottom:12}}><label style={{display:"block",fontSize:".8rem",fontWeight:700,color:B.dark,marginBottom:4}}>Additional notes <span style={{fontWeight:400,color:B.gray}}>(optional)</span></label><textarea style={{...INP,resize:"vertical",minHeight:70}} placeholder="Describe your project, site conditions, special requests..." value={form.notes} onChange={e=>F("notes",e.target.value)}/></div>
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <SButton onClick={()=>go(0)} v="outlineDark" style={{whiteSpace:"nowrap"}}>Back</SButton>
            <SButton onClick={()=>{
              if(!isSpecial(form.type)&&form.type!=="repair"){if(!form.len||!form.wid||parseFloat(form.len)<=0||parseFloat(form.wid)<=0){alert("Please enter the project length and width.");return;}}
              if(form.type==="columns"&&(!form.cols||parseInt(form.cols)<=0)){alert("Please enter the number of columns.");return;}
              go(2);
            }} full style={{fontSize:".9rem",padding:"11px 0"}}>Next: Photos & Files <i className="ti ti-arrow-right" style={{marginLeft:6,fontSize:13,verticalAlign:-2}} aria-hidden="true"/></SButton>
          </div>
        </div>}

        {step===2&&<div>
          <h2 style={{fontSize:"1rem",fontWeight:700,color:B.dark,marginBottom:3}}>Photos, plans & drawings</h2>
          <p style={{fontSize:".82rem",color:B.gray,marginBottom:14}}>Optional - but photos help us give a better estimate.</p>
          <div style={{background:"#EDE7D5",borderRadius:8,padding:"9px 12px",fontSize:".76rem",color:B.gray,marginBottom:12}}><strong style={{color:B.dark}}>Helpful uploads:</strong> Site photos, existing concrete, access paths, sketches, or any plans you have.</div>
          <label style={{display:"block",border:"2px dashed "+B.border,borderRadius:8,padding:"22px 14px",textAlign:"center",cursor:"pointer",background:B.white,marginBottom:12}}>
            <i className="ti ti-photo-plus" style={{fontSize:28,color:B.lgray,display:"block",marginBottom:8}} aria-hidden="true"/>
            <p style={{fontSize:".78rem",color:B.gray,lineHeight:1.4}}>Click to upload photos, plans, or sketches<br/><span style={{fontSize:".7rem"}}>JPG, PNG, HEIC, PDF - up to 10 files</span></p>
            <input type="file" multiple accept="image/*,.pdf,.heic" style={{display:"none"}} onChange={e=>{const fs=Array.from(e.target.files).slice(0,10);F("fileCount",fs.length);F("fileNames",fs.map(f=>f.name));}}/>
          </label>
          {form.fileCount>0&&<p style={{fontSize:".76rem",color:B.gray,marginBottom:12}}><i className="ti ti-check" style={{color:"#1E8449",marginRight:4}} aria-hidden="true"/>{form.fileCount} file{form.fileCount!==1?"s":""} selected</p>}
          <div style={{display:"flex",gap:8}}>
            <SButton onClick={()=>go(1)} v="outlineDark" style={{whiteSpace:"nowrap"}}>Back</SButton>
            <SButton onClick={()=>go(3)} full style={{fontSize:".9rem",padding:"11px 0"}}>Next: Your Info <i className="ti ti-arrow-right" style={{marginLeft:6,fontSize:13,verticalAlign:-2}} aria-hidden="true"/></SButton>
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
            <SButton onClick={()=>go(2)} v="outlineDark" style={{whiteSpace:"nowrap"}}>Back</SButton>
            <SButton onClick={()=>{
              if(!form.name){alert("Please enter your name.");return;}
              if(!form.phone&&!form.email){alert("Please provide a phone number or email.");return;}
              handleSubmit();
            }} v="green" full style={{fontSize:".9rem",padding:"11px 0"}}>
              <i className="ti ti-calculator" style={{marginRight:7,fontSize:14,verticalAlign:-2}} aria-hidden="true"/>Calculate My Estimate
            </SButton>
          </div>
        </div>}
      </div>
    </div>
  );
}