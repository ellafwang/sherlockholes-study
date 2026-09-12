import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MagnifierIcon, NotebookIcon } from "@/components/MysteryIcons";
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
import { createNotebook, deleteNotebook, listNotebooks, type Notebook } from "@/lib/db";

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
  const [pendingDelete, setPendingDelete] = useState<Notebook | null>(null);

  const create = useMutation({
    mutationFn: () => createNotebook(title.trim(), subject.trim() || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notebooks"] });
      setCreating(false);
      setTitle("");
      setSubject("");
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
      <header className="animate-rise-in flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <MagnifierIcon className="h-9 w-9 text-foreground" />
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Sherlock Holes</h1>
          </div>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Teach a topic out loud to a curious, easily-confused detective. Wherever he gets lost is
            a hole in what you know — and that's exactly where you'll study next.
          </p>
        </div>
        <Button size="lg" onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" /> New notebook
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
            <NotebookIcon className="mx-auto h-12 w-12 text-foreground" />
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
            <div key={notebook.id} className="case-file animate-rise-in group relative p-5">
              <Link
                to="/notebook/$notebookId"
                params={{ notebookId: notebook.id }}
                className="block"
                aria-label={`Open ${notebook.title}`}
              >
                <NotebookIcon className="h-10 w-10 text-foreground" />
                <h3 className="mt-4 text-xl font-semibold leading-tight">{notebook.title}</h3>
                {notebook.subject && (
                  <p className="mt-1 text-sm text-muted-foreground">{notebook.subject}</p>
                )}
                <p className="label-caps mt-4 text-brass">Open case →</p>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${notebook.title}`}
                className="absolute right-2 top-2 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                onClick={() => setPendingDelete(notebook)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
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
              <Label htmlFor="notebook-title">Name</Label>
              <Input
                id="notebook-title"
                value={title}
                autoFocus
                placeholder="Organic Chemistry I"
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && title.trim()) create.mutate();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notebook-subject">Subject (optional)</Label>
              <Input
                id="notebook-subject"
                value={subject}
                placeholder="Chemistry"
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
