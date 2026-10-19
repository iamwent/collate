import { appendFileSync } from "node:fs";

/** Keep tag-derived versions safe for app metadata, filenames and shell arguments. */
export function releaseVersion(tag: string): string {
  const version = tag.replace(/^v/, "");
  if (version.trim() !== version || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?$/.test(version)) {
    throw new Error(`Tag must be a release version such as v1.2.3 or v1.2.3-beta.1: ${tag}`);
  }
  return version;
}

if (import.meta.main) {
  if (process.env.GITHUB_REF_TYPE !== "tag") throw new Error("Packaging is only allowed for tag pushes.");
  const version = releaseVersion(process.env.GITHUB_REF_NAME ?? "");
  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required.");
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nprerelease=${version.includes("-")}\n`);
  console.log(`Release version: ${version}`);
}
