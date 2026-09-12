import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CaseFileIcon, MagnifierIcon } from "@/components/MysteryIcons";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createNotebook, deleteNotebook, listNotebooks, updateNotebook, type Notebook } from "@/lib/db";

const NOTEBOOK_COLORS = [
  { value: "gold", label: "Gold", className: "bg-notebook-gold" },
  { value: "crimson", label: "Crimson", className: "bg-notebook-crimson" },
  { value: "forest", label: "Forest green", className: "bg-notebook-forest" },
  { value: "navy", label: "Navy blue", className: "bg-notebook-navy" },
  { value: "plum", label: "Plum", className: "bg-notebook-plum" },
  { value: "charcoal", label: "Charcoal", className: "bg-notebook-charcoal" },
] as const;

const notebookColorClass = (color: string | undefined) =>
  NOTEBOOK_COLORS.find((option) => option.value === color)?.className ?? "bg-notebook-gold";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sherlock Holes — Study Desk" },
      {
        name: "description",
        content:
          "Your notebooks of teaching sessions. Explain a topic out loud to Sherlock, answer his questions, then learn what you missed.",
      },
      { property: "og:title", content: "Sherlock Holes — Study Desk" },
      {
        property: "og:description",
        content: "Notebooks of Feynman-technique sessions: teach, get quizzed, close the holes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const queryClient = useQueryClient();
  const notebooks = useQuery({ queryKey: ["notebooks"], queryFn: listNotebooks });

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [color, setColor] = useState("gold");
  const [pendingDelete, setPendingDelete] = useState<Notebook | null>(null);
  const [editing, setEditing] = useState<Notebook | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editColor, setEditColor] = useState("gold");

  const openEditor = (notebook: Notebook) => {
    setEditing(notebook);
    setEditTitle(notebook.title);
    setEditSubject(notebook.subject ?? "");
    setEditColor(notebook.color ?? "gold");
  };

  const save = useMutation({
    mutationFn: () =>
      updateNotebook(editing!.id, {
        title: editTitle.trim(),
        subject: editSubject.trim() || null,
        color: editColor,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      setEditing(null);
      toast.success("Notebook updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const create = useMutation({
    mutationFn: () => createNotebook(title.trim(), subject.trim() || null, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      setCreating(false);
      setTitle("");
      setSubject("");
      setColor("gold");
      toast.success("Notebook opened");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteNotebook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      setPendingDelete(null);
      toast.success("Notebook destroyed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-16">
      <header className="animate-rise-in flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2 rounded-sm border-2 border-dashed border-brass bg-card px-4 py-2 shadow-plate rotate-[-1deg]">
            <MagnifierIcon className="h-8 w-8 text-brass" />
            <h1 className="text-3xl font-bold uppercase tracking-widest text-foreground sm:text-4xl">Sherlock Holes</h1>
          </div>
          <p className="mt-3 text-lg font-medium text-foreground/90">Finding The Gaps In Your Understanding.</p>
          <p className="mt-3 max-w-xl text-base text-muted-foreground">
            Teach a topic out loud to Sherlock. Wherever he gets lost is
            a hole in what you know — and that's exactly where you'll study next.
          </p>
        </div>
        <Button size="lg" className="h-auto gap-2 px-7 py-5 text-lg" onClick={() => setCreating(true)}>
          <Plus className="h-5 w-5" /> New notebook
        </Button>
      </header>

      <section className="mt-10">
        <h2 className="label-caps">Your notebooks</h2>

        {notebooks.isPending && <p className="mt-6 text-muted-foreground">Opening the desk drawer…</p>}

        {notebooks.isError && (
          <p className="mt-6 text-destructive">
            The desk drawer is stuck: {(notebooks.error as Error).message}
          </p>
        )}

        {notebooks.data?.length === 0 && (
          <div className="case-file mt-6 p-10 text-center">
            <CaseFileIcon className="mx-auto h-14 w-14 text-notebook-gold" />
            <p className="mt-4 text-lg">No notebooks yet.</p>
            <p className="mt-1 text-muted-foreground">
              Start one for a course, a chapter, or a single stubborn topic.
            </p>
            <Button className="mt-5" onClick={() => setCreating(true)}>
              <Plus className="mr-1 h-4 w-4" /> New notebook
            </Button>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notebooks.data?.map((notebook) => (
            <div key={notebook.id} className="case-file animate-rise-in group relative overflow-hidden p-5">
              <span aria-hidden className={`absolute inset-x-0 top-0 h-1.5 ${notebookColorClass(notebook.color)}`} />
              <Link
                to="/notebook/$notebookId"
                params={{ notebookId: notebook.id }}
                className="block"
                aria-label={`Open ${notebook.title}`}
              >
                <CaseFileIcon className={`h-12 w-12 ${notebookColorClass(notebook.color).replace("bg-", "text-")}`} />
                <h3 className="mt-4 text-xl font-semibold leading-tight">{notebook.title}</h3>
                {notebook.subject && (
                  <p className="mt-1 text-sm text-muted-foreground">{notebook.subject}</p>
                )}
                <p className="label-caps mt-4 text-brass">Open case →</p>
              </Link>
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${notebook.title}`}
                  className="text-muted-foreground"
                  onClick={() => openEditor(notebook)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${notebook.title}`}
                  className="text-muted-foreground"
                  onClick={() => setPendingDelete(notebook)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New notebook</DialogTitle>
            <DialogDescription>Name it after the course or topic you're studying.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notebook-title">Subject</Label>
              <Input
                id="notebook-title"
                value={title}
                autoFocus
                placeholder="Sherlock Holmes"
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && title.trim()) create.mutate();
                }}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Notebook color</legend>
              <div className="flex flex-wrap gap-3">
                {NOTEBOOK_COLORS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={option.label}
                    aria-pressed={color === option.value}
                    title={option.label}
                    className={`h-10 w-10 rounded-full p-1.5 ${
                      color === option.value ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""
                    }`}
                    onClick={() => setColor(option.value)}
                  >
                    <span aria-hidden className={`h-full w-full rounded-full border border-foreground/20 ${option.className}`} />
                  </Button>
                ))}
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="notebook-subject">Brief Description (optional)</Label>
              <Input
                id="notebook-subject"
                value={subject}
                placeholder="Sherlock Holme's Love Life"
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Opening…" : "Create notebook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit notebook</DialogTitle>
            <DialogDescription>Change the subject, description or color.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-notebook-title">Subject</Label>
              <Input
                id="edit-notebook-title"
                value={editTitle}
                autoFocus
                onChange={(event) => setEditTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && editTitle.trim()) save.mutate();
                }}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Notebook color</legend>
              <div className="flex flex-wrap gap-3">
                {NOTEBOOK_COLORS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={option.label}
                    aria-pressed={editColor === option.value}
                    title={option.label}
                    className={`h-10 w-10 rounded-full p-1.5 ${
                      editColor === option.value ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""
                    }`}
                    onClick={() => setEditColor(option.value)}
                  >
                    <span aria-hidden className={`h-full w-full rounded-full border border-foreground/20 ${option.className}`} />
                  </Button>
                ))}
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="edit-notebook-subject">Brief Description (optional)</Label>
              <Input
                id="edit-notebook-subject"
                value={editSubject}
                onChange={(event) => setEditSubject(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={!editTitle.trim() || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Every session inside it — transcripts, questions and feedback — goes with it. This can't
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete notebook
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
