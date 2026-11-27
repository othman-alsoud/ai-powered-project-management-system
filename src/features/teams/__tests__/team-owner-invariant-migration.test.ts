import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Team Owner Invariant Migration Fix", () => {
  const rootDir = process.cwd();
  const initialMigrationPath = path.join(
    rootDir,
    "prisma/migrations/20261118000000_init/migration.sql"
  );
  const fixMigrationPath = path.join(
    rootDir,
    "prisma/migrations/20261122140000_fix_team_owner_invariant_min_uuid/migration.sql"
  );
  const dbDesignPath = path.join(rootDir, "docs/DATABASE_DESIGN.md");

  it("ensures initial migration exists and preserves migration history immutability", () => {
    expect(fs.existsSync(initialMigrationPath)).toBe(true);
    const content = fs.readFileSync(initialMigrationPath, "utf-8");
    expect(content).toContain("verify_team_owner_invariant");
  });

  it("ensures new migration exists and replaces verify_team_owner_invariant", () => {
    expect(fs.existsSync(fixMigrationPath)).toBe(true);
    const sql = fs.readFileSync(fixMigrationPath, "utf-8");

    // Must be CREATE OR REPLACE FUNCTION with schema-qualified name
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.verify_team_owner_invariant()");
    expect(sql).toContain("RETURNS TRIGGER");

    // Must NOT use unsupported MIN aggregate on UUID
    expect(sql).not.toMatch(/MIN\(\s*["']?userId["']?\s*\)/i);
    expect(sql).not.toMatch(/min\(uuid\)/i);

    // Must use separate COUNT(*) query
    expect(sql).toContain('SELECT COUNT(*) INTO owner_count');
    expect(sql).toContain('FROM "team_member"');
    expect(sql).toContain('WHERE "teamId" = target_team_id AND "role" = \'OWNER\'');

    // Must validate owner_count != 1
    expect(sql).toContain("IF owner_count != 1 THEN");
    expect(sql).toContain("RAISE EXCEPTION 'Team % must have exactly 1 OWNER (found %)'");

    // Must retrieve the OWNER UUID with separate query using LIMIT 1
    expect(sql).toContain('SELECT "userId" INTO actual_owner');
    expect(sql).toContain("LIMIT 1");

    // Must validate team.ownerId matches actual_owner
    expect(sql).toContain('WHERE "id" = target_team_id AND "ownerId" = actual_owner');
    expect(sql).toContain("RAISE EXCEPTION 'Team % ownerId does not match OWNER membership'");
  });

  it("ensures docs/DATABASE_DESIGN.md is synchronized with the new query pattern", () => {
    const doc = fs.readFileSync(dbDesignPath, "utf-8");
    expect(doc).not.toContain('MIN("userId")');
    expect(doc).toContain('SELECT COUNT(*) INTO owner_count');
    expect(doc).toContain('SELECT "userId" INTO actual_owner');
    expect(doc).toContain('LIMIT 1');
  });
});
