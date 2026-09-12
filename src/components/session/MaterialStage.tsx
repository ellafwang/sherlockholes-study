import { FileText, ListPlus, Plus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { SherlockFace } from "@/components/SherlockFace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { readNotesFile } from "@/lib/read-documents";

const DURATIONS = [60, 120, 180, 240, 300];

export function MaterialStage({
  initialNotes,
  initialConcepts,
  initialLimit,
  busy,
  onStart,
}: {
  initialNotes: string;
  initialConcepts: string[];
  initialLimit: number;
  busy: boolean;
  onStart: (payload: { notes: string; concepts: string[]; limit: number }) => void;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [concepts, setConcepts] = useState<string[]>(initialConcepts);
  const [draft, setDraft] = useState("");
  const [limit, setLimit] = useState(initialLimit || 180);
  const [sources, setSources] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const addConcept = () => {
    const value = draft.trim();
    if (!value) return;
    setConcepts((current) => [...current, value]);
    setDraft("");
  };

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

  const ready = notes.trim().length > 20 || concepts.length > 0;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-5 py-8 lg:grid-cols-[1fr_320px]">
      <div className="animate-rise-in">
        <h2 className="text-2xl font-semibold">Give Sherlock the case file</h2>
        <p className="mt-1 text-muted-foreground">
          He knows nothing about this topic. Hand him your notes, or just list what you plan to
          cover — he'll use it to spot what you leave out.
        </p>

        <Tabs defaultValue="notes" className="mt-6">
          <TabsList>
            <TabsTrigger value="notes">
              <FileText className="mr-2 h-4 w-4" /> Notes
            </TabsTrigger>
            <TabsTrigger value="concepts">
              <ListPlus className="mr-2 h-4 w-4" /> Key concepts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="space-y-3">
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
              accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.rtf,application/pdf,text/plain"
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
                PDF, Word (.docx), text, markdown or CSV — several at once.
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
          </TabsContent>

          <TabsContent value="concepts" className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={draft}
                placeholder="e.g. Carbocation stability"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addConcept();
                  }
                }}
              />
              <Button onClick={addConcept} disabled={!draft.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {concepts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add each concept you intend to explain. Sherlock will check them off as you go.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {concepts.map((concept, index) => (
                  <li
                    key={`${concept}-${index}`}
                    className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm"
                  >
                    {concept}
                    <button
                      type="button"
                      aria-label={`Remove ${concept}`}
                      onClick={() => setConcepts((current) => current.filter((_, i) => i !== index))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

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
          onClick={() => onStart({ notes: notes.trim(), concepts, limit })}
        >
          {busy ? "Sherlock is reading…" : "Teach Sherlock!"}
        </Button>
        {!ready && (
          <p className="mt-2 text-sm text-muted-foreground">
            Add some notes or at least one concept first.
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
