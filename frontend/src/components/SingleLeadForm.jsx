import { useState } from "react";
import { scoreSingleLead } from "../services/api";
import ShapChart from "./ShapChart";

/* ── Field definitions ───────────────────────────────────── */
const DROPDOWNS = {
    property_type: {
        label: "Property type",
        options: ["Townhouse", "Detached", "Apartment", "Semi-Detached", "Heritage"],
    },
    neighbourhood: {
        label: "Neighbourhood",
        options: [
            "Downtown", "West End", "Sydenham Ward", "Portsmouth Village",
            "Strathcona Park", "Williamsville", "Kingscourt", "Inner Harbour",
            "Calvin Park", "Cataraqui",
        ],
    },
    requested_timeline: {
        label: "Timeline",
        options: ["Flexible", "1 month", "1-2 weeks", "ASAP"],
    },
    referral_source: {
        label: "Referral source",
        options: ["Facebook Ads", "Door-to-Door", "Lawn Signs", "Word of Mouth/Referral", "Google Ads"],
    },
    homeowner_status: {
        label: "Homeowner status",
        options: ["Own", "Rent"],
    },
    preferred_contact: {
        label: "Preferred contact",
        options: ["Email", "SMS", "Phone Call"],
    },
    lead_capture_weather: {
        label: "Weather at capture",
        options: ["Sunny", "Cloudy", "Rain", "Snow", "Windy"],
    },
    customer_age_bracket: {
        label: "Age group",
        options: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
    },
    lead_weekday: {
        label: "Day of week",
        options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    },
    lead_month: {
        label: "Month",
        options: [
            { value: 1, label: "January" }, { value: 2, label: "February" },
            { value: 3, label: "March" }, { value: 4, label: "April" },
            { value: 5, label: "May" }, { value: 6, label: "June" },
            { value: 7, label: "July" }, { value: 8, label: "August" },
            { value: 9, label: "September" }, { value: 10, label: "October" },
            { value: 11, label: "November" }, { value: 12, label: "December" },
        ],
    },
};

const INITIAL = {
    property_type: "", neighbourhood: "", estimated_job_size_sqft: "",
    requested_timeline: "", referral_source: "", homeowner_status: "",
    preferred_contact: "", lead_capture_weather: "", distance_to_queens_km: "",
    customer_age_bracket: "", has_pets: false, lead_weekday: "", lead_month: "",
};

/* ── Row layout: pairs of fields ─────────────────────────── */
const ROWS = [
    { section: "Property details", fields: ["property_type", "neighbourhood"] },
    { fields: ["estimated_job_size_sqft", "requested_timeline"] },
    { section: "Lead context", fields: ["referral_source", "homeowner_status"] },
    { fields: ["preferred_contact", "customer_age_bracket"] },
    { section: "Timing & location", fields: ["lead_weekday", "lead_month"] },
    { fields: ["distance_to_queens_km", "lead_capture_weather"] },
    { fields: ["has_pets"] },
];

const BAND_COLORS = {
    High: "var(--color-high)",
    Medium: "var(--color-medium)",
    Low: "var(--color-low)",
};

