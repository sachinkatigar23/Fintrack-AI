import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Sparkles } from "../common/icons.js";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import AINote from "./AINote.jsx";
import { aiApi } from "../../services/financeApi.js";
import { errorMessage } from "../../api/axios.js";
import { useMoney } from "../../hooks/useMoney.js";

const SUGGESTIONS = [
  "Where am I spending the most money?",
  "How has my spending changed compared with last month?",
  "How much have I saved this month?",
  "Am I within my budget?",
  "Which bills are coming up?",
];

// Chat is kept for the browser session so switching tabs doesn't lose it
const STORE = "fintrack-coach-chat";
const loadChat = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) || "[]");
  } catch {
    return [];
  }
};

function Answer({ data }) {
  const money = useMoney();
  const chart = Array.isArray(data.chart?.data) ? data.chart.data.filter((d) => Number.isFinite(Number(d.value))) : [];
  return (
    <div className="bubble ai">
      <div className="flex items-center gap-2" style={{ fontWeight: 600, marginBottom: 6 }}>
        <Sparkles style={{ width: 15, height: 15 }} className="iris" /> {data.title || "Answer"}
      </div>
      <p style={{ color: "var(--text-2)" }}>{data.summary}</p>
      {data.metrics?.length > 0 && (
        <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
          {data.metrics.map((m) => (
            <span key={m} className="pill" style={{ fontSize: 11 }}>
              {m}
            </span>
          ))}
        </div>
      )}
      {chart.length > 0 && (
        <div style={{ height: 150, marginTop: 12 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#8A97AD", fontSize: 10 }} />
              <Tooltip formatter={(v) => money.fmt0(v)} contentStyle={{ background: "var(--panel)", border: "1px solid var(--line-hi)", borderRadius: 10 }} />
              <Bar dataKey="value" fill="#7C6BFF" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {data.recommendation && (
        <div className="box info" style={{ marginTop: 10, padding: "9px 12px" }}>
          <p style={{ fontSize: 12.5 }}>
            <b>Recommendation:</b> {data.recommendation}
          </p>
        </div>
      )}
      <AINote data={data} />
    </div>
  );
}

export default function CoachTab() {
  const [messages, setMessages] = useState(loadChat);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-30)));
    } catch {
      /* ignore */
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  const ask = async (question) => {
    const q = (question ?? text).trim();
    if (!q || busy) return;
    setText("");
    const history = messages.slice(-6).map((m) => ({ role: m.role, text: m.role === "user" ? m.text : m.data?.summary || m.error || "" }));
    setMessages((list) => [...list, { role: "user", text: q }]);
    setBusy(true);
    try {
      const data = await aiApi.chat(q, history);
      setMessages((list) => [...list, { role: "ai", data }]);
    } catch (err) {
      setMessages((list) => [...list, { role: "ai", error: errorMessage(err, "I can't answer right now. Please try again.") }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card ai" style={{ background: undefined }}>
      <div className="ai-hd" style={{ paddingTop: 22 }}>
        <span className="ai-ic">
          <MessageSquare />
        </span>
        <div>
          <b style={{ fontSize: 14 }}>AI Coach</b>
          <div className="muted" style={{ fontSize: 11.5 }}>Ask me anything about your own money</div>
        </div>
        <div style={{ flex: 1 }} />
        {messages.length > 0 && (
          <button type="button" className="btn ghost sm" onClick={() => setMessages([])}>
            Clear chat
          </button>
        )}
      </div>

      <div className="scrollY flex flex-col gap-4" style={{ maxHeight: 460, minHeight: 300, padding: "12px 24px 20px", position: "relative", zIndex: 1 }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 260 }}>
            <p className="muted" style={{ maxWidth: 440, fontSize: 13.5 }}>
              I answer using figures calculated from <b>your</b> records only. Try one of these:
            </p>
            <div className="flex flex-wrap justify-center gap-2" style={{ marginTop: 16 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chipf" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="bubble me">
              {m.text}
            </div>
          ) : m.error ? (
            <div key={i} className="bubble ai coral">
              {m.error}
            </div>
          ) : (
            <Answer key={i} data={m.data} />
          )
        )}

        {busy && (
          <div className="bubble ai" style={{ width: 70 }}>
            <div className="dots3">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex gap-3"
        style={{ borderTop: "1px solid var(--line)", padding: "16px 24px", position: "relative", zIndex: 1 }}
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask your AI financial coach..." disabled={busy} maxLength={500} />
        <button type="submit" className="btn primary" disabled={busy || !text.trim()} aria-label="Send">
          <Send />
        </button>
      </form>
    </div>
  );
}
