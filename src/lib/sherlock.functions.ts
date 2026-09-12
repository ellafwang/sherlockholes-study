import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Verdict = "neutral" | "green" | "yellow" | "red";

const materialSchema = z.object({
  sessionTitle: z.string(),
  notes: z.string(),
  concepts: z.array(z.string()),
});

const BOUNDARY = `You are strictly bound to the student's notes/material. You must NOT ask about anything not directly mentioned or defined in the notes. If a word or concept appears in the notes but is not defined there, do not ask for its definition; simply note it and move on. Never infer, extrapolate, or test knowledge that goes beyond what the notes actually say.`;

const PERSONA = `You are Sherlock Holes: a bright undergraduate who has already taken the course on this topic.
You have solid foundational knowledge of the curriculum — you know the core definitions, the usual theorems, and how the pieces fit together at an undergraduate level.
You are helping a fellow student study by listening to their explanation and asking the kind of probing questions a prepared classmate would ask: about edge cases, why a step works, how two ideas connect, or when a rule breaks.
You do NOT ask for basic definitions or concepts you would already know from the course. You only push on things that are genuinely unclear, subtle, or missing from the notes.
${BOUNDARY}
You are curious, respectful, and concise. Keep every question to one short sentence.
Vary how you phrase questions. Never start a question with "I do not understand" or "I don't get it".`;

const GRADER = `You judge how completely a student is explaining their own material, from the perspective of a prepared undergraduate classmate.
You MUST react with a verdict on every stretch of speech that asserts anything at all.
verdict rules, applied strictly:
- "green": accurate and elaborative — the mechanism, conditions, examples and connections are all there for what they just covered. Basic definitions do not need to be restated.
- "yellow": partly right but thin — vague, no example, a missing condition, a skipped step from the notes, or a connection that was not explained. This is your default when you are still confused. Never mark yellow just because a basic definition was not given; assume you already know the fundamentals from the course.
- "red": something they said is factually wrong, contradicts their own material, or mixes up two concepts.
- "neutral": ONLY when the stretch is filler, an aside, a false start, or nothing substantive was asserted. Never use "neutral" as a safe middle ground.
"note" is your reaction in one short sentence spoken directly to the student:
green = say what clicked, yellow = name the one thing you still don't get, red = name what sounded wrong.`;

/* ---------- seed questions from the material ---------- */

export const seedQuestions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => materialSchema.parse(input))
  .handler(async ({ data }) => {
    const { generateJson } = await import("./ai.server");
    const result = await generateJson<{ questions: { question: string; concept: string }[] }>({
      instructions: `${PERSONA}
You have just been handed the student's material for the topic "${data.sessionTitle}".
Write exactly 3 questions — the 3 most important ones — a well-prepared undergraduate classmate would ask to test whether the student really understands the material.
Every question MUST be answerable from the material below — never ask about anything it does not mention.
Focus on mechanisms, edge cases, connections between ideas, when a rule breaks, and "why" questions. Do not ask for basic definitions. One sentence each.
Use varied openings such as "What happens if...", "Why does...", "How would...", "Walk me through...", "What's the difference between...".`,
      input: `Notes:\n${data.notes || "(none given)"}\n\nKey concepts the student intends to cover:\n${
        data.concepts.join("\n") || "(none listed)"
      }`,
      schemaName: "seed_questions",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["questions"],
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["question", "concept"],
              properties: {
                question: { type: "string" },
                concept: { type: "string" },
              },
            },
          },
        },
      },
    });
    return result.questions.slice(0, 3);
  });

/* ---------- live grading during the blurt ---------- */

const blurtSchema = z.object({
  sessionTitle: z.string(),
  notes: z.string(),
  concepts: z.array(z.string()),
  transcript: z.string(),
  earlier: z.string(),
});

export type BlurtGrade = {
  verdict: Verdict;
  concept: string;
  note: string;
  examples: number;
  questions: { question: string; concept: string }[];
};

export const gradeBlurt = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => blurtSchema.parse(input))
  .handler(async ({ data }): Promise<BlurtGrade> => {
    const { generateJson } = await import("./ai.server");
    return generateJson<BlurtGrade>({
      instructions: `${PERSONA}

${GRADER}

You are listening live while the student teaches "${data.sessionTitle}".
Judge ONLY the newest stretch of speech, in the context of what came before.
Also note which single concept from their material it belongs to (use their own wording, or "General" if none fits),
count how many worked examples or concrete instances they gave in this stretch,
and return an empty "questions" array. Do not generate follow-up questions during the blurt.
"note" is one short sentence, addressed to the student, that you keep to yourself for now.`,
      input: `Their notes:\n${data.notes || "(none)"}
Key concepts:\n${data.concepts.join(", ") || "(none listed)"}

Earlier in this explanation:\n${data.earlier.slice(-2500) || "(nothing yet)"}

Newest stretch of speech:\n${data.transcript}`,
      schemaName: "blurt_grade",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["verdict", "concept", "note", "examples", "questions"],
        properties: {
          verdict: { type: "string", enum: ["neutral", "green", "yellow", "red"] },
          concept: { type: "string" },
          note: { type: "string" },
          examples: { type: "integer" },
          questions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["question", "concept"],
              properties: {
                question: { type: "string" },
                concept: { type: "string" },
              },
            },
          },
        },
      },
    });
  });

/* ---------- Mid-Session Q&A grading ---------- */

const answerSchema = z.object({
  sessionTitle: z.string(),
  notes: z.string(),
  question: z.string(),
  answer: z.string(),
  followUpDepth: z.number(),
  /** What the student actually said while teaching, so grading is grounded in it. */
  transcript: z.string().optional().default(""),
});


