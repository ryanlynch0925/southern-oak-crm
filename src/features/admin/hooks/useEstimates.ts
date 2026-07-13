import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { Ticket } from "../../tickets/ticketTypes";
import { buildEstimateUpdatePayload, databaseEstimateToTicket, hasEstimateUpdatePayload } from "../estimates/estimateUtils";
import { fetchEstimateById, fetchEstimates, updateEstimate } from "../services/estimateService";

function sameTicket(first: Ticket, second: Ticket) {
  if (first.databaseId && second.databaseId) {
    return first.databaseId === second.databaseId;
  }

  return first.id === second.id;
}

function mergeTicketIntoList(nextTicket: Ticket, tickets: Ticket[]) {
  const withoutDuplicate = tickets.filter(ticket => !sameTicket(ticket, nextTicket));
  return [nextTicket, ...withoutDuplicate].sort((first, second) => new Date(second.at).getTime() - new Date(first.at).getTime());
}

export function useEstimates(enabled: boolean) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshEstimates = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Unable to verify Supabase session before loading estimates:", {
          message: sessionError.message,
          name: sessionError.name,
        });
        throw new Error("Unable to verify admin session before loading estimates.");
      }

      if (!session) {
        console.warn("Skipped estimate load because no Supabase session was available.");
        setTickets([]);
        return;
      }

      const rows = await fetchEstimates();
      const mappedTickets = rows.map(databaseEstimateToTicket);

      setTickets(mappedTickets);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load estimates.";
      console.error("Unable to load estimates:", loadError);
      setError(message);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refreshEstimates();
  }, [refreshEstimates]);

  const addTicket = useCallback((ticket: Ticket) => {
    setTickets(previousTickets => mergeTicketIntoList(ticket, previousTickets));
  }, []);

  const updateTicket = useCallback(async (updated: Ticket) => {
    const previous = tickets.find(ticket => sameTicket(ticket, updated)) || null;

    if (!enabled || !updated.databaseId) {
      setTickets(previousTickets => (
        previousTickets.some(ticket => sameTicket(ticket, updated))
          ? previousTickets.map(ticket => sameTicket(ticket, updated) ? updated : ticket)
          : mergeTicketIntoList(updated, previousTickets)
      ));
      return updated;
    }

    const payload = buildEstimateUpdatePayload(updated, previous);

    try {
      const savedEstimate = hasEstimateUpdatePayload(payload)
        ? await updateEstimate(updated.databaseId, payload)
        : await fetchEstimateById(updated.databaseId);
      const savedTicket = databaseEstimateToTicket(savedEstimate);
      setTickets(previousTickets => mergeTicketIntoList(savedTicket, previousTickets));
      setError("");
      return savedTicket;
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Unable to update estimate.";
      console.error("Unable to update estimate:", updateError);
      setError(message);
      throw updateError;
    }
  }, [enabled, tickets]);

  return {
    tickets,
    loading,
    error,
    addTicket,
    updateTicket,
    refreshEstimates,
  };
}
