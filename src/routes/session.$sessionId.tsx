import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { QuestionBubbleIcon, TreasureChestIcon } from "@/components/MysteryIcons";
import { SherlockFace, type Verdict } from "@/components/SherlockFace";
import { FeedbackPanel, type Report } from "@/components/session/FeedbackPanel";
import { LearnPanel } from "@/components/session/LearnPanel";
import { MaterialStage } from "@/components/session/MaterialStage";
import { QaPanel, verdictOf } from "@/components/session/QaPanel";
import { RecorderOrb } from "@/components/session/RecorderOrb";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import {
  addLearnMessage,
  addLearnTopics,
  addQaTurn,
  addQuestions,
  addSegment,
  clearSegments,
  getSession,
  getSummary,
  keyConceptsOf,
  listLearnMessages,
  listLearnTopics,
  listQaTurns,
  listQuestions,
  listSegments,
  saveSummary,
  setQuestionStatus,
  stringsOf,
  updateSession,
} from "@/lib/db";
import { buildReport, gradeAnswer, gradeBlurt, learnReply, seedQuestions } from "@/lib/sherlock.functions";
import { speakAsSherlock } from "@/lib/voice.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/session/$sessionId")({
  head: () => ({
    meta: [
      { title: "Teach Sherlock — Sherlock Holes" },
      {
        name: "description",
        content:
          "Explain your topic out loud to Sherlock, answer the questions he was left with, then learn what you missed.",
      },
      { property: "og:title", content: "Teach Sherlock — Sherlock Holes" },
      {
        property: "og:description",
        content: "A live teaching session: blurt, mid-session Q&A, feedback report and tutoring.",
      },
    ],
  }),
  ssr: false,
  component: SessionPage,
});

// Sherlock should visibly react while you talk, so judge short stretches often.
const GRADE_EVERY_MS = 6000;
type Panel = "none" | "qa" | "feedback" | "learn";

