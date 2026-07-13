import type { Ticket } from "../features/tickets/ticketTypes";

const daysAgoIso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();

export const DEMO_TICKETS: Ticket[] = [
  { id: "T-001", at: daysAgoIso(0), name: "Mike Johnson", phone: "(770) 555-0142", email: "mikej@gmail.com", addr: "214 Maple Ridge Rd", city: "Griffin, GA", ptype: "Driveway", len: 60, wid: 14, sqft: 840, thick: '4"', finish: "Broom", tear: "Yes", grade: "No", access: "Easy", timeline: "ASAP", notes: "Old asphalt needs to come out first. Want clean broom finish throughout.", rLow: 7500, rHigh: 10500, quote: null, status: "New Request", followUp: "", files: ["driveway_front.jpg", "driveway_side.jpg"], history: [{ s: "New Request", d: daysAgoIso(0), n: "Submitted via website" }], adminNotes: "" },
  { id: "T-002", at: daysAgoIso(1), name: "Sarah & Tom Davis", phone: "(678) 555-0287", email: "davis.family@email.com", addr: "88 Birchwood Circle", city: "Thomaston, GA", ptype: "Stamped Patio", len: 24, wid: 16, sqft: 384, thick: '4"', finish: "Stamped", tear: "No", grade: "Not Sure", access: "Easy", timeline: "~1 Month", notes: "Want flagstone stamp pattern. Backyard, some slope toward the fence line.", rLow: 6800, rHigh: 10200, quote: null, status: "Needs Review", followUp: "2026-06-05", files: ["backyard1.jpg", "backyard2.jpg", "sketch.pdf"], history: [{ s: "New Request", d: daysAgoIso(1), n: "Submitted via website" }, { s: "Needs Review", d: daysAgoIso(1), n: "Need to check slope - grading may be needed" }], adminNotes: "Slope needs attention. If significant add $600-900. Customer is motivated - wants done before summer." },
  { id: "T-003", at: daysAgoIso(3), name: "Robert Tanner", phone: "(404) 555-0311", email: "rtanner@outlook.com", addr: "Hwy 74 W, Lot 12", city: "Barnesville, GA", ptype: "Pole Barn Slab", len: 60, wid: 40, sqft: 2400, thick: '6"', finish: "Broom", tear: "No", grade: "Yes", access: "Easy", timeline: "1-2 Weeks", notes: "40x60 slab for metal building. Dirt work started. Need 6 inch with wire mesh.", rLow: 18000, rHigh: 25000, quote: 22800, status: "Final Quote Sent", followUp: "2026-06-06", files: ["lot_survey.pdf"], history: [{ s: "New Request", d: daysAgoIso(3), n: "Submitted via website" }, { s: "Site Visit Needed", d: daysAgoIso(3), n: "Need to see grade and site conditions" }, { s: "Scheduled", d: daysAgoIso(2), n: "Site visit scheduled Tuesday 10am" }, { s: "Final Quote Sent", d: daysAgoIso(1), n: "Quote emailed: $22,800" }], adminNotes: "Good customer. Site relatively flat. Following up Friday." },
  { id: "T-004", at: daysAgoIso(5), name: "Linda Weston", phone: "(770) 555-0419", email: "lindaw@gmail.com", addr: "421 Pecan Grove Dr", city: "Forsyth, GA", ptype: "Sidewalk", len: 45, wid: 4, sqft: 180, thick: '4"', finish: "Broom", tear: "Yes", grade: "No", access: "Easy", timeline: "Flexible", notes: "Old cracked sidewalk from driveway to front porch needs full replacement.", rLow: 1500, rHigh: 2400, quote: 1900, status: "Won", followUp: "", files: [], history: [{ s: "New Request", d: daysAgoIso(5), n: "Submitted via website" }, { s: "Rough Estimate Sent", d: daysAgoIso(5), n: "Sent range via text" }, { s: "Final Quote Sent", d: daysAgoIso(4), n: "Quote: $1,900 incl. tear-out" }, { s: "Won", d: daysAgoIso(3), n: "Customer accepted. Scheduled next week." }], adminNotes: "Small job complete. Deposit collected." },
  { id: "T-005", at: daysAgoIso(7), name: "James Holley", phone: "(404) 555-0572", email: "jholley@email.net", addr: "15 Commerce Park Blvd", city: "McDonough, GA", ptype: "Commercial Slab", len: 80, wid: 50, sqft: 4000, thick: '6"', finish: "Smooth", tear: "No", grade: "Yes", access: "Easy", timeline: "ASAP", notes: "Warehouse expansion slab. 4000 sqft for heavy equipment use. Need reinforced.", rLow: 30000, rHigh: 42000, quote: null, status: "Needs Review", followUp: "2026-06-04", files: ["site_plan.pdf", "warehouse_layout.pdf"], history: [{ s: "New Request", d: daysAgoIso(7), n: "Submitted via website" }, { s: "Needs Review", d: daysAgoIso(6), n: "Commercial - review engineering requirements" }], adminNotes: "Need geotechnical report. Rebar req for heavy equipment adds cost. Call Monday." },
  { id: "T-006", at: daysAgoIso(2), name: "Derek Fountain", phone: "(678) 555-0833", email: "dfountain@icloud.com", addr: "619 Lakeview Trl", city: "Locust Grove, GA", ptype: "Columns", len: 0, wid: 0, sqft: 0, thick: "N/A", finish: "N/A", tear: "No", grade: "No", access: "Easy", timeline: "1-2 Weeks", notes: "4 brick columns, 6 feet tall each, for a new front entrance gate with caps.", rLow: 4000, rHigh: 10000, quote: null, status: "Site Visit Needed", followUp: "2026-06-07", files: ["gate_reference.jpg"], history: [{ s: "New Request", d: daysAgoIso(2), n: "Submitted via website" }, { s: "Needs Review", d: daysAgoIso(2), n: "Column work - need footing depth info" }, { s: "Site Visit Needed", d: daysAgoIso(1), n: "Visiting to confirm spec and footing" }], adminNotes: "4 columns ~6ft. Wide range - confirm footing depth and cap design on site." },
  { id: "T-007", at: daysAgoIso(10), name: "Carla Simmons", phone: "(478) 555-0688", email: "csimmons@yahoo.com", addr: "302 Old Mill Rd", city: "Macon, GA", ptype: "Decorative Pool Deck", len: 20, wid: 20, sqft: 400, thick: '4"', finish: "Decorative", tear: "No", grade: "No", access: "Easy", timeline: "~1 Month", notes: "Pool deck needs decorative overlay. Prefer a light cool-deck style finish.", rLow: 4800, rHigh: 7200, quote: 5600, status: "Scheduled", followUp: "2026-06-10", files: ["pool_area.jpg", "pool_deck.jpg"], history: [{ s: "New Request", d: daysAgoIso(10), n: "Submitted via website" }, { s: "Rough Estimate Sent", d: daysAgoIso(10), n: "Range sent via email" }, { s: "Site Visit Needed", d: daysAgoIso(8), n: "Check existing deck condition" }, { s: "Final Quote Sent", d: daysAgoIso(6), n: "Quote: $5,600 for decorative overlay" }, { s: "Scheduled", d: daysAgoIso(4), n: "Scheduled for June 10" }], adminNotes: "Overlay job June 10. Check for cracks day before - add $300-500 if crack repair needed." },
  { id: "T-008", at: daysAgoIso(14), name: "Harold & Brenda Puckett", phone: "(770) 555-0724", email: "hpuckett@gmail.com", addr: "County Road 34", city: "Zebulon, GA", ptype: "Block Foundation", len: 28, wid: 36, sqft: 1008, thick: "N/A", finish: "N/A", tear: "No", grade: "Yes", access: "Not Sure", timeline: "Flexible", notes: "Shop building block foundation plus interior slab. Rural property, some grade work.", rLow: 8500, rHigh: 14000, quote: null, status: "Lost", followUp: "", files: [], history: [{ s: "New Request", d: daysAgoIso(14), n: "Submitted via website" }, { s: "Rough Estimate Sent", d: daysAgoIso(13), n: "Sent rough range" }, { s: "Lost", d: daysAgoIso(8), n: "Customer went with lower bid" }], adminNotes: "Lost to price. Rural access uncertainty may have inflated estimate.", decisionFeedbackReason: "I am comparing other quotes", decisionFeedbackComment: "Still deciding between two contractors and may revisit this later." },
];

