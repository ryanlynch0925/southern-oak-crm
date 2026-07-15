import { useCallback, useEffect, useState } from "react";
import { type AdminCustomerRecord, fetchCustomers } from "../customers/customerService";

export function useCustomers(enabled: boolean) {
  const [customers, setCustomers] = useState<AdminCustomerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshCustomers = useCallback(async () => {
    if (!enabled) {
      setCustomers([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const rows = await fetchCustomers();
      setCustomers(rows);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load customers.";
      console.error("Unable to load customers:", loadError);
      setCustomers([]);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refreshCustomers();
  }, [refreshCustomers]);

  return {
    customers,
    loading,
    error,
    refreshCustomers,
  };
}
