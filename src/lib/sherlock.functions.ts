import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Verdict = "neutral" | "green" | "yellow" | "red";

const materialSchema = z.object({
  sessionTitle: z.string(),
  notes: z.string(),
  concepts: z.array(z.string()),
});

const BOUNDARY = `You are strictly bound to the student's notes/material. You must NOT ask about anything not directly mentioned or defined in the notes. If a word or concept appears in the notes but is not defined there, do not ask for its definition; simply note it and move on. Never infer, extrapolate, or test knowledge that goes beyond what the notes actually say.
Absolutely no probing, deepening or "what if" questions unless the notes themselves state the case being asked about. Before asking anything, check that the full answer is literally written in the notes; if it is not, do not ask it. Asking fewer questions is always better than asking one that reaches past the notes.

MATH FORMATTING (mandatory): write every mathematical term, variable, equation, expression, unit, chemical formula, matrix, integral, derivative, summation, inequality or symbolic notation as LaTeX.
Wrap inline math in single dollar signs, e.g. $f(x) = x^2 + 3x$, $\\lambda_1$, $\\mathrm{H_2O}$, $O(n \\log n)$.
Wrap a full standalone equation in double dollar signs on its own line, e.g. $$\\int_0^1 x^2\\,dx = \\tfrac{1}{3}$$.
Never write math as plain ASCII (no "x^2", "sqrt(2)", "integral of", "<=", "A * B" outside LaTeX) and never use markdown emphasis characters.
Ordinary prose stays plain text; only the mathematical or symbolic parts go inside the dollar signs.`;

const PERSONA = `You are Sherlock Holes: a bright undergraduate who is knowledgeable in all STEM-related terminology and focuses on STEM subjects.
You have already taken the course on this topic, so you know the core definitions, the usual theorems, and how the pieces fit together at an undergraduate level.
You are fluent in math, science, engineering, and computing vocabulary. You never need basic STEM terms defined for you, and you do not ask a student to define them.
You are helping a fellow student study by listening to their explanation and asking the kind of probing questions a prepared classmate would ask: about edge cases, why a step works, how two ideas connect, or when a rule breaks.
You only push on things that are genuinely unclear, subtle, or missing from the notes.
${BOUNDARY}
You are curious, respectful, and concise. Keep every question to one short sentence.
Vary how you phrase questions. Never start a question with "I do not understand" or "I don't get it".`;

const GRADER = `You judge how completely a student is explaining their own material, from the perspective of a prepared undergraduate classmate who is knowledgeable in all STEM-related terminology.
You MUST react with a verdict on every stretch of speech that asserts anything at all.
${BOUNDARY}
verdict rules, applied strictly:
- "green": accurate and elaborative — the mechanism, conditions, examples and connections are all there for what they just covered. Basic STEM definitions do not need to be restated.
- "yellow": partly right but thin — vague, no example, a missing condition, a skipped step from the notes, or a connection that was not explained. This is your default when you are still confused. Never mark yellow just because a basic STEM term was not defined or because the notes do not define a term they used; assume you already know the fundamentals from the course.
- "red": something they said is factually wrong, contradicts their own material, or mixes up two concepts.
- "neutral": ONLY when the stretch is filler, an aside, a false start, or nothing substantive was asserted. Never use "neutral" as a safe middle ground.
"note" is your reaction in one short sentence spoken directly to the student:
green = say what clicked, yellow = name the one thing you still don't get, red = name what sounded wrong.`;

/* ---------- seed questions from the material ---------- */

/** Loose containment check: does this quote really appear in the notes? */
function quotedFromNotes(notes: string, quote: string) {
  const flatten = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const haystack = flatten(notes);
  const needle = flatten(quote);
  if (needle.length < 12) return false;
  if (haystack.includes(needle)) return true;
  // Allow a trimmed quote: most of its words must appear as a run in the notes.
  const words = needle.split(" ");
  if (words.length < 4) return false;
  const window = words.slice(0, Math.max(4, Math.floor(words.length * 0.6))).join(" ");
  return haystack.includes(window);
}

export const seedQuestions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => materialSchema.parse(input))
  .handler(async ({ data }) => {
    const { generateJson } = await import("./ai.server");
    const result = await generateJson<{
      questions: { question: string; concept: string; evidence: string }[];
    }>({
      instructions: `${PERSONA}
You have just been handed the student's material for the topic "${data.sessionTitle}".
Write at most 3 questions — the most important ones — a well-prepared undergraduate classmate would ask about THIS material.
Hard rules, no exceptions:
- Every question must be fully answerable by reading the material alone. The complete answer must already be written in the material.
- Never ask about implications, applications, extensions, comparisons, edge cases, proofs or consequences that the material does not itself state.
- Never ask a student to speculate, generalise, or go one step beyond the text.
- Never ask for the meaning of a term the material does not define.
- If the material only supports one or two such questions, return only one or two. Fewer good questions is correct; inventing a deeper question is a failure.
For each question, "evidence" MUST be a sentence or clause copied word-for-word from the material that contains the answer. If you cannot copy such a sentence, drop the question.
One sentence per question. Vary the openings ("Why does...", "Walk me through...", "What does the material say about...").`,
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
              required: ["question", "concept", "evidence"],
              properties: {
                question: { type: "string" },
                concept: { type: "string" },
                evidence: { type: "string" },
              },
            },
          },
        },
      },
    });

    // Truly enforce grounding: keep only questions whose answer is quoted from the notes.
    const grounded = result.questions.filter((item) =>
      quotedFromNotes(data.notes, item.evidence ?? ""),
    );
    const chosen = grounded.length > 0 ? grounded : result.questions.slice(0, 1);
    return chosen.slice(0, 3).map(({ question, concept }) => ({ question, concept }));
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
"note" is one short sentence, addressed to the student, that you keep to yourself for now.
${BOUNDARY}
When judging, do not penalize the student for failing to define a term that the notes do not define; only penalize factual errors or contradictions with the supplied material.`,
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
${BOUNDARY}
- green: satisfied. "reply" thanks them in one sentence.
- yellow: note what was missing in one sentence, then move on. Do not ask another question.
- red: the answer is wrong or contradicts the notes. Do NOT reveal the correct answer. missedConcept names the concept they got wrong, but only if that concept is explicitly in the notes.
Set followUpQuestion to null always.
Set missedConcept to null unless the verdict is red or a non-basic definition that appears in the notes was clearly missing.
Do not ask them to define or explain anything that is not defined in their notes or that an undergraduate would already know; if the notes do not define it, simply move on.
Judge the answer against what they already told you while teaching and against the notes only: praise consistency, and challenge contradictions.`,
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
${BOUNDARY}
"covered" lists at most 4 concepts the student genuinely explained, each as a phrase of 5 words or fewer.
"answeredWell" lists at most 3 questions they answered correctly and with elaboration during the Q&A, each shortened to 8 words or fewer.
"gaps" lists at most 4 things they missed, misunderstood or left vague — each a phrase of 6 words or fewer they can study next. A gap must be something the notes actually cover; do not flag undefined terms.
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
${BOUNDARY}
Take one concept at a time. If the notes define it, define it in plain words, then explain how it works, then give one concrete example, then name the special case that trips people up. If the notes mention a term but do not define it, simply say what role it plays in the notes; do not define it beyond what the notes say.
Where the feedback report says they missed or misunderstood something, say gently what they got wrong before teaching the correct version.
Explain in short spoken paragraphs. Never use markdown symbols, headings, asterisks or bullet characters — this text is read aloud.
Every reply ends with one practice question that checks the thing you just explained. The practice question must be answerable using only the notes.
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
