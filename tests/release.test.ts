import { expect, test } from "bun:test";
import { releaseVersion } from "../scripts/release/version";

test("release versions preserve stable and prerelease tags", () => {
  expect(releaseVersion("v1.2.3")).toBe("1.2.3");
  expect(releaseVersion("0.1.0")).toBe("0.1.0");
  expect(releaseVersion("v1.2.3-beta.1")).toBe("1.2.3-beta.1");
  expect(releaseVersion("v1.2.3-rc.0")).toBe("1.2.3-rc.0");
});

test("unsafe or ambiguous tag names never reach release filenames or app metadata", () => {
  for (const tag of ["", "main", "v1.2", "v01.2.3", "v1.2.3-01", "v1.2.3+metadata", "v1.2.3\n", "v1.2.3\nversion=4.5.6", "v1.2.3; echo hi", "releases/v1.2.3"]) {
    expect(() => releaseVersion(tag)).toThrow();
  }
});
