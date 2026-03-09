import { useState, useMemo } from "react";
import { scoreFromSupabase } from "../services/api";
import SummaryBar from "./SummaryBar";
import FilterPanel from "./FilterPanel";
import LeadCard from "./LeadCard";

export default function SupabaseScorer({ disabled }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [lastPulled, setLastPulled] = useState(null);

    const [bandFilter, setBandFilter] = useState([]);
    const [neighbourhoodFilter, setNeighbourhoodFilter] = useState("");
    const [referralFilter, setReferralFilter] = useState("");
    const [sortAsc, setSortAsc] = useState(false);
    const [scoreRange, setScoreRange] = useState([0, 100]);

    const handlePull = async () => {
        setLoading(true);
        setError(null);
        setData(null);
        try {
            const result = await scoreFromSupabase();
            setData(result);
            setLastPulled(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredLeads = useMemo(() => {
        if (!data?.leads) return [];
        let list = [...data.leads];
        if (bandFilter.length) list = list.filter((l) => bandFilter.includes(l.profit_band));
        if (neighbourhoodFilter) list = list.filter((l) => l.input_summary?.neighbourhood === neighbourhoodFilter);
        if (referralFilter) list = list.filter((l) => l.input_summary?.referral_source === referralFilter);
        if (scoreRange[0] > 0 || scoreRange[1] < 100)
            list = list.filter((l) => l.priority_score >= scoreRange[0] && l.priority_score <= scoreRange[1]);
        list.sort((a, b) => sortAsc ? a.priority_score - b.priority_score : b.priority_score - a.priority_score);
        return list;
    }, [data, bandFilter, neighbourhoodFilter, referralFilter, sortAsc, scoreRange]);

    const exportCSV = () => {
        if (!filteredLeads.length) return;
        const headers = ["rank", "band", "score", "confidence", "neighbourhood", "sqft", "timeline", "referral"];
        const rows = filteredLeads.map((l, i) => [
            i + 1, l.profit_band, l.priority_score, l.confidence.toFixed(4),
            l.input_summary?.neighbourhood || "", l.input_summary?.estimated_job_size_sqft || "",
            l.input_summary?.requested_timeline || "", l.input_summary?.referral_source || "",
        ]);
        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `astra-leads-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ── Empty state ─────────────────────────────────────── */
    if (!data && !loading && !error) {
        return (
            <div>
                <h2
                    className="text-xl font-semibold mb-6"
                    style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
                >
                    Score New Leads
                </h2>
                <div className="bg-white border rounded-lg p-10 text-center" style={{ borderColor: "var(--color-border)" }}>
                    <p className="text-sm mb-1" style={{ color: "var(--color-text)" }}>
                        Pull & Score from Supabase
                    </p>
                    <p className="text-xs mb-5" style={{ color: "var(--color-text-muted)" }}>
                        Fetches all unscored leads, cleans, and scores with the ASTRA model.
                    </p>
                    <button
                        onClick={handlePull}
                        disabled={disabled}
                        className="px-8 py-2.5 rounded-md text-sm font-semibold text-white disabled:opacity-35 disabled:cursor-not-allowed transition-all hover:opacity-90"
                        style={{ backgroundColor: "var(--color-brand)" }}
                    >
                        Pull & Score
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Loading */}
            {loading && (
                <div className="flex flex-col items-center py-16">
                    <div
                        className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3"
                        style={{ borderColor: "var(--color-brand)", borderTopColor: "transparent" }}
                    />
                    <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        Fetching and scoring leads…
                    </p>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="bg-[var(--color-low-bg)] text-[var(--color-low)] px-4 py-3 rounded text-xs mb-5 flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={handlePull} className="text-xs font-medium underline">Try again</button>
                </div>
            )}

            {/* Results */}
            {data && !loading && (
                <>
                    <div className="flex items-center justify-between mb-4">
                        <h2
                            className="text-xl font-semibold"
                            style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
                        >
                            Results
                        </h2>
                        <button
                            onClick={handlePull}
                            className="text-xs font-medium hover:underline"
                            style={{ color: "var(--color-brand)" }}
                        >
                            Pull again
                        </button>
                    </div>

                    {data.summary.total === 0 ? (
                        <div className="bg-white border rounded-lg p-10 text-center" style={{ borderColor: "var(--color-border)" }}>
                            <p style={{ color: "var(--color-text-muted)" }}>No unscored leads found</p>
                        </div>
                    ) : (
                        <>
                            <SummaryBar
                                high={data.summary.high} medium={data.summary.medium} low={data.summary.low}
                                total={data.summary.total} droppedRows={data.summary.dropped_rows}
                                lastPulled={lastPulled}
                            />

                            <FilterPanel
                                leads={data.leads}
                                bandFilter={bandFilter} setBandFilter={setBandFilter}
                                neighbourhoodFilter={neighbourhoodFilter} setNeighbourhoodFilter={setNeighbourhoodFilter}
                                referralFilter={referralFilter} setReferralFilter={setReferralFilter}
                                sortAsc={sortAsc} setSortAsc={setSortAsc}
                                scoreRange={scoreRange} setScoreRange={setScoreRange}
                                onExport={exportCSV} filteredCount={filteredLeads.length}
                            />

                            {/* Lead rows — Vercel-style divider list */}
                            <div className="bg-white border rounded-lg" style={{ borderColor: "var(--color-border)" }}>
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
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
