import { useState } from "react";

import SButton from "../../components/common/SButton";
import { supabase } from "../../lib/supabase";
import { B, INP } from "../../theme";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setErrorMessage("Enter your email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F0F2F5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: B.white,
          borderRadius: 12,
          padding: "36px 28px",
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 2px 20px rgba(0,0,0,.08)",
          border: "0.5px solid var(--color-border-tertiary)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: B.green,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
            }}
          >
            <i
              className="ti ti-shield-lock"
              style={{ fontSize: 26, color: B.tan }}
              aria-hidden="true"
            />
          </div>

          <h1
            style={{
              fontSize: "1.2rem",
              fontWeight: 700,
              color: B.dark,
              marginBottom: 4,
            }}
          >
            Admin Login
          </h1>

          <p style={{ fontSize: ".8rem", color: B.gray }}>
            Southern Oak Concrete
          </p>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              display: "block",
              fontSize: ".8rem",
              fontWeight: 700,
              color: B.dark,
              marginBottom: 4,
            }}
          >
            Email
          </label>

          <input
            style={INP}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrorMessage("");
            }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              display: "block",
              fontSize: ".8rem",
              fontWeight: 700,
              color: B.dark,
              marginBottom: 4,
            }}
          >
            Password
          </label>

          <input
            style={INP}
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrorMessage("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !loading) {
                void handleLogin();
              }
            }}
          />

          {errorMessage && (
            <p
              style={{
                color: "#C0392B",
                fontSize: ".75rem",
                marginTop: 4,
              }}
            >
              <i
                className="ti ti-alert-circle"
                style={{ marginRight: 4 }}
                aria-hidden="true"
              />
              {errorMessage}
            </p>
          )}
        </div>

        <SButton
          onClick={() => void handleLogin()}
          v="green"
          full
          style={{
            fontSize: ".9rem",
            padding: "11px 0",
            opacity: loading ? 0.7 : 1,
            pointerEvents: loading ? "none" : "auto",
          }}
        >
          <i
            className="ti ti-login"
            style={{
              marginRight: 7,
              fontSize: 14,
              verticalAlign: -2,
            }}
            aria-hidden="true"
          />

          {loading ? "Signing In..." : "Sign In"}
        </SButton>
      </div>
    </div>
  );
}