export type AnswerGrade = {
  verdict: Verdict;
  reply: string;
  followUpQuestion: string | null;
  missedConcept: string | null;
};

export const gradeAnswer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => answerSchema.parse(input))
  .handler(async ({ data }): Promise<AnswerGrade> => {
    const { generateJson } = await import("./ai.server");
    return generateJson<AnswerGrade>({
      instructions: `${PERSONA}

${GRADER}

You asked the student a question about "${data.sessionTitle}" and they answered.
Grade the answer, then respond in character with a one-sentence "reply". Do NOT ask a follow-up question.
- green: satisfied. "reply" thanks them in one sentence.
- yellow: note what was missing in one sentence, then move on. Do not ask another question.
- red: the answer is wrong. Do NOT reveal the correct answer. missedConcept names the concept they got wrong.
Set followUpQuestion to null always.
Set missedConcept to null unless the verdict is red or a non-basic definition was clearly missing.
Do not ask them to define or explain anything that is not defined in their notes or that an undergraduate would already know; if the notes do not define it, simply move on.
Judge the answer against what they already told you while teaching: praise consistency, and challenge contradictions.`,
      input: `Their notes:\n${data.notes || "(none)"}\n\nWhat they said while teaching you:\n${data.transcript || "(they said nothing yet)"}\n\nYour question:\n${data.question}\n\nTheir answer:\n${data.answer}`,
      schemaName: "answer_grade",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["verdict", "reply", "followUpQuestion", "missedConcept"],
        properties: {
          verdict: { type: "string", enum: ["neutral", "green", "yellow", "red"] },
          reply: { type: "string" },
          followUpQuestion: { type: ["string", "null"] },
          missedConcept: { type: ["string", "null"] },
        },
      },
    });
  });

/* ---------- Session feedback report ---------- */

const summarySchema = z.object({
  sessionTitle: z.string(),
  notes: z.string(),
  concepts: z.array(z.string()),
  transcript: z.string(),
  qaLog: z.string(),
  openQuestions: z.array(z.string()),
});

export type SummaryReport = {
  covered: string[];
  answeredWell: string[];
  gaps: string[];
  narrative: string;
};

export const buildReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => summarySchema.parse(input))
  .handler(async ({ data }): Promise<SummaryReport> => {
    const { generateJson } = await import("./ai.server");
    return generateJson<SummaryReport>({
      instructions: `You are writing the case notes for a Feynman-technique study session on "${data.sessionTitle}".
Brevity is the top priority: this report is scanned at a glance.
"covered" lists at most 4 concepts the student genuinely explained, each as a phrase of 5 words or fewer.
"answeredWell" lists at most 3 questions they answered correctly and with elaboration during the Q&A, each shortened to 8 words or fewer.
"gaps" lists at most 4 things they missed, misunderstood or left vague — each a phrase of 6 words or fewer they can study next.
"narrative" is exactly 1 or 2 short sentences of plain, honest feedback addressed to the student. No filler.
Only reference material the student actually supplied or said.`,
      input: `Notes:\n${data.notes || "(none)"}
Key concepts:\n${data.concepts.join(", ") || "(none listed)"}

Full spoken explanation:\n${data.transcript.slice(0, 12000) || "(nothing recorded)"}

Q&A log:\n${data.qaLog.slice(0, 8000) || "(no Q&A)"}

Questions still unanswered:\n${data.openQuestions.join("\n") || "(none)"}`,
      schemaName: "session_report",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["covered", "answeredWell", "gaps", "narrative"],
        properties: {
          covered: { type: "array", items: { type: "string" } },
          answeredWell: { type: "array", items: { type: "string" } },
          gaps: { type: "array", items: { type: "string" } },
          narrative: { type: "string" },
        },
      },
      effort: "medium",
    });
  });

/* ---------- Learn from Sherlock ---------- */

const learnSchema = z.object({
  sessionTitle: z.string(),
  notes: z.string(),
  focus: z.array(z.string()),
  keyConcepts: z.array(z.string()).default([]),
  report: z.string().default(""),
  history: z.array(z.object({ role: z.string(), content: z.string() })),
  message: z.string(),
});

export const learnReply = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => learnSchema.parse(input))
  .handler(async ({ data }): Promise<{ reply: string }> => {
    const { generateProse } = await import("./ai.server");
    const reply = await generateProse({
      instructions: `You are Sherlock Holes in teaching mode: a warm, exacting tutor for the topic "${data.sessionTitle}".
Teach only from the student's own notes, their key concepts and the session feedback report given below — never invent material they never studied.
Take one concept at a time: define it in plain words, then explain how it works, then give one concrete example, then name the special case that trips people up.
Where the feedback report says they missed or misunderstood something, say gently what they got wrong before teaching the correct version.
Explain in short spoken paragraphs. Never use markdown symbols, headings, asterisks or bullet characters — this text is read aloud.
Every reply ends with one practice question that checks the thing you just explained.
Keep replies under 180 words.`,
      input: `The student's notes:\n${data.notes || "(none)"}

Key concepts of this session:\n${data.keyConcepts.join("\n") || "(none listed)"}

Feedback report from their teaching attempt:\n${data.report || "(no report yet)"}

Concepts they still need to close:\n${data.focus.join("\n") || "(none flagged)"}

Conversation so far:
${data.history
  .slice(-12)
  .map((m) => `${m.role === "user" ? "Student" : "Sherlock"}: ${m.content}`)
  .join("\n")}

Student: ${data.message}`,
      effort: "low",
    });
    return { reply };
  });
