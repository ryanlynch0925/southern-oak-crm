import { useCallback, useEffect, useState } from "react";
import {
  type AdminCustomerRecord,
  type CustomerUpdatePatch,
  fetchCustomers,
  setCustomerActive as setCustomerActiveInSupabase,
  updateCustomer as updateCustomerInSupabase,
} from "../customers/customerService";

function sameCustomer(first: AdminCustomerRecord, second: AdminCustomerRecord) {
  return first.id === second.id;
}

function mergeCustomerIntoList(nextCustomer: AdminCustomerRecord, customers: AdminCustomerRecord[]) {
  const existingCustomerIndex = customers.findIndex((customer) => sameCustomer(customer, nextCustomer));

  if (existingCustomerIndex < 0) {
    return [nextCustomer, ...customers];
  }

  return customers.map((customer) => sameCustomer(customer, nextCustomer) ? nextCustomer : customer);
}

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

  const updateCustomer = useCallback(async (customerId: string, patch: CustomerUpdatePatch) => {
    const savedCustomer = await updateCustomerInSupabase(customerId, patch);
    setCustomers((previousCustomers) => mergeCustomerIntoList(savedCustomer, previousCustomers));
    setError("");
    return savedCustomer;
  }, []);

  const setCustomerActive = useCallback(async (customerId: string, isActive: boolean) => {
    const savedCustomer = await setCustomerActiveInSupabase(customerId, isActive);
    setCustomers((previousCustomers) => mergeCustomerIntoList(savedCustomer, previousCustomers));
    setError("");
    return savedCustomer;
  }, []);

  return {
    customers,
    loading,
    error,
    refreshCustomers,
    updateCustomer,
    setCustomerActive,
  };
}
