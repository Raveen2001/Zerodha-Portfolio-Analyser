import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { GoogleIcon } from "../components/GoogleIcon";
import styles from "./Landing.module.css";

export function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setMode, user, loading } = useApp();
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    if (location.state?.tab === "signup") {
      setAuthTab("signup");
    }
  }, [location.state]);

  useEffect(() => {
    if (loading) return;
    if (user) {
      navigate("/app", { replace: true });
    }
  }, [loading, user, navigate]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setAuthError(null);
    setMessage(null);
    setAuthLoading(true);
    try {
      if (authTab === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        navigate("/app");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Check your email to confirm your account.");
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleContinueWithGoogle = async () => {
    if (!supabase) {
      setMode("guest");
      navigate("/app");
      return;
    }
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/app" },
    });
    if (error) {
      setAuthError(error.message);
      return;
    }
  };

  const handleContinueWithoutLogin = () => {
    setMode("guest");
    navigate("/app");
  };

  const handleTryDemo = () => {
    navigate("/demo");
  };

  const hasSupabase = !!supabase;

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <img
            src="/logo.svg"
            alt=""
            width={48}
            height={48}
            className={styles.logo}
          />
        </div>
        <h1 className={styles.title}>Zerodha Portfolio Analyzer</h1>
        <p className={styles.subtitle}>
          Analyze your holdings and balance your investment sets
        </p>

        {hasSupabase ? (
          <>
            <div className={styles.tabs}>
              <button
                type="button"
                className={authTab === "signin" ? styles.tabActive : styles.tab}
                onClick={() => {
                  setAuthTab("signin");
                  setAuthError(null);
                  setMessage(null);
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                className={authTab === "signup" ? styles.tabActive : styles.tab}
                onClick={() => {
                  setAuthTab("signup");
                  setAuthError(null);
                  setMessage(null);
                }}
              >
                Sign up
              </button>
            </div>
            <form onSubmit={handleEmailAuth} className={styles.authForm}>
              <label className={styles.label}>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={styles.input}
                  required
                  autoComplete={authTab === "signin" ? "email" : "email"}
                />
              </label>
              <label className={styles.label}>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={styles.input}
                  required
                  minLength={6}
                  autoComplete={
                    authTab === "signin" ? "current-password" : "new-password"
                  }
                />
              </label>
              {authError && (
                <p className={styles.authError} role="alert">
                  {authError}
                </p>
              )}
              {message && <p className={styles.authMessage}>{message}</p>}
              <button
                type="submit"
                className={styles.primary}
                disabled={authLoading}
              >
                {authLoading
                  ? "Please wait…"
                  : authTab === "signin"
                  ? "Sign in"
                  : "Sign up"}
              </button>
            </form>
            <div className={styles.divider}>
              <span>or</span>
            </div>
            <button
              type="button"
              className={styles.googleBtn}
              onClick={handleContinueWithGoogle}
              aria-label="Continue with Google"
            >
              <GoogleIcon className={styles.googleIcon} />
              Continue with Google
            </button>
          </>
        ) : (
          <p className={styles.noAuthHint}>
            Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> in your .env to enable sign in.
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={handleContinueWithoutLogin}
          >
            Continue without login
          </button>
          <button type="button" className={styles.demo} onClick={handleTryDemo}>
            Try demo with sample data
          </button>
        </div>

        <p className={styles.hint}>
          Without login, data is stored on this device. With an account, it
          syncs to the cloud.
        </p>
      </div>
    </div>
  );
}
