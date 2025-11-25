import { useState, useEffect } from "react";
import "./App.css";
import * as api from "./api";

function App() {
  const [activeTab, setActiveTab] = useState<string>("inbox");
  const [emails, setEmails] = useState<any[]>([]);
  const [processed, setProcessed] = useState<Record<string, any>>({});

  // Prompts
  const [prompts, setPrompts] = useState<Record<string, string>>({
    categorize: "",
    action_items: "",
    auto_reply: "",
  });

  const [selectedEmail, setSelectedEmail] = useState<any | null>(null);

  // Chat
  const [chatInput, setChatInput] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: string; content: string }>
  >([]);

  // Drafts
  const [draft, setDraft] = useState<string>("");
  const [draftId, setDraftId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<any[]>([]);

  // Loading states
  const [isLoadingProcess, setIsLoadingProcess] = useState<boolean>(false);
  const [isLoadingChat, setIsLoadingChat] = useState<boolean>(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState<boolean>(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const e = await api.getEmails();
      const p = await api.getPrompts();
      const d = await api.listDrafts();
      setEmails(e || []);
      setPrompts(p || {});
      setDrafts(d || []);
    } catch (err) {
      console.error("Failed to fetch initial data", err);
    }
  }

  const handleProcess = async () => {
    try {
      setIsLoadingProcess(true);
      const res = await api.processEmails();
      setProcessed(res || {});
    } catch (e) {
      console.error("Process error", e);
      alert("Failed to process inbox. See console.");
    } finally {
      setIsLoadingProcess(false);
    }
  };

  const handlePromptSave = async (type: string, value: string) => {
    const newPrompts = { ...prompts, [type]: value } as Record<string, string>;
    setPrompts(newPrompts);
    try {
      await api.updatePrompt(type, value);
    } catch (e) {
      console.error("Failed to save prompt", e);
      alert("Failed to save prompt");
    }
  };

  const handleChat = async () => {
    if (!chatInput) return;
    const newHistory = [...chatHistory, { role: "user", content: chatInput }];
    setChatHistory(newHistory);
    setIsLoadingChat(true);
    try {
      const res = await api.chatAgent(chatInput, undefined, selectedEmail?.id);
      setChatHistory((prev) => [
        ...prev,
        { role: "agent", content: res.response || res.error || "No response" },
      ]);
    } catch (e) {
      console.error("Chat error", e);
      setChatHistory((prev) => [
        ...prev,
        { role: "agent", content: "Error: failed to get response" },
      ]);
    } finally {
      setIsLoadingChat(false);
      setChatInput("");
    }
  };

  const handleDraft = async () => {
    if (!selectedEmail) return;
    setIsLoadingDraft(true);
    try {
      const res = await api.generateDraft(selectedEmail.id);
      setDraft(res.draft || "");
      setDraftId(res.draft_id || null);
      const dRes = await api.listDrafts();
      setDrafts(dRes || []);
    } catch (e) {
      console.error(e);
      alert("Error generating draft. See console.");
    } finally {
      setIsLoadingDraft(false);
    }
  };

  const handleSaveDraft = async (contentToSave: string) => {
    try {
      const payload = {
        draft_id: draftId,
        content: contentToSave,
        email_id: selectedEmail?.id,
      };
      const res = await api.saveDraft(payload);
      if (res.draft_id) setDraftId(res.draft_id);
      else if (res.draft && res.draft.id) setDraftId(res.draft.id);
      const dRes = await api.listDrafts();
      setDrafts(dRes || []);
      alert("Draft saved locally (not sent).");
    } catch (e) {
      console.error(e);
      alert("Failed to save draft");
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Email Productivity Agent</h1>

      <div
        style={{
          marginBottom: "20px",
          borderBottom: "1px solid #ccc",
          paddingBottom: "10px",
        }}
      >
        <button
          onClick={() => setActiveTab("brain")}
          style={{ marginLeft: "10px" }}
        >
          Brain
        </button>
        <button
          onClick={() => setActiveTab("inbox")}
          style={{ marginLeft: "10px" }}
        >
          Inbox
        </button>
        <button
          onClick={() => setActiveTab("agent")}
          style={{ marginLeft: "10px" }}
        >
          Agent
        </button>
        <button
          onClick={() => setActiveTab("drafts")}
          style={{ marginLeft: "10px" }}
        >
          Drafts
        </button>
      </div>

      {/* Brain */}
      {activeTab === "brain" && (
        <div>
          <h2>Agent Configuration</h2>
          {Object.keys(prompts).map((key) => (
            <div key={key} style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", fontWeight: "bold" }}>
                {key.toUpperCase()}
              </label>
              <textarea
                value={prompts[key]}
                onChange={(e) => handlePromptSave(key, e.target.value)}
                style={{ width: "100%", height: "80px" }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Inbox */}
      {activeTab === "inbox" && (
        <div>
          <button
            onClick={handleProcess}
            style={{
              marginBottom: "20px",
              padding: "10px",
              background: "#007bff",
              color: "#fff",
            }}
          >
            {isLoadingProcess
              ? "Processing inbox..."
              : "Process Inbox with LLM"}
          </button>

          <div style={{ display: "flex" }}>
            <div
              style={{
                width: "40%",
                borderRight: "1px solid #eee",
                color: "black",
              }}
            >
              {emails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  style={{
                    padding: "10px",
                    background:
                      selectedEmail?.id === email.id ? "#e3f2fd" : "white",
                    cursor: "pointer",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <strong>{email.sender}</strong>
                  <br />
                  {email.subject}
                  {processed[email.id] && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "blue",
                        marginTop: "5px",
                      }}
                    >
                      {processed[email.id].category}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ width: "60%", padding: "20px" }}>
              {selectedEmail ? (
                <>
                  <h2>{selectedEmail.subject}</h2>
                  <p>{selectedEmail.body}</p>

                  <hr />

                  {processed[selectedEmail.id] && (
                    <div
                      style={{
                        background: "#f9f9f9",
                        padding: "10px",
                        color: "black",
                      }}
                    >
                      <h4>Analysis</h4>
                      <p>
                        <strong>Actions:</strong>{" "}
                        {processed[selectedEmail.id].actions}
                      </p>
                    </div>
                  )}

                  <div style={{ marginTop: "20px" }}>
                    <button
                      onClick={() => setActiveTab("agent")}
                      style={{ marginRight: "10px" }}
                    >
                      Chat about this
                    </button>
                    <button onClick={handleDraft} disabled={isLoadingDraft}>
                      {isLoadingDraft
                        ? "Generating..."
                        : "Generate Draft Reply"}
                    </button>
                    <button
                      onClick={() => handleSaveDraft(draft)}
                      style={{ marginLeft: "8px" }}
                    >
                      Save Draft
                    </button>
                  </div>

                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    style={{
                      width: "100%",
                      height: "150px",
                      marginTop: "10px",
                    }}
                  />
                </>
              ) : (
                <p>Select an email</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drafts */}
      {activeTab === "drafts" && (
        <div>
          <h2>Saved Drafts (Local)</h2>
          <div style={{ display: "flex" }}>
            <div style={{ width: "35%", borderRight: "1px solid #eee" }}>
              {drafts.map((d) => (
                <div
                  key={d.id}
                  onClick={() => {
                    setDraft(d.content);
                    setDraftId(d.id);
                    if (d.email_id) {
                      const e = emails.find((x) => x.id === d.email_id);
                      if (e) setSelectedEmail(e);
                    }
                  }}
                  style={{
                    padding: "10px",
                    cursor: "pointer",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  <strong>Draft #{d.id}</strong>
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    {d.status}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ width: "65%", padding: "20px" }}>
              <h3>Draft Editor</h3>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                style={{ width: "100%", height: "240px" }}
              />
              <div style={{ marginTop: "10px" }}>
                <button onClick={() => handleSaveDraft(draft)}>
                  Save Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Agent */}
      {activeTab === "agent" && (
        <div>
          <h2>Agent Chat</h2>
          <div
            style={{
              background: "#f4f4f4",
              padding: "10px",
              marginBottom: "10px",
              color: "black",
            }}
          >
            Current Context:{" "}
            <strong>
              {selectedEmail ? selectedEmail.subject : "Full Inbox"}
            </strong>
          </div>

          <div
            style={{
              height: "300px",
              overflowY: "scroll",
              border: "1px solid #ddd",
              padding: "10px",
              marginBottom: "10px",
            }}
          >
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                style={{
                  textAlign: msg.role === "user" ? "right" : "left",
                  margin: "5px 0",
                }}
              >
                <span
                  style={{
                    background: msg.role === "user" ? "#007bff" : "#e2e2e2",
                    color: msg.role === "user" ? "white" : "black",
                    padding: "5px 10px",
                    borderRadius: "10px",
                  }}
                >
                  {msg.content}
                </span>
              </div>
            ))}
            {isLoadingChat && (
              <div style={{ textAlign: "left", marginTop: "6px" }}>
                <em style={{ color: "#666" }}>Agent is typing...</em>
              </div>
            )}
          </div>

          <div style={{ display: "flex" }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleChat()}
              style={{ flex: 1, padding: "10px" }}
              placeholder="Ask the agent..."
            />
            <button
              onClick={handleChat}
              style={{ padding: "10px" }}
              disabled={isLoadingChat}
            >
              {isLoadingChat ? "Waiting..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
