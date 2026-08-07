import { getEffectiveFinalEstimateStatus } from "../../estimates/finalEstimateTypes";
import type { Ticket, TicketStatus } from "../../tickets/ticketTypes";
import type { EstimateWorkflowStatus } from "./estimateUtils";

export type EstimateWorkflowStageId =
  | "new_request"
  | "needs_review"
  | "rough_estimate_sent"
  | "interested"
  | "site_visit_requested"
  | "site_visit_needed"
  | "site_visit_scheduled"
  | "site_visit_completed"
  | "final_quote_sent"
  | "estimate_accepted"
  | "ready_to_schedule"
  | "won"
  | "follow_up_needed"
  | "lead_declined"
  | "lost";

export type EstimateWorkflowStageGroup = "primary" | "outcome";

export interface EstimateWorkflowStageDefinition {
  id: EstimateWorkflowStageId;
  workflowStatus: EstimateWorkflowStatus;
  ticketStatus: TicketStatus;
  displayLabel: string;
  group: EstimateWorkflowStageGroup;
  manualSelectable: boolean;
  systemControlled?: boolean;
  helperText?: string;
}

export type EstimateWorkflowQuickAction =
  | {
    kind: "status";
    label: string;
    icon: string;
    targetStatus: TicketStatus;
    historyNote: string;
    successMessage: string;
  }
  | {
    kind: "schedule_site_visit";
    label: string;
    icon: string;
  }
  | {
    kind: "schedule_job";
    label: string;
    icon: string;
  }
  | {
    kind: "focus_final_estimate";
    label: string;
    icon: string;
    helperText: string;
  }
  | {
    kind: "info";
    label: string;
    helperText: string;
  }
  | {
    kind: "none";
    helperText: string;
  };

const ESTIMATE_WORKFLOW_STAGES: EstimateWorkflowStageDefinition[] = [
  {
    id: "new_request",
    workflowStatus: "new_request",
    ticketStatus: "New Request",
    displayLabel: "New Request",
    group: "primary",
    manualSelectable: true,
  },
  {
    id: "needs_review",
    workflowStatus: "needs_review",
    ticketStatus: "Needs Review",
    displayLabel: "Needs Review",
    group: "primary",
    manualSelectable: true,
  },
  {
    id: "rough_estimate_sent",
    workflowStatus: "rough_estimate_sent",
    ticketStatus: "Rough Estimate Sent",
    displayLabel: "Rough Estimate Sent",
    group: "primary",
    manualSelectable: true,
  },
  {
    id: "interested",
    workflowStatus: "interested",
    ticketStatus: "Interested",
    displayLabel: "Interested",
    group: "primary",
    manualSelectable: true,
  },
  {
    id: "site_visit_requested",
    workflowStatus: "site_visit_requested",
    ticketStatus: "Site Visit Requested",
    displayLabel: "Site Visit Requested",
    group: "primary",
    manualSelectable: true,
  },
  {
    id: "site_visit_needed",
    workflowStatus: "site_visit_needed",
    ticketStatus: "Site Visit Needed",
    displayLabel: "Site Visit Needed",
    group: "primary",
    manualSelectable: true,
  },
  {
    id: "site_visit_scheduled",
    workflowStatus: "site_visit_scheduled",
    ticketStatus: "Site Visit Scheduled",
    displayLabel: "Site Visit Scheduled",
    group: "primary",
    manualSelectable: true,
  },
  {
    id: "site_visit_completed",
    workflowStatus: "site_visit_completed",
    ticketStatus: "Site Visit Completed",
    displayLabel: "Site Visit Completed",
    group: "primary",
    manualSelectable: true,
  },
  {
    id: "final_quote_sent",
    workflowStatus: "final_quote_sent",
    ticketStatus: "Final Quote Sent",
    displayLabel: "Final Estimate Published",
    group: "primary",
    manualSelectable: false,
    systemControlled: true,
  },
  {
    id: "estimate_accepted",
    workflowStatus: "estimate_accepted",
    ticketStatus: "Estimate Accepted",
    displayLabel: "Estimate Accepted",
    group: "primary",
    manualSelectable: false,
    systemControlled: true,
    helperText: "Set automatically when the customer accepts the published final estimate.",
  },
  {
    id: "ready_to_schedule",
    workflowStatus: "ready_to_schedule",
    ticketStatus: "Ready to Schedule",
    displayLabel: "Ready to Schedule",
    group: "primary",
    manualSelectable: true,
  },
  {
    id: "won",
    workflowStatus: "won",
    ticketStatus: "Won",
    displayLabel: "Won",
    group: "primary",
    manualSelectable: true,
  },
  {
    id: "follow_up_needed",
    workflowStatus: "follow_up_needed",
    ticketStatus: "Follow Up Needed",
    displayLabel: "Follow Up Needed",
    group: "outcome",
    manualSelectable: true,
  },
  {
    id: "lead_declined",
    workflowStatus: "lead_declined",
    ticketStatus: "Declined",
    displayLabel: "Declined",
    group: "outcome",
    manualSelectable: true,
  },
  {
    id: "lost",
    workflowStatus: "lost",
    ticketStatus: "Lost",
    displayLabel: "Lost",
    group: "outcome",
    manualSelectable: true,
  },
];

