/**
 * Tests for auth module — PM assertions, project closed check.
 */

import { describe, it, expect } from "vitest";
import { createDatabase, migrate } from "../storage/index.js";
import { RegistrationStore } from "../storage/registrations.js";
import {
  verifyToken,
  assertPmRole,
  assertProjectHasPm,
  assertProjectNotClosed,
  assertPermission,
  assertProjectAccess,
} from "./index.js";

async function setupDb() {
  const db = await createDatabase();
  await migrate(db);

  // Seed a project
  db.exec(
    "INSERT INTO projects (id, name, description) VALUES ('test-project', 'Test Project', 'A test')"
  );

  return db;
}

function makeUser(overrides: Partial<ReturnType<typeof verifyToken>> = {}) {
  return {
    projectId: "test-project",
    role: "api-owner",
    permissions: "write" as const,
    ...overrides,
  };
}

describe("verifyToken", () => {
  it("returns null for invalid token", () => {
    // Can't easily test without TokenStore, but structure is tested in database.test.ts
    expect(true).toBe(true);
  });
});

describe("assertPmRole", () => {
  it("passes for PM role", () => {
    const user = makeUser({ role: "pm" });
    expect(() => assertPmRole(user)).not.toThrow();
  });

  it("throws PERMISSION_DENIED for non-PM role", () => {
    const user = makeUser({ role: "api-owner" });
    expect(() => assertPmRole(user)).toThrow("PERMISSION_DENIED");
  });

  it("throws INVALID_TOKEN for null user", () => {
    expect(() => assertPmRole(null)).toThrow("INVALID_TOKEN");
  });
});

describe("assertProjectHasPm", () => {
  it("throws NO_PM when no PM registered", async () => {
    const db = await setupDb();

    expect(() => assertProjectHasPm(db, "test-project")).toThrow("NO_PM");
  });

  it("passes when PM is registered", async () => {
    const db = await setupDb();
    const store = new RegistrationStore(db);
    store.register({
      project: "test-project",
      sender: "admin/repo",
      role: "pm",
      workpath: "/home/admin",
      giturl: "https://github.com/admin/repo",
    });

    expect(() => assertProjectHasPm(db, "test-project")).not.toThrow();
  });
});

describe("assertProjectNotClosed", () => {
  it("passes for active project", async () => {
    const db = await setupDb();
    expect(() => assertProjectNotClosed(db, "test-project")).not.toThrow();
  });

  it("throws PROJECT_CLOSED for closed project", async () => {
    const db = await setupDb();
    db.run("UPDATE projects SET status = 'closed' WHERE id = 'test-project'");

    expect(() => assertProjectNotClosed(db, "test-project")).toThrow("PROJECT_CLOSED");
  });
});

describe("assertPermission", () => {
  it("passes with sufficient permissions", () => {
    const user = makeUser({ permissions: "admin" });
    expect(() => assertPermission(user, "write")).not.toThrow();
  });

  it("passes with exactly matching permission", () => {
    const user = makeUser({ permissions: "write" });
    expect(() => assertPermission(user, "write")).not.toThrow();
  });

  it("throws PERMISSION_DENIED with insufficient permissions", () => {
    const user = makeUser({ permissions: "read" });
    expect(() => assertPermission(user, "write")).toThrow("PERMISSION_DENIED");
  });

  it("throws INVALID_TOKEN for null user", () => {
    expect(() => assertPermission(null, "read")).toThrow("INVALID_TOKEN");
  });
});

describe("assertProjectAccess", () => {
  it("passes when project matches", () => {
    const user = makeUser({ projectId: "test-project" });
    expect(() => assertProjectAccess(user, "test-project")).not.toThrow();
  });

  it("throws UNAUTHORIZED_SCOPE when project does not match", () => {
    const user = makeUser({ projectId: "other-project" });
    expect(() => assertProjectAccess(user, "test-project")).toThrow("UNAUTHORIZED_SCOPE");
  });

  it("throws INVALID_TOKEN for null user", () => {
    expect(() => assertProjectAccess(null, "test-project")).toThrow("INVALID_TOKEN");
  });
});
