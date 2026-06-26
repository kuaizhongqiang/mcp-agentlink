/**
 * Smoke tests for the storage layer.
 */

import { describe, it, expect } from "vitest";
import { createDatabase, migrate } from "./index.js";
import { RegistrationStore } from "./registrations.js";
import { EventStore } from "./events.js";
import { TokenStore } from "./tokens.js";
import { ProjectStore } from "./projects.js";
import { CharterStore } from "./charters.js";

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

  it("closes an active project", async () => {
    const db = await setupDb();
    const store = new ProjectStore(db);

    const closed = store.close("test-1");
    expect(closed).toBeTruthy();
    expect(closed!.status).toBe("closed");

    const found = store.findById("test-1");
    expect(found!.status).toBe("closed");
  });

  it("isClosed returns true for closed projects", async () => {
    const db = await setupDb();
    const store = new ProjectStore(db);

    store.close("test-1");
    expect(store.isClosed("test-1")).toBe(true);
  });

  it("isClosed returns false for active projects", async () => {
    const db = await setupDb();
    const store = new ProjectStore(db);

    expect(store.isClosed("test-1")).toBe(false);
  });

  it("cannot close a non-existent project", async () => {
    const db = await setupDb();
    const store = new ProjectStore(db);

    const closed = store.close("non-existent");
    expect(closed).toBeUndefined();
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

  it("findPm returns undefined when no PM", async () => {
    const db = await setupDb();
    const store = new RegistrationStore(db);

    const pm = store.findPm("test-1");
    expect(pm).toBeUndefined();
  });

  it("hasPm returns false when no PM", async () => {
    const db = await setupDb();
    const store = new RegistrationStore(db);

    expect(store.hasPm("test-1")).toBe(false);
  });

  it("findPm returns the PM registration", async () => {
    const db = await setupDb();
    const store = new RegistrationStore(db);

    store.register({
      project: "test-1",
      sender: "admin/repo",
      role: "pm",
      workpath: "/home/admin",
      giturl: "https://github.com/admin/repo",
    });

    const pm = store.findPm("test-1");
    expect(pm).toBeTruthy();
    expect(pm!.role).toBe("pm");
    expect(pm!.sender).toBe("admin/repo");
  });

  it("hasPm returns true when PM registered", async () => {
    const db = await setupDb();
    const store = new RegistrationStore(db);

    store.register({
      project: "test-1",
      sender: "admin/repo",
      role: "pm",
      workpath: "/home/admin",
      giturl: "https://github.com/admin/repo",
    });

    expect(store.hasPm("test-1")).toBe(true);
  });
});

describe("CharterStore integration", () => {
  it("publishes and retrieves a charter", async () => {
    const db = await setupDb();
    const store = new CharterStore(db);

    const charter = store.publish({
      project: "test-1",
      content: "vision: test\nroles:\n  - coder",
      published_by: "pm",
    });

    expect(charter.project_id).toBe("test-1");
    expect(charter.guid).toBeTruthy();

    const fetched = store.getByProject("test-1");
    expect(fetched).toBeTruthy();
    expect(fetched!.content).toBe(charter.content);
    expect(fetched!.guid).toBe(charter.guid);
  });

  it("upsert updates existing charter", async () => {
    const db = await setupDb();
    const store = new CharterStore(db);

    store.publish({ project: "test-1", content: "v1", published_by: "pm" });
    const updated = store.publish({ project: "test-1", content: "v2", published_by: "pm" });

    expect(updated.content).toBe("v2");
    const fetched = store.getByProject("test-1");
    expect(fetched!.content).toBe("v2");
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