const STAGE_BY_ID = new Map(
  ESTIMATE_WORKFLOW_STAGES.map((stage) => [stage.id, stage])
);

const STAGE_BY_TICKET_STATUS = new Map(
  ESTIMATE_WORKFLOW_STAGES.map((stage) => [stage.ticketStatus, stage])
);

const STAGE_BY_WORKFLOW_STATUS = new Map(
  ESTIMATE_WORKFLOW_STAGES.map((stage) => [stage.workflowStatus, stage])
);

export const PRIMARY_ESTIMATE_WORKFLOW_ORDER = ESTIMATE_WORKFLOW_STAGES
  .filter((stage) => stage.group === "primary")
  .map((stage) => stage.displayLabel);

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim();
}

function normalizeEstimateCustomerStatus(value: string | null | undefined) {
  const normalizedValue = normalizeText(value).toLowerCase();
  return normalizedValue || null;
}

function normalizeWorkflowStatus(value: string | null | undefined) {
  const normalizedValue = normalizeText(value).toLowerCase();
  return normalizedValue || null;
}

function getStageByTicketStatus(status: string | null | undefined) {
  return STAGE_BY_TICKET_STATUS.get(status as TicketStatus) || null;
}

function getStageByWorkflowStatus(status: string | null | undefined) {
  const normalizedWorkflowStatus = normalizeWorkflowStatus(status);
  return normalizedWorkflowStatus
    ? STAGE_BY_WORKFLOW_STATUS.get(normalizedWorkflowStatus) || null
    : null;
}

function hasAcceptedFinalEstimatePublication(ticket: Pick<Ticket, "finalEstimatePublications">) {
  const publications = Array.isArray(ticket.finalEstimatePublications)
    ? ticket.finalEstimatePublications
    : [];

  return publications.some((publication) => (
    getEffectiveFinalEstimateStatus(publication.status, publication.expiresAt) === "accepted"
    || publication.decision === "accepted"
  ));
}

function hasDeclinedFinalEstimatePublication(ticket: Pick<Ticket, "finalEstimatePublications">) {
  const publications = Array.isArray(ticket.finalEstimatePublications)
    ? ticket.finalEstimatePublications
    : [];

  return publications.some((publication) => publication.decision === "declined");
}

function hasNotSureFinalEstimatePublication(ticket: Pick<Ticket, "finalEstimatePublications">) {
  const publications = Array.isArray(ticket.finalEstimatePublications)
    ? ticket.finalEstimatePublications
    : [];

  return publications.some((publication) => publication.decision === "not_sure");
}

function hasPublishedFinalEstimateVersion(ticket: Pick<Ticket, "finalEstimatePublications">) {
  return Array.isArray(ticket.finalEstimatePublications)
    && ticket.finalEstimatePublications.length > 0;
}

export function getEstimateWorkflowStageDefinition(stageId: EstimateWorkflowStageId) {
  return STAGE_BY_ID.get(stageId) || null;
}

export function getEstimateWorkflowStageDefinitions(group?: EstimateWorkflowStageGroup) {
  if (!group) {
    return ESTIMATE_WORKFLOW_STAGES;
  }

  return ESTIMATE_WORKFLOW_STAGES.filter((stage) => stage.group === group);
}

export function getEstimateStatusDisplayLabel(status: string | null | undefined) {
  return getStageByTicketStatus(status)?.displayLabel || normalizeText(status);
}

export function getEstimateWorkflowStatusFilterOptions() {
  return ESTIMATE_WORKFLOW_STAGES.map((stage) => ({
    value: stage.ticketStatus,
    label: stage.displayLabel,
  }));
}

