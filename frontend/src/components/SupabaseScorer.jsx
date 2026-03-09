import { useState, useMemo } from "react";
import { scoreFromSupabase } from "../services/api";
import SummaryBar from "./SummaryBar";
import FilterPanel from "./FilterPanel";
import LeadCard from "./LeadCard";

const STATUS = {
    IDLE: "idle",
    FETCHING: "fetching",
    SCORING: "scoring",
    DONE: "done",
    EMPTY: "empty",
    ERROR: "error",
};

export default function SupabaseScorer({ disabled }) {
    const [status, setStatus] = useState(STATUS.IDLE);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    // Filters (same as BatchUploader)
    const [bandFilter, setBandFilter] = useState([]);
    const [neighbourhoodFilter, setNeighbourhoodFilter] = useState("");
    const [referralFilter, setReferralFilter] = useState("");
    const [sortAsc, setSortAsc] = useState(false);

    const isLoading = status === STATUS.FETCHING || status === STATUS.SCORING;

    const handlePullAndScore = async () => {
        setStatus(STATUS.FETCHING);
        setError(null);
        setResult(null);

        try {
            const res = await scoreFromSupabase();
            if (res.summary.total === 0) {
                setStatus(STATUS.EMPTY);
            } else {
                setResult(res);
                setStatus(STATUS.DONE);
            }
            // Reset filters
            setBandFilter([]);
            setNeighbourhoodFilter("");
            setReferralFilter("");
            setSortAsc(false);
        } catch (err) {
            if (err.message?.includes("No unscored leads")) {
                setStatus(STATUS.EMPTY);
            } else {
                setError(err.message);
                setStatus(STATUS.ERROR);
            }
        }
    };

    const handleReset = () => {
        setStatus(STATUS.IDLE);
        setResult(null);
        setError(null);
    };

    // Filter + sort leads
    const filteredLeads = useMemo(() => {
        if (!result?.leads) return [];
        let leads = [...result.leads];

        if (bandFilter.length > 0) {
            leads = leads.filter((l) => bandFilter.includes(l.profit_band));
        }
        if (neighbourhoodFilter) {
            leads = leads.filter((l) => l.input_summary?.neighbourhood === neighbourhoodFilter);
        }
        if (referralFilter) {
            leads = leads.filter((l) => l.input_summary?.referral_source === referralFilter);
        }

        leads.sort((a, b) =>
            sortAsc
                ? a.priority_score - b.priority_score
                : b.priority_score - a.priority_score
        );

        return leads;
    }, [result, bandFilter, neighbourhoodFilter, referralFilter, sortAsc]);

    const handleExport = () => {
        if (!filteredLeads.length) return;
        const headers = ["rank", "profit_band", "priority_score", "confidence", "neighbourhood", "sqft", "timeline", "referral_source"];
        const rows = filteredLeads.map((l, i) => [
            i + 1,
            l.profit_band,
            l.priority_score,
            l.confidence,
            l.input_summary?.neighbourhood || "",
            l.input_summary?.estimated_job_size_sqft || "",
            l.input_summary?.requested_timeline || "",
            l.input_summary?.referral_source || "",
        ]);
        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "scored_leads.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            {/* Initial / loading state */}
            {!result && status !== STATUS.EMPTY && (
                <div className="bg-white border border-[var(--color-border)] rounded-lg p-12 text-center">
                    {status === STATUS.IDLE && (
                        <>
                            <div className="text-4xl mb-4">⚡</div>
                            <p className="text-[var(--color-text)] font-medium mb-2">
                                Pull & Score Leads from Supabase
                            </p>
                            <p className="text-sm text-[var(--color-text-muted)] mb-6">
                                Fetches all unscored leads, cleans data, and scores them automatically
                            </p>
                            <button
                                onClick={handlePullAndScore}
                                disabled={disabled}
                                className="px-6 py-3 rounded-lg text-sm font-medium text-white bg-[var(--color-brand)] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Pull &amp; Score from Supabase
                            </button>
                        </>
                    )}

                    {isLoading && (
                        <div className="flex flex-col items-center gap-3">
                            <span className="w-8 h-8 border-3 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
                            <p className="text-[var(--color-text)] font-medium">
                                {status === STATUS.FETCHING
                                    ? "Fetching unscored leads from Supabase…"
                                    : "Scoring leads…"}
                            </p>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                This may take a moment
                            </p>
                        </div>
                    )}

                    {status === STATUS.ERROR && (
                        <div className="flex flex-col items-center gap-3">
                            <div className="text-4xl">⚠️</div>
                            <p className="text-[var(--color-text)] font-medium">
                                Something went wrong
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Empty state */}
            {status === STATUS.EMPTY && (
                <div className="bg-white border border-[var(--color-border)] rounded-lg p-12 text-center">
                    <div className="text-4xl mb-4">✅</div>
                    <p className="text-[var(--color-text)] font-medium mb-2">
                        No unscored leads found in Supabase
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)] mb-6">
                        All leads in the database already have scores assigned
                    </p>
                    <button
                        onClick={handleReset}
                        className="text-sm text-[var(--color-brand)] hover:underline"
                    >
                        Try again
                    </button>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
                    <span>{error}</span>
                    <button
                        onClick={handleReset}
                        className="text-red-700 hover:text-red-900 font-medium ml-4"
                    >
                        Try again
                    </button>
                </div>
            )}

            {/* Results */}
            {result && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                            Results
                        </h3>
                        <button
                            onClick={handleReset}
                            className="text-sm text-[var(--color-brand)] hover:underline"
                        >
                            Pull again
                        </button>
                    </div>

                    <SummaryBar
                        high={result.summary.high}
                        medium={result.summary.medium}
                        low={result.summary.low}
                        total={result.summary.total}
                        droppedRows={result.summary.dropped_rows || 0}
                    />

                    <FilterPanel
                        leads={result.leads}
                        bandFilter={bandFilter}
                        setBandFilter={setBandFilter}
                        neighbourhoodFilter={neighbourhoodFilter}
                        setNeighbourhoodFilter={setNeighbourhoodFilter}
                        referralFilter={referralFilter}
                        setReferralFilter={setReferralFilter}
                        sortAsc={sortAsc}
                        setSortAsc={setSortAsc}
                        onExport={handleExport}
                        filteredCount={filteredLeads.length}
                    />

                    <div className="flex flex-col gap-3">
                        {filteredLeads.map((lead, i) => (
                            <LeadCard
                                key={i}
                                rank={i + 1}
                                profitBand={lead.profit_band}
                                priorityScore={lead.priority_score}
                                confidence={lead.confidence}
                                topReasons={lead.top_reasons}
                                inputSummary={lead.input_summary}
                            />
                        ))}
                        {filteredLeads.length === 0 && (
                            <div className="text-center text-[var(--color-text-muted)] py-12">
                                No leads match the current filters.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
