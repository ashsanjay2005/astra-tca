import { useState, useMemo } from "react";

export default function FilterPanel({
    leads,
    bandFilter, setBandFilter,
    neighbourhoodFilter, setNeighbourhoodFilter,
    referralFilter, setReferralFilter,
    sortAsc, setSortAsc,
    scoreRange, setScoreRange,
    onExport, filteredCount,
}) {
    const [open, setOpen] = useState(false);

    const uniqueNeighbourhoods = useMemo(() => {
        const s = new Set();
        leads.forEach((l) => { if (l.input_summary?.neighbourhood) s.add(l.input_summary.neighbourhood); });
        return [...s].sort();
    }, [leads]);

    const uniqueReferrals = useMemo(() => {
        const s = new Set();
        leads.forEach((l) => { if (l.input_summary?.referral_source) s.add(l.input_summary.referral_source); });
        return [...s].sort();
    }, [leads]);

    const toggleBand = (b) => setBandFilter((prev) =>
        prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    );

    const activeCount = [
        bandFilter.length > 0 && bandFilter.length < 3,
        neighbourhoodFilter !== "",
        referralFilter !== "",
        scoreRange[0] > 0 || scoreRange[1] < 100,
    ].filter(Boolean).length;

    const BANDS = [
        { label: "High", color: "var(--color-high)" },
        { label: "Medium", color: "var(--color-medium)" },
        { label: "Low", color: "var(--color-low)" },
    ];

    const selectCls =
        "w-full border-b bg-transparent text-xs py-1.5 outline-none " +
        "border-[var(--color-border)] focus:border-[var(--color-brand)] transition-colors";

    return (
        <div className="mb-4">
            {/* Control bar */}
            <div className="flex items-center gap-2 mb-3">
                <button
                    onClick={() => setOpen((p) => !p)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium border transition-all"
                    style={{
                        borderColor: open || activeCount > 0 ? "var(--color-brand)" : "var(--color-border)",
                        color: open || activeCount > 0 ? "var(--color-brand)" : "var(--color-text-muted)",
                    }}
                >
                    Filters
                    {activeCount > 0 && (
                        <span
                            className="ml-0.5 w-4 h-4 flex items-center justify-center text-[10px] font-bold rounded-full text-white"
                            style={{ backgroundColor: "var(--color-brand)" }}
                        >
                            {activeCount}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setSortAsc((p) => !p)}
                    className="px-3 py-1.5 rounded text-xs border transition-all"
                    style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
                >
                    {sortAsc ? "↑ Lowest" : "↓ Highest"}
                </button>

                <span className="text-xs ml-auto" style={{ color: "var(--color-text-muted)" }}>
                    {filteredCount} of {leads.length}
                </span>

                <button
                    onClick={onExport}
                    className="text-xs hover:underline"
                    style={{ color: "var(--color-text-muted)" }}
                >
                    Export CSV
                </button>
            </div>

            {/* Collapsible panel */}
            <div style={{
                maxHeight: open ? "300px" : "0",
                opacity: open ? 1 : 0,
                overflow: "hidden",
                transition: "max-height 0.2s ease, opacity 0.15s ease",
            }}>
                <div className="bg-white border rounded-lg p-4" style={{ borderColor: "var(--color-border)" }}>
                    <div className="flex flex-wrap gap-6">
                        {/* Band toggles */}
                        <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.05em] mb-2" style={{ color: "var(--color-text-muted)" }}>
                                Band
                            </div>
                            <div className="flex gap-1.5">
                                {BANDS.map((b) => {
                                    const on = bandFilter.includes(b.label);
                                    return (
                                        <button
                                            key={b.label}
                                            onClick={() => toggleBand(b.label)}
                                            className="px-3 py-1 rounded text-[11px] font-semibold border transition-all"
                                            style={{
                                                backgroundColor: on ? b.color : "transparent",
                                                color: on ? "white" : "var(--color-text-muted)",
                                                borderColor: on ? "transparent" : "var(--color-border)",
                                            }}
                                        >
                                            {b.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Dropdowns */}
                        <div className="flex-1 min-w-[140px]">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.05em] mb-2" style={{ color: "var(--color-text-muted)" }}>
                                Neighbourhood
                            </div>
                            <select value={neighbourhoodFilter} onChange={(e) => setNeighbourhoodFilter(e.target.value)} className={selectCls}>
                                <option value="">All</option>
                                {uniqueNeighbourhoods.map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                        <div className="flex-1 min-w-[140px]">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.05em] mb-2" style={{ color: "var(--color-text-muted)" }}>
                                Referral
                            </div>
                            <select value={referralFilter} onChange={(e) => setReferralFilter(e.target.value)} className={selectCls}>
                                <option value="">All</option>
                                {uniqueReferrals.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        {/* Score range */}
                        <div className="min-w-[160px]">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.05em] mb-2" style={{ color: "var(--color-text-muted)" }}>
                                Score {scoreRange[0]}–{scoreRange[1]}
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="range" min={0} max={100} value={scoreRange[0]}
                                    onChange={(e) => setScoreRange([Math.min(+e.target.value, scoreRange[1]), scoreRange[1]])}
                                    className="flex-1" />
                                <input type="range" min={0} max={100} value={scoreRange[1]}
                                    onChange={(e) => setScoreRange([scoreRange[0], Math.max(+e.target.value, scoreRange[0])])}
                                    className="flex-1" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
