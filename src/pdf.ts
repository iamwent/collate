import { PDFDocument, degrees } from "pdf-lib";

export interface Source {
  id: string;
  name: string;
  bytes: Uint8Array;
  document: PDFDocument;
}
export interface Page {
  id: string;
  source: Source;
  index: number;
  rotation: number;
}

export async function readPDF(name: string, bytes: Uint8Array): Promise<Page[]> {
  let document: PDFDocument;
  try {
    document = await PDFDocument.load(bytes);
  } catch (error) {
    if (error instanceof Error && error.message.includes("encrypted")) {
      throw new Error(`「${name}」已加密，请先解除密码保护。`);
    }
    throw new Error(`无法读取「${name}」，请确认它是未损坏的 PDF。`);
  }
  if (!document.getPageCount()) throw new Error(`「${name}」没有可用页面。`);
  // Flatten existing form fields so page copies retain their visible values.
  const form = document.getForm();
  if (form.getFields().length) {
    try { form.flatten({ updateFieldAppearances: false }); }
    catch { throw new Error(`「${name}」包含无法保留外观的表单，请先将表单扁平化。`); }
  }
  const source: Source = { id: crypto.randomUUID(), name, bytes, document };
  return document.getPages().map((_, index) => ({
    id: crypto.randomUUID(), source, index, rotation: 0,
  }));
}

export async function exportPDF(pages: readonly Page[]): Promise<Uint8Array> {
  if (!pages.length) throw new Error("至少保留一页才能导出 PDF。");
  const output = await PDFDocument.create();
  // Copy in source batches while adding pages in the exact workspace order.
  const copies = new Map<string, Map<number, import("pdf-lib").PDFPage>>();
  for (const page of pages) {
    if (copies.has(page.source.id)) continue;
    const indices = [...new Set(pages.filter(p => p.source.id === page.source.id).map(p => p.index))];
    const copied = await output.copyPages(page.source.document, indices);
    copies.set(page.source.id, new Map(indices.map((index, i) => [index, copied[i]!])));
  }
  for (const page of pages) {
    const copied = copies.get(page.source.id)!.get(page.index)!;
    // A source page appears once in a workspace; each split has its own output.
    copied.setRotation(degrees((page.source.document.getPage(page.index).getRotation().angle + page.rotation) % 360));
    output.addPage(copied);
  }
  return output.save();
}

/** One-based page numbers/ranges in the order entered. */
export function parseRange(value: string, count: number): number[] {
  if (!value.trim()) throw new Error("请输入页码，例如 1-3, 5。");
  const result: number[] = [];
  for (const part of value.replaceAll("，", ",").split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error(`页码格式不正确：${part || "空页码"}。`);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end > count || start > end) throw new Error(`页码必须在 1–${count} 之间，范围从小到大填写。`);
    for (let i = start; i <= end; i++) {
      if (result.includes(i - 1)) throw new Error(`页码 ${i} 重复出现。`);
      result.push(i - 1);
    }
  }
  return result;
}

export function reorder(pages: readonly Page[], order: string): Page[] {
  const indices = parseRange(order, pages.length);
  if (indices.length !== pages.length) throw new Error("重排时须包含所有页面，且每页只出现一次。");
  return indices.map(i => pages[i]!);
}

export function replacePages(pages: readonly Page[], selected: ReadonlySet<string>, replacements: readonly Page[]): Page[] {
  if (!selected.size || replacements.length !== selected.size) throw new Error("替换页数必须与所选页数相同。");
  let next = 0;
  return pages.map(page => selected.has(page.id) ? replacements[next++]! : page);
}

export function movePages(pages: readonly Page[], selected: ReadonlySet<string>, target: string): Page[] {
  if (selected.has(target)) return [...pages];
  const moving = pages.filter(p => selected.has(p.id));
  const rest = pages.filter(p => !selected.has(p.id));
  const index = rest.findIndex(p => p.id === target);
  if (index < 0) return [...pages];
  return [...rest.slice(0, index), ...moving, ...rest.slice(index)];
}