/* ── Component ───────────────────────────────────────────── */
export default function SingleLeadForm({ disabled }) {
    const [form, setForm] = useState(INITIAL);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const set = (field) => (e) => {
        const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        setForm((prev) => ({ ...prev, [field]: val }));
    };

    const isValid = () => {
        const { estimated_job_size_sqft, distance_to_queens_km, has_pets, ...rest } = form;
        return (
            Object.values(rest).every((v) => v !== "") &&
            Number(estimated_job_size_sqft) > 0 &&
            Number(estimated_job_size_sqft) <= 5000 &&
            Number(distance_to_queens_km) >= 0 &&
            estimated_job_size_sqft !== "" &&
            distance_to_queens_km !== ""
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isValid()) return;
        setLoading(true);
        setError(null);
        try {
            const payload = {
                ...form,
                estimated_job_size_sqft: Number(form.estimated_job_size_sqft),
                distance_to_queens_km: Number(form.distance_to_queens_km),
                lead_month: Number(form.lead_month),
                has_pets: Boolean(form.has_pets),
            };
            setResult(await scoreSingleLead(payload));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const inputBase =
        "w-full border-b bg-transparent text-sm py-2 outline-none transition-colors " +
        "border-[var(--color-border)] focus:border-[var(--color-brand)] " +
        "placeholder:text-[var(--color-text-muted)]";

    const renderField = (field) => {
        if (field === "has_pets") {
            return (
                <label key={field} className="flex items-center gap-2 py-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.has_pets}
                        onChange={set("has_pets")}
                        className="accent-[var(--color-brand)] w-4 h-4"
                    />
                    <span className="text-sm">Has pets</span>
                </label>
            );
        }
        if (field === "estimated_job_size_sqft") {
            return (
                <div key={field} className="flex-1 min-w-0">
                    <input
                        type="number" min={1} max={5000}
                        value={form.estimated_job_size_sqft}
                        onChange={set("estimated_job_size_sqft")}
                        placeholder="Job size (sqft)"
                        className={inputBase}
                    />
                </div>
            );
        }
        if (field === "distance_to_queens_km") {
            return (
                <div key={field} className="flex-1 min-w-0">
                    <input
                        type="number" min={0} max={15} step={0.1}
                        value={form.distance_to_queens_km}
                        onChange={set("distance_to_queens_km")}
                        placeholder="Distance to Queens (km)"
                        className={inputBase}
                    />
                </div>
            );
        }
        const { label: lbl, options } = DROPDOWNS[field];
        return (
            <div key={field} className="flex-1 min-w-0">
                <select value={form[field]} onChange={set(field)} className={inputBase}>
                    <option value="">{lbl}</option>
                    {options.map((opt) => {
                        const val = typeof opt === "object" ? opt.value : opt;
                        const text = typeof opt === "object" ? opt.label : opt;
                        return <option key={val} value={val}>{text}</option>;
                    })}
                </select>
            </div>
        );
    };

    return (
        <div>
            {/* Page heading */}
            <h2
                className="text-xl font-semibold mb-6"
                style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
            >
                Score a Lead
            </h2>

            {/* ── Result card ─────────────────────────────────── */}
            {result && (
                <div className="bg-white border rounded-lg p-6 mb-6" style={{ borderColor: "var(--color-border)" }}>
                    <div className="flex items-start justify-between mb-5">
                        <div className="flex items-baseline gap-3">
                            <span
                                className="text-4xl font-bold"
                                style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
                            >
                                {result.priority_score}
                            </span>
                            <span
                                className="text-xs font-semibold px-2 py-0.5 rounded text-white"
                                style={{ backgroundColor: BAND_COLORS[result.profit_band] || "#888" }}
                            >
                                {result.profit_band}
                            </span>
                            <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                {Math.round(result.confidence * 100)}% confidence
                            </span>
                        </div>
                        <button
                            onClick={() => setResult(null)}
                            className="text-xs hover:underline"
                            style={{ color: "var(--color-text-muted)" }}
                        >
                            Dismiss
                        </button>
                    </div>
                    <ShapChart reasons={result.top_reasons} profitBand={result.profit_band} />
                </div>
            )}

            {/* ── Form card ───────────────────────────────────── */}
            <form
                onSubmit={handleSubmit}
                className="bg-white border rounded-lg px-6 py-5"
                style={{ borderColor: "var(--color-border)" }}
            >
                {ROWS.map((row, ri) => (
                    <div key={ri}>
                        {/* Section label */}
                        {row.section && (
                            <div
                                className={`text-[10px] font-semibold uppercase tracking-[0.05em] ${ri > 0 ? "mt-5 pt-5 border-t" : ""}`}
                                style={{
                                    color: "var(--color-text-muted)",
                                    borderColor: "var(--color-border)",
                                    marginBottom: "8px",
                                }}
                            >
                                {row.section}
                            </div>
                        )}
                        <div className="flex gap-4">
                            {row.fields.map(renderField)}
                        </div>
                    </div>
                ))}

                <button
                    type="submit"
                    disabled={disabled || loading || !isValid()}
                    className="mt-5 w-full py-2.5 rounded-md text-sm font-semibold text-white transition-all disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90"
                    style={{ backgroundColor: "var(--color-brand)" }}
                >
                    {loading ? "Scoring…" : "Score This Lead"}
                </button>
            </form>

            {error && (
                <div className="mt-3 bg-[var(--color-low-bg)] text-[var(--color-low)] px-4 py-2.5 rounded text-xs">
                    {error}
                </div>
            )}
        </div>
    );
}
