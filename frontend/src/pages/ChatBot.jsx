import { useState, useRef, useEffect } from "react";

export default function ChatBot({ csvContext = "" }) {
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Bonjour ! Je suis votre assistant SLA. Posez-moi une question ou chargez un CSV pour que je l'analyse.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setInput("");
    setLoading(true);

    const systemPrompt = `Tu es un assistant expert en analyse SLA pour DXC Tunisia Contact Center.
Tu aides à analyser les ruptures SLA, identifier les causes racines et proposer des recommandations concrètes.
${csvContext ? `Voici les données SLA disponibles :\n${csvContext}` : ""}
Réponds en français de manière concise et professionnelle.`;

    try {
      const res = await fetch("/api/claude/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userText },
          ],
          max_tokens: 1000,
          stream: false,
        }),
      });

      const data = await res.json();

      // Groq retourne format OpenAI
      const reply =
        data?.choices?.[0]?.message?.content ||
        data?.content?.[0]?.text ||
        "Erreur : réponse inattendue.";

      setMessages((prev) => [...prev, { role: "bot", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Erreur de connexion au serveur." },
      ]);
    }

    setLoading(false);
  };

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen(!open)}
        title="Assistant SLA"
        style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 1000,
          background: open ? "#3C3489" : "#7F77DD",
          color: "white", border: "none", borderRadius: "50%",
          width: 54, height: 54, fontSize: 24, cursor: "pointer",
          boxShadow: "0 4px 16px rgba(127,119,221,0.4)",
          transition: "background 0.2s",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {open ? "✕" : "💬"}
      </button>

      {/* Fenêtre chat */}
      {open && (
        <div style={{
          position: "fixed", bottom: 94, right: 28, zIndex: 1000,
          width: 370, height: 500,
          background: "white", borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column",
          border: "1px solid #e8e6f8", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg, #7F77DD, #534AB7)",
            color: "white", padding: "14px 18px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Assistant SLA</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>
                {csvContext ? "✅ Données CSV chargées" : "Aucun fichier chargé"}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "12px 14px",
            display: "flex", flexDirection: "column", gap: 10,
            background: "#fafafa",
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
              }}>
                <div style={{
                  background: m.role === "user" ? "#7F77DD" : "white",
                  color: m.role === "user" ? "white" : "#222",
                  padding: "9px 13px", borderRadius: 12,
                  fontSize: 13, lineHeight: 1.5,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  border: m.role === "bot" ? "1px solid #eee" : "none",
                  whiteSpace: "pre-wrap",
                }}>
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{
                alignSelf: "flex-start", background: "white",
                padding: "9px 13px", borderRadius: 12,
                fontSize: 13, color: "#999",
                border: "1px solid #eee",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}>
                ⏳ En train d'analyser...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            display: "flex", gap: 8, padding: "10px 12px",
            borderTop: "1px solid #eee", background: "white",
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Posez votre question SLA..."
              style={{
                flex: 1, padding: "9px 14px", borderRadius: 20,
                border: "1px solid #ddd", fontSize: 13, outline: "none",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim() ? "#ccc" : "#7F77DD",
                color: "white", border: "none", borderRadius: "50%",
                width: 38, height: 38, cursor: loading ? "not-allowed" : "pointer",
                fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.2s",
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}