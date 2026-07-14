import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createScheduleEvent,
  fetchScheduleEvents,
  findJobIdByEstimateId,
  updateScheduleEvent,
} from "../calendar/calendarService";
import {
  buildScheduleCalendarJobs,
  databaseScheduleRowToCalendarEvent,
  sortCalendarEvents,
  sortScheduleRows,
} from "../calendar/calendarUtils";
import type { DatabaseScheduleEventRow, ScheduleEventWritePayload } from "../calendar/calendarTypes";

function mergeScheduleRow(nextRow: DatabaseScheduleEventRow, rows: DatabaseScheduleEventRow[]) {
  const rowsWithoutDuplicate = rows.filter((row) => row.id !== nextRow.id);
  return sortScheduleRows([nextRow, ...rowsWithoutDuplicate]);
}

export function useScheduleEvents(enabled: boolean) {
  const [rows, setRows] = useState<DatabaseScheduleEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshScheduleEvents = useCallback(async () => {
    if (!enabled) {
      setRows([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const loadedRows = await fetchScheduleEvents();
      setRows(loadedRows);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load calendar.";
      console.error("Unable to load calendar:", loadError);
      setRows([]);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refreshScheduleEvents();
  }, [refreshScheduleEvents]);

  const createEvent = useCallback(async (payload: ScheduleEventWritePayload) => {
    const savedRow = await createScheduleEvent(payload);
    setRows((previousRows) => mergeScheduleRow(savedRow, previousRows));
    setError("");
    return savedRow;
  }, []);

  const updateEvent = useCallback(async (eventId: string, payload: ScheduleEventWritePayload) => {
    const savedRow = await updateScheduleEvent(eventId, payload);
    setRows((previousRows) => mergeScheduleRow(savedRow, previousRows));
    setError("");
    return savedRow;
  }, []);

  const events = useMemo(
    () => sortCalendarEvents(rows.map(databaseScheduleRowToCalendarEvent)),
    [rows]
  );

  const calendarJobs = useMemo(
    () => buildScheduleCalendarJobs(rows),
    [rows]
  );

  return {
    rows,
    events,
    calendarJobs,
    loading,
    error,
    refreshScheduleEvents,
    createEvent,
    updateEvent,
    findJobIdByEstimateId,
  };
}
