import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import type { PublicPage } from "./appTypes";
import AdminWorkspace from "./adminDashboard";
import Footer from "./components/layout/Footer";
import Nav from "./components/layout/Nav";
import AdminLogin from "./features/auth/AdminLogin";
import { canAccessEstimates, isAppRole, type AppRole } from "./features/admin/auth/roles";
import { useEstimates } from "./features/admin/hooks/useEstimates";
import EstimatePage from "./features/estimates/EstimatePage";
import type { Ticket } from "./features/tickets/ticketTypes";
import { supabase } from "./lib/supabase";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import GalleryPage from "./pages/GalleryPage";
import HomePage from "./pages/HomePage";
import ServicesPage from "./pages/ServicesPage";
import { B } from "./theme";

export default function App() {
  const [page, setPage] = useState<PublicPage>("home");
  const [adminMode, setAdminMode] = useState(false);

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [appRole, setAppRole] = useState<AppRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [roleError, setRoleError] = useState("");
  const sessionUserId = session?.user?.id || null;
  const {
    tickets,
    loading: ticketsLoading,
    error: ticketsError,
    addTicket,
    updateTicket,
  } = useEstimates(adminMode && canAccessEstimates(appRole));

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const {
        data: { session: currentSession },
        error,
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (error) {
        console.error(
          "Unable to load Supabase session:",
          error
        );
      }

      setSession(currentSession);
      setAuthLoading(false);
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!mounted) {
          return;
        }

        setSession(nextSession);
        setAuthLoading(false);

        if (event === "SIGNED_OUT") {
          setAppRole(null);
          setRoleError("");
          setRoleLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRole = async () => {
      if (!sessionUserId) {
        setAppRole(null);
        setRoleError("");
        setRoleLoading(false);
        return;
      }

      setRoleLoading(true);
      setRoleError("");

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", sessionUserId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Unable to load admin role:", error);
        setAppRole(null);
        setRoleError("Unable to load account permissions.");
        setRoleLoading(false);
        return;
      }

      if (!isAppRole(data?.role)) {
        setAppRole(null);
        setRoleError("This account does not have an assigned Southern Oak role.");
        setRoleLoading(false);
        return;
      }

      setAppRole(data.role);
      setRoleLoading(false);
    };

    void loadRole();

    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  const handleTicketSubmit = (ticket: Ticket) => {
    addTicket(ticket);
  };

  const handleTicketUpdate = async (updated: Ticket) => {
    await updateTicket(updated);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) {
      console.error("Unable to sign out:", error);
      return;
    }

    setAdminMode(false);
    setAppRole(null);
    setRoleError("");
  };

  if (adminMode) {
    if (authLoading) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#F0F2F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: B.dark,
            fontWeight: 600,
          }}
        >
          Checking login...
        </div>
      );
    }

    if (!session) {
      return <AdminLogin />;
    }

    if (roleLoading) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#F0F2F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: B.dark,
            fontWeight: 600,
          }}
        >
          Loading permissions...
        </div>
      );
    }

    if (!appRole) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#F0F2F5",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: B.dark,
            fontWeight: 600,
            padding: 16,
            textAlign: "center",
            gap: 16,
          }}
        >
          <div>
            {roleError || "This account does not have access to the dashboard."}
          </div>

          <button
            onClick={() => void handleLogout()}
            style={{
              border: "none",
              borderRadius: 999,
              background: B.dark,
              color: "#FFFFFF",
              padding: "10px 18px",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </div>
      );
    }

    return (
      <AdminWorkspace
        appRole={appRole}
        tickets={tickets}
        ticketsLoading={ticketsLoading}
        ticketsError={ticketsError}
        onUpdateTicket={handleTicketUpdate}
        onLogout={() => void handleLogout()}
        setPage={(nextPage: PublicPage) => {
          setAdminMode(false);
          setPage(nextPage);
        }}
      />
    );
  }

  const renderPage = () => {
    switch (page) {
      case "home":
        return <HomePage setPage={setPage} />;

      case "services":
        return <ServicesPage setPage={setPage} />;

      case "gallery":
        return <GalleryPage setPage={setPage} />;

      case "about":
        return <AboutPage setPage={setPage} />;

      case "contact":
        return <ContactPage setPage={setPage} />;

      case "estimate":
        return (
          <EstimatePage
            onSubmitTicket={handleTicketSubmit}
            onUpdateTicket={(ticket) => void handleTicketUpdate(ticket)}
            onReturnHome={() => setPage("home")}
          />
        );

      default:
        return <HomePage setPage={setPage} />;
    }
  };

  return (
    <div
      style={{
        fontFamily:
          "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        color: B.dark,
      }}
    >
      <Nav
        page={page}
        setPage={setPage}
        adminMode={adminMode}
        setAdminMode={setAdminMode}
      />

      {renderPage()}

      <Footer
        setPage={setPage}
        setAdminMode={setAdminMode}
      />

      <button
        onClick={() => setAdminMode(true)}
        title="Admin"
        style={{
          position: "fixed",
          bottom: 14,
          right: 14,
          width: 34,
          height: 34,
          background: B.dark,
          border: "none",
          borderRadius: "50%",
          color: "rgba(255,255,255,.3)",
          fontSize: ".8rem",
          cursor: "pointer",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <i
          className="ti ti-shield"
          style={{ fontSize: 15 }}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
