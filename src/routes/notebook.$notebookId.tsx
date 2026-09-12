import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CaseFileIcon, MagnifierIcon } from "@/components/MysteryIcons";
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
import { Button } from "@/components/ui/button";
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
import { createSession, deleteSession, getNotebook, listSessions, type Session } from "@/lib/db";

export const Route = createFileRoute("/notebook/$notebookId")({
  head: () => ({
    meta: [
      { title: "Notebook — Sherlock Holes" },
      {
        name: "description",
        content: "Every teaching session in this notebook: start a new one or reopen an old case.",
      },
      { property: "og:title", content: "Notebook — Sherlock Holes" },
      {
        property: "og:description",
        content: "Teaching sessions for this notebook, with transcripts, questions and feedback.",
      },
    ],
  }),
  component: NotebookPage,
});

const STAGE_LABEL: Record<string, string> = {
  material: "Awaiting material",
  teach: "Mid-explanation",
  qa: "In questioning",
  feedback: "Feedback ready",
  learn: "Learning",
};

const NOTEBOOK_COLOR_CLASSES: Record<string, string> = {
  gold: "text-notebook-gold",
  crimson: "text-notebook-crimson",
  forest: "text-notebook-forest",
  navy: "text-notebook-navy",
  plum: "text-notebook-plum",
  charcoal: "text-notebook-charcoal",
};

function NotebookPage() {
  const { notebookId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const notebook = useQuery({
    queryKey: ["notebook", notebookId],
    queryFn: () => getNotebook(notebookId),
  });
  const sessions = useQuery({
    queryKey: ["sessions", notebookId],
    queryFn: () => listSessions(notebookId),
  });

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null);

  const create = useMutation({
    mutationFn: () => createSession(notebookId, title.trim()),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["sessions", notebookId] });
      setCreating(false);
      setTitle("");
      if (session) navigate({ to: "/session/$sessionId", params: { sessionId: session.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions", notebookId] });
      setPendingDelete(null);
      toast.success("Session deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 sm:py-12">
      <Link to="/" className="label-caps inline-flex items-center gap-2 text-brass hover:underline">
        <ArrowLeft className="h-4 w-4" /> All notebooks
      </Link>

      <header className="animate-rise-in mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <CaseFileIcon
            className={`h-14 w-14 shrink-0 ${NOTEBOOK_COLOR_CLASSES[notebook.data?.color ?? "gold"] ?? NOTEBOOK_COLOR_CLASSES["gold"]}`}
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {notebook.data?.title ?? "Notebook"}
            </h1>
            {notebook.data?.subject && (
              <p className="mt-1 text-muted-foreground">{notebook.data.subject}</p>
            )}
          </div>
        </div>
        <Button size="lg" onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" /> New session
        </Button>
      </header>

      <section className="mt-10">
        <h2 className="label-caps">Sessions</h2>

        {sessions.isPending && <p className="mt-6 text-muted-foreground">Leafing through…</p>}

        {sessions.data?.length === 0 && (
          <div className="case-file mt-6 p-10 text-center">
            <MagnifierIcon className="mx-auto h-11 w-11 text-foreground" />
            <p className="mt-4 text-lg">No sessions in this notebook yet.</p>
            <p className="mt-1 text-muted-foreground">
              A session is one topic you explain out loud, start to finish.
            </p>
            <Button className="mt-5" onClick={() => setCreating(true)}>
              <Plus className="mr-1 h-4 w-4" /> New session
            </Button>
          </div>
        )}

        <ul className="mt-6 space-y-3">
          {sessions.data?.map((session) => (
            <li key={session.id} className="case-file animate-rise-in group relative">
              <Link
                to="/session/$sessionId"
                params={{ sessionId: session.id }}
                className="flex items-center justify-between gap-4 p-5 pr-14"
              >
                <div>
                  <h3 className="text-xl font-semibold leading-tight">{session.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {STAGE_LABEL[session.stage] ?? session.stage} ·{" "}
                    {new Date(session.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <span className="label-caps text-brass">Open →</span>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${session.title}`}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                onClick={() => setPendingDelete(session)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New session</DialogTitle>
            <DialogDescription>What are you going to explain out loud?</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="session-title">Session name</Label>
            <Input
              id="session-title"
              autoFocus
              value={title}
              placeholder="SN1 vs SN2 reactions"
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && title.trim()) create.mutate();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Starting…" : "Start session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The transcript, questions and feedback for this session will be gone for good.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
