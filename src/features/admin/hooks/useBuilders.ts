import { useEffect, useRef, useState } from "react";
import { sortBuildersByName } from "../builders/builderUtils";
import { createBuilder as createBuilderInSupabase, fetchBuilders } from "../services/builderService";

export function useBuilders(enabled = true) {
  const [builders, setBuilders] = useState([]);
  const [buildersLoading, setBuildersLoading] = useState(true);
  const [buildersError, setBuildersError] = useState("");
  const builderCreateErrorRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    const loadBuilders = async () => {
      if (!enabled) {
        setBuilders([]);
        setBuildersLoading(false);
        setBuildersError("");
        return;
      }

      setBuildersLoading(true);
      setBuildersError("");

      try {
        const loadedBuilders = await fetchBuilders();
        if (!cancelled) {
          setBuilders(loadedBuilders);
        }
      } catch (error) {
        console.error("Unable to load builders:", error);
        if (!cancelled) {
          setBuilders([]);
          setBuildersError(error?.message || "Unable to load builders.");
        }
      } finally {
        if (!cancelled) {
          setBuildersLoading(false);
        }
      }
    };

    void loadBuilders();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const createBuilder = async builder => {
    if (!enabled) {
      builderCreateErrorRef.current = "Builder access is not available for this role.";
      return null;
    }

    builderCreateErrorRef.current = "";
    setBuildersError("");

    try {
      const savedBuilder = await createBuilderInSupabase(builder);
      setBuilders(prev => {
        const withoutDuplicate = prev.filter(existing => (
          existing.databaseId !== savedBuilder.databaseId &&
          existing.id !== savedBuilder.id &&
          existing.name !== savedBuilder.name
        ));
        return sortBuildersByName([...withoutDuplicate, savedBuilder]);
      });
      return savedBuilder;
    } catch (error) {
      const message = error?.message || "Unable to create builder.";
      console.error("Unable to create builder:", error);
      builderCreateErrorRef.current = message;
      setBuildersError(message);
      return null;
    }
  };

  return {
    builders,
    buildersLoading,
    buildersError,
    createBuilder,
    getBuilderCreateError: () => builderCreateErrorRef.current,
  };
}
