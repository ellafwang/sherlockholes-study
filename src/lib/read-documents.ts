/**
 * Turns uploaded files into plain notes text, in the browser.
 * Handles PDFs, Word (.docx), and any plain-text/markdown/csv style file.
 */

const MAX_BYTES = 25_000_000;

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

async function readPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

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

async function readImage(file: File): Promise<string> {
  const { readImageNotes } = await import("./documents.functions");
  const result = await readImageNotes({ data: { dataUrl: await toDataUrl(file) } });
  return result.text.trim();
}

export type ReadResult = { name: string; text: string } | { name: string; error: string };

export async function readNotesFile(file: File): Promise<ReadResult> {
  if (file.size > MAX_BYTES) {
    return { name: file.name, error: "that file is too large — try a shorter section" };
  }

  const ext = extensionOf(file.name);
  try {
    if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext) || file.type.startsWith("image/")) {
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
      if (!text) {
        return {
          name: file.name,
          error: "that PDF has no readable text (it may be a scan) — paste the section instead",
        };
      }
      return { name: file.name, text };
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
    if (!text) return { name: file.name, error: "that file looked empty" };
    // A stray binary file read as text turns into mostly unreadable characters.
    const readable = text.replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]/g, "");
    if (readable.length < text.length * 0.85) {
      return { name: file.name, error: "that file type can't be read — try a PDF, Word file or text" };
    }
    return { name: file.name, text: readable };
  } catch (cause) {
    console.error(cause);
    return { name: file.name, error: "that file couldn't be opened" };
  }
}
