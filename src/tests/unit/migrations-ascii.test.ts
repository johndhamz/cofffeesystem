import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PostgREST (Haskell, no locale in the container) truncates error responses that contain
 * non-ASCII characters, turning a clear "INVALID_STATE: ..." message into an empty 500.
 * Keep every `raise exception` message in migrations ASCII-only.
 */
describe("migration error messages", () => {
  it("contain only ASCII characters", () => {
    const dir = path.resolve(import.meta.dirname, "../../../supabase/migrations");
    const offenders: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
      readFileSync(path.join(dir, file), "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (/raise\s+(exception|notice|warning)/i.test(line) && /[^\x00-\x7F]/.test(line)) {
            offenders.push(`${file}:${i + 1}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
