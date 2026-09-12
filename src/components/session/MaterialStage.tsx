import { FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { SherlockFace } from "@/components/SherlockFace";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readNotesFile } from "@/lib/read-documents";

const DURATIONS = [60, 120, 180, 240, 300];

export function MaterialStage({
  initialNotes,
  initialLimit,
  busy,
  onStart,
}: {
  initialNotes: string;
  initialLimit: number;
  busy: boolean;
  onStart: (payload: { notes: string; concepts: string[]; limit: number }) => void;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [limit, setLimit] = useState(initialLimit || 180);
  const [sources, setSources] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const readFiles = async (files: File[]) => {
    setReading(true);
    try {
      const results = await Promise.all(files.map((file) => readNotesFile(file)));
      const added: string[] = [];
      let blob = "";
      for (const result of results) {
        if ("error" in result) {
          toast.error(`${result.name}: ${result.error}`);
          continue;
        }
        added.push(result.name);
        blob += `${blob ? "\n\n" : ""}--- ${result.name} ---\n${result.text}`;
      }
      if (!blob) return;
      setNotes((current) => (current ? `${current}\n\n${blob}` : blob));
      setSources((current) => [...current, ...added]);
      toast.success(
        added.length === 1 ? `Added notes from ${added[0]}` : `Added notes from ${added.length} files`,
      );
    } finally {
      setReading(false);
    }
  };

  const ready = notes.trim().length > 20;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-5 py-8 lg:grid-cols-[1fr_320px]">
      <div className="animate-rise-in">
        <h2 className="text-2xl font-semibold">Give Sherlock the case file</h2>
        <p className="mt-1 text-muted-foreground">
          He knows nothing about this topic. Hand him your notes — typed, pasted or uploaded. Every
          question he asks will come from what you give him here, nothing more.
        </p>

        <div className="mt-6 space-y-3">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Paste your lecture notes, textbook section or summary here…"
            className="min-h-56"
          />
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".pdf,.docx,.pptx,.txt,.md,.markdown,.csv,.json,.rtf,.png,.jpg,.jpeg,.webp,.gif,application/pdf,text/plain,image/*"
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 0) void readFiles(files);
              event.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              disabled={reading}
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {reading ? "Reading your files…" : "Upload files"}
            </Button>
            <span className="text-sm text-muted-foreground">
              PDF, Word, PowerPoint, photos or screenshots, text, markdown or CSV — several at once.
            </span>
          </div>
          {sources.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {sources.map((name, index) => (
                <li
                  key={`${name}-${index}`}
                  className="rounded-full border border-border px-3 py-1 text-sm"
                >
                  <FileText className="mr-1 inline h-3.5 w-3.5" />
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-8">
          <Label className="label-caps">How long will you speak?</Label>
          <div className="mt-3 flex flex-wrap gap-2">
            {DURATIONS.map((seconds) => (
              <Button
                key={seconds}
                variant={limit === seconds ? "default" : "secondary"}
                onClick={() => setLimit(seconds)}
              >
                {seconds / 60} min
              </Button>
            ))}
          </div>
        </div>

        <Button
          size="lg"
          className="mt-8"
          disabled={!ready || busy}
          onClick={() => onStart({ notes: notes.trim(), concepts: [], limit })}
        >
          {busy ? "Sherlock is reading…" : "Teach Sherlock!"}
        </Button>
        {!ready && (
          <p className="mt-2 text-sm text-muted-foreground">
            Add your notes, or upload a file, to begin.
          </p>
        )}
      </div>

      <aside className="case-file flex flex-col items-center justify-center p-6">
        <SherlockFace verdict="neutral" size="md" />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          “I've read nothing on this. Explain it to me as though I'm brand new — because I am.”
        </p>
      </aside>
    </div>
  );
}
