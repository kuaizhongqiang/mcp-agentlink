/**
 * Smoke tests for the storage layer.
 */

import { describe, it, expect } from "vitest";
import { createDatabase, migrate } from "./index.js";
import { RegistrationStore } from "./registrations.js";
import { EventStore } from "./events.js";
import { TokenStore } from "./tokens.js";

async function setupDb() {
  const db = await createDatabase();
  await migrate(db);

  // Seed a project for tests that need it
  db.exec(
    "INSERT INTO projects (id, name, description) VALUES ('test-1', 'Test Project', 'A test')"
  );

  return db;
}

describe("ProjectStore", () => {
  it("creates and retrieves a project", async () => {
    const db = await setupDb();
    const created = db.exec<{ name: string }>(
      "INSERT INTO projects (id, name, description) VALUES ('p1', 'P1', '') RETURNING *"
    );
    expect(created[0].name).toBe("P1");

    const found = db.exec<{ name: string }>(
      "SELECT * FROM projects WHERE id = ?",
      ["p1"]
    );
    expect(found[0].name).toBe("P1");
  });
});

describe("RegistrationStore", () => {
  it("registers a new agent", async () => {
    const db = await setupDb();
    const store = new RegistrationStore(db);

    const reg = store.register({
      project: "test-1",
      sender: "repo-a/agent-1",
      role: "api-owner",
      workpath: "/home/repo-a",
      giturl: "https://github.com/user/repo-a",
    });
    expect(reg).toBeTruthy();
    expect(reg!.sender).toBe("repo-a/agent-1");
  });

  it("re-register updates last_seen (idempotent)", async () => {
    const db = await setupDb();
    const store = new RegistrationStore(db);

    store.register({
      project: "test-1",
      sender: "repo-a/agent-1",
      role: "api-owner",
      workpath: "/home/repo-a",
      giturl: "https://github.com/user/repo-a",
    });

    const reg = store.register({
      project: "test-1",
      sender: "repo-a/agent-1",
      role: "api-owner",
      workpath: "/home/repo-a",
      giturl: "https://github.com/user/repo-a",
    });
    expect(reg).toBeTruthy();
    expect(reg!.status).toBe("online");
  });

  it("lists registrations", async () => {
    const db = await setupDb();
    const store = new RegistrationStore(db);

    store.register({
      project: "test-1",
      sender: "repo-a/agent-1",
      role: "api-owner",
      workpath: "/home/repo-a",
      giturl: "https://github.com/user/repo-a",
    });

    const list = store.list();
    expect(list.length).toBeGreaterThanOrEqual(1);
  });
});

describe("EventStore", () => {
  it("creates and queries an event", async () => {
    const db = await setupDb();
    const store = new EventStore(db);

    const ev = store.create({
      project: "test-1",
      type: "milestone",
      sender: "repo-a/agent-1",
      summary: "Phase 1 complete",
      scope: "*",
    });
    expect(ev).toBeTruthy();
    expect(ev.summary).toBe("Phase 1 complete");
    expect(ev.type).toBe("milestone");

    const events = store.query({ project: "test-1" });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it("filters by type", async () => {
    const db = await setupDb();
    const store = new EventStore(db);

    store.create({
      project: "test-1",
      type: "milestone",
      sender: "repo-a/agent-1",
      summary: "Done",
      scope: "*",
    });

    const events = store.query({ project: "test-1", type: "milestone" });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});

describe("TokenStore", () => {
  it("generates and verifies a token", async () => {
    const db = await setupDb();
    const store = new TokenStore(db);

    const { token, tokenData } = store.generate("test-1", "api-owner");
    expect(token.length).toBe(64); // 32 bytes = 64 hex chars
    expect(tokenData.status).toBe("active");

    const verified = store.verify(token);
    expect(verified).toBeTruthy();
    expect(verified!.role).toBe("api-owner");

    const revoked = store.revoke(token);
    expect(revoked).toBeTruthy();
    expect(revoked!.status).toBe("revoked");

    const afterRevoke = store.verify(token);
    expect(afterRevoke).toBeUndefined();
  });
});
