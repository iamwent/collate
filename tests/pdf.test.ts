import { describe, expect, test } from "bun:test";
import { PDFDocument, degrees } from "pdf-lib";
import { exportPDF, movePages, parseRange, readPDF, reorder, replacePages } from "../src/pdf";

async function fixture(name: string, widths: number[], rotation = 0) {
  const pdf = await PDFDocument.create();
  for (const width of widths) pdf.addPage([width, 400]).setRotation(degrees(rotation));
  return readPDF(name, await pdf.save());
}
async function inspect(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map(page => [page.getWidth(), page.getRotation().angle]);
}

describe("PDF page operations", () => {
  test("merge, delete, rotate, reorder and replace survive an export/reload", async () => {
    const a = await fixture("a.pdf", [100, 200, 300], 90);
    const b = await fixture("b.pdf", [500, 600]);
    const merged = [...a, ...b];
    expect((await PDFDocument.load(await exportPDF(merged))).getPageCount()).toBe(5);
    const deleted = merged.filter(p => p !== a[1]);
    const rotated = deleted.map(p => p === a[0] ? { ...p, rotation: 270 } : p);
    const ordered = reorder(rotated, "4, 1, 3, 2");
    const replacement = await fixture("replacement.pdf", [700, 800], 180);
    const replaced = replacePages(ordered, new Set([ordered[0]!.id, ordered[2]!.id]), replacement);
    expect(await inspect(await exportPDF(replaced))).toEqual([[700, 180], [100, 0], [800, 180], [300, 90]]);
    // Export does not mutate imported rotations or the original workspace.
    expect(a[0]!.source.document.getPage(0).getRotation().angle).toBe(90);
    expect(await inspect(await exportPDF(a))).toEqual([[100, 90], [200, 90], [300, 90]]);
  });
  test("split uses current workspace order and produces independent files", async () => {
    const pages = reorder(await fixture("a.pdf", [100, 200, 300, 400]), "4, 2, 1, 3");
    const groups = ["1, 3", "2, 4"].map(range => parseRange(range, pages.length).map(i => pages[i]!));
    expect(await inspect(await exportPDF(groups[0]!))).toEqual([[400, 0], [100, 0]]);
    expect(await inspect(await exportPDF(groups[1]!))).toEqual([[200, 0], [300, 0]]);
    expect(await inspect(await exportPDF(pages))).toEqual([[400, 0], [200, 0], [100, 0], [300, 0]]);
  });
  test("batch drag keeps relative order", async () => {
    const pages = await fixture("a.pdf", [100, 200, 300, 400, 500]);
    const selected = new Set([pages[0]!.id, pages[2]!.id]);
    expect(movePages(pages, selected, pages[4]!.id).map(p => p.index)).toEqual([1, 3, 0, 2, 4]);
    expect(movePages(pages, selected, pages[2]!.id)).toEqual(pages);
  });
  test("invalid ranges, partial orders, mismatched replacements and empty exports fail safely", async () => {
    const pages = await fixture("a.pdf", [100, 200, 300]);
    expect(parseRange("3，1-2", 3)).toEqual([2, 0, 1]);
    for (const range of ["", "0", "4", "2-1", "1,1", "1,", "1.2", "1-4", "-1"]) expect(() => parseRange(range, 3)).toThrow();
    expect(() => reorder(pages, "1-2")).toThrow();
    expect(() => replacePages(pages, new Set([pages[0]!.id]), pages)).toThrow();
    await expect(exportPDF([])).rejects.toThrow();
    await expect(readPDF("broken.pdf", new Uint8Array([1, 2]))).rejects.toThrow("无法读取");
  });
});
