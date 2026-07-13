import { supabase } from "../../lib/supabase";

export async function submitPublicEstimate(payload) {
  const { data, error } = await supabase.rpc("submit_public_estimate", {
    payload,
  });

  if (error) {
    throw new Error(error.message || "Unable to submit estimate request.");
  }

  return data;
}
