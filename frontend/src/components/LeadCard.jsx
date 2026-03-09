const FEATURE_LABELS = {
    estimated_job_size_sqft: "Job Size",
    distance_to_queens_km: "Distance",
    referral_source: "Referral Source",
    neighbourhood: "Neighbourhood",
    homeowner_status: "Homeowner",
    requested_timeline: "Timeline",
    season: "Season",
    distance_band: "Distance Band",
    weather_binary: "Weather",
    customer_age_bracket: "Age Group",
    has_pets: "Has Pets",
    lead_weekday: "Day of Week",
    property_type: "Property Type",
};

const BAND_STYLES = {
    High: {
        bg: "bg-[var(--color-high)]",
        border: "border-l-[var(--color-high)]",
        text: "text-white",
    },
    Medium: {
        bg: "bg-[var(--color-medium)]",
        border: "border-l-[var(--color-medium)]",
        text: "text-white",
    },
    Low: {
        bg: "bg-[var(--color-low)]",
        border: "border-l-[var(--color-low)]",
        text: "text-white",
    },
};

export default function LeadCard({ profitBand, priorityScore, confidence, topReasons, inputSummary, rank }) {
    const style = BAND_STYLES[profitBand] || BAND_STYLES.Low;

    return (
        <div
            className={`bg-white rounded-lg border border-[var(--color-border)] border-l-4 ${style.border} p-5 flex flex-col sm:flex-row gap-4`}
        >
            {/* Left — Rank + Score + Band */}
            <div className="flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1 sm:min-w-[100px]">
                {rank != null && (
                    <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                        #{rank}
                    </span>
                )}
                <span className="text-3xl font-bold text-[var(--color-text)]">
                    {priorityScore}
                </span>
                <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}
                >
                    {profitBand}
                </span>
            </div>

            {/* Middle — Reasons */}
            <div className="flex-1 flex flex-col gap-2">
                <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    Top Reasons
                </span>
                <div className="flex flex-wrap gap-2">
                    {(topReasons || []).map((r, i) => (
                        <span
                            key={i}
                            className="inline-flex items-center gap-1 text-sm bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded px-2.5 py-1"
                        >
                            {FEATURE_LABELS[r.feature] || r.feature}
                            <span
                                className={
                                    r.direction === "positive"
                                        ? "text-[var(--color-high)]"
                                        : "text-[var(--color-low)]"
                                }
                            >
                                {r.direction === "positive" ? "↑" : "↓"}
                            </span>
                        </span>
                    ))}
                </div>
            </div>

            {/* Right — Summary attributes */}
            <div className="sm:min-w-[180px] flex flex-col gap-1 text-sm">
                {inputSummary?.neighbourhood && (
                    <div>
                        <span className="text-[var(--color-text-muted)]">Area: </span>
                        {inputSummary.neighbourhood}
                    </div>
                )}
                {inputSummary?.estimated_job_size_sqft && (
                    <div>
                        <span className="text-[var(--color-text-muted)]">Size: </span>
                        {inputSummary.estimated_job_size_sqft} sqft
                    </div>
                )}
                {inputSummary?.requested_timeline && (
                    <div>
                        <span className="text-[var(--color-text-muted)]">Timeline: </span>
                        {inputSummary.requested_timeline}
                    </div>
                )}
                {inputSummary?.homeowner_status && (
                    <div>
                        <span className="text-[var(--color-text-muted)]">Owner: </span>
                        {inputSummary.homeowner_status}
                    </div>
                )}
            </div>

            {/* Bottom-right — Confidence */}
            <div className="sm:self-end text-xs text-[var(--color-text-muted)]">
                {Math.round(confidence * 100)}% confidence
            </div>
        </div>
    );
}
