const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function scoreSingleLead(leadData) {
    const res = await fetch(`${API_BASE}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadData),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `Request failed (${res.status})`);
    }
    return res.json();
}

export async function scoreBatch(file) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/score/batch`, {
        method: "POST",
        body: form,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `Request failed (${res.status})`);
    }
    return res.json();
}

export async function scoreFromSupabase() {
    const res = await fetch(`${API_BASE}/leads/score-supabase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `Request failed (${res.status})`);
    }
    return res.json();
}

export async function healthCheck() {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error("API unreachable");
    return res.json();
}

export async function askAboutLeads(question, conversationHistory = []) {
    const res = await fetch(`${API_BASE}/leads/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            question,
            conversation_history: conversationHistory,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `Request failed (${res.status})`);
    }
    return res.json();
}
