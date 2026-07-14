import { useCallback, useEffect, useState } from "react";
import {
  databaseJobToFrontendJob,
  mapDatabaseJobsToFrontendJobs,
  sortFrontendJobs,
  type FrontendJob,
  type JobBuilderReference,
} from "../jobs/jobUtils";
import {
  createBuilderJob as createBuilderJobInSupabase,
  fetchJobs,
  updateJob as updateJobInSupabase,
  type BuilderJobDraft,
  type JobUpdatePayload,
} from "../services/jobService";

function sameJob(first: FrontendJob, second: FrontendJob) {
  return first.databaseId === second.databaseId;
}

function mergeJobIntoList(nextJob: FrontendJob, jobs: FrontendJob[]) {
  const withoutDuplicate = jobs.filter((job) => !sameJob(job, nextJob));
  return sortFrontendJobs([nextJob, ...withoutDuplicate]);
}

export function useJobs(enabled: boolean, builders: JobBuilderReference[] = []) {
  const [jobs, setJobs] = useState<FrontendJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshJobs = useCallback(async () => {
    if (!enabled) {
      setJobs([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const rows = await fetchJobs();
      setJobs(mapDatabaseJobsToFrontendJobs(rows, builders));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load jobs.";
      console.error("Unable to load jobs:", loadError);
      setJobs([]);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [enabled, builders]);

  useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  const updateJob = useCallback(async (jobId: string, payload: JobUpdatePayload) => {
    const savedRow = await updateJobInSupabase(jobId, payload);
    const savedJob = databaseJobToFrontendJob(savedRow, builders);
    setJobs((previousJobs) => mergeJobIntoList(savedJob, previousJobs));
    setError("");
    return savedJob;
  }, [builders]);

  const createBuilderJob = useCallback(async (draft: BuilderJobDraft) => {
    const savedRow = await createBuilderJobInSupabase(draft);
    const savedJob = databaseJobToFrontendJob(savedRow, builders);
    setJobs((previousJobs) => mergeJobIntoList(savedJob, previousJobs));
    setError("");
    return savedJob;
  }, [builders]);

  return {
    jobs,
    loading,
    error,
    refreshJobs,
    updateJob,
    createBuilderJob,
  };
}
