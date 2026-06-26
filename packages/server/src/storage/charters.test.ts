/**
 * Tests for CharterStore.
 */

import { describe, it, expect } from "vitest";
import { createDatabase, migrate } from "./index.js";
import { CharterStore } from "./charters.js";

async function setupDb() {
  const db = await createDatabase();
  await migrate(db);

  // Seed a project
  db.exec(
    "INSERT INTO projects (id, name, description) VALUES ('test-project', 'Test Project', 'A test project')"
  );

  return db;
}

describe("CharterStore", () => {
  it("publishes a new charter (insert)", async () => {
    const db = await setupDb();
    const store = new CharterStore(db);

    const charter = store.publish({
      project: "test-project",
      content: "vision: Build great things\nroles:\n  - coder\n  - tester",
      published_by: "pm",
    });

    expect(charter).toBeTruthy();
    expect(charter.project_id).toBe("test-project");
    expect(charter.guid).toBeTruthy();
    expect(charter.content).toContain("vision");
    expect(charter.published_by).toBe("pm");
    expect(charter.published_at).toBeTruthy();
  });

  it("updates an existing charter (upsert)", async () => {
    const db = await setupDb();
    const store = new CharterStore(db);

    // First publish
    const first = store.publish({
      project: "test-project",
      content: "version 1",
      published_by: "pm",
    });

    // Second publish — same project, should update
    const second = store.publish({
      project: "test-project",
      content: "version 2",
      published_by: "pm",
    });

    expect(second.project_id).toBe("test-project");
    expect(second.content).toBe("version 2");
    expect(second.guid).not.toBe(first.guid);

    // updated_at should be >= published_at (may be same second in fast tests)
    expect(new Date(second.updated_at).getTime())
      .toBeGreaterThanOrEqual(new Date(second.published_at).getTime());

    // Should only have one record for this project
    const fetched = store.getByProject("test-project");
    expect(fetched?.content).toBe("version 2");
  });

  it("getByProject returns undefined for non-existent charter", async () => {
    const db = await setupDb();
    const store = new CharterStore(db);

    const result = store.getByProject("non-existent");
    expect(result).toBeUndefined();
  });

  it("getByProject returns the charter", async () => {
    const db = await setupDb();
    const store = new CharterStore(db);

    store.publish({
      project: "test-project",
      content: "charter content",
      published_by: "pm",
    });

    const fetched = store.getByProject("test-project");
    expect(fetched).toBeTruthy();
    expect(fetched!.content).toBe("charter content");
    expect(fetched!.guid).toBeTruthy();
  });

  it("generates a unique GUID for each publish", async () => {
    const db = await setupDb();
    const store = new CharterStore(db);

    const guids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const charter = store.publish({
        project: "test-project",
        content: `version ${i}`,
        published_by: "pm",
      });
      guids.add(charter.guid);
    }

    // Each publish should have a unique GUID
    expect(guids.size).toBe(5);
  });
});
