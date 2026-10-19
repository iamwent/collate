import { isMyGo } from "mygo-runtime";
import { Files } from "./mygo";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { zip } from "fflate";
import { exportPDF, movePages, parseRange, readPDF, reorder, replacePages, type Page } from "./pdf";

let renderer: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | undefined;
function pdfRenderer() {
  return renderer ??= import("pdfjs-dist/legacy/build/pdf.mjs").then(module => {
    module.GlobalWorkerOptions.workerSrc = workerUrl;
    return module;
  });
}
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const input = $<HTMLInputElement>("#file-input");
const grid = $("#pages");
const dialog = $<HTMLDialogElement>("#operation-dialog");
// All PDF.js resources follow the deployment base, including /collate/ on Pages.
const pdfAssetsURL = new URL(`${import.meta.env.BASE_URL}pdf-assets/`, document.baseURI);
const rangeInput = $<HTMLTextAreaElement>("#range-input");
let pages: Page[] = [];
let selected = new Set<string>();
let undo: Page[][] = [];
let redo: Page[][] = [];
let busy = false;
let anchor = -1;
let savedKey = "";
let fileMode: "merge" | "replace" = "merge";
let dialogMode = "";
let replacements: Page[] = [];
let dragIds = new Set<string>();
const previews = new Map<string, Promise<PDFDocumentProxy>>();
const thumbnails = new Map<string, string>();
let renderQueue = Promise.resolve();

