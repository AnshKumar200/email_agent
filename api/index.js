const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const MOCK_DB = {
  emails: [
    {
      id: 1,
      sender: "boss@company.com",
      subject: "Urgent: Q3 Report",
      body: "Hi, I need the Q3 financial report by EOD tomorrow.",
      timestamp: "2023-10-27 09:00",
    },
    {
      id: 2,
      sender: "newsletter@techweekly.com",
      subject: "The Future of AI",
      body: "Top stories this week: LLMs are taking over...",
      timestamp: "2023-10-27 10:30",
    },
  ],
  prompts: {
    categorize: "Categorize emails into: Important, Newsletter, Spam. Respond with just the category name.",
    action_items: "Extract tasks. JSON format: {'task': '...', 'deadline': '...'}.",
    auto_reply: "Draft a polite professional reply.",
  },
  processed: {},
  drafts: {},
};

let _genaiClient = null;
async function getGenaiClient() {
  if (_genaiClient) return _genaiClient;
  try {
    const mod = await import("@google/genai");
    const { GoogleGenAI } = mod;
    _genaiClient = new GoogleGenAI({});
    return _genaiClient;
  } catch (err) {
    throw new Error(`Failed to load @google/genai: ${err.message || err}`);
  }
}

async function queryGemini(apiKey, systemInstruction, userInput) {
  const effectiveKey = apiKey || process.env.GEMINI_API_KEY;
  if (!effectiveKey) {
    return { error: "API Key is missing. Set GEMINI_API_KEY in server environment or provide api_key." };
  }

  const promptText = [systemInstruction || "", userInput || ""].filter(Boolean).join("\n\n");

  const model = process.env.GEMINI_MODEL || process.env.GENERATIVE_MODEL || "gemini-2.0-flash";

  try {
    const client = await getGenaiClient();

    const response = await client.models.generateContent({
      model,
      contents: promptText,
    });

    const text = response && (response.text || (response?.candidates && response.candidates[0]?.content) || "");
    return { text, raw: response };
  } catch (err) {
    return { error: `Failed to call Gemini SDK: ${String(err)}` };
  }
}

// --- Endpoints ---
app.get("/api/emails", (req, res) => {
  res.json(MOCK_DB.emails);
});

app.get("/api/prompts", (req, res) => {
  res.json(MOCK_DB.prompts);
});

app.post("/api/prompts", (req, res) => {
  const { type, content } = req.body || {};
  if (!type) return res.status(400).json({ error: "Missing prompt type" });
  MOCK_DB.prompts[type] = content;
  res.json({ status: "success" });
});

app.post("/api/process", async (req, res) => {
  try {
    const api_key = req.body?.api_key;
    for (const email of MOCK_DB.emails) {
      const eid = String(email.id);
      const content = `Subject: ${email.subject}\nBody: ${email.body}`;

      const cat_res = await queryGemini(api_key, MOCK_DB.prompts.categorize, content);
      const act_res = await queryGemini(api_key, MOCK_DB.prompts.action_items, content);

      const category = cat_res && !cat_res.error ? cat_res.text : (cat_res && cat_res.error ? `Error: ${cat_res.error}` : String(cat_res));
      const actions = act_res && !act_res.error ? act_res.text : (act_res && act_res.error ? `Error: ${act_res.error}` : String(act_res));

      MOCK_DB.processed[eid] = { category, actions };
    }
    res.json(MOCK_DB.processed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.post("/api/chat", async (req, res) => {
  const { query, context_email_id, api_key } = req.body || {};
  let context = "General Inbox";
  if (context_email_id != null) {
    const email = MOCK_DB.emails.find((e) => e.id === context_email_id);
    if (email) context = `Email Subject: ${email.subject}\nBody: ${email.body}`;
  }
  const system_prompt = `You are an email assistant. Context: ${context}. User Prompts: ${JSON.stringify(MOCK_DB.prompts)}`;
  try {
    const resp = await queryGemini(api_key, system_prompt, query);
    if (resp && resp.error) return res.json({ error: resp.error });
    return res.json({ response: resp.text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

app.post("/api/draft", async (req, res) => {
  const { email_id, api_key } = req.body || {};
  const email = MOCK_DB.emails.find((e) => e.id === email_id);
  if (!email) return res.json({ draft: "Error: Email not found." });
  const prompt = MOCK_DB.prompts.auto_reply;
  const content = `Original Email:\nSubject: ${email.subject}\nFrom: ${email.sender}\n\n${email.body}`;
  const resp = await queryGemini(api_key, prompt, content);
  const draft_text = resp && !resp.error ? resp.text : (typeof resp === "string" ? resp : (resp && resp.error ? `Error: ${resp.error}` : ""));

  let next_id = 1;
  try {
    const keys = Object.keys(MOCK_DB.drafts).map((k) => parseInt(k, 10));
    next_id = keys.length ? Math.max(...keys) + 1 : 1;
  } catch (e) {
    next_id = 1;
  }
  MOCK_DB.drafts[String(next_id)] = {
    id: next_id,
    email_id: email_id,
    content: draft_text,
    status: "draft",
  };
  res.json({ draft: draft_text, draft_id: next_id });
});

app.post("/api/ingest", (req, res) => {
  const email = req.body || {};
  let next_id = 1;
  try {
    const ids = MOCK_DB.emails.map((e) => e.id);
    next_id = ids.length ? Math.max(...ids) + 1 : 1;
  } catch (e) {
    next_id = 1;
  }
  const email_obj = {
    id: next_id,
    sender: email.sender || "unknown@local",
    subject: email.subject || "(no subject)",
    body: email.body || "",
    timestamp: email.timestamp || "",
  };
  MOCK_DB.emails.push(email_obj);
  res.json({ status: "ingested", email: email_obj });
});

app.get("/api/processed", (req, res) => {
  res.json(MOCK_DB.processed);
});

app.get("/api/processed/:email_id", (req, res) => {
  const id = req.params.email_id;
  res.json(MOCK_DB.processed[id] || {});
});

app.get("/api/drafts", (req, res) => {
  res.json(Object.values(MOCK_DB.drafts));
});

app.post("/api/drafts", (req, res) => {
  const { draft_id, email_id, content } = req.body || {};
  try {
    if (draft_id) {
      const key = String(draft_id);
      if (!MOCK_DB.drafts[key]) return res.json({ error: "Draft not found" });
      MOCK_DB.drafts[key].content = content;
      MOCK_DB.drafts[key].status = "draft";
      return res.json({ status: "updated", draft: MOCK_DB.drafts[key] });
    } else {
      let next_id = 1;
      const keys = Object.keys(MOCK_DB.drafts).map((k) => parseInt(k, 10));
      next_id = keys.length ? Math.max(...keys) + 1 : 1;
      MOCK_DB.drafts[String(next_id)] = { id: next_id, email_id, content, status: "draft" };
      return res.json({ status: "created", draft_id: next_id });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Node backend listening on ${PORT}`);
});
