from fastapi.testclient import TestClient

from api import backend

client = TestClient(backend.app)


def setup_module(module):
    # Stub out the LLM call to avoid network/external dependencies in tests
    backend.query_gemini = lambda api_key, system_instruction, user_input: {"text": "stubbed response"}


def test_get_emails():
    r = client.get("/api/emails")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_ingest_and_process_and_draft_flow():
    # ingest a new email
    new_email = {"sender": "test@local", "subject": "Hello", "body": "Please do X"}
    r = client.post("/api/ingest", json=new_email)
    assert r.status_code == 200
    payload = r.json()
    assert payload["status"] == "ingested"
    email = payload["email"]
    eid = email["id"]

    # process inbox (uses stubbed query_gemini)
    r = client.post("/api/process", json={"api_key": "fake"})
    assert r.status_code == 200
    processed = r.json()
    assert str(eid) in processed

    # generate a draft for the newly ingested email
    r = client.post("/api/draft", json={"email_id": eid, "api_key": "fake"})
    assert r.status_code == 200
    d = r.json()
    assert "draft" in d
    assert "draft_id" in d

    # list drafts
    r = client.get("/api/drafts")
    assert r.status_code == 200
    drafts = r.json()
    assert isinstance(drafts, list)

    # update a draft
    draft_id = d["draft_id"]
    r = client.post("/api/drafts", json={"draft_id": draft_id, "content": "updated content"})
    assert r.status_code == 200
    res = r.json()
    assert res.get("status") in ("updated", "created") or res.get("draft")
