export default function SummaryBar({ high, medium, low, total, droppedRows, lastPulled }) {
    const pHigh = total > 0 ? (high / total) * 100 : 0;
    const pMedium = total > 0 ? (medium / total) * 100 : 0;
    const pLow = total > 0 ? (low / total) * 100 : 0;

    return (
        <div className="bg-white border rounded-lg p-5 mb-5" style={{ borderColor: "var(--color-border)" }}>
            {/* Stacked bar */}
            <div className="h-2.5 rounded-full overflow-hidden flex" style={{ backgroundColor: "#F0F0F0" }}>
                {pHigh > 0 && (
                    <div style={{ width: `${pHigh}%`, backgroundColor: "var(--color-high)", transition: "width 0.5s" }} />
                )}
                {pMedium > 0 && (
                    <div style={{ width: `${pMedium}%`, backgroundColor: "var(--color-medium)", transition: "width 0.5s" }} />
                )}
                {pLow > 0 && (
                    <div style={{ width: `${pLow}%`, backgroundColor: "var(--color-low)", transition: "width 0.5s" }} />
                )}
            </div>

            {/* Stats line */}
            <div className="flex flex-wrap items-center gap-5 mt-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-high)" }} />
                    <span className="font-semibold" style={{ color: "var(--color-text)" }}>{high}</span> High
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-medium)" }} />
                    <span className="font-semibold" style={{ color: "var(--color-text)" }}>{medium}</span> Medium
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-low)" }} />
                    <span className="font-semibold" style={{ color: "var(--color-text)" }}>{low}</span> Low
                </span>
                <span className="ml-auto">
                    <span className="font-semibold" style={{ color: "var(--color-text)" }}>{total}</span> leads scored
                    {droppedRows > 0 && <span> · {droppedRows} skipped</span>}
                    {lastPulled && <span> · Last pulled: {lastPulled}</span>}
                </span>
            </div>
        </div>
    );
}
