import { useState, useEffect } from "react";
import { healthCheck } from "./services/api";
import LandingPage from "./components/LandingPage";
import SingleLeadForm from "./components/SingleLeadForm";
import SupabaseScorer from "./components/SupabaseScorer";

const TABS = [
  { id: "single", label: "Score a Lead" },
  { id: "batch", label: "Score New Leads" },
];

export default function App() {
  const [view, setView] = useState("landing"); // "landing" | "tool"
  const [activeTab, setActiveTab] = useState(0);
  const [apiStatus, setApiStatus] = useState("checking");

  useEffect(() => {
    healthCheck()
      .then(() => setApiStatus("ok"))
      .catch(() => setApiStatus("offline"));
  }, []);

  const navigateToTool = (tabIndex) => {
    setActiveTab(tabIndex);
    setView("tool");
  };

  if (view === "landing") {
    return <LandingPage onNavigate={navigateToTool} />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-surface-alt)" }}>
      {/* ── Nav ──────────────────────────────────────────── */}
      <header style={{ backgroundColor: "var(--color-nav)" }}>
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Brand — clickable back to landing */}
            <button
              onClick={() => setView("landing")}
              className="text-white text-base tracking-[0.12em] font-semibold hover:opacity-80 transition-opacity"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              ASTRA
            </button>

            {/* Tabs */}
            <div className="flex gap-1 bg-[var(--color-nav-light)] rounded-md p-0.5">
              {TABS.map((tab, i) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(i)}
                  className={`px-4 py-1.5 rounded text-xs font-medium transition-all ${activeTab === i
                      ? "bg-[var(--color-brand)] text-white"
                      : "text-gray-400 hover:text-gray-200"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${apiStatus === "ok"
                  ? "bg-[var(--color-high)]"
                  : apiStatus === "offline"
                    ? "bg-[var(--color-low)]"
                    : "bg-[var(--color-medium)]"
                }`}
            />
            {apiStatus === "ok" ? "Connected" : apiStatus === "offline" ? "Offline" : "…"}
          </div>
        </div>
      </header>

      {/* ── Offline alert ────────────────────────────────── */}
      {apiStatus === "offline" && (
        <div className="max-w-6xl mx-auto px-6 mt-4">
          <div className="bg-[var(--color-low-bg)] text-[var(--color-low)] px-4 py-2.5 rounded text-xs">
            Cannot connect to the scoring API. Make sure the backend is running.
          </div>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 0 && <SingleLeadForm disabled={apiStatus !== "ok"} />}
        {activeTab === 1 && <SupabaseScorer disabled={apiStatus !== "ok"} />}
      </main>
    </div>
  );
}
