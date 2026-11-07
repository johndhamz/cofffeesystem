import { describe, expect, it } from "vitest";
import { isObjectWithin, objectPath, safeFileName } from "@/lib/storage/paths";

const BIZ = "11111111-1111-4111-8111-111111111111";
const DOC = "22222222-2222-4222-8222-222222222222";

describe("storage paths", () => {
  it("sanitises file names and keeps them short", () => {
    expect(safeFileName("receipt (1).PDF")).toBe("receipt__1_.PDF");
    expect(safeFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(safeFileName("")).toBe("file");
    expect(safeFileName("a".repeat(500))).toHaveLength(100);
  });

  it("builds <business>/<document>/<timestamp>-<name> paths", () => {
    expect(objectPath(BIZ, DOC, "photo.jpg", 1700000000000)).toBe(
      `${BIZ}/${DOC}/1700000000000-photo.jpg`,
    );
  });

  it("accepts only a single object directly inside the document folder", () => {
    expect(isObjectWithin(`${BIZ}/${DOC}/1-photo.jpg`, BIZ, DOC)).toBe(true);
    expect(isObjectWithin(`${BIZ}/${DOC}/`, BIZ, DOC)).toBe(false);
    expect(isObjectWithin(`${BIZ}/${DOC}/nested/photo.jpg`, BIZ, DOC)).toBe(false);
    expect(isObjectWithin(`${BIZ}/${DOC}/..photo`, BIZ, DOC)).toBe(false);
    expect(isObjectWithin(`${BIZ}/other/1-photo.jpg`, BIZ, DOC)).toBe(false);
    expect(isObjectWithin(`other/${DOC}/1-photo.jpg`, BIZ, DOC)).toBe(false);
    expect(isObjectWithin(`${BIZ}/${DOC}/${"a".repeat(121)}`, BIZ, DOC)).toBe(false);
  });

  it("round-trips: every generated path passes the server-side check", () => {
    for (const name of ["a.png", "weird name!!.pdf", "x".repeat(300), ""]) {
      expect(isObjectWithin(objectPath(BIZ, DOC, name), BIZ, DOC)).toBe(true);
    }
  });
});
