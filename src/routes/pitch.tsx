import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Maximize2, Printer } from "lucide-react";
import { useEffect, useRef } from "react";

import { pitchSlides } from "@/components/slides/pitch-slides";
import { ScaledSlide } from "@/components/slides/SlideLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pitch")({
  validateSearch: (search: Record<string, unknown>) => ({
    slide:
      typeof search["slide"] === "number"
        ? search["slide"]
        : typeof search["slide"] === "string"
          ? Number(search["slide"])
          : undefined,
    print: search["print"] === true || search["print"] === "true",
  }),
  head: () => ({
    meta: [
      { title: "Sherlock Holes Pitch Deck" },
      {
        name: "description",
        content:
          "A concise pitch deck and speaker script for Sherlock Holes, the voice-first Feynman Technique study app.",
      },
      { property: "og:title", content: "Sherlock Holes Pitch Deck" },
      {
        property: "og:description",
        content: "Problem, evidence, architecture, live demo flow, impact, and presentation script.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PitchPage,
});

function PitchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/pitch" });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const requested = Number.isFinite(search.slide) ? Number(search.slide) : 1;
  const index = Math.min(pitchSlides.length - 1, Math.max(0, requested - 1));
  const slide = pitchSlides[index]!;
  const totalSeconds = pitchSlides.reduce((total, item) => total + item.seconds, 0);

  const goTo = (nextIndex: number) => {
    const safe = Math.min(pitchSlides.length - 1, Math.max(0, nextIndex));
    void navigate({
      search: { slide: safe + 1, print: false },
      replace: true,
    });
  };

  useEffect(() => {
    document.title = `${index + 1}/${pitchSlides.length} — ${slide.title}`;
  }, [index, slide.title]);

  useEffect(() => {
    if (search.print) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") goTo(index + 1);
      if (event.key === "ArrowLeft") goTo(index - 1);
      if (event.key === "Escape" && document.fullscreenElement) void document.exitFullscreen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, search.print]);

  if (search.print) {
    return (
      <main className="pitch-print">
        {pitchSlides.map((item, slideIndex) => (
          <article key={item.title} className="pitch-print-page">
            {item.render()}
            <aside>
              <h2>{item.title} — {item.seconds} seconds</h2>
              <p>{item.script}</p>
            </aside>
            <span>{slideIndex + 1}</span>
          </article>
        ))}
      </main>
    );
  }

  return (
    <main className="pitch-page">
      <section className="pitch-toolbar" aria-label="Presentation controls">
        <div>
          <p className="label-caps">Pitch deck</p>
          <h1>Sherlock Holes</h1>
        </div>
        <div className="pitch-controls">
          <Button variant="secondary" onClick={() => goTo(index - 1)} disabled={index === 0}>
            <ChevronLeft /> Previous
          </Button>
          <span className="pitch-counter">{index + 1} / {pitchSlides.length}</span>
          <Button variant="secondary" onClick={() => goTo(index + 1)} disabled={index === pitchSlides.length - 1}>
            Next <ChevronRight />
          </Button>
          <Button variant="secondary" onClick={() => void stageRef.current?.requestFullscreen()}>
            <Maximize2 /> Present
          </Button>
          <Button variant="secondary" onClick={() => void navigate({ search: { slide: undefined, print: true } })}>
            <Printer /> Print
          </Button>
        </div>
      </section>

      <div className="pitch-workspace">
        <nav className="pitch-thumbnails" aria-label="Slide thumbnails">
          {pitchSlides.map((item, itemIndex) => (
            <button
              key={item.title}
              type="button"
              onClick={() => goTo(itemIndex)}
              className={cn("pitch-thumbnail", itemIndex === index && "is-active")}
            >
              <span>{itemIndex + 1}</span>
              {item.title}
            </button>
          ))}
        </nav>

        <section ref={stageRef} className="pitch-stage" aria-label={`Slide ${index + 1}: ${slide.title}`}>
          <ScaledSlide>{slide.render()}</ScaledSlide>
        </section>

        <aside className="pitch-notes" aria-label="Speaker script">
          <div className="pitch-notes-header">
            <p className="label-caps">Speaker script</p>
            <span>{slide.seconds}s</span>
          </div>
          <h2>{slide.title}</h2>
          <p>{slide.script}</p>
          <p className="pitch-total">Total planned time: {Math.floor(totalSeconds / 60)}:{String(totalSeconds % 60).padStart(2, "0")}</p>
        </aside>
      </div>
    </main>
  );
}
