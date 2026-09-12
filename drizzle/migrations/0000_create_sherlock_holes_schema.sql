-- Notebooks
CREATE TABLE public.notebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title TEXT NOT NULL,
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebooks TO anon, authenticated;
GRANT ALL ON public.notebooks TO service_role;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access notebooks" ON public.notebooks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Sessions
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'material',
  blurt_limit_seconds INTEGER NOT NULL DEFAULT 300,
  notes_text TEXT,
  key_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO anon, authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access sessions" ON public.sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX sessions_notebook_idx ON public.sessions(notebook_id);

-- Blurt segments (transcript chunks with live verdicts)
CREATE TABLE public.blurt_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  transcript TEXT NOT NULL,
  verdict TEXT NOT NULL DEFAULT 'neutral',
  concept TEXT,
  at_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  example_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blurt_segments TO anon, authenticated;
GRANT ALL ON public.blurt_segments TO service_role;
ALTER TABLE public.blurt_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access blurt_segments" ON public.blurt_segments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX blurt_segments_session_idx ON public.blurt_segments(session_id);

-- Questions (gap questions)
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  concept TEXT,
  source TEXT NOT NULL DEFAULT 'material',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO anon, authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access questions" ON public.questions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX questions_session_idx ON public.questions(session_id);

-- Q&A turns
CREATE TABLE public.qa_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  verdict TEXT NOT NULL DEFAULT 'neutral',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_turns TO anon, authenticated;
GRANT ALL ON public.qa_turns TO service_role;
ALTER TABLE public.qa_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access qa_turns" ON public.qa_turns FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX qa_turns_session_idx ON public.qa_turns(session_id);

-- Session summaries
CREATE TABLE public.summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  covered JSONB NOT NULL DEFAULT '[]'::jsonb,
  open_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtopic_time JSONB NOT NULL DEFAULT '[]'::jsonb,
  speaking_seconds INTEGER NOT NULL DEFAULT 0,
  example_count INTEGER NOT NULL DEFAULT 0,
  narrative TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.summaries TO anon, authenticated;
GRANT ALL ON public.summaries TO service_role;
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access summaries" ON public.summaries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX summaries_session_idx ON public.summaries(session_id);

-- Learn from Sherlock knowledge list
CREATE TABLE public.learn_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  detail TEXT,
  origin TEXT NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learn_topics TO anon, authenticated;
GRANT ALL ON public.learn_topics TO service_role;
ALTER TABLE public.learn_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access learn_topics" ON public.learn_topics FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX learn_topics_session_idx ON public.learn_topics(session_id);

-- Learn from Sherlock chat transcript
CREATE TABLE public.learn_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learn_messages TO anon, authenticated;
GRANT ALL ON public.learn_messages TO service_role;
ALTER TABLE public.learn_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access learn_messages" ON public.learn_messages FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX learn_messages_session_idx ON public.learn_messages(session_id);

-- Demo notebook so the dashboard is not empty on first visit
INSERT INTO public.notebooks (title, subject) VALUES
  ('Organic Chemistry I', 'Reaction mechanisms and stereochemistry'),
  ('Linear Algebra', 'Vector spaces, eigenvalues, transformations');