export function resolveEffectiveEstimateWorkflowStage(
  ticket: Pick<
    Ticket,
    "status" | "workflowStatus" | "customerStatus" | "finalEstimatePublications" | "siteVisitAppointment"
  >
): EstimateWorkflowStageId {
  const currentStatusStage = getStageByTicketStatus(ticket.status);
  const workflowStage = getStageByWorkflowStatus(ticket.workflowStatus);
  const customerStatus = normalizeEstimateCustomerStatus(ticket.customerStatus);
  const hasAcceptedPublication = hasAcceptedFinalEstimatePublication(ticket);
  const hasDeclinedPublication = hasDeclinedFinalEstimatePublication(ticket);
  const hasNotSurePublication = hasNotSureFinalEstimatePublication(ticket);

  if (currentStatusStage?.id === "won") {
    return "won";
  }

  if (currentStatusStage?.id === "ready_to_schedule") {
    return "ready_to_schedule";
  }

  if (customerStatus === "accepted" || hasAcceptedPublication || currentStatusStage?.id === "estimate_accepted") {
    return "estimate_accepted";
  }

  if (customerStatus === "declined" || hasDeclinedPublication) {
    return currentStatusStage?.id === "lead_declined" ? "lead_declined" : "lost";
  }

  if (customerStatus === "not_sure" || hasNotSurePublication) {
    return "follow_up_needed";
  }

  if (
    currentStatusStage?.id === "follow_up_needed"
    || currentStatusStage?.id === "lead_declined"
    || currentStatusStage?.id === "lost"
  ) {
    return currentStatusStage.id;
  }

  if (ticket.siteVisitAppointment) {
    return "site_visit_scheduled";
  }

  if (hasPublishedFinalEstimateVersion(ticket)) {
    return "final_quote_sent";
  }

  if (currentStatusStage?.id && currentStatusStage.id !== "final_quote_sent") {
    return currentStatusStage.id;
  }

  if (
    workflowStage?.id
    && workflowStage.id !== "final_quote_sent"
    && workflowStage.id !== "estimate_accepted"
  ) {
    return workflowStage.id;
  }

  if (currentStatusStage?.id === "final_quote_sent" || workflowStage?.id === "final_quote_sent") {
    return "site_visit_completed";
  }

  return "new_request";
}

export function getEstimateWorkflowQuickAction(
  stageId: EstimateWorkflowStageId,
  options?: {
    canManageSiteVisits?: boolean;
  }
): EstimateWorkflowQuickAction {
  switch (stageId) {
    case "new_request":
      return {
        kind: "status",
        label: "Move to Needs Review",
        icon: "ti-arrow-right",
        targetStatus: "Needs Review",
        historyNote: "Estimate moved to Needs Review.",
        successMessage: "Estimate moved to Needs Review.",
      };
    case "needs_review":
      return {
        kind: "status",
        label: "Mark Rough Estimate Sent",
        icon: "ti-mail-check",
        targetStatus: "Rough Estimate Sent",
        historyNote: "Rough estimate sent to customer.",
        successMessage: "Estimate moved to Rough Estimate Sent.",
      };
    case "rough_estimate_sent":
      return {
        kind: "status",
        label: "Mark Interested",
        icon: "ti-thumb-up",
        targetStatus: "Interested",
        historyNote: "Customer marked as interested in the rough estimate.",
        successMessage: "Estimate moved to Interested.",
      };
    case "interested":
      return {
        kind: "status",
        label: "Request Site Visit",
        icon: "ti-map-pin-plus",
        targetStatus: "Site Visit Requested",
        historyNote: "Customer is ready for a site visit request.",
        successMessage: "Estimate moved to Site Visit Requested.",
      };
    case "site_visit_requested":
      return {
        kind: "status",
        label: "Move to Site Visit Needed",
        icon: "ti-map-search",
        targetStatus: "Site Visit Needed",
        historyNote: "Site visit approved for scheduling.",
        successMessage: "Estimate moved to Site Visit Needed.",
      };
    case "site_visit_needed":
      if (options?.canManageSiteVisits) {
        return {
          kind: "schedule_site_visit",
          label: "Schedule Site Visit",
          icon: "ti-calendar-plus",
        };
      }

      return {
        kind: "info",
        label: "Site Visit Needed",
        helperText: "This lead is ready for site-visit scheduling when a calendar manager is available.",
      };
    case "site_visit_scheduled":
      return {
        kind: "status",
        label: "Complete Site Visit",
        icon: "ti-checkup-list",
        targetStatus: "Site Visit Completed",
        historyNote: "Site visit completed and estimate is ready for final-estimate preparation.",
        successMessage: "Estimate moved to Site Visit Completed.",
      };
    case "site_visit_completed":
      return {
        kind: "focus_final_estimate",
        label: "Prepare Final Estimate",
        icon: "ti-file-invoice",
        helperText: "Use the Final Estimate section below to prepare and publish the customer-facing final estimate.",
      };
    case "final_quote_sent":
      return {
        kind: "info",
        label: "Awaiting Customer Decision",
        helperText: "Customer decisions now come from the published final-estimate review page and appear in Published Versions below.",
      };
    case "estimate_accepted":
    case "ready_to_schedule":
      return {
        kind: "schedule_job",
        label: "Schedule Job",
        icon: "ti-calendar-event",
      };
    case "follow_up_needed":
      return {
        kind: "none",
        helperText: "Follow up with the customer and update the lead when they respond.",
      };
    case "lead_declined":
    case "lost":
      return {
        kind: "none",
        helperText: "This estimate is in an outcome state. Earlier workflow progression actions are intentionally hidden.",
      };
    case "won":
      return {
        kind: "none",
        helperText: "This estimate has already reached Won. No earlier workflow progression action is available.",
      };
    default:
      return {
        kind: "none",
        helperText: "Update the lead status as needed.",
      };
  }
}