export const createInitialTickets = (): Ticket[] =>
  DEMO_TICKETS.map(ticket => {
    const baseTicket: Ticket = {
      ...ticket,
      estimateDecision: ticket.estimateDecision || null,
      estimateDecisionLabel: ticket.estimateDecisionLabel || "Awaiting decision",
      decisionQuestion: ticket.decisionQuestion || "Does this estimate range work for your project?",
      decisionAt: ticket.decisionAt || "",
      decisionFeedbackReason: ticket.decisionFeedbackReason || "",
      decisionFeedbackComment: ticket.decisionFeedbackComment || "",
      notifications: ticket.notifications || [],
    };

    if (ticket.id === "T-002") {
      return {
        ...baseTicket,
        status: "Interested",
        estimateDecision: "yes",
        estimateDecisionLabel: "Yes / Interested",
        decisionAt: ticket.at,
        notifications: [{
          id: "notif-T-002",
          type: "warm_lead",
          title: "Warm lead",
          message: "Customer said the estimate range works and wants to move forward. Reach out for site visit planning.",
          createdAt: ticket.at,
        }],
        history: [...(ticket.history || []), { s: "Interested", d: new Date().toISOString(), n: "Customer selected \"Yes, I'd like to move forward.\" Warm lead logged for site visit follow-up." }],
      };
    }

    if (ticket.id === "T-006") {
      return {
        ...baseTicket,
        status: "Site Visit Requested",
        estimateDecision: "yes",
        estimateDecisionLabel: "Yes / Interested",
        decisionAt: ticket.at,
        notifications: [{
          id: "notif-T-006",
          type: "warm_lead",
          title: "Warm lead",
          message: "Customer wants to move forward. Owner should confirm a site visit call time.",
          createdAt: ticket.at,
        }],
        history: [...(ticket.history || []), { s: "Site Visit Requested", d: new Date().toISOString(), n: "Office queued a site visit request after the customer approved the estimate range." }],
      };
    }

    if (ticket.id === "T-007" || ticket.id === "T-004") {
      return {
        ...baseTicket,
        estimateDecision: "yes",
        estimateDecisionLabel: "Yes / Interested",
        decisionAt: ticket.at,
        notifications: ticket.notifications?.length ? ticket.notifications : [{
          id: `notif-${ticket.id}`,
          type: "warm_lead",
          title: "Warm lead",
          message: "Customer approved the estimate range and moved forward in the pipeline.",
          createdAt: ticket.at,
        }],
      };
    }

    if (ticket.id === "T-008") {
      return {
        ...baseTicket,
        status: "Follow Up Needed",
        estimateDecision: "no",
        estimateDecisionLabel: "No / Follow Up Needed",
        decisionAt: ticket.at,
        decisionFeedbackReason: ticket.decisionFeedbackReason || "I am comparing other quotes",
        decisionFeedbackComment: ticket.decisionFeedbackComment || "Still deciding between two contractors and may revisit this later.",
        followUp: ticket.followUp || "2026-06-18",
        notifications: [{
          id: "notif-T-008",
          type: "sales_follow_up",
          title: "Sales follow-up",
          message: "Customer said the estimate range does not work right now. Owner follow-up call recommended.",
          createdAt: ticket.at,
        }],
        history: [...(ticket.history || []), { s: "Follow Up Needed", d: new Date().toISOString(), n: "Customer selected \"No, not at this time.\" Owner follow-up call recommended." }],
      };
    }

    return baseTicket;
  });
