import axios from "axios";

const API_URL = "http://localhost:8000/api";

export async function getEmails() {
  const res = await axios.get(`${API_URL}/emails`);
  return res.data;
}

export async function ingestEmail(payload: { sender: string; subject: string; body: string; timestamp?: string }) {
  const res = await axios.post(`${API_URL}/ingest`, payload);
  return res.data;
}

export async function getPrompts() {
  const res = await axios.get(`${API_URL}/prompts`);
  return res.data;
}

export async function updatePrompt(type: string, content: string) {
  const res = await axios.post(`${API_URL}/prompts`, { type, content });
  return res.data;
}

export async function processEmails(api_key?: string) {
  // API key is optional; backend will read GEMINI_API_KEY if not provided.
  const payload = api_key ? { api_key } : {};
  const res = await axios.post(`${API_URL}/process`, payload);
  return res.data;
}

export async function getProcessed(emailId?: number) {
  if (emailId) {
    const res = await axios.get(`${API_URL}/processed/${emailId}`);
    return res.data;
  }
  const res = await axios.get(`${API_URL}/processed`);
  return res.data;
}

export async function chatAgent(query: string, api_key?: string, context_email_id?: number) {
  const payload: any = { query, context_email_id };
  if (api_key) payload.api_key = api_key;
  const res = await axios.post(`${API_URL}/chat`, payload);
  return res.data;
}

export async function generateDraft(email_id: number, api_key?: string) {
  const payload: any = { email_id };
  if (api_key) payload.api_key = api_key;
  const res = await axios.post(`${API_URL}/draft`, payload);
  return res.data;
}

export async function listDrafts() {
  const res = await axios.get(`${API_URL}/drafts`);
  return res.data;
}

export async function saveDraft(payload: { draft_id?: number | null; email_id?: number | null; content: string }) {
  const res = await axios.post(`${API_URL}/drafts`, payload);
  return res.data;
}
