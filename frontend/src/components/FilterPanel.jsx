import { useMemo } from "react";

export default function FilterPanel({
    leads,
    bandFilter,
    setBandFilter,
    neighbourhoodFilter,
    setNeighbourhoodFilter,
    referralFilter,
    setReferralFilter,
    sortAsc,
    setSortAsc,
    onExport,
    filteredCount,
}) {
    const uniqueNeighbourhoods = useMemo(() => {
        const set = new Set();
        leads.forEach((l) => {
            const n = l.input_summary?.neighbourhood;
            if (n) set.add(n);
        });
        return [...set].sort();
    }, [leads]);

    const uniqueReferrals = useMemo(() => {
        const set = new Set();
        leads.forEach((l) => {
            const r = l.input_summary?.referral_source;
            if (r) set.add(r);
        });
        return [...set].sort();
    }, [leads]);

    const toggleBand = (band) => {
        setBandFilter((prev) =>
            prev.includes(band) ? prev.filter((b) => b !== band) : [...prev, band]
        );
    };

    const BANDS = [
        { label: "High", color: "bg-[var(--color-high)]", activeText: "text-white" },
        { label: "Medium", color: "bg-[var(--color-medium)]", activeText: "text-white" },
        { label: "Low", color: "bg-[var(--color-low)]", activeText: "text-white" },
    ];

    return (
        <div className="bg-white border border-[var(--color-border)] rounded-lg p-4 mb-4 flex flex-wrap items-center gap-4">
            {/* Band toggles */}
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mr-1">
                    Band
                </span>
                {BANDS.map((b) => {
                    const active = bandFilter.includes(b.label);
                    return (
                        <button
                            key={b.label}
                            onClick={() => toggleBand(b.label)}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors border ${active
                                    ? `${b.color} ${b.activeText} border-transparent`
                                    : "bg-white text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-text-muted)]"
                                }`}
                        >
                            {b.label}
                        </button>
                    );
                })}
            </div>

            {/* Neighbourhood dropdown */}
            <select
                value={neighbourhoodFilter}
                onChange={(e) => setNeighbourhoodFilter(e.target.value)}
                className="border border-[var(--color-border)] rounded px-3 py-1.5 text-sm bg-white text-[var(--color-text)]"
            >
                <option value="">All Neighbourhoods</option>
                {uniqueNeighbourhoods.map((n) => (
                    <option key={n} value={n}>{n}</option>
                ))}
            </select>

            {/* Referral dropdown */}
            <select
                value={referralFilter}
                onChange={(e) => setReferralFilter(e.target.value)}
                className="border border-[var(--color-border)] rounded px-3 py-1.5 text-sm bg-white text-[var(--color-text)]"
            >
                <option value="">All Referral Sources</option>
                {uniqueReferrals.map((r) => (
                    <option key={r} value={r}>{r}</option>
                ))}
            </select>

            {/* Sort toggle */}
            <button
                onClick={() => setSortAsc((p) => !p)}
                className="px-3 py-1.5 rounded text-sm border border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] transition-colors"
            >
                {sortAsc ? "↑ Lowest First" : "↓ Highest First"}
            </button>

            {/* Export */}
            <button
                onClick={onExport}
                className="px-3 py-1.5 rounded text-sm border border-[var(--color-brand)] text-[var(--color-brand)] hover:bg-blue-50 transition-colors ml-auto"
            >
                Export CSV
            </button>

            {/* Count */}
            <span className="text-sm text-[var(--color-text-muted)]">
                Showing {filteredCount} of {leads.length} leads
            </span>
        </div>
    );
}
