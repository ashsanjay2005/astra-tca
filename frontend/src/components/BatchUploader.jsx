import { useState, useMemo, useRef } from "react";
import { scoreBatch } from "../services/api";
import SummaryBar from "./SummaryBar";
import FilterPanel from "./FilterPanel";
import LeadCard from "./LeadCard";

export default function BatchUploader({ disabled }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    // Filters
    const [bandFilter, setBandFilter] = useState([]);
    const [neighbourhoodFilter, setNeighbourhoodFilter] = useState("");
    const [referralFilter, setReferralFilter] = useState("");
    const [sortAsc, setSortAsc] = useState(false);

    const fileInputRef = useRef(null);
    const dropRef = useRef(null);

    const handleFile = (f) => {
        if (f && f.name.endsWith(".csv")) {
            setFile(f);
            setError(null);
        } else {
            setError("Please select a .csv file.");
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropRef.current?.classList.remove("border-[var(--color-brand)]");
        const f = e.dataTransfer.files[0];
        handleFile(f);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        dropRef.current?.classList.add("border-[var(--color-brand)]");
    };

    const handleDragLeave = () => {
        dropRef.current?.classList.remove("border-[var(--color-brand)]");
    };

    const handleSubmit = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);
        try {
            const res = await scoreBatch(file);
            setResult(res);
            // Reset filters
            setBandFilter([]);
            setNeighbourhoodFilter("");
            setReferralFilter("");
            setSortAsc(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
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
            {/* Upload zone */}
            {!result && (
                <div
                    ref={dropRef}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-white border-2 border-dashed border-[var(--color-border)] rounded-lg p-12 text-center cursor-pointer hover:border-[var(--color-text-muted)] transition-colors"
                >
                    <div className="text-4xl mb-3">📄</div>
                    <p className="text-[var(--color-text)] font-medium">
                        Drop CSV here or click to upload
                    </p>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                        Only .csv files accepted
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={(e) => handleFile(e.target.files[0])}
                        className="hidden"
                    />
                </div>
            )}

            {/* File selected — show name + submit */}
            {file && !result && (
                <div className="mt-4 flex items-center gap-4">
                    <span className="text-sm text-[var(--color-text)]">
                        📎 {file.name}
                    </span>
                    <button
                        onClick={handleSubmit}
                        disabled={disabled || loading}
                        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-brand)] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? (
                            <span className="inline-flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Scoring…
                            </span>
                        ) : (
                            "Score Batch"
                        )}
                    </button>
                    <button
                        onClick={() => { setFile(null); setError(null); }}
                        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
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
                            onClick={() => { setResult(null); setFile(null); }}
                            className="text-sm text-[var(--color-brand)] hover:underline"
                        >
                            Upload another
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
