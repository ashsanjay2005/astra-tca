/**
 * LandingPage — CREO-style hero + 3-column features grid.
 * Shown as default view before the user enters the tool.
 */

export default function LandingPage({ onNavigate }) {
    return (
        <div className="min-h-screen flex flex-col">
            {/* ── Hero ────────────────────────────────────────── */}
            <section
                className="flex-1 flex flex-col items-center justify-center px-6 py-24"
                style={{ backgroundColor: "var(--color-nav)" }}
            >
                <h1
                    className="text-5xl md:text-6xl font-bold text-white tracking-tight mb-3"
                    style={{ fontFamily: "var(--font-heading)" }}
                >
                    ASTRA
                </h1>
                <p className="text-sm tracking-[0.2em] uppercase mb-8" style={{ color: "var(--color-text-muted)" }}>
                    Powered by CREO Solutions
                </p>
                <p className="text-lg text-gray-300 max-w-md text-center mb-10 leading-relaxed">
                    AI-powered lead intelligence for residential painting teams
                </p>

                <div className="flex gap-4">
                    <button
                        onClick={() => onNavigate(0)}
                        className="px-8 py-3 rounded-md text-sm font-semibold text-white transition-all hover:opacity-90"
                        style={{ backgroundColor: "var(--color-brand)" }}
                    >
                        Score a Lead
                    </button>
                    <button
                        onClick={() => onNavigate(1)}
                        className="px-8 py-3 rounded-md text-sm font-semibold border transition-all hover:bg-white/5"
                        style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)" }}
                    >
                        Score New Leads
                    </button>
                </div>
            </section>

            {/* ── Features ────────────────────────────────────── */}
            <section className="bg-white px-6 py-16">
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
                    {[
                        {
                            title: "Instant Scoring",
                            desc: "Score any lead in seconds using our trained ML model",
                        },
                        {
                            title: "Explainable AI",
                            desc: "Understand exactly why each lead scored high or low",
                        },
                        {
                            title: "Supabase Integration",
                            desc: "Pull unscored leads directly from your database",
                        },
                    ].map((f) => (
                        <div
                            key={f.title}
                            className="border rounded-lg p-6"
                            style={{ borderColor: "var(--color-border)" }}
                        >
                            <h3 className="text-base font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                                {f.title}
                            </h3>
                            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                                {f.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Footer ──────────────────────────────────────── */}
            <footer className="bg-white border-t px-6 py-6 text-center text-xs" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
                © 2026 CREO Solutions · ASTRA Lead Intelligence Platform
            </footer>
        </div>
    );
}
