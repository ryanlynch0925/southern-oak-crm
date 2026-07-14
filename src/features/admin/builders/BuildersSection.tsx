import { Btn, Card } from "../shared/AdminPrimitives";
import { B } from "../shared/adminStyles";
import { fmtDate } from "../shared/adminFormatters";
import { sortBuilderPhases } from "./builderUtils";
export default function BuildersSection({ builders, jobs, onCreateBuilderJob, onCreateBuilder, onOpenJob, buildersLoading = false, buildersError = "" }) {
  const builderSummaries = builders.map(builder => {
    const builderJobs = jobs.filter(job => (
      job.builder_id === builder.id
      || (!job.builder_id && !!job.builder_name && job.builder_name.trim().toLowerCase() === builder.name.trim().toLowerCase())
    ));
    const openJobs = builderJobs.filter(job => !["Completed", "Cancelled"].includes(job.status)).length;
    const nextPour = builderJobs.flatMap(job => sortBuilderPhases(job.phases || [])).find(phase => phase.phase_key === "pour_slab" && phase.scheduled_date);
    return { builder, builderJobs, openJobs, nextPour };
  });
  return (
    <>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: B.dark, marginBottom: 4 }}>Builders</h1>
            <p style={{ fontSize: ".8rem", color: B.gray }}>Manage production builder relationships, active communities, and slab workflow volume.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn v="outline" onClick={onCreateBuilder}><i className="ti ti-building-plus" style={{ marginRight: 6 }} aria-hidden="true" />Add Builder</Btn>
            <Btn v="green" onClick={onCreateBuilderJob}><i className="ti ti-plus" style={{ marginRight: 6 }} aria-hidden="true" />New Builder Job</Btn>
          </div>
        </div>
      </Card>
      {buildersLoading && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: ".8rem", color: B.gray }}>Loading builders...</div>
        </Card>
      )}
      {buildersError && (
        <Card style={{ marginBottom: 14, borderColor: "#F5B7B1", background: "#FDEDEC" }}>
          <div style={{ fontSize: ".8rem", color: "#922B21", fontWeight: 700 }}>Unable to load builders</div>
          <div style={{ fontSize: ".76rem", color: "#922B21", marginTop: 3 }}>{buildersError}</div>
        </Card>
      )}
      {!buildersLoading && !buildersError && builderSummaries.length === 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: ".8rem", color: B.gray }}>No builders found.</div>
        </Card>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
        {builderSummaries.map(({ builder, builderJobs, openJobs, nextPour }) => (
          <Card key={builder.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, color: B.dark, fontSize: ".95rem" }}>{builder.name}</div>
                <div style={{ fontSize: ".74rem", color: B.gray }}>{builder.contact} - {builder.phone}</div>
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 20, background: `${builder.color}14`, color: builder.color, fontWeight: 700, fontSize: ".68rem", whiteSpace: "nowrap" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: builder.color, display: "inline-block" }} />
                {openJobs} active
              </span>
            </div>
            <div style={{ fontSize: ".76rem", color: B.gray, marginBottom: 10 }}>Communities: {builder.communities.length ? builder.communities.join(", ") : "None entered yet"}</div>
            <div style={{ fontSize: ".74rem", color: B.gray, fontWeight: 700, marginBottom: 6 }}>Current jobs</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {builderJobs.length === 0 && <div style={{ fontSize: ".74rem", color: B.gray }}>No jobs yet.</div>}
              {builderJobs.map(job => (
                <button key={job.id} onClick={() => onOpenJob(job.id)} style={{ textAlign: "left", background: B.sand, border: "1px solid var(--color-border-tertiary)", borderRadius: 6, padding: "8px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontSize: ".76rem", fontWeight: 700, color: B.dark }}>
                    {job.community || job.lot_number
                      ? `${job.community || job.builder_name} - ${job.lot_number ? `Lot ${job.lot_number}` : job.name}`
                      : job.name}
                  </div>
                  <div style={{ fontSize: ".72rem", color: B.gray }}>{job.work_order_number || "No work order"} - {job.status}</div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: ".74rem", color: B.gray }}>{nextPour ? `Next pour on ${fmtDate(nextPour.scheduled_date)}` : "No pour scheduled yet."}</div>
          </Card>
        ))}
      </div>
    </>
  );
}
