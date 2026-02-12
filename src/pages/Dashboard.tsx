import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { loadGuestStorage } from "../lib/storage";
import { Header } from "../components/Header";
import { UploadArea } from "../components/UploadArea";
import { SetList } from "../components/SetList";
import { SummaryInsights } from "../components/SummaryInsights";
import styles from "./Dashboard.module.css";

export function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    loading,
    mode,
    portfolio,
    portfolioUploadedAt,
    clearData,
    error,
    clearError,
    loadDemo,
  } = useApp();
  const [mergeOffer, setMergeOffer] = useState(false);

  useEffect(() => {
    if (location.pathname === "/demo") {
      loadDemo();
    }
  }, [location.pathname, loadDemo]);

  useEffect(() => {
    if (loading) return;
    if (mode === "logged_in" && loadGuestStorage()?.portfolio) {
      setMergeOffer(true);
    }
  }, [loading, mode]);

  const { mergeGuestIntoAccount } = useApp();

  const handleMergeYes = async () => {
    await mergeGuestIntoAccount();
    setMergeOffer(false);
  };

  const handleMergeNo = () => {
    localStorage.removeItem("zerodhaPortfolio_guest");
    setMergeOffer(false);
  };

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loading}>Loading…</div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <Header />
      <main className={styles.main}>
        {error && (
          <div className={styles.errorBanner} role="alert">
            <span>{error}</span>
            <button
              type="button"
              className={styles.dismissError}
              onClick={clearError}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
        {(!portfolio || Object.keys(portfolio).length === 0) &&
          mode !== "demo" && <UploadArea />}
        {mode === "demo" && portfolio && Object.keys(portfolio).length > 0 && (
          <div className={styles.demoBanner} role="status">
            <p className={styles.demoBannerText}>
              This is <strong>sample data</strong> to show how the app works.
              Create an account for free to upload your own holdings and sync
              across devices.
            </p>
            <button
              type="button"
              className={styles.demoBannerCta}
              onClick={() => navigate("/", { state: { tab: "signup" } })}
            >
              Create account for free
            </button>
          </div>
        )}
        {portfolio && Object.keys(portfolio).length > 0 && <SummaryInsights />}
        <SetList />
        {portfolio && Object.keys(portfolio).length > 0 && mode !== "demo" && (
          <div className={styles.footer}>
            <p className={styles.lastUpdated}>
              Last updated:{" "}
              {portfolioUploadedAt
                ? new Date(portfolioUploadedAt).toLocaleString()
                : "—"}
            </p>
            <button
              type="button"
              className={styles.clearBtn}
              onClick={clearData}
            >
              Clear data & upload new
            </button>
          </div>
        )}
      </main>

      {mergeOffer && (
        <div
          className={styles.mergeOverlay}
          role="dialog"
          aria-label="Merge local data"
        >
          <div className={styles.mergeCard}>
            <p className={styles.mergeTitle}>
              You have local data from before login. Merge it into your account?
            </p>
            <div className={styles.mergeActions}>
              <button
                type="button"
                className={styles.mergePrimary}
                onClick={handleMergeYes}
              >
                Yes, merge
              </button>
              <button
                type="button"
                className={styles.mergeSecondary}
                onClick={handleMergeNo}
              >
                No, discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
