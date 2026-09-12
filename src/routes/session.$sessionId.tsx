import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { MathText } from "@/components/MathText";
import { QuestionBubbleIcon, TreasureChestIcon } from "@/components/MysteryIcons";
import { SherlockFace, type Verdict } from "@/components/SherlockFace";
import { FeedbackPanel, type Report } from "@/components/session/FeedbackPanel";
import { LearnPanel } from "@/components/session/LearnPanel";
import { MaterialStage } from "@/components/session/MaterialStage";
import { QaPanel, verdictOf } from "@/components/session/QaPanel";
import { RecorderOrb } from "@/components/session/RecorderOrb";
import { Button } from "@/components/ui/button";
import { MathTextarea } from "@/components/MathTextarea";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { Input } from "@/components/ui/input";
import { TranscriptView, TRANSCRIPT_LANGUAGES } from "@/components/session/TranscriptView";
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
import { latexToSpeech } from "@/lib/math-speech";
import { speakAsSherlock } from "@/lib/voice.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/session/$sessionId")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: search["view"] === "feedback" ? ("feedback" as const) : undefined,
  }),
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: SessionPage,
});

// Sherlock listens and judges every second, so his face tracks what you say.
const GRADE_EVERY_MS = 1000;
const MAX_QA_QUESTIONS = 3;
type Panel = "none" | "qa" | "feedback" | "learn";

