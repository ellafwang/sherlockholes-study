ALTER TABLE public.notebooks
ADD COLUMN color text NOT NULL DEFAULT 'gold';

ALTER TABLE public.notebooks
ADD CONSTRAINT notebooks_color_allowed
CHECK (color IN ('gold', 'crimson', 'forest', 'navy', 'plum', 'charcoal'));