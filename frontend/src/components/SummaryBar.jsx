export default function SummaryBar({ high, medium, low, total, droppedRows }) {
    const boxes = [
        { label: "High", count: high, color: "bg-[var(--color-high)]", textColor: "text-white" },
        { label: "Medium", count: medium, color: "bg-[var(--color-medium)]", textColor: "text-white" },
        { label: "Low", count: low, color: "bg-[var(--color-low)]", textColor: "text-white" },
    ];

    return (
        <div className="flex flex-wrap gap-3 mb-4">
            {boxes.map((b) => (
                <div
                    key={b.label}
                    className={`${b.color} ${b.textColor} rounded-lg px-5 py-3 min-w-[100px]`}
                >
                    <div className="text-2xl font-bold">{b.count}</div>
                    <div className="text-sm opacity-90">{b.label}</div>
                </div>
            ))}
            <div className="bg-white border border-[var(--color-border)] rounded-lg px-5 py-3 min-w-[100px]">
                <div className="text-2xl font-bold text-[var(--color-text)]">{total}</div>
                <div className="text-sm text-[var(--color-text-muted)]">
                    Total
                    {droppedRows > 0 && (
                        <span className="block text-xs text-[var(--color-text-muted)]">
                            ({droppedRows} row{droppedRows !== 1 ? "s" : ""} skipped)
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
