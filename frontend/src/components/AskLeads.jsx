import { useState, useRef, useEffect } from "react";
import { askAboutLeads } from "../services/api";

const SUGGESTIONS = [
    "What neighborhoods produce the best leads?",
    "Which referral sources should we invest in?",
    "What makes a lead score high?",
    "Summarize today's batch",
];

export default function AskLeads({ open, onClose, leadsCount }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const sendQuestion = async (question) => {
        if (!question.trim() || loading) return;

        const userMsg = { role: "user", content: question.trim() };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput("");
        setLoading(true);

        try {
            const history = updatedMessages.slice(0, -1); // everything before the new question
            const res = await askAboutLeads(question.trim(), history);
            setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: `Sorry, something went wrong: ${err.message}` },
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        sendQuestion(input);
    };

    return (
        <>
            {/* Backdrop */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/20 z-40 transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Drawer */}
            <div
                className="fixed top-0 right-0 h-full w-[400px] max-w-[90vw] bg-white z-50 flex flex-col shadow-xl transition-transform duration-200"
                style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
                    <div>
                        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                            Ask About Leads
                        </h3>
                        <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                            {leadsCount > 0 ? `${leadsCount} leads loaded` : "No leads"}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-lg leading-none px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                        style={{ color: "var(--color-text-muted)" }}
                    >
                        ✕
                    </button>
                </div>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {/* Empty state */}
                    {messages.length === 0 && !loading && (
                        <div className="text-center pt-8">
                            {leadsCount === 0 ? (
                                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                                    Score some leads first, then ask me anything about them.
                                </p>
                            ) : (
                                <>
                                    <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
                                        Ask anything about your scored leads
                                    </p>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {SUGGESTIONS.map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => sendQuestion(s)}
                                                className="text-[11px] px-3 py-1.5 rounded-full border transition-all hover:bg-gray-50"
                                                style={{
                                                    borderColor: "var(--color-border)",
                                                    color: "var(--color-text)",
                                                }}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Chat bubbles */}
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div
                                className="max-w-[85%] px-3 py-2 rounded-lg text-[13px] leading-relaxed whitespace-pre-wrap"
                                style={
                                    msg.role === "user"
                                        ? { backgroundColor: "var(--color-brand)", color: "white" }
                                        : { backgroundColor: "var(--color-surface-alt)", color: "var(--color-text)" }
                                }
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))}

                    {/* Loading dots */}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--color-surface-alt)" }}>
                                <div className="flex gap-1">
                                    {[0, 1, 2].map((d) => (
                                        <span
                                            key={d}
                                            className="w-1.5 h-1.5 rounded-full animate-pulse"
                                            style={{
                                                backgroundColor: "var(--color-text-muted)",
                                                animationDelay: `${d * 0.2}s`,
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={endRef} />
                </div>

                {/* Input bar */}
                <form onSubmit={handleSubmit} className="border-t px-4 py-3 flex gap-2" style={{ borderColor: "var(--color-border)" }}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={loading || leadsCount === 0}
                        placeholder={leadsCount === 0 ? "Score leads first…" : "Ask a question…"}
                        className="flex-1 text-sm border rounded-md px-3 py-2 outline-none transition-colors disabled:opacity-50"
                        style={{
                            borderColor: "var(--color-border)",
                            color: "var(--color-text)",
                        }}
                        onFocus={(e) => (e.target.style.borderColor = "var(--color-brand)")}
                        onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
                    />
                    <button
                        type="submit"
                        disabled={loading || !input.trim() || leadsCount === 0}
                        className="px-4 py-2 rounded-md text-sm font-medium text-white transition-all disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90"
                        style={{ backgroundColor: "var(--color-brand)" }}
                    >
                        Send
                    </button>
                </form>
            </div>
        </>
    );
}
