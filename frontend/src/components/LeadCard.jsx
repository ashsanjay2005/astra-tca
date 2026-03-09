import { useState } from "react";
import { ShapPills } from "./ShapChart";
import ShapChart from "./ShapChart";

const BAND_BG = {
    High: "var(--color-high)",
    Medium: "var(--color-medium)",
    Low: "var(--color-low)",
};

const DETAIL_LABELS = {
    property_type: "Property",
    neighbourhood: "Area",
    estimated_job_size_sqft: "Size",
    requested_timeline: "Timeline",
    referral_source: "Referral",
    homeowner_status: "Owner",
    preferred_contact: "Contact",
    customer_age_bracket: "Age",
    has_pets: "Pets",
    lead_capture_weather: "Weather",
    distance_to_queens_km: "Distance",
    lead_weekday: "Day",
    lead_month: "Month",
};

// Fields to hide from the user-facing detail grid
const HIDDEN_FIELDS = new Set([
    "lead_id", "lead_date", "customer_name", "expected_profit_band",
    "customer_email", "customer_phone",
]);

function fmtVal(key, val) {
    if (val === null || val === undefined) return "—";
    if (val === true) return "Yes";
    if (val === false) return "No";
    if (key === "estimated_job_size_sqft") return `${val} sqft`;
    if (key === "distance_to_queens_km") return `${val} km`;
    return String(val);
}

export default function LeadCard({ profitBand, priorityScore, confidence, topReasons, inputSummary, rank }) {
    const [expanded, setExpanded] = useState(false);
    const confPct = Math.round(confidence * 100);

    const handleCopy = () => {
        const lines = [
            `#${rank} — ${profitBand} (Score: ${priorityScore}, Confidence: ${confPct}%)`,
            "",
            ...Object.entries(inputSummary || {})
                .filter(([k]) => !HIDDEN_FIELDS.has(k))
                .map(([k, v]) => `${DETAIL_LABELS[k] || k}: ${fmtVal(k, v)}`),
        ];
        navigator.clipboard.writeText(lines.join("\n"));
    };

    // Visible detail entries
    const details = Object.entries(inputSummary || {}).filter(([k, v]) => !HIDDEN_FIELDS.has(k) && v !== null);

    return (
        <div className="border-b" style={{ borderColor: "var(--color-border)" }}>
            {/* ── Row (collapsed) ──────────────────────────────── */}
            <button
                type="button"
                onClick={() => setExpanded((p) => !p)}
                className="w-full text-left py-3 px-1 flex items-center gap-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
            >
                {/* Rank */}
                <span className="text-[11px] w-7 shrink-0" style={{ color: "var(--color-text-muted)" }}>
                    #{rank}
                </span>

                {/* Score pill */}
                <span
                    className="inline-flex items-center justify-center w-9 h-6 rounded text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: BAND_BG[profitBand] || "#888" }}
                >
                    {priorityScore}
                </span>

                {/* SHAP tags */}
                <div className="flex-1 min-w-0">
                    <ShapPills reasons={topReasons} profitBand={profitBand} />
                </div>

                {/* Metadata */}
                <div className="hidden md:flex items-center gap-0 text-[11px] shrink-0" style={{ color: "var(--color-text-muted)" }}>
                    {inputSummary?.neighbourhood && <span>{inputSummary.neighbourhood}</span>}
                    {inputSummary?.estimated_job_size_sqft && <span>&nbsp;·&nbsp;{inputSummary.estimated_job_size_sqft} sqft</span>}
                    {inputSummary?.requested_timeline && <span>&nbsp;·&nbsp;{inputSummary.requested_timeline}</span>}
                    {inputSummary?.homeowner_status && <span>&nbsp;·&nbsp;{inputSummary.homeowner_status}</span>}
                    <span>&nbsp;·&nbsp;{confPct}%</span>
                </div>

                {/* Chevron */}
                <span
                    className="text-[10px] shrink-0 transition-transform duration-200"
                    style={{
                        color: "var(--color-text-muted)",
                        transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                >
                    ▾
                </span>
            </button>

            {/* ── Expanded panel ───────────────────────────────── */}
            <div
                style={{
                    maxHeight: expanded ? "600px" : "0",
                    opacity: expanded ? 1 : 0,
                    overflow: "hidden",
                    transition: "max-height 0.2s ease, opacity 0.15s ease",
                }}
            >
                <div className="px-1 pb-4 pt-1">
                    {/* Waterfall */}
                    <div className="mb-4">
                        <ShapChart reasons={topReasons} profitBand={profitBand} />
                    </div>

                    {/* Detail grid — 3 columns, human-readable labels */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 mb-3">
                        {details.map(([key, val]) => (
                            <div key={key} className="text-[11px]">
                                <span style={{ color: "var(--color-text-muted)" }}>
                                    {DETAIL_LABELS[key] || key.replace(/_/g, " ")}:
                                </span>{" "}
                                <span className="font-medium" style={{ color: "var(--color-text)" }}>
                                    {fmtVal(key, val)}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Copy */}
                    <button
                        onClick={handleCopy}
                        className="text-[11px] hover:underline"
                        style={{ color: "var(--color-text-muted)" }}
                    >
                        Copy details
                    </button>
                </div>
            </div>
        </div>
    );
}