function mmss(total: number) {
  const safe = Math.max(0, Math.round(total));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function SessionPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const speech = useSpeechRecognition();

  const gradeBlurtFn = useServerFn(gradeBlurt);
  const gradeAnswerFn = useServerFn(gradeAnswer);
  const seedQuestionsFn = useServerFn(seedQuestions);
  const buildReportFn = useServerFn(buildReport);
  const learnReplyFn = useServerFn(learnReply);
  const speakFn = useServerFn(speakAsSherlock);

  const session = useQuery({ queryKey: ["session", sessionId], queryFn: () => getSession(sessionId) });
  const questions = useQuery({ queryKey: ["questions", sessionId], queryFn: () => listQuestions(sessionId) });
  const segments = useQuery({ queryKey: ["segments", sessionId], queryFn: () => listSegments(sessionId) });
  const qaTurns = useQuery({ queryKey: ["qa", sessionId], queryFn: () => listQaTurns(sessionId) });
  const summary = useQuery({ queryKey: ["summary", sessionId], queryFn: () => getSummary(sessionId) });
  const learnTopics = useQuery({ queryKey: ["learn-topics", sessionId], queryFn: () => listLearnTopics(sessionId) });
  const learnMessages = useQuery({
    queryKey: ["learn-messages", sessionId],
    queryFn: () => listLearnMessages(sessionId),
  });

  const [verdict, setVerdict] = useState<Verdict>("neutral");
  const [reaction, setReaction] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("none");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [grading, setGrading] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [starting, setStarting] = useState(false);
  const [typedBlurt, setTypedBlurt] = useState("");
  const [followUp, setFollowUp] = useState<{ question: string; questionId: string | null } | null>(null);
  const [followUpDepth, setFollowUpDepth] = useState(0);
  const [qaBusy, setQaBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [learnBusy, setLearnBusy] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const lastGradeAt = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stage = session.data?.stage ?? "material";
  const limit = session.data?.blurt_limit_seconds ?? 180;
  const concepts = useMemo(() => (session.data ? keyConceptsOf(session.data) : []), [session.data]);
  const notes = session.data?.notes_text ?? "";
  const remaining = Math.max(0, limit - elapsed);

  /* ---------- persisted transcript so far ---------- */
  const transcriptSoFar = useMemo(
    () => (segments.data ?? []).map((segment) => segment.transcript).join(" "),
    [segments.data],
  );

  /* ---------- words spoken so far ---------- */
  const spokenWords = useMemo(() => {
    const all = `${transcriptSoFar} ${speech.finalText} ${speech.interimText}`.trim();
    return all ? all.split(/\s+/).length : 0;
  }, [transcriptSoFar, speech.finalText, speech.interimText]);

  /* ---------- concept coverage of the explanation ---------- */
  const coverage = useMemo(() => {
    if (concepts.length === 0) return { covered: [] as string[], percent: 0 };
    const haystack = `${transcriptSoFar} ${speech.finalText} ${speech.interimText}`.toLowerCase();
    const graded = new Set(
      (segments.data ?? []).map((segment) => segment.concept?.trim().toLowerCase()).filter(Boolean),
    );
    const covered = concepts.filter((concept) => {
      const needle = concept.trim().toLowerCase();
      if (!needle) return false;
      if (graded.has(needle)) return true;
      // fuzzy: concept named, or graded concept label references it
      if (haystack.includes(needle)) return true;
      for (const g of graded) if (g && (g.includes(needle) || needle.includes(g))) return true;
      return false;
    });
    return { covered, percent: Math.round((covered.length / concepts.length) * 100) };
  }, [concepts, transcriptSoFar, speech.finalText, speech.interimText, segments.data]);

  /* ---------- countdown ---------- */
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const gradeChunk = useCallback(
    async (chunk: string, at: number, duration: number) => {
      if (!chunk || !session.data) return;
      setGrading(true);
      try {
        const grade = await gradeBlurtFn({
          data: {
            sessionTitle: session.data.title,
            notes,
            concepts,
            transcript: chunk,
            earlier: transcriptSoFar,
          },
        });
        setVerdict(grade.verdict);
        setReaction(grade.note?.trim() || null);
        await addSegment({
          session_id: sessionId,
          transcript: chunk,
          verdict: grade.verdict,
          concept: grade.concept || null,
          at_seconds: Math.round(at),
          duration_seconds: Math.max(1, Math.round(duration)),
          example_count: Math.max(0, grade.examples),
        });
        if (grade.questions.length > 0) {
          await addQuestions(
            sessionId,
            grade.questions.slice(0, 2).map((item) => ({
              question: item.question,
              concept: item.concept || null,
              source: "blurt",
            })),
          );
          queryClient.invalidateQueries({ queryKey: ["questions", sessionId] });
        }
        queryClient.invalidateQueries({ queryKey: ["segments", sessionId] });
      } catch (error) {
        console.error(error);
        // Never lose what the student said: keep the words even if grading failed,
        // so the Q&A and the feedback report still have the real explanation.
        try {
          await addSegment({
            session_id: sessionId,
            transcript: chunk,
            verdict: "neutral",
            concept: null,
            at_seconds: Math.round(at),
            duration_seconds: Math.max(1, Math.round(duration)),
            example_count: 0,
          });
          queryClient.invalidateQueries({ queryKey: ["segments", sessionId] });
        } catch (saveError) {
          console.error(saveError);
        }
        toast.error((error as Error).message);
      } finally {
        setGrading(false);
      }

    },
    [concepts, gradeBlurtFn, notes, queryClient, session.data, sessionId, transcriptSoFar],
  );

  /* ---------- live grading while blurting ----------
     Kept on refs: the clock ticks every second, and re-creating the interval
     on every tick meant the 15s grading pass never once fired. */
  const elapsedRef = useRef(0);
  const gradeChunkRef = useRef(gradeChunk);
  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);
  useEffect(() => {
    gradeChunkRef.current = gradeChunk;
  }, [gradeChunk]);

  const drainSpeech = speech.drain;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const chunk = drainSpeech();
      if (!chunk) return;
      const at = lastGradeAt.current;
      const now = elapsedRef.current;
      lastGradeAt.current = now;
      void gradeChunkRef.current(chunk, at, Math.max(1, now - at));
    }, GRADE_EVERY_MS);
    return () => clearInterval(id);
  }, [running, drainSpeech]);


  /* ---------- start the blurt ---------- */
  const startTeaching = async (payload: { notes: string; concepts: string[]; limit: number }) => {
    setStarting(true);
    try {
      await updateSession(sessionId, {
        notes_text: payload.notes,
        key_concepts: payload.concepts,
        blurt_limit_seconds: payload.limit,
        stage: "teach",
      });
      const seeded = await seedQuestionsFn({
        data: {
          sessionTitle: session.data?.title ?? "this topic",
          notes: payload.notes,
          concepts: payload.concepts,
        },
      });
      await addQuestions(
        sessionId,
        seeded.map((item) => ({
          question: item.question,
          concept: item.concept || null,
          source: "material",
        })),
      );
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["questions", sessionId] });
      setElapsed(0);
      lastGradeAt.current = 0;
      speech.reset();
      setVerdict("neutral");
      setReaction(null);
      setRunning(true);
      if (speech.supported) speech.start();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const flushRemaining = async () => {
    const chunk = speech.drain() || typedBlurt.trim();
    if (chunk) {
      const at = lastGradeAt.current;
      const now = elapsedRef.current;
      lastGradeAt.current = now;
      await gradeChunk(chunk, at, Math.max(1, now - at));
      setTypedBlurt("");
    }
  };


  const pauseTeaching = async () => {
    setRunning(false);
    await speech.stop();
    await flushRemaining();
  };

  const resumeTeaching = () => {
    setRunning(true);
    if (speech.supported) speech.start();
  };

  /**
   * The recorder button: starting it listens (and keeps the clock running),
   * stopping it hands everything captured so far to Sherlock.
   */
  const toggleRecorder = async () => {
    if (speech.listening) {
      await speech.stop();
      if (stage === "teach" && panel === "none") await flushRemaining();
      return;
    }
    speech.start();
    if (stage === "teach" && panel === "none" && remaining > 0) setRunning(true);
  };

  /* ---------- auto-finish when time is up ---------- */
  useEffect(() => {
    if (!running || remaining > 0) return;
    setRunning(false);
    void speech.stop().then(flushRemaining).then(() => {
      toast.info("Time's up — Sherlock has questions.");
      openQa();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, remaining]);

  /* ---------- Q&A ---------- */
  const pendingQuestions = useMemo(
    () => (questions.data ?? []).filter((question) => question.status === "pending"),
    [questions.data],
  );
  const activeQuestion = followUp ?? (pendingQuestions[0]
    ? { question: pendingQuestions[0].question, questionId: pendingQuestions[0].id }
    : null);

  const openQa = async () => {
    setRunning(false);
    await speech.stop();
    if (stage === "teach") await flushRemaining();
    speech.reset();
    setPanel("qa");
    setVerdict("neutral");
    setReaction(null);
    if (stage !== "qa") {
      await updateSession(sessionId, { stage: "qa" });
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    }
  };

  const submitAnswer = async (answer: string) => {
    if (!activeQuestion || !session.data) return;
    setQaBusy(true);
    await speech.stop();
    try {
      await addQaTurn({
        session_id: sessionId,
        question_id: activeQuestion.questionId,
        role: "user",
        content: answer,
      });
      const spokenSoFar = ((await listSegments(sessionId)) ?? []).map((row) => row.transcript).join(" ");
      const grade = await gradeAnswerFn({
        data: {
          sessionTitle: session.data.title,
          notes,
          question: activeQuestion.question,
          answer,
          followUpDepth,
          transcript: spokenSoFar,
        },
      });

      setVerdict(grade.verdict);
      await addQaTurn({
        session_id: sessionId,
        question_id: activeQuestion.questionId,
        role: "sherlock",
        content: grade.reply,
        verdict: grade.verdict,
      });
      if (grade.missedConcept) {
        await addLearnTopics(sessionId, [
          { topic: grade.missedConcept, detail: grade.reply, origin: "qa" },
        ]);
        queryClient.invalidateQueries({ queryKey: ["learn-topics", sessionId] });
      }
      if (grade.followUpQuestion && followUpDepth < 2) {
        setFollowUp({ question: grade.followUpQuestion, questionId: activeQuestion.questionId });
        setFollowUpDepth((depth) => depth + 1);
        await addQaTurn({
          session_id: sessionId,
          question_id: activeQuestion.questionId,
          role: "sherlock",
          content: grade.followUpQuestion,
          verdict: grade.verdict,
        });
      } else {
        setFollowUp(null);
        setFollowUpDepth(0);
        if (activeQuestion.questionId) {
          await setQuestionStatus(activeQuestion.questionId, grade.verdict === "green" ? "answered" : "missed");
          queryClient.invalidateQueries({ queryKey: ["questions", sessionId] });
        }
      }
      speech.reset();
      queryClient.invalidateQueries({ queryKey: ["qa", sessionId] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setQaBusy(false);
    }
  };

  const skipQuestion = async () => {
    if (!activeQuestion) return;
    setFollowUp(null);
    setFollowUpDepth(0);
    setVerdict("yellow");
    if (activeQuestion.questionId) {
      await setQuestionStatus(activeQuestion.questionId, "missed");
      queryClient.invalidateQueries({ queryKey: ["questions", sessionId] });
    }
    speech.reset();
  };

  /* ---------- feedback report ---------- */
  const report: Report | null = useMemo(() => {
    const row = summary.data;
    if (!row) return null;
    return {
      covered: stringsOf(row.covered),
      answeredWell: stringsOf(row.answered_well),
      gaps: stringsOf(row.gaps),
      openQuestions: stringsOf(row.open_questions),
      subtopicTime: (row.subtopic_time ?? {}) as Record<string, number>,
      speakingSeconds: row.speaking_seconds,
      exampleCount: row.example_count,
      narrative: row.narrative ?? "",
    };
  }, [summary.data]);

  const openFeedback = async () => {
    setPanel("feedback");
    await speech.stop();
    setRunning(false);
    if (!session.data) return;
    if (stage !== "feedback" && stage !== "learn") {
      await updateSession(sessionId, { stage: "feedback" });
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    }
    setReportBusy(true);
    try {
      // Read straight from the database: anything just spoken may not be in the
      // cached lists yet, and the report must be built from the real transcript.
      const [rows, turns, allQuestions] = await Promise.all([
        listSegments(sessionId),
        listQaTurns(sessionId),
        listQuestions(sessionId),
      ]);
      const subtopicTime: Record<string, number> = {};
      let speakingSeconds = 0;
      let exampleCount = 0;
      for (const row of rows ?? []) {
        const key = row.concept?.trim() || "General";
        subtopicTime[key] = (subtopicTime[key] ?? 0) + row.duration_seconds;
        speakingSeconds += row.duration_seconds;
        exampleCount += row.example_count;
      }
      const stillOpen = (allQuestions ?? [])
        .filter((question) => question.status !== "answered")
        .map((question) => question.question);


      const result = await buildReportFn({
        data: {
          sessionTitle: session.data.title,
          notes,
          concepts,
          transcript: (rows ?? []).map((row) => row.transcript).join(" "),
          qaLog: (turns ?? [])
            .map((turn) => `${turn.role === "user" ? "Student" : "Sherlock"}: ${turn.content}`)
            .join("\n"),
          openQuestions: stillOpen,
        },
      });

      await saveSummary({
        session_id: sessionId,
        covered: result.covered,
        answered_well: result.answeredWell,
        gaps: result.gaps,
        open_questions: stillOpen,
        subtopic_time: subtopicTime,
        speaking_seconds: speakingSeconds,
        example_count: exampleCount,
        narrative: result.narrative,
      });
      const existing = new Set(
        ((await listLearnTopics(sessionId)) ?? []).map((topic) =>
          topic.topic.trim().toLowerCase(),
        ),
      );
      const fresh = result.gaps.filter((gap) => !existing.has(gap.trim().toLowerCase()));
      if (fresh.length > 0) {
        await addLearnTopics(
          sessionId,
          fresh.map((gap) => ({ topic: gap, detail: null, origin: "summary" })),
        );
        queryClient.invalidateQueries({ queryKey: ["learn-topics", sessionId] });
      }
      queryClient.invalidateQueries({ queryKey: ["summary", sessionId] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setReportBusy(false);
    }
  };

  /* ---------- learn mode ---------- */
  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  };

  const playAudio = async (text: string) => {
    const spoken = text.replace(/[*_#`>]/g, " ").trim();
    if (!spoken) return;
    stopAudio();
    setVoiceLoading(true);
    try {
      const result = await speakFn({ data: { text: spoken.slice(0, 3500) } });
      if (!result.ok) {
        setVoiceNotice(result.message);
        return;
      }
      setVoiceNotice(null);
      const audio = new Audio(`data:audio/mpeg;base64,${result.audio}`);
      audioRef.current = audio;
      audio.onended = () => setSpeaking(false);
      audio.onpause = () => setSpeaking(false);
      setSpeaking(true);
      await audio.play();
    } catch (error) {
      console.error(error);
      setSpeaking(false);
      setVoiceNotice("Sherlock's voice didn't come through — tap “Hear it” to try again.");
    } finally {
      setVoiceLoading(false);
    }
  };

  /* the lesson plan: gaps and open questions from the report first, then the
     session's own key concepts so there is always something to be taught */
  const learnPlan = useMemo(() => {
    const seen = new Set<string>();
    const plan: string[] = [];
    const push = (value?: string | null) => {
      const topic = (value ?? "").trim();
      if (!topic) return;
      const key = topic.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      plan.push(topic);
    };
    (learnTopics.data ?? []).forEach((row) => push(row.topic));
    (summary.data?.gaps as string[] | undefined)?.forEach(push);
    concepts.forEach(push);
    return plan;
  }, [learnTopics.data, summary.data, concepts]);

  const taughtTopics = useMemo(() => {
    const said = (learnMessages.data ?? []).map((row) => row.content.toLowerCase()).join(" ");
    return learnPlan.filter((topic) => said.includes(topic.toLowerCase()));
  }, [learnMessages.data, learnPlan]);

  const nextLearnTopic = useMemo(() => {
    const done = new Set(taughtTopics.map((topic) => topic.toLowerCase()));
    return learnPlan.find((topic) => !done.has(topic.toLowerCase())) ?? null;
  }, [learnPlan, taughtTopics]);

  const reportContext = useMemo(() => {
    const row = summary.data;
    if (!row) return "";
    const list = (label: string, values: unknown) =>
      Array.isArray(values) && values.length > 0 ? `${label}: ${(values as string[]).join("; ")}` : "";
    return [
      row.narrative ? `Summary: ${row.narrative}` : "",
      list("Concepts they covered well", row.covered),
      list("Questions they answered correctly", row.answered_well),
      list("Questions still open", row.open_questions),
      list("Missed or misunderstood", row.gaps),
      `They spoke for ${row.speaking_seconds} seconds and gave ${row.example_count} examples.`,
    ]
      .filter(Boolean)
      .join("\n");
  }, [summary.data]);

  const openLearn = async () => {
    setPanel("learn");
    if (stage !== "learn") {
      await updateSession(sessionId, { stage: "learn" });
      queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    }
    if ((learnMessages.data ?? []).length === 0 && !learnBusy) {
      const first = learnPlan[0];
      void sendLearn(
        first
          ? `Teach me “${first}” from my notes — start with what I got wrong about it, then explain it properly.`
          : "Walk me through my notes concept by concept, starting with the first one.",
      );
    }
  };

  const teachTopic = (topic: string) =>
    sendLearn(`Teach me “${topic}” using my notes and the feedback report.`);

  const sendLearn = async (message: string) => {
    if (!session.data) return;
    setLearnBusy(true);
    try {
      await addLearnMessage(sessionId, "user", message);
      queryClient.invalidateQueries({ queryKey: ["learn-messages", sessionId] });
      const history = (learnMessages.data ?? []).map((row) => ({ role: row.role, content: row.content }));
      const result = await learnReplyFn({
        data: {
          sessionTitle: session.data.title,
          notes,
          focus: learnPlan,
          keyConcepts: concepts,
          report: reportContext,
          history,
          message,
        },
      });
      await addLearnMessage(sessionId, "sherlock", result.reply);
      queryClient.invalidateQueries({ queryKey: ["learn-messages", sessionId] });
      setVerdict("neutral");
      void playAudio(result.reply);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLearnBusy(false);
    }
  };

  /* ---------- new teach session over the same material ---------- */
  const teachAgain = async () => {
    await clearSegments(sessionId);
    await updateSession(sessionId, { stage: "teach" });
    queryClient.invalidateQueries({ queryKey: ["segments", sessionId] });
    queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    setPanel("none");
    setElapsed(0);
    lastGradeAt.current = 0;
    speech.reset();
    setVerdict("neutral");
    setRunning(true);
    if (speech.supported) speech.start();
  };

  useEffect(() => () => audioRef.current?.pause(), []);

  if (session.isPending) {
    return <p className="p-10 text-muted-foreground">Opening the case…</p>;
  }
  if (!session.data) {
    return (
      <div className="p-10">
        <p className="text-lg">This session no longer exists.</p>
        <Button className="mt-4" onClick={() => navigate({ to: "/" })}>
          Back to notebooks
        </Button>
      </div>
    );
  }

  const backToNotebook = () =>
    navigate({ to: "/notebook/$notebookId", params: { notebookId: session.data!.notebook_id } });

  if (stage === "material") {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-5xl px-5 pt-8">
          <button
            type="button"
            onClick={backToNotebook}
            className="label-caps inline-flex items-center gap-2 text-brass hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to notebook
          </button>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">{session.data.title}</h1>
        </div>
        <MaterialStage
          initialNotes={notes}
          initialConcepts={concepts}
          initialLimit={limit}
          busy={starting}
          onStart={startTeaching}
        />
      </main>
    );
  }

  const timerTone =
    remaining <= 15 ? "text-verdict-red" : remaining <= 60 ? "text-gold" : "text-foreground";

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_400px]">
        {/* ---- stage: Sherlock, timer, recorder ---- */}
        <section className="relative flex flex-col items-center">
          <button
            type="button"
            onClick={backToNotebook}
            aria-label="Back to notebook"
            className="label-caps absolute left-0 top-0 inline-flex items-center gap-2 text-brass hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <div className="mt-10 text-center">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{session.data.title}</h1>
            {stage === "teach" && panel === "none" && (
              <p className={cn("mt-1 text-4xl font-semibold tabular-nums transition-colors", timerTone)}>
                {mmss(remaining)}
              </p>
            )}
          </div>

          <SherlockFace verdict={verdict} className="mt-4" />

          <div className="mt-4">
            <RecorderOrb
              listening={speech.listening}
              speaking={speech.speaking}
              disabled={!speech.supported}
              onToggle={toggleRecorder}
              levels={speech.levels}
              wordCount={spokenWords}
              label={
                !speech.supported
                  ? "Mic unavailable"
                  : grading
                    ? "Sherlock is following"
                    : speech.transcribing
                      ? "Transcribing your voice…"
                    : speech.listening
                      ? undefined
                      : "Tap to speak"
              }
            />
          </div>

          {concepts.length > 0 && (panel === "none" || stage === "teach") && (
            <div className="mx-auto mt-5 w-full max-w-md">
              <div className="label-caps flex items-center justify-between text-muted-foreground">
                <span>Explanation covered</span>
                <span className="tabular-nums text-brass">
                  {coverage.covered.length}/{concepts.length} · {coverage.percent}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={coverage.percent}
                aria-label="Explanation coverage"
                className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted/60"
              >
                <div
                  className="h-full rounded-full bg-brass transition-[width] duration-700 ease-out"
                  style={{ width: `${coverage.percent}%` }}
                />
              </div>
              {coverage.percent < 100 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Still to cover: {concepts.filter((c) => !coverage.covered.includes(c)).join(", ")}
                </p>
              )}
            </div>
          )}

          {stage === "teach" && panel === "none" && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {running ? (
                <Button variant="secondary" onClick={pauseTeaching}>
                  <Pause className="mr-2 h-4 w-4" /> Pause
                </Button>
              ) : (
                <Button variant="secondary" onClick={resumeTeaching}>
                  <Play className="mr-2 h-4 w-4" /> Resume
                </Button>
              )}
              <Button onClick={openQa}>I'm finished explaining</Button>
            </div>
          )}

          {(speech.interimText || speech.finalText) && panel === "none" && (
            <p className="mt-5 max-h-32 max-w-xl overflow-y-auto text-center text-sm leading-snug text-muted-foreground">
              {speech.finalText.slice(-400)}
              <span className="text-foreground">{speech.interimText}</span>
            </p>
          )}

          {panel === "none" && speech.error && (
            <p role="alert" className="mt-3 max-w-md text-center text-sm text-verdict-red">
              {speech.error}
            </p>
          )}

          {panel === "none" && speech.supported && (
            <button
              type="button"
              onClick={() => setShowTyping((value) => !value)}
              className="label-caps mt-4 text-brass hover:underline"
            >
              {showTyping ? "Hide typing" : "Type instead"}
            </button>
          )}

          {(!speech.supported || showTyping) && panel === "none" && (
            <div className="mt-5 w-full max-w-xl">
              <p className="text-sm text-muted-foreground">
                Type what you'd say instead — Sherlock reacts the
                same way.
              </p>
              <Textarea
                value={typedBlurt}
                onChange={(event) => setTypedBlurt(event.target.value)}
                placeholder="Explain it here…"
                className="mt-2 min-h-24"
              />
              <Button
                className="mt-2"
                variant="secondary"
                disabled={!typedBlurt.trim() || grading}
                onClick={() => {
                  const chunk = typedBlurt.trim();
                  setTypedBlurt("");
                  const at = lastGradeAt.current;
                  const now = elapsedRef.current;
                  lastGradeAt.current = now;
                  void gradeChunk(chunk, at, Math.max(1, now - at));
                }}
              >
                Send to Sherlock
              </Button>
            </div>
          )}
        </section>

        {/* ---- right rail: icon buttons or the open panel ---- */}
        <aside className="lg:min-h-[32rem]">
          {panel === "none" && (
            <div className="flex justify-center gap-4 lg:flex-col lg:items-end lg:justify-start">
              <button
                type="button"
                onClick={openQa}
                aria-label="Mid-session Q&A"
                title="Mid-session Q&A"
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-foreground/20 bg-card transition-colors hover:border-gold"
              >
                <QuestionBubbleIcon className="h-8 w-8 text-foreground" />
              </button>
              <button
                type="button"
                onClick={openFeedback}
                aria-label="Session feedback"
                title="Session feedback"
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-foreground/20 bg-card transition-colors hover:border-gold"
              >
                <TreasureChestIcon className="h-8 w-8 text-foreground" />
              </button>
            </div>
          )}

          {panel === "qa" && (
            <QaPanel
              question={activeQuestion?.question ?? null}
              entries={(qaTurns.data ?? []).map((turn) => ({
                id: turn.id,
                role: turn.role,
                content: turn.content,
                verdict: verdictOf(turn.verdict),
              }))}
              busy={qaBusy}
              remaining={Math.max(0, pendingQuestions.length - 1)}
              liveText={`${speech.finalText}${speech.interimText}`}
              listening={speech.listening}
              micSupported={speech.supported}
              onToggleMic={() => (speech.listening ? void speech.stop() : speech.start())}
              onSubmit={async (answer) => {
                const captured = speech.listening ? await speech.stop() : "";
                await submitAnswer(captured || answer);
              }}
              onSkip={skipQuestion}
              onBack={() => setPanel("none")}
              onFinish={openFeedback}
            />
          )}

          {panel === "feedback" && (
            <FeedbackPanel
              report={report}
              loading={reportBusy}
              onBack={() => setPanel("none")}
              onLearn={openLearn}
              onNewTeach={teachAgain}
            />
          )}

          {panel === "learn" && (
            <LearnPanel
              entries={(learnMessages.data ?? []).map((row) => ({
                id: row.id,
                role: row.role,
                content: row.content,
              }))}
              focus={learnPlan}
              covered={taughtTopics}
              nextTopic={nextLearnTopic}
              busy={learnBusy}
              voiceNotice={voiceNotice}
              speaking={speaking}
              voiceLoading={voiceLoading}
              onSend={sendLearn}
              onTeachTopic={teachTopic}
              onReplay={playAudio}
              onStopVoice={stopAudio}
              onBack={() => {
                stopAudio();
                setPanel("feedback");
              }}
            />
          )}
        </aside>
      </div>
    </main>
  );
}
