import { useRef, useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { parseHoldingsFile } from "../lib/csv";
import { UploadIcon } from "./UploadIcon";
import { ProfileIcon } from "./ProfileIcon";
import styles from "./Header.module.css";

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    mode,
    portfolio,
    portfolioUploadedAt,
    setPortfolio,
    clearData,
  } = useApp();
  const [profileOpen, setProfileOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const hasPortfolio = portfolio && Object.keys(portfolio).length > 0;
  const isLoggedIn = mode === "logged_in" && !!user;
  const isDemo = mode === "demo";
  const isGuest = mode === "guest";
  const showProfile = isGuest || !!user;
  const showPillNav = !!hasPortfolio;

  useEffect(() => {
    if (!profileOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [profileOpen]);

  const handleUploadClick = () => {
    setUploadError(null);
    uploadInputRef.current?.click();
  };

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    parseHoldingsFile(file)
      .then((data) => {
        setPortfolio(data);
        setUploadError(null);
        setProfileOpen(false);
      })
      .catch((err) => {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      });
  };

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setProfileOpen(false);
    navigate("/");
  };

  const handleLogin = () => {
    setProfileOpen(false);
    navigate("/");
  };

  const handleClearData = () => {
    clearData();
    setProfileOpen(false);
  };

  const logoHref =
    user || (isGuest && hasPortfolio) || isDemo
      ? isDemo
        ? "/demo"
        : "/app"
      : "/";

  const avatarInitial = user?.email ? user.email[0].toUpperCase() : null;

  const lastUpdated = portfolioUploadedAt
    ? new Date(portfolioUploadedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const dashboardPath = isDemo ? "/demo" : "/app";
  const isOnDashboard =
    location.pathname === "/app" || location.pathname === "/demo";
  const isOnHistory = location.pathname === "/app/history";

  return (
    <header className={styles.header}>
      {/* Left: logo + demo badge */}
      <div className={styles.left}>
        <Link to={logoHref} className={styles.logo}>
          <img
            src="/logo.svg"
            alt=""
            width={26}
            height={26}
            className={styles.logoImg}
          />
          <span className={styles.logoText}>Portfolio Analyzer</span>
        </Link>
        {isDemo && <span className={styles.demoBadge}>Demo</span>}
      </div>

      {/* Center: pill nav (logged-in with portfolio only) */}
      {showPillNav && (
        <nav className={styles.pillNav} aria-label="Page navigation">
          <button
            type="button"
            className={`${styles.pill} ${isOnDashboard ? styles.pillActive : ""}`}
            onClick={() => navigate(dashboardPath)}
          >
            Dashboard
          </button>
          {isLoggedIn && (
            <button
              type="button"
              className={`${styles.pill} ${isOnHistory ? styles.pillActive : ""}`}
              onClick={() => navigate("/app/history")}
            >
              History
            </button>
          )}
        </nav>
      )}

      {/* Right: actions */}
      <div className={styles.right}>
        {/* Hidden file input */}
        <input
          ref={uploadInputRef}
          type="file"
          accept=".csv"
          className={styles.hiddenInput}
          onChange={handleUploadChange}
          aria-label="Upload Zerodha holdings CSV"
          title="Upload Zerodha holdings CSV"
        />

        {uploadError && (
          <span className={styles.uploadError} role="alert">
            {uploadError}
          </span>
        )}

        {/* Upload icon button (non-demo, portfolio loaded) */}
        {hasPortfolio && !isDemo && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={handleUploadClick}
            title="Upload new holdings CSV"
            aria-label="Upload new holdings CSV"
          >
            <UploadIcon />
          </button>
        )}

        {/* Guest: Login to sync */}
        {isGuest && supabase && (
          <button
            type="button"
            className={styles.ctaBtn}
            onClick={handleLogin}
          >
            <span className={styles.ctaBtnFull}>Login to sync</span>
            <span className={styles.ctaBtnShort}>Login</span>
          </button>
        )}

        {/* Demo: Create account */}
        {isDemo && supabase && (
          <button
            type="button"
            className={styles.ctaBtn}
            onClick={() => navigate("/", { state: { tab: "signup" } })}
          >
            <span className={styles.ctaBtnFull}>Create account</span>
            <span className={styles.ctaBtnShort}>Sign up</span>
          </button>
        )}

        {/* Avatar / profile */}
        {showProfile && (
          <div className={styles.profileWrap} ref={profileRef}>
            <button
              type="button"
              className={`${styles.avatarBtn} ${avatarInitial ? styles.avatarFilled : ""}`}
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label="Profile menu"
              aria-expanded={profileOpen ? "true" : "false"}
              aria-haspopup="true"
            >
              {avatarInitial ?? <ProfileIcon className={styles.profileIcon} />}
            </button>

            {profileOpen && (
              <div className={styles.profileDropdown}>
                {user && (
                  <div className={styles.profileEmail}>
                    {user.email ?? "Signed in"}
                  </div>
                )}
                {lastUpdated && (
                  <div className={styles.profileMeta}>
                    Last updated: {lastUpdated}
                  </div>
                )}
                {(user || lastUpdated) && (
                  <div className={styles.profileDivider} />
                )}

                {hasPortfolio && !isDemo && (
                  <button
                    type="button"
                    className={styles.profileItem}
                    onClick={() => {
                      setProfileOpen(false);
                      handleUploadClick();
                    }}
                  >
                    <UploadIcon className={styles.profileItemIcon} />
                    Upload new CSV
                  </button>
                )}

                {hasPortfolio && (
                  <button
                    type="button"
                    className={`${styles.profileItem} ${styles.profileItemDanger}`}
                    onClick={handleClearData}
                  >
                    Clear data
                  </button>
                )}

                {hasPortfolio && <div className={styles.profileDivider} />}

                <button
                  type="button"
                  className={styles.profileItem}
                  onClick={user ? handleSignOut : handleLogin}
                >
                  {user ? "Sign out" : "Back to home"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
