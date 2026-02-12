import { useRef, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { parseHoldingsFile } from "../lib/csv";
import { UploadIcon } from "./UploadIcon";
import { ProfileIcon } from "./ProfileIcon";
import styles from "./Header.module.css";

export function Header() {
  const navigate = useNavigate();
  const { user, mode, portfolio, setPortfolio } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const hasPortfolio = portfolio && Object.keys(portfolio).length > 0;
  const showProfile = mode === "guest" || user;

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
        setMenuOpen(false);
      })
      .catch((err) => {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      });
  };

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setMenuOpen(false);
    setProfileOpen(false);
    navigate("/");
  };

  const handleLogin = () => {
    setMenuOpen(false);
    navigate("/");
  };

  return (
    <>
      <header className={styles.header}>
        <Link
          to={
            user || (mode === "guest" && hasPortfolio) || mode === "demo"
              ? mode === "demo"
                ? "/demo"
                : "/app"
              : "/"
          }
          className={styles.logo}
        >
          <img
            src="/logo.svg"
            alt=""
            width={28}
            height={28}
            className={styles.logoImg}
          />
          <span className={styles.logoText}>Zerodha Portfolio Analyzer</span>
        </Link>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen ? "true" : "false"}
        >
          <span className={styles.menuIcon} />
          <span className={styles.menuIcon} />
          <span className={styles.menuIcon} />
        </button>
        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`}>
          {hasPortfolio && mode !== "demo" && (
            <>
              <input
                ref={uploadInputRef}
                type="file"
                accept=".csv"
                className={styles.hiddenInput}
                onChange={handleUploadChange}
                aria-label="Upload Zerodha holdings CSV"
                title="Upload Zerodha holdings CSV"
              />
              <button
                type="button"
                className={styles.ctaBtn}
                onClick={handleUploadClick}
              >
                <UploadIcon className={styles.ctaIcon} />
                Upload holdings
              </button>
              {uploadError && (
                <span className={styles.uploadError} role="alert">
                  {uploadError}
                </span>
              )}
            </>
          )}
          {mode === "demo" && (
            <>
              <span className={styles.badge}>Demo</span>
              {supabase && (
                <button
                  type="button"
                  className={styles.navLink}
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/", { state: { tab: "signup" } });
                  }}
                >
                  Create account
                </button>
              )}
            </>
          )}
          {mode === "guest" && supabase && (
            <button
              type="button"
              className={styles.navLink}
              onClick={handleLogin}
            >
              Login to sync
            </button>
          )}
          {showProfile && (
            <div className={styles.profileWrap} ref={profileRef}>
              <button
                type="button"
                className={styles.profileBtn}
                onClick={() => setProfileOpen(!profileOpen)}
                aria-label="Profile menu"
                aria-expanded={profileOpen ? "true" : "false"}
                aria-haspopup="true"
              >
                <ProfileIcon className={styles.profileIcon} />
              </button>
              {profileOpen && (
                <div className={styles.profileDropdown}>
                  {user && (
                    <div className={styles.profileEmail}>
                      {user.email ?? "Signed in"}
                    </div>
                  )}
                  <button
                    type="button"
                    className={styles.profileItem}
                    onClick={handleSignOut}
                  >
                    {user ? "Sign out" : "Back to home"}
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
      </header>
    </>
  );
}
