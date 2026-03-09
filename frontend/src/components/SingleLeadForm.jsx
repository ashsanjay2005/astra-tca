import { useState } from "react";
import { scoreSingleLead } from "../services/api";
import LeadCard from "./LeadCard";

const DROPDOWNS = {
    property_type: {
        label: "Property Type",
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
        label: "Referral Source",
        options: ["Facebook Ads", "Door-to-Door", "Lawn Signs", "Word of Mouth/Referral", "Google Ads"],
    },
    homeowner_status: {
        label: "Homeowner Status",
        options: ["Own", "Rent"],
    },
    preferred_contact: {
        label: "Preferred Contact",
        options: ["Email", "SMS", "Phone Call"],
    },
    lead_capture_weather: {
        label: "Weather at Capture",
        options: ["Sunny", "Cloudy", "Rain", "Snow", "Windy"],
    },
    customer_age_bracket: {
        label: "Age Group",
        options: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
    },
    lead_weekday: {
        label: "Day of Week",
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

const INITIAL_STATE = {
    property_type: "",
    neighbourhood: "",
    estimated_job_size_sqft: "",
    requested_timeline: "",
    referral_source: "",
    homeowner_status: "",
    preferred_contact: "",
    lead_capture_weather: "",
    distance_to_queens_km: "",
    customer_age_bracket: "",
    has_pets: false,
    lead_weekday: "",
    lead_month: "",
};

export default function SingleLeadForm({ disabled }) {
    const [form, setForm] = useState(INITIAL_STATE);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const set = (field) => (e) => {
        const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        setForm((prev) => ({ ...prev, [field]: val }));
    };

    const isValid = () => {
        const { estimated_job_size_sqft, distance_to_queens_km, has_pets, ...rest } = form;
        const allFilled = Object.values(rest).every((v) => v !== "");
        const sqft = Number(estimated_job_size_sqft);
        const dist = Number(distance_to_queens_km);
        return allFilled && sqft > 0 && sqft <= 5000 && dist >= 0 && estimated_job_size_sqft !== "" && distance_to_queens_km !== "";
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
            const res = await scoreSingleLead(payload);
            setResult(res);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const selectClasses =
        "w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-white text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-opacity-30";
    const labelClasses = "block text-sm font-medium text-[var(--color-text-muted)] mb-1";

    const renderDropdown = (field) => {
        const { label, options } = DROPDOWNS[field];
        return (
            <div key={field}>
                <label className={labelClasses}>{label}</label>
                <select value={form[field]} onChange={set(field)} className={selectClasses}>
                    <option value="">Select {label.toLowerCase()}…</option>
                    {options.map((opt) => {
                        const val = typeof opt === "object" ? opt.value : opt;
                        const lbl = typeof opt === "object" ? opt.label : opt;
                        return (
                            <option key={val} value={val}>{lbl}</option>
                        );
                    })}
                </select>
            </div>
        );
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <div className="bg-white border border-[var(--color-border)] rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        {/* Left column — Property info */}
                        {renderDropdown("property_type")}
                        {renderDropdown("neighbourhood")}
                        <div>
                            <label className={labelClasses}>Job Size (sqft)</label>
                            <input
                                type="number"
                                min={1}
                                max={5000}
                                step={1}
                                value={form.estimated_job_size_sqft}
                                onChange={set("estimated_job_size_sqft")}
                                placeholder="e.g. 1200"
                                className={selectClasses}
                            />
                        </div>
                        {renderDropdown("requested_timeline")}
                        {renderDropdown("referral_source")}
                        {renderDropdown("homeowner_status")}
                        {renderDropdown("preferred_contact")}

                        {/* Right column — Lead info */}
                        {renderDropdown("lead_capture_weather")}
                        <div>
                            <label className={labelClasses}>Distance to Queens (km)</label>
                            <input
                                type="number"
                                min={0}
                                max={15}
                                step={0.1}
                                value={form.distance_to_queens_km}
                                onChange={set("distance_to_queens_km")}
                                placeholder="e.g. 3.5"
                                className={selectClasses}
                            />
                        </div>
                        {renderDropdown("customer_age_bracket")}
                        {renderDropdown("lead_weekday")}
                        {renderDropdown("lead_month")}

                        {/* Checkbox */}
                        <div className="flex items-center gap-2 md:col-span-2">
                            <input
                                type="checkbox"
                                id="has_pets"
                                checked={form.has_pets}
                                onChange={set("has_pets")}
                                className="w-4 h-4 rounded border-[var(--color-border)]"
                            />
                            <label htmlFor="has_pets" className="text-sm text-[var(--color-text)]">
                                Has pets
                            </label>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="mt-6">
                        <button
                            type="submit"
                            disabled={disabled || loading || !isValid()}
                            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white bg-[var(--color-brand)] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? (
                                <span className="inline-flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Scoring…
                                </span>
                            ) : (
                                "Score This Lead"
                            )}
                        </button>
                    </div>
                </div>
            </form>

            {/* Error */}
            {error && (
                <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Result */}
            {result && (
                <div className="mt-6">
                    <h3 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                        Result
                    </h3>
                    <LeadCard
                        profitBand={result.profit_band}
                        priorityScore={result.priority_score}
                        confidence={result.confidence}
                        topReasons={result.top_reasons}
                        inputSummary={result.input_summary}
                    />
                </div>
            )}
        </div>
    );
}