function mmss(total: number) {
  const safe = Math.max(0, Math.round(total));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function reportSpeechText(report: Report) {
  const lines = [
    report.narrative,
    report.covered.length ? `You covered ${report.covered.join(", ")}.` : "",
    report.answeredWell.length ? `You answered well on ${report.answeredWell.join(", ")}.` : "",
    report.gaps.length ? `Still shaky: ${report.gaps.join(", ")}.` : "",
    report.openQuestions.length ? `Open questions: ${report.openQuestions.join(" ")}` : "",
    `You spoke for ${Math.round(report.speakingSeconds)} seconds and gave ${report.exampleCount} examples.`,
  ].filter(Boolean);
  return lines.join(" ");
}

function SessionPage() {
  const { sessionId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [languageCode, setLanguageCode] = useState("eng");
  const [vocabulary, setVocabulary] = useState("");
  const keyterms = useMemo(
    () =>
      vocabulary
        .split(/[,\n]/)
        .map((term) => term.trim())
        .filter(Boolean)
        .slice(0, 100),
    [vocabulary],
  );
  const speech = useSpeechRecognition({ languageCode, keyterms });

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
  const [followUp, setFollowUp] = useState<{ question: string; questionId: string | null; concept?: string | null } | null>(null);
  const [followUpDepth, setFollowUpDepth] = useState(0);
  const [qaBusy, setQaBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [learnBusy, setLearnBusy] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [retake, setRetake] = useState(false);
  const lastGradeAt = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const pendingPlayRef = useRef<(() => Promise<void>) | null>(null);

  const stage = session.data?.stage ?? "material";
  const limit = session.data?.blurt_limit_seconds ?? 180;
  const concepts = useMemo(() => (session.data ? keyConceptsOf(session.data) : []), [session.data]);
  const notes = session.data?.notes_text ?? "";
  const remaining = Math.max(0, limit - elapsed);
  // A session is complete once its feedback summary exists; the mic stays
  // locked unless the user deliberately starts a fresh attempt (teachAgain).
  const speakingLocked = Boolean(summary.data) && !retake;

  useEffect(() => {
    if (search.view === "feedback") setPanel("feedback");
  }, [search.view]);

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

  /* ---------- live trail of Sherlock's judgements ---------- */
  const recentVerdicts = useMemo<Verdict[]>(
    () =>
      (segments.data ?? [])
        .slice(-10)
        .map((segment) => (segment.verdict ?? "neutral") as Verdict),
    [segments.data],
  );

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
          const pendingCount = (questions.data ?? []).filter((q) => q.status === "pending").length;
          const room = Math.max(0, MAX_QA_QUESTIONS - pendingCount);
          if (room > 0) {
            await addQuestions(
              sessionId,
              grade.questions.slice(0, room).map((item) => ({
                question: item.question,
                concept: item.concept || null,
                source: "blurt",
              })),
            );
            queryClient.invalidateQueries({ queryKey: ["questions", sessionId] });
          }
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
    [concepts, gradeBlurtFn, notes, queryClient, questions.data, session.data, sessionId, transcriptSoFar],
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

  // One judgement at a time: words stay banked until the current one comes back.
  const gradingRef = useRef(false);
  useEffect(() => {
    gradingRef.current = grading;
  }, [grading]);

  const drainSpeech = speech.drain;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (gradingRef.current) return;
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
    if (speakingLocked) {
      toast.info("Feedback for this session is complete — the mic is closed.");
      return;
    }
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
    if (speakingLocked) {
      toast.info("Feedback for this session is complete — the mic is closed.");
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
    ? { question: pendingQuestions[0].question, questionId: pendingQuestions[0].id as string | null, concept: pendingQuestions[0].concept }
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
      setReaction(grade.reply?.trim() || null);
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
      setFollowUp(null);
      setFollowUpDepth(0);
      if (activeQuestion.questionId) {
        await setQuestionStatus(activeQuestion.questionId, grade.verdict === "green" ? "answered" : "missed");
        queryClient.invalidateQueries({ queryKey: ["questions", sessionId] });
      }
      speech.reset();
      queryClient.invalidateQueries({ queryKey: ["qa", sessionId] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setQaBusy(false);
    }
  };

  const SKIP_REPLIES = [
    "I'll note that as an open question.",
    "Let's park that one for now.",
    "We'll circle back to that.",
    "That's one to review later.",
    "Moving on — we can return to this.",
  ];

  const skipQuestion = async () => {
    if (!activeQuestion) return;
    setFollowUp(null);
    setFollowUpDepth(0);
    setVerdict("yellow");
    setReaction(SKIP_REPLIES[Math.floor(Math.random() * SKIP_REPLIES.length)]!);
    if (activeQuestion.questionId) {
      await setQuestionStatus(activeQuestion.questionId, "missed");
      queryClient.invalidateQueries({ queryKey: ["questions", sessionId] });
    }
    // "I don't know" means this must be addressed in Learn from Sherlock:
    // record the question's topic so it lands in the feedback lesson plan.
    const topic = (activeQuestion.concept?.trim() || activeQuestion.question).trim();
    if (topic) {
      const existing = new Set(
        ((await listLearnTopics(sessionId)) ?? []).map((row) =>
          row.topic.trim().toLowerCase(),
        ),
      );
      if (!existing.has(topic.toLowerCase())) {
        await addLearnTopics(sessionId, [
          { topic, detail: activeQuestion.question, origin: "skipped" },
        ]);
        queryClient.invalidateQueries({ queryKey: ["learn-topics", sessionId] });
      }
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

      // Start speaking the instant the report is saved so the student hears
      // the summary as the feedback panel renders.
      const freshReport: Report = {
        covered: result.covered,
        answeredWell: result.answeredWell,
        gaps: result.gaps,
        openQuestions: stillOpen,
        subtopicTime,
        speakingSeconds,
        exampleCount,
        narrative: result.narrative,
      };
      feedbackSpokenRef.current = true;
      stopAudio();
      queueAudio(reportSpeechText(freshReport));

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
  /* bumped on every stop so queued speech from a closed panel never starts */
  const speechTokenRef = useRef(0);
  const speechQueueRef = useRef<Promise<void>>(Promise.resolve());
  /* bumped only by stopAudio, so queued lines survive each other's playback */
  const speechGenRef = useRef(0);

  /* stops whatever is playing without cancelling anything queued behind it */
  const stopPlayback = () => {
    speechTokenRef.current += 1;
    pendingPlayRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onpause = null;
      audio.pause();
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setSpeaking(false);
    setVoiceLoading(false);
  };

  /* full stop: current line and everything queued after it */
  const stopAudio = () => {
    speechGenRef.current += 1;
    speechQueueRef.current = Promise.resolve();
    stopPlayback();
  };

  /* cache of in-flight/generated audio keyed by spoken text, so anything
     prefetched (next question, feedback report) plays instantly instead of
     waiting on a fresh voice-generation round trip after it pops up */
  const audioCacheRef = useRef(new Map<string, Promise<{ ok: boolean; audio?: string; message?: string }>>());

  const requestAudio = (spoken: string) => {
    const key = spoken.slice(0, 3500);
    let pending = audioCacheRef.current.get(key);
    if (!pending) {
      pending = speakFn({ data: { text: key } });
      audioCacheRef.current.set(key, pending);
      if (audioCacheRef.current.size > 20) {
        const oldest = audioCacheRef.current.keys().next().value;
        if (oldest) audioCacheRef.current.delete(oldest);
      }
    }
    return pending;
  };

  /* warm the cache so playback starts the moment the line is needed */
  const prefetchAudio = (text: string) => {
    const spoken = latexToSpeech(text).replace(/[*_#`>]/g, " ").trim();
    if (!spoken) return;
    void requestAudio(spoken).catch(() => undefined);
  };

  const playAudio = async (text: string) => {
    const spoken = latexToSpeech(text).replace(/[*_#`>]/g, " ").trim();
    if (!spoken) return;
    stopPlayback();
    const token = speechTokenRef.current;
    setVoiceLoading(true);
    try {
      const result = await requestAudio(spoken);
      if (token !== speechTokenRef.current) return;
      if (!result.ok) {
        audioCacheRef.current.delete(spoken.slice(0, 3500));
        setVoiceNotice(result.message ?? "Sherlock's voice didn't come through.");
        return;
      }

      // Decode base64 into a real audio blob: long data: URIs are rejected or
      // silently dropped by some browsers, a blob URL always plays.
      if (!result.audio) {
        audioCacheRef.current.delete(spoken.slice(0, 3500));
        setVoiceNotice("Sherlock's voice didn't come through.");
        return;
      }
      const binary = atob(result.audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
      audioUrlRef.current = url;

      // Reuse one element so the browser keeps the gesture-granted permission.
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;
      audio.preload = "auto";

      await new Promise<void>((resolve) => {
        const finish = () => {
          setSpeaking(false);
          resolve();
        };
        audio.onended = finish;
        audio.onpause = finish;

        const start = async () => {
          if (token !== speechTokenRef.current) {
            resolve();
            return;
          }
          setSpeaking(true);
          await audio.play();
          setVoiceNotice(null);
        };

        void start().catch((error: Error) => {
          // Autoplay policy: speech generated without a click cannot start on
          // its own. Keep it ready and let the next tap anywhere release it.
          if (error.name === "NotAllowedError") {
            setSpeaking(false);
            pendingPlayRef.current = start;
            setVoiceNotice("Tap anywhere to let Sherlock speak out loud.");
          } else {
            console.error(error);
            setSpeaking(false);
            setVoiceNotice("Sherlock's voice didn't come through — tap “Hear it” to try again.");
          }
          resolve();
        });
      });
    } catch (error) {
      console.error(error);
      setSpeaking(false);
      setVoiceNotice("Sherlock's voice didn't come through — tap “Hear it” to try again.");
    } finally {
      setVoiceLoading(false);
    }
  };

  /* speak one thing after another instead of cutting the previous line off */
  const queueAudio = (text: string) => {
    const generation = speechGenRef.current;
    speechQueueRef.current = speechQueueRef.current
      .then(() => (generation === speechGenRef.current ? playAudio(text) : undefined))
      .catch(() => undefined);
  };


  /* release any speech that autoplay blocked, on the student's next tap */
  useEffect(() => {
    const release = () => {
      const pending = pendingPlayRef.current;
      if (!pending) return;
      pendingPlayRef.current = null;
      void pending().catch(() => setSpeaking(false));
    };
    document.addEventListener("pointerdown", release);
    document.addEventListener("keydown", release);
    return () => {
      document.removeEventListener("pointerdown", release);
      document.removeEventListener("keydown", release);
    };
  }, []);

  /* ---------- Sherlock speaks every question and the feedback report ---------- */
  const spokenOnceRef = useRef<Set<string>>(new Set());
  const feedbackSpokenRef = useRef(false);
  const speakOnce = (key: string, text: string) => {
    if (!text.trim()) return;
    if (spokenOnceRef.current.has(key)) return;
    spokenOnceRef.current.add(key);
    void playAudio(text);
  };

  /* any question that pops up — Q&A or a follow-up — is asked out loud in full */
  useEffect(() => {
    if (panel !== "qa" || !activeQuestion) return;
    speakOnce(`q:${activeQuestion.questionId ?? activeQuestion.question}`, activeQuestion.question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, activeQuestion?.question, activeQuestion?.questionId]);

  /* the feedback summary is read aloud the moment the feedback tab opens, and
     re-read on each fresh visit to it */
  useEffect(() => {
    if (panel !== "feedback") {
      feedbackSpokenRef.current = false;
      return;
    }
    if (reportBusy || !report || feedbackSpokenRef.current) return;
    feedbackSpokenRef.current = true;
    stopAudio();
    queueAudio(reportSpeechText(report));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, reportBusy, report]);

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
    // Sherlock reads the feedback report aloud when the lesson opens, then the
    // first lesson follows it instead of cutting it off.
    stopAudio();
    if (report) queueAudio(reportSpeechText(report));
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
      queueAudio(result.reply);
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
    setReaction(null);
    setRetake(true);
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

  const backToNotebook = () => {
    const notebookId = session.data?.notebook_id;
    if (!notebookId) return;
    navigate({ to: "/notebook/$notebookId", params: { notebookId } });
  };

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

          <div className={cn("mt-4 transition-transform", grading && "animate-pulse")}>
            <SherlockFace verdict={verdict} />
          </div>

          {stage === "teach" && panel === "none" && (
            <div className="mt-2 flex flex-col items-center gap-1.5">
              <p aria-live="polite" className="label-caps text-muted-foreground">
                {grading
                  ? "Sherlock is judging that…"
                  : speech.transcribing
                    ? "Catching your words…"
                    : speech.listening
                      ? verdict === "green"
                        ? "He's following you"
                        : verdict === "yellow"
                          ? "He's getting confused"
                          : verdict === "red"
                            ? "He thinks that's wrong"
                            : "He's listening"
                      : "Paused"}
              </p>
              {recentVerdicts.length > 0 && (
                <div
                  className="flex items-center gap-1"
                  aria-label="Sherlock's reactions so far"
                >
                  {recentVerdicts.map((item, index) => (
                    <span
                      key={`${item}-${index}`}
                      className="h-2 w-5 rounded-full transition-colors"
                      style={{
                        background:
                          item === "green"
                            ? "var(--verdict-green)"
                            : item === "yellow"
                              ? "var(--brass)"
                              : item === "red"
                                ? "var(--verdict-red)"
                                : "var(--muted)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {reaction && (
            <p
              aria-live="polite"
              className="mt-2 max-w-md animate-fade-in text-center text-base italic"
              style={{
                color:
                  verdict === "green"
                    ? "var(--verdict-green)"
                    : verdict === "yellow"
                      ? "var(--brass)"
                      : verdict === "red"
                        ? "var(--verdict-red)"
                        : "var(--muted-foreground)",
              }}
            >
              “<MathText>{reaction}</MathText>”
            </p>
          )}


          <div className="mt-4">
            <RecorderOrb
              listening={speech.listening}
              speaking={speech.speaking}
              disabled={!speech.supported || speakingLocked}
              onToggle={toggleRecorder}
              levels={speech.levels}
              wordCount={spokenWords}
              label={
                speakingLocked
                  ? "Case closed"
                  : !speech.supported
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

          {stage === "teach" && panel === "none" && !speakingLocked && (
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

          {panel === "none" && !speakingLocked && (
            <div className="mx-auto mt-5 grid w-full max-w-xl gap-3 text-left sm:grid-cols-2">
              <label className="block">
                <span className="label-caps text-muted-foreground">Spoken language</span>
                <select
                  value={languageCode}
                  onChange={(event) => setLanguageCode(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {TRANSCRIPT_LANGUAGES.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label-caps text-muted-foreground">Context / vocabulary</span>
                <Input
                  value={vocabulary}
                  onChange={(event) => setVocabulary(event.target.value)}
                  placeholder="eigenvector, ATP, Dr. Nguyen"
                  className="mt-1"
                />
              </label>
            </div>
          )}

          {panel === "none" && (
            <div className="mt-4 w-full">
              <TranscriptView
                turns={speech.turns}
                events={speech.events}
                live={speech.interimText}
              />
            </div>
          )}

          {panel === "none" && speech.error && (
            <p role="alert" className="mt-3 max-w-md text-center text-sm text-verdict-red">
              {speech.error}
            </p>
          )}

          {speakingLocked && panel === "none" && (
            <p className="mt-4 max-w-md text-center text-sm text-muted-foreground">
              This session's feedback is complete — the case is closed. Review the report on
              the right, or start a new session from the notebook to keep practicing.
            </p>
          )}

          {panel === "none" && speech.supported && !speakingLocked && (
            <button
              type="button"
              onClick={() => setShowTyping((value) => !value)}
              className="label-caps mt-4 text-brass hover:underline"
            >
              {showTyping ? "Hide typing" : "Type instead"}
            </button>
          )}

          {(!speech.supported || showTyping) && panel === "none" && !speakingLocked && (
            <div className="mt-5 w-full max-w-xl">
              <p className="text-sm text-muted-foreground">
                Type what you'd say instead — Sherlock reacts the
                same way.
              </p>
              <MathTextarea
                value={typedBlurt}
                onValueChange={setTypedBlurt}
                placeholder="Explain it here…"
                className="min-h-24"
                wrapperClassName="mt-2"
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
              onBack={() => {
                stopAudio();
                setPanel("none");
              }}
              onLearn={openLearn}
              onNewTeach={() => {
                stopAudio();
                void teachAgain();
              }}
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
