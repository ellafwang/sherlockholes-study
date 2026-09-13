/**
 * Turns uploaded files into plain notes text, in the browser.
 * Handles PDFs, Word (.docx), and any plain-text/markdown/csv style file.
 */

const MAX_BYTES = 25_000_000;

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjs;
}

/** Max pages we photograph and hand to the scanner, to keep uploads quick. */
const MAX_SCAN_PAGES = 20;

async function readPdf(file: File): Promise<string> {
  const pdfjs = await loadPdfjs();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let page = 1; page <= pdf.numPages; page += 1) {
    const content = await (await pdf.getPage(page)).getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pages.push(text);
  }
  return pages.join("\n\n");
}

/** Turns each page of a PDF into a picture so handwriting can be read. */
async function scanPdf(file: File, onProgress?: Progress): Promise<string> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const count = Math.min(pdf.numPages, MAX_SCAN_PAGES);

  // Photograph the pages first (fast, main thread), then read them together.
  const shots: string[] = [];
  for (let index = 1; index <= count; index += 1) {
    const page = await pdf.getPage(index);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) continue;
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    shots.push(canvas.toDataURL("image/jpeg", 0.85));
    onProgress?.(`Photographing page ${index} of ${count}…`);
  }

  let done = 0;
  onProgress?.(`Reading ${shots.length} page${shots.length === 1 ? "" : "s"} of handwriting…`);
  const texts = await mapWithLimit(shots, 4, async (dataUrl) => {
    const text = await scanPicture(dataUrl);
    done += 1;
    onProgress?.(`Read ${done} of ${shots.length} pages…`);
    return text;
  });

  return texts
    .map((text, index) => (text ? (shots.length > 1 ? `Page ${index + 1}\n${text}` : text) : ""))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

type Progress = (message: string) => void;

/** Runs the work a few items at a time so many pages don't queue up one by one. */
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await work(items[index]!, index);
    }
  });
  await Promise.all(runners);
  return results;
}


async function readDocx(file: File): Promise<string> {
  const mammoth = (await import("mammoth/mammoth.browser.js")) as {
    extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value.trim();
}

async function readPptx(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slides = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort(
      (a, b) =>
        Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0),
    );

  const parts: string[] = [];
  for (const [index, path] of slides.entries()) {
    const xml = await zip.files[path]!.async("string");
    const lines = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
      .map((match) =>
        match[1]!
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .trim(),
      )
      .filter(Boolean);
    if (lines.length > 0) parts.push(`Slide ${index + 1}\n${lines.join("\n")}`);
  }
  return parts.join("\n\n");
}

async function toDataUrl(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buffer.length; i += 8192) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
  }
  const type = file.type || "image/png";
  return `data:${type};base64,${btoa(binary)}`;
}

/** Hands one picture to the note scanner, which reads handwriting and print alike. */
async function scanPicture(dataUrl: string): Promise<string> {
  const { readImageNotes } = await import("./documents.functions");
  const result = await readImageNotes({ data: { dataUrl } });
  return result.text.trim();
}

async function readImage(file: File): Promise<string> {
  return scanPicture(await toDataUrl(file));
}

export type ReadResult = { name: string; text: string } | { name: string; error: string };

export async function readNotesFile(
  file: File,
  onProgress?: Progress,
): Promise<ReadResult> {
  if (file.size > MAX_BYTES) {
    return { name: file.name, error: "that file is too large — try a shorter section" };
  }

  const ext = extensionOf(file.name);
  try {
    const imageExts = [
      "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "avif", "heic", "heif",
    ];
    if (imageExts.includes(ext) || file.type.startsWith("image/")) {
      onProgress?.("Reading the handwriting in your picture…");
      const text = await readImage(file);
      if (!text) {
        return { name: file.name, error: "no readable writing was found in that picture" };
      }
      return { name: file.name, text };
    }

    if (ext === "pptx") {
      const text = await readPptx(file);
      if (!text) return { name: file.name, error: "that slide deck had no readable text" };
      return { name: file.name, text };
    }

    if (ext === "ppt") {
      return {
        name: file.name,
        error: "older PowerPoint files can't be read — save it as .pptx or PDF first",
      };
    }

    if (ext === "pdf" || file.type === "application/pdf") {
      const text = await readPdf(file);
      if (text) return { name: file.name, text };
      // No selectable text: it's a scan or handwritten pages, so read the pictures.
      const scanned = await scanPdf(file, onProgress);
      if (!scanned) {
        return { name: file.name, error: "no readable writing was found in that file" };
      }
      return { name: file.name, text: scanned };
    }


    if (ext === "docx") {
      const text = await readDocx(file);
      if (!text) return { name: file.name, error: "that Word file looked empty" };
      return { name: file.name, text };
    }

    if (ext === "doc" || ext === "pages") {
      return {
        name: file.name,
        error: "older Word/Pages files can't be read — save it as .docx or PDF first",
      };
    }

    const text = (await file.text()).trim();
    const readable = text.replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]/g, "");
    if (text && readable.length >= text.length * 0.85) {
      return { name: file.name, text: readable };
    }

    // Not readable as writing — treat it as a picture of notes and scan it.
    const scanned = await scanPicture(await toDataUrl(file));
    if (scanned) return { name: file.name, text: scanned };
    return { name: file.name, error: "no readable writing was found in that file" };
  } catch (cause) {
    console.error(cause);
    return { name: file.name, error: "that file couldn't be opened" };
  }
}
