import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Notebook = Tables<"notebooks">;
export type Session = Tables<"sessions">;
export type BlurtSegment = Tables<"blurt_segments">;
export type Question = Tables<"questions">;
export type QaTurn = Tables<"qa_turns">;
export type Summary = Tables<"summaries">;
export type LearnTopic = Tables<"learn_topics">;
export type LearnMessage = Tables<"learn_messages">;

export type FeedbackSummaryItem = {
  id: string;
  session_id: string;
  narrative: string | null;
  covered: unknown;
  gaps: unknown;
  created_at: string;
  sessions: { id: string; title: string } | null;
};

function unwrap<T>(result: { data: T; error: unknown }): T {
  const error = result.error as { message?: string } | null;
  if (error) throw new Error(error.message ?? "The case files are unreachable.");
  return result.data;
}

export const keyConceptsOf = (session: Session): string[] =>
  Array.isArray(session.key_concepts) ? (session.key_concepts as string[]).filter(Boolean) : [];

export const stringsOf = (value: unknown): string[] =>
  Array.isArray(value) ? (value as unknown[]).map(String) : [];

/* ----- notebooks ----- */

export const listNotebooks = async () =>
  unwrap(await supabase.from("notebooks").select("*").order("created_at", { ascending: false }));

export const createNotebook = async (title: string, subject: string | null, color: string) =>
  unwrap(await supabase.from("notebooks").insert({ title, subject, color }).select().single());

export const renameNotebook = async (id: string, title: string) =>
  unwrap(await supabase.from("notebooks").update({ title }).eq("id", id).select().single());

export const updateNotebook = async (
  id: string,
  patch: { title?: string; subject?: string | null; color?: string },
) => unwrap(await supabase.from("notebooks").update(patch).eq("id", id).select().single());

export const deleteNotebook = async (id: string) => {
  const { error } = await supabase.from("notebooks").delete().eq("id", id);
  if (error) throw new Error(error.message);
};

export const getNotebook = async (id: string) =>
  unwrap(await supabase.from("notebooks").select("*").eq("id", id).maybeSingle());

/* ----- sessions ----- */

export const listSessions = async (notebookId: string) =>
  unwrap(
    await supabase
      .from("sessions")
      .select("*")
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: false }),
  );

export const createSession = async (notebookId: string, title: string) =>
  unwrap(await supabase.from("sessions").insert({ notebook_id: notebookId, title }).select().single());

export const getSession = async (id: string) =>
  unwrap(await supabase.from("sessions").select("*").eq("id", id).maybeSingle());

export const updateSession = async (
  id: string,
  patch: Partial<Pick<Session, "title" | "stage" | "notes_text" | "key_concepts" | "blurt_limit_seconds">>,
) =>
  unwrap(
    await supabase
      .from("sessions")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single(),
  );

export const deleteSession = async (id: string) => {
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
};

/* ----- blurt segments ----- */

export const listSegments = async (sessionId: string) =>
  unwrap(
    await supabase
      .from("blurt_segments")
      .select("*")
      .eq("session_id", sessionId)
      .order("at_seconds", { ascending: true }),
  );

export const addSegment = async (row: {
  session_id: string;
  transcript: string;
  verdict: string;
  concept: string | null;
  at_seconds: number;
  duration_seconds: number;
  example_count: number;
}) => unwrap(await supabase.from("blurt_segments").insert(row).select().single());

export const clearSegments = async (sessionId: string) => {
  const { error } = await supabase.from("blurt_segments").delete().eq("session_id", sessionId);
  if (error) throw new Error(error.message);
};

/* ----- questions ----- */

export const listQuestions = async (sessionId: string) =>
  unwrap(
    await supabase
      .from("questions")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
  );

export const addQuestions = async (
  sessionId: string,
  items: { question: string; concept: string | null; source: string }[],
) => {
  if (items.length === 0) return [];
  return unwrap(
    await supabase
      .from("questions")
      .insert(items.map((item) => ({ ...item, session_id: sessionId })))
      .select(),
  );
};

export const setQuestionStatus = async (id: string, status: string) =>
  unwrap(await supabase.from("questions").update({ status }).eq("id", id).select().single());

/* ----- Q&A turns ----- */

export const listQaTurns = async (sessionId: string) =>
  unwrap(
    await supabase
      .from("qa_turns")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
  );

export const addQaTurn = async (row: {
  session_id: string;
  question_id: string | null;
  role: string;
  content: string;
  verdict?: string;
}) => unwrap(await supabase.from("qa_turns").insert(row).select().single());

/* ----- summaries ----- */

export const getSummary = async (sessionId: string) =>
  unwrap(
    await supabase
      .from("summaries")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );

export const listFeedbackSummaries = async (): Promise<FeedbackSummaryItem[]> =>
  unwrap(
    await supabase
      .from("summaries")
      .select("id, session_id, narrative, covered, gaps, created_at, sessions(id, title)")
      .order("created_at", { ascending: false }),
  ) ?? [];

export const saveSummary = async (row: {
  session_id: string;
  covered: string[];
  answered_well: string[];
  gaps: string[];
  open_questions: string[];
  subtopic_time: Record<string, number>;
  speaking_seconds: number;
  example_count: number;
  narrative: string;
}) => {
  await supabase.from("summaries").delete().eq("session_id", row.session_id);
  return unwrap(await supabase.from("summaries").insert(row).select().single());
};

/* ----- learn mode ----- */

export const listLearnTopics = async (sessionId: string) =>
  unwrap(
    await supabase
      .from("learn_topics")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
  );

export const addLearnTopics = async (
  sessionId: string,
  items: { topic: string; detail: string | null; origin: string }[],
) => {
  if (items.length === 0) return [];
  return unwrap(
    await supabase
      .from("learn_topics")
      .insert(items.map((item) => ({ ...item, session_id: sessionId })))
      .select(),
  );
};

export const listLearnMessages = async (sessionId: string) =>
  unwrap(
    await supabase
      .from("learn_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
  );

export const addLearnMessage = async (sessionId: string, role: string, content: string) =>
  unwrap(await supabase.from("learn_messages").insert({ session_id: sessionId, role, content }).select().single());
