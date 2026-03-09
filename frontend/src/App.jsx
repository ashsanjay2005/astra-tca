import { useState, useEffect } from "react";
import { healthCheck } from "./services/api";
import SingleLeadForm from "./components/SingleLeadForm";
import SupabaseScorer from "./components/SupabaseScorer";

const TABS = ["Score a Lead", "Score New Leads"];

export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [apiStatus, setApiStatus] = useState("checking");

  useEffect(() => {
    healthCheck()
      .then(() => setApiStatus("ok"))
      .catch(() => setApiStatus("offline"));
  }, []);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">
            ASTRA Lead Scoring
          </h1>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block w-2 h-2 rounded-full ${apiStatus === "ok"
                ? "bg-[var(--color-high)]"
                : apiStatus === "offline"
                  ? "bg-[var(--color-low)]"
                  : "bg-[var(--color-medium)]"
                }`}
            />
            <span className="text-[var(--color-text-muted)]">
              {apiStatus === "ok"
                ? "API Connected"
                : apiStatus === "offline"
                  ? "Cannot connect to API"
                  : "Checking…"}
            </span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6 flex gap-6">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === i
                ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      {/* Offline alert */}
      {apiStatus === "offline" && (
        <div className="max-w-6xl mx-auto px-6 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            Cannot connect to the scoring API at localhost:8000. Make sure the
            backend is running.
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        {activeTab === 0 && <SingleLeadForm disabled={apiStatus !== "ok"} />}
        {activeTab === 1 && <SupabaseScorer disabled={apiStatus !== "ok"} />}
      </main>
    </div>
  );
}
