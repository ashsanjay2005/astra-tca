/**
 * ShapChart — SHAP feature contribution visualizations.
 *
 * Exports:
 *   ShapPills  — compact directional pills for collapsed lead rows
 *   ShapChart  — full horizontal waterfall chart (default export)
 *
 * SHAP Direction Logic:
 *   The backend returns SHAP values FOR THE PREDICTED CLASS.
 *   - High leads: positive SHAP = pushing toward High = GOOD for the lead
 *   - Low leads:  positive SHAP = pushing toward Low  = BAD for the lead
 *   - Medium:     ambiguous — show both directions
 *
 *   So for LOW leads we INVERT the display: backend "positive" → red ↓
 *
 * TODO: Backend currently returns top-N by absolute magnitude which may
 * be all in one direction. For ideal display, src/model.py explain()
 * should return top positive AND top negative SHAP contributors separately.
 */

const FEATURE_LABELS = {
    estimated_job_size_sqft: "Job Size",
    distance_to_queens_km: "Distance",
    referral_source: "Referral",
    neighbourhood: "Area",
    homeowner_status: "Owner Status",
    requested_timeline: "Timeline",
    season: "Season",
    distance_band: "Distance Band",
    weather_binary: "Weather",
    customer_age_bracket: "Age",
    has_pets: "Pets",
    lead_weekday: "Day",
    property_type: "Property",
    job_size_tier: "Job Tier",
    is_large_and_close: "Large & Close",
    is_homeowner_detached: "Owner + Detached",
    sqft_per_km: "Size/Distance",
    lead_month_sin: "Seasonality",
    lead_month_cos: "Seasonality",
    age_ordinal: "Age",
    timeline_urgency: "Urgency",
    preferred_contact: "Contact",
    lead_capture_weather: "Weather",
};

function label(feature) {
    return FEATURE_LABELS[feature] || feature.replace(/_/g, " ");
}

/**
 * Map backend direction to DISPLAY direction based on predicted band.
 * For Low leads, invert: backend "positive" → display "negative" (red ↓)
 */
function displayDirection(backendDirection, profitBand) {
    if (profitBand === "Low") {
        return backendDirection === "positive" ? "negative" : "positive";
    }
    return backendDirection;
}

/**
 * Get directional reasons for compact pill display:
 * - High:   top 2-3 positive (green ↑)
 * - Low:    top 2-3 negative (red ↓) — inverted from backend
 * - Medium: #1 positive + #1 negative
 */
function getPillReasons(reasons, profitBand) {
    if (!reasons || !reasons.length) return [];

    // Map to display directions
    const mapped = reasons.map((r) => ({
        ...r,
        displayDir: displayDirection(r.direction, profitBand),
    }));

    const positive = mapped.filter((r) => r.displayDir === "positive");
    const negative = mapped.filter((r) => r.displayDir === "negative");

    switch (profitBand) {
        case "High":
            return (positive.length > 0 ? positive : mapped).slice(0, 3);
        case "Low":
            return (negative.length > 0 ? negative : mapped).slice(0, 3);
        case "Medium":
        default: {
            const out = [];
            if (positive.length) out.push(positive[0]);
            if (negative.length) out.push(negative[0]);
            return out.length ? out : mapped.slice(0, 2);
        }
    }
}

/** Compact pill display — used in collapsed lead rows */
export function ShapPills({ reasons, profitBand }) {
    const pills = getPillReasons(reasons, profitBand);

    return (
        <div className="flex flex-wrap gap-1">
            {pills.map((r, i) => {
                const isGood = r.displayDir === "positive";
                return (
                    <span
                        key={i}
                        className="inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                            color: isGood ? "var(--color-high)" : "var(--color-low)",
                            backgroundColor: isGood ? "var(--color-high-bg)" : "var(--color-low-bg)",
                        }}
                    >
                        {label(r.feature)}
                        <span className="text-[9px]">{isGood ? "↑" : "↓"}</span>
                    </span>
                );
            })}
        </div>
    );
}

/** Full waterfall bar chart — sorted by absolute magnitude */
export default function ShapChart({ reasons, profitBand }) {
    if (!reasons || !reasons.length) return null;

    // Sort by absolute impact descending
    const sorted = [...reasons].sort((a, b) => b.impact - a.impact);
    const maxImpact = Math.max(...sorted.map((r) => r.impact), 0.001);

    return (
        <div>
            <div className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>
                Feature Contributions
            </div>
            <div className="space-y-1">
                {sorted.map((r, i) => {
                    const dir = displayDirection(r.direction, profitBand);
                    const isPositive = dir === "positive";
                    const barPct = (r.impact / maxImpact) * 100;

                    return (
                        <div key={i} className="flex items-center gap-2 h-5">
                            {/* Label */}
                            <div
                                className="w-24 text-right text-[11px] truncate shrink-0"
                                style={{ color: "var(--color-text-muted)" }}
                            >
                                {label(r.feature)}
                            </div>

                            {/* Bar area — centered zero line */}
                            <div className="flex-1 flex items-center">
                                {/* Negative half */}
                                <div className="w-1/2 flex justify-end">
                                    {!isPositive && (
                                        <div
                                            className="h-3.5 rounded-l-sm"
                                            style={{
                                                width: `${barPct}%`,
                                                backgroundColor: "var(--color-low)",
                                                opacity: 0.75,
                                                transition: "width 0.4s ease",
                                            }}
                                        />
                                    )}
                                </div>
                                {/* Zero line */}
                                <div className="w-px h-4 shrink-0" style={{ backgroundColor: "var(--color-border)" }} />
                                {/* Positive half */}
                                <div className="w-1/2">
                                    {isPositive && (
                                        <div
                                            className="h-3.5 rounded-r-sm"
                                            style={{
                                                width: `${barPct}%`,
                                                backgroundColor: "var(--color-high)",
                                                opacity: 0.75,
                                                transition: "width 0.4s ease",
                                            }}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Value */}
                            <div
                                className="text-[10px] font-medium w-12 shrink-0"
                                style={{ color: isPositive ? "var(--color-high)" : "var(--color-low)" }}
                            >
                                {isPositive ? "+" : "−"}{r.impact.toFixed(3)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
