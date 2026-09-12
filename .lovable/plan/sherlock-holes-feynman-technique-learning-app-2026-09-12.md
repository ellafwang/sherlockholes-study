# Sherlock Holes — Feynman-technique learning app

Teach a topic out loud to Sherlock, get quizzed on the gaps ("holes"), then learn what you missed from him.

## What gets built

### Dashboard
- Grid of notebooks (course / concept / topic). Create, rename, delete (with a confirm step).
- Opening a notebook lists its sessions with date and status. Create a new session (name it first), open an existing one, or delete one with confirmation.

### Inside a session
A session moves through clear stages, with smooth transitions between each:

1. **Material** — two ways to give Sherlock the material:
   - paste or upload notes as text
   - fill a "Key Concepts" list form
   Sherlock turns this into a starting set of questions held back for the Q&A.
2. **Blurt (Teach Sherlock!)** — pick a length up to 5 minutes, then speak your explanation. Live transcription shows on screen. The timer turns amber at 30 seconds left and red at zero; stopping is always the student's own choice. While speaking, Sherlock's face reacts — neutral, green smile with thumbs-up, yellow confused with a question mark, red shocked with an exclamation — cross-fading smoothly. Any concept left thin or wrong becomes a question for later.
3. **Mid-Session Q&A** — Sherlock asks neutral-faced questions aimed at the holes. Correct and elaborate answers turn him green and he moves on; vague answers turn him yellow and he presses for detail; wrong answers turn him red and he asks guiding questions without handing over the answer, and that concept is flagged for review.
4. **Summary** — concepts covered, questions still open, what was missed or misunderstood, total speaking time, number of examples given, and time spent per subtopic (only subtopics from the material the student supplied). Saved to the session permanently.
5. **Next step** — add the missed or misunderstood concepts to Sherlock's teaching list, then go to Learn from Sherlock, start a fresh Teach session, or return to the dashboard.
6. **Learn from Sherlock!** — reachable at any point, including before ever blurting, for when the student has no idea where to start. Sherlock explains the notes or a requested topic step by step and speaks aloud in his own voice, with interactive practice questions along the way.

Skip buttons appear once the blurt can end: a speech-bubble icon for Mid-Session Q&A, a light bulb for Learn from Sherlock.

### Look and feel
- EB Garamond throughout.
- Palette: parchment #F0DCB9 and #EADBC4, near-black #030706 ink, grey #7D7D7D, gold #f5b942, brown #964f03. Detective-notebook feel — magnifier, keyhole, brick and pipe motifs used sparingly.
- Sherlock's four expressions come from your uploaded artwork, split into four separate images and cross-faded.

### Saved data
Notebooks, sessions, notes and key concepts, transcripts, questions, answers with their verdicts, session summaries, and the Learn-from-Sherlock knowledge list are all stored per session in the app's database. No login for now — everyone shares one workspace, so this is a single-student setup.

## Technical notes

- Lovable Cloud for the database. Tables: `notebooks`, `sessions`, `session_materials`, `blurt_segments`, `questions`, `qa_turns`, `summaries`, `learn_topics`. Public grants + permissive RLS since there is no auth yet; the schema keeps a nullable `user_id` so login can be added later without a rewrite.
- Speech in: browser Web Speech API for live captions, plus periodic audio windows sent to a server function for accurate transcription via Lovable AI speech-to-text. Typing fallback if the mic is unavailable.
- Grading loop: every few seconds of transcript is sent to a server function that returns a verdict (neutral/green/yellow/red), the concept touched, and any new gap questions — this drives the face and builds the Q&A queue.
- Q&A and Learn mode: streaming chat server route through Lovable AI, `openai/gpt-6-astra` on the Responses API, with the session's material and gap list as context.
- Voice out: ElevenLabs connector, called from a server function; audio streamed back to the browser. Requires linking your ElevenLabs account — I will open the connect card at that step.
- Expression sprites cut from `image-2.png` into four assets, animated with opacity/scale transitions.
- Timers and per-subtopic timing tracked client-side and persisted with the summary.

## Build order

1. Design system, fonts, palette, Sherlock expression assets, dashboard and notebook screens (data in place, mock content).
2. Cloud enabled, schema and data wiring for notebooks and sessions with delete confirmations.
3. Material input, blurt timer, live transcription, expression engine, real-time grading.
4. Mid-Session Q&A with branching follow-ups, then session summary and persistence.
5. Learn from Sherlock chat, ElevenLabs voice, add-missed-concepts handoff.
