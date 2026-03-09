import { useState, useEffect } from "react";
import { healthCheck } from "./services/api";
import LandingPage from "./components/LandingPage";
import SingleLeadForm from "./components/SingleLeadForm";
import SupabaseScorer from "./components/SupabaseScorer";
import AskLeads from "./components/AskLeads";

const TABS = [
  { id: "single", label: "Score a Lead" },
  { id: "batch", label: "Score New Leads" },
];

export default function App() {
  const [view, setView] = useState("landing");
  const [activeTab, setActiveTab] = useState(0);
  const [apiStatus, setApiStatus] = useState("checking");
  const [showChat, setShowChat] = useState(false);
  const [scoredLeadsCount, setScoredLeadsCount] = useState(0);

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
            <button
              onClick={() => setView("landing")}
              className="text-white text-base tracking-[0.12em] font-semibold hover:opacity-80 transition-opacity"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              ASTRA
            </button>

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

          <div className="flex items-center gap-3">
            {/* Chat toggle */}
            <button
              onClick={() => setShowChat((p) => !p)}
              className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 transition-colors"
              title="Ask about leads"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-400"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {scoredLeadsCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                  style={{ backgroundColor: "var(--color-high)" }}
                />
              )}
            </button>

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
        </div>
      </header>

      {/* Offline alert */}
      {apiStatus === "offline" && (
        <div className="max-w-6xl mx-auto px-6 mt-4">
          <div className="bg-[var(--color-low-bg)] text-[var(--color-low)] px-4 py-2.5 rounded text-xs">
            Cannot connect to the scoring API. Make sure the backend is running.
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 0 && <SingleLeadForm disabled={apiStatus !== "ok"} />}
        {activeTab === 1 && (
          <SupabaseScorer
            disabled={apiStatus !== "ok"}
            onLeadsScored={(count) => setScoredLeadsCount(count)}
          />
        )}
      </main>

      {/* Chat drawer */}
      <AskLeads
        open={showChat}
        onClose={() => setShowChat(false)}
        leadsCount={scoredLeadsCount}
      />
    </div>
  );
}