function key() { return pages.map(p => `${p.id}:${p.rotation}`).join("|"); }
function message(text: string, error = false) {
  $("#status").textContent = text;
  $("#status").classList.toggle("error", error);
}
function updateControls() {
  const count = selected.size;
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-action]")) {
    const action = button.dataset.action;
    button.disabled = busy || (action === "undo" ? !undo.length : action === "redo" ? !redo.length :
      ["delete", "rotate", "replace"].includes(action!) ? !count : action === "merge" ? false : !pages.length);
  }
  const all = $<HTMLInputElement>("#select-all");
  all.disabled = busy || !pages.length;
  all.checked = !!pages.length && count === pages.length;
  all.indeterminate = count > 0 && count < pages.length;
  $("#selection-count").textContent = count ? `已选 ${count} / ${pages.length} 页` : `${pages.length} 页`;
  $("#document-name").textContent = pages.length ? (new Set(pages.map(p => p.source.id)).size === 1 ? pages[0]!.source.name : "合并文档.pdf") : "还没有打开文件";
  $("#document-meta").textContent = pages.length ? `${pages.length} 页 · ${new Set(pages.map(p => p.source.id)).size} 个来源文件${key() !== savedKey ? " · 待导出" : " · 已导出"}` : "从一个 PDF 开始，也可以一次添加多个文件";
  document.title = `${pages.length && key() !== savedKey ? "● " : ""}Collate · PDF 页面工具`;
  $("#confirm-dialog").toggleAttribute("disabled", busy);
  $("#split-each").toggleAttribute("disabled", busy);
  grid.setAttribute("aria-busy", String(busy));
}
async function task(action: () => Promise<void>) {
  if (busy) return;
  busy = true;
  updateControls();
  try { await action(); }
  catch (error) { message(error instanceof Error ? error.message : String(error), true); }
  finally { busy = false; updateControls(); }
}
function commit(next: Page[], text: string) {
  undo.push(pages);
  if (undo.length > 40) undo.shift();
  redo = [];
  pages = next;
  selected = new Set([...selected].filter(id => pages.some(p => p.id === id)));
  anchor = -1;
  render();
  message(text);
}
function select(page: Page, index: number, shift: boolean) {
  if (busy) return;
  if (shift && anchor >= 0) {
    for (let i = Math.min(anchor, index); i <= Math.max(anchor, index); i++) selected.add(pages[i]!.id);
  } else {
    if (selected.has(page.id)) selected.delete(page.id); else selected.add(page.id);
    anchor = index;
  }
  updateSelection();
}
function updateSelection() {
  for (const card of grid.querySelectorAll<HTMLElement>(".page-card")) {
    const checked = selected.has(card.dataset.id!);
    card.classList.toggle("selected", checked);
    card.setAttribute("aria-checked", String(checked));
  }
  updateControls();
}
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    observer.unobserve(entry.target);
    const card = entry.target as HTMLElement;
    const page = pages.find(p => p.id === card.dataset.id);
    if (!page) continue;
    renderQueue = renderQueue.then(async () => {
      if (!card.isConnected) return;
      const cacheKey = `${page.id}:${page.rotation}`;
      try {
        let thumbnail = thumbnails.get(cacheKey);
        if (!thumbnail) {
          let document = previews.get(page.source.id);
          if (!document) {
            const { getDocument } = await pdfRenderer();
            document = getDocument({ data: page.source.bytes.slice(), cMapUrl: new URL("cmaps/", pdfAssetsURL).href, cMapPacked: true, standardFontDataUrl: new URL("standard_fonts/", pdfAssetsURL).href, wasmUrl: new URL("wasm/", pdfAssetsURL).href, iccUrl: new URL("iccs/", pdfAssetsURL).href }).promise;
            previews.set(page.source.id, document);
          }
          const sourcePage = await (await document).getPage(page.index + 1);
          const rotation = (sourcePage.rotate + page.rotation) % 360;
          const original = sourcePage.getViewport({ scale: 1, rotation });
          const viewport = sourcePage.getViewport({ scale: Math.min(360 / original.width, 400 / original.height), rotation });
          const canvas = documentWindow.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await sourcePage.render({ canvas, viewport }).promise;
          thumbnail = canvas.toDataURL("image/webp", .85);
          thumbnails.set(cacheKey, thumbnail);
          sourcePage.cleanup();
          canvas.width = canvas.height = 0;
        }
        if (!card.isConnected) return;
        const image = documentWindow.createElement("img");
        image.src = thumbnail;
        image.alt = "";
        image.draggable = false;
        card.querySelector(".page-preview")!.replaceChildren(image);
      } catch {
        if (card.isConnected) card.querySelector(".preview-placeholder")!.textContent = "预览不可用 · 仍可整理页面";
      }
    });
  }
}, { rootMargin: "250px" });
// Keep the DOM document distinct from PDF.js documents in async thumbnail work.
const documentWindow = document;
function render() {
  // Undo keeps at most 40 snapshots. Release documents and thumbnails once
  // their pages are no longer reachable through the workspace or history.
  const retained = [...pages, ...undo.flat(), ...redo.flat()];
  const sourceIds = new Set(retained.map(page => page.source.id));
  const pageIds = new Set(retained.map(page => page.id));
  for (const [id, preview] of previews) {
    if (!sourceIds.has(id)) {
      previews.delete(id);
      void preview.then(document => document.loadingTask.destroy()).catch(() => {});
    }
  }
  for (const cacheKey of thumbnails.keys()) {
    if (!pageIds.has(cacheKey.split(":")[0]!)) thumbnails.delete(cacheKey);
  }
  observer.disconnect();
  grid.replaceChildren();
  grid.hidden = !pages.length;
  $("#empty").hidden = !!pages.length;
  pages.forEach((page, index) => {
    const card = document.createElement("article");
    card.className = "page-card";
    card.dataset.id = page.id;
    card.tabIndex = 0;
    card.draggable = true;
    card.setAttribute("role", "checkbox");
    card.setAttribute("aria-label", `第 ${index + 1} 页，来自 ${page.source.name} 第 ${page.index + 1} 页`);
    card.innerHTML = '<span class="check" aria-hidden="true">✓</span><div class="page-preview"><span class="preview-placeholder">正在准备预览…</span></div><div class="page-label"><strong></strong><div class="page-move"><button aria-label="向前移动" title="向前移动">‹</button><button aria-label="向后移动" title="向后移动">›</button></div></div><p class="page-source"></p>';
    card.querySelector("strong")!.textContent = `第 ${index + 1} 页`;
    const sourceLabel = card.querySelector<HTMLElement>(".page-source")!;
    sourceLabel.textContent = `${page.source.name} · ${page.index + 1}${page.rotation ? ` · +${page.rotation}°` : ""}`;
    sourceLabel.title = sourceLabel.textContent;
    card.addEventListener("click", e => { if (!(e.target as HTMLElement).closest("button")) select(page, index, e.shiftKey); });
    card.addEventListener("keydown", e => {
      if (e.target === card && (e.key === " " || e.key === "Enter")) { e.preventDefault(); select(page, index, e.shiftKey); }
    });
    card.querySelectorAll("button").forEach((button, direction) => {
      const target = index + (direction ? 1 : -1);
      button.disabled = target < 0 || target >= pages.length;
      button.addEventListener("click", () => {
        if (busy) return;
        const next = [...pages];
        [next[index], next[target]] = [next[target]!, next[index]!];
        commit(next, "已调整页面顺序");
        (grid.children[target] as HTMLElement)?.focus();
      });
    });
    card.addEventListener("dragstart", e => {
      if (busy) { e.preventDefault(); return; }
      dragIds = selected.has(page.id) ? new Set(selected) : new Set([page.id]);
      e.dataTransfer!.setData("text/plain", page.id);
      e.dataTransfer!.effectAllowed = "move";
    });
    card.addEventListener("dragover", e => {
      if (!dragIds.size || busy) return;
      e.preventDefault();
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("dragend", () => { dragIds.clear(); grid.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over")); });
    card.addEventListener("drop", e => {
      if (!dragIds.size || busy) return;
      e.preventDefault(); e.stopPropagation();
      const next = movePages(pages, dragIds, page.id);
      dragIds.clear();
      if (next.some((p, i) => p.id !== pages[i]!.id)) commit(next, "已调整页面顺序");
      else card.classList.remove("drag-over");
    });
    grid.append(card);
    observer.observe(card);
  });
  updateSelection();
}

function openDialog(mode: string) {
  dialogMode = mode;
  $("#dialog-error").textContent = "";
  rangeInput.hidden = mode === "clear";
  $("#range-label").hidden = mode === "clear";
  $("#split-each").hidden = mode !== "split";
  const titles: Record<string, string> = { split: "拆分 PDF", reorder: "重排页面", replace: "替换所选页面", clear: "清空工作台" };
  $("#dialog-title").textContent = titles[mode]!;
  const descriptions: Record<string, string> = {
    split: "每行生成一份 PDF，例如 1-3, 5。页码以当前工作台顺序为准。\n多份文件会打包成 ZIP；可只导出需要的页面。",
    reorder: "输入完整页序，例如 3, 1-2。须包含当前所有页面，每页只出现一次。",
    replace: `来源：${replacements[0]?.source.name}\n输入替换文件中的页码，按输入顺序替换当前所选的 ${selected.size} 页。`,
    clear: "这会移除当前所有页面。清空后仍可撤销，原文件不受影响。",
  };
  $("#dialog-description").textContent = descriptions[mode]!;
  rangeInput.value = mode === "replace" ? `1${selected.size > 1 ? `-${Math.min(selected.size, replacements.length)}` : ""}` : mode === "split" && selected.size ? pages.map((p, i) => selected.has(p.id) ? i + 1 : null).filter(i => i !== null).join(", ") : `1${pages.length > 1 ? `-${pages.length}` : ""}`;
  $("#confirm-dialog").textContent = mode === "split" ? "导出拆分结果" : mode === "clear" ? "清空" : "确认";
  dialog.showModal();
  if (mode !== "clear") rangeInput.focus();
}
async function importFiles(files: File[], mode: "merge" | "replace") {
  if (!files.length) return;
  await task(async () => {
    message("正在读取 PDF…");
    const incoming: Page[] = [];
    for (const file of files) incoming.push(...await readPDF(file.name, new Uint8Array(await file.arrayBuffer())));
    if (mode === "replace") {
      replacements = incoming;
      openDialog("replace");
      message(`已读取替换文件，共 ${incoming.length} 页`);
    } else {
      commit([...pages, ...incoming], `已添加 ${files.length} 个 PDF，共 ${incoming.length} 页`);
    }
  });
}
function basename() { return (pages[0]?.source.name ?? "document.pdf").replace(/\.pdf$/i, ""); }
async function save(name: string, bytes: Uint8Array) {
  if (isMyGo()) {
    const blob = new Blob([new Uint8Array(bytes)]);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]!);
      reader.onerror = () => reject(new Error("无法读取导出数据"));
      reader.readAsDataURL(blob);
    });
    return Files.save(name, base64);
  }
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
async function action(name: string) {
  if (busy) return;
  switch (name) {
    case "merge": case "replace":
      if (name === "replace" && !selected.size) return;
      fileMode = name;
      input.multiple = name === "merge";
      input.value = ""; input.click(); break;
    case "delete":
      if (!selected.size) return;
      commit(pages.filter(p => !selected.has(p.id)), `已删除 ${selected.size} 页，可撤销`); break;
    case "rotate":
      if (!selected.size) return;
      commit(pages.map(p => selected.has(p.id) ? { ...p, rotation: (p.rotation + 90) % 360 } : p), `已旋转 ${selected.size} 页`); break;
    case "undo": case "redo": {
      const from = name === "undo" ? undo : redo;
      const to = name === "undo" ? redo : undo;
      const previous = from.pop();
      if (!previous) return;
      to.push(pages); pages = previous; selected.clear(); anchor = -1;
      render(); message(name === "undo" ? "已撤销" : "已重做"); break;
    }
    case "split": case "reorder": case "clear":
      if (pages.length) openDialog(name); break;
    case "export":
      if (!pages.length) return;
      await task(async () => {
        message("正在生成 PDF…");
        if (await save(`${basename()}-edited.pdf`, await exportPDF(pages))) {
          savedKey = key(); message("已导出 PDF");
        } else message("已取消导出，页面仍保留在工作台");
      }); break;
  }
}

document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach(button => button.addEventListener("click", () => void action(button.dataset.action!)));
input.addEventListener("change", () => void importFiles(Array.from(input.files ?? []), fileMode));
$("#select-all").addEventListener("change", () => {
  selected = $<HTMLInputElement>("#select-all").checked ? new Set(pages.map(p => p.id)) : new Set();
  updateSelection();
});
function closeDialog() { if (!busy) { dialog.close(); replacements = []; } }
$("#close-dialog").addEventListener("click", closeDialog);
$("#cancel-dialog").addEventListener("click", closeDialog);
dialog.addEventListener("cancel", e => { if (busy) e.preventDefault(); else replacements = []; });
$("#split-each").addEventListener("click", () => { rangeInput.value = pages.map((_, i) => i + 1).join("\n"); });
$("#operation-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (busy) return;
  $("#dialog-error").textContent = "";
  try {
    if (dialogMode === "clear") { commit([], "工作台已清空，可撤销"); closeDialog(); return; }
    if (dialogMode === "reorder") { commit(reorder(pages, rangeInput.value), "已应用新的页序"); closeDialog(); return; }
    if (dialogMode === "replace") {
      const indices = parseRange(rangeInput.value, replacements.length);
      commit(replacePages(pages, selected, indices.map(i => replacements[i]!)), "已替换所选页面，可撤销");
      closeDialog(); return;
    }
    const lines = rangeInput.value.trim().split(/\n/);
    const groups = lines.map(line => parseRange(line, pages.length).map(i => pages[i]!));
    await task(async () => {
      message("正在生成拆分结果…");
      try {
        let saved: boolean;
        if (groups.length === 1) saved = await save(`${basename()}-split.pdf`, await exportPDF(groups[0]!));
        else {
          const files: Record<string, Uint8Array> = {};
          for (let i = 0; i < groups.length; i++) files[`${basename()}-${String(i + 1).padStart(3, "0")}.pdf`] = await exportPDF(groups[i]!);
          const bytes = await new Promise<Uint8Array>((resolve, reject) => zip(files, { level: 0 }, (err, data) => err ? reject(err) : resolve(data)));
          saved = await save(`${basename()}-split.zip`, bytes);
        }
        if (saved) { dialog.close(); message(`已导出 ${groups.length} 份 PDF`); }
        else message("已取消导出");
      } catch (error) {
        $("#dialog-error").textContent = error instanceof Error ? error.message : String(error);
        throw error;
      }
    });
  } catch (error) { $("#dialog-error").textContent = error instanceof Error ? error.message : String(error); }
});
let dragDepth = 0;
document.addEventListener("dragenter", e => {
  if (!e.dataTransfer?.types.includes("Files")) return;
  e.preventDefault(); dragDepth++; $(".app").classList.add("dragging-files");
});
document.addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; $(".app").classList.remove("dragging-files"); } });
document.addEventListener("dragover", e => { if (e.dataTransfer?.types.includes("Files")) e.preventDefault(); });
document.addEventListener("drop", e => {
  if (!e.dataTransfer?.types.includes("Files")) return;
  e.preventDefault(); dragDepth = 0; $(".app").classList.remove("dragging-files");
  if (busy || dialog.open) return;
  void importFiles(Array.from(e.dataTransfer.files), "merge");
});
document.addEventListener("keydown", e => {
  if (dialog.open || (e.target as HTMLElement).matches("input,textarea")) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); void action(e.shiftKey ? "redo" : "undo"); }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") { e.preventDefault(); if (!busy) { selected = new Set(pages.map(p => p.id)); updateSelection(); } }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void action("export"); }
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); void action("delete"); }
});
window.addEventListener("beforeunload", e => { if (pages.length && key() !== savedKey) e.preventDefault(); });
render();
