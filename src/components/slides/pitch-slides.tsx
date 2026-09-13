import { ArrowRight, Brain, Database, FileAudio, MonitorPlay, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import heroImage from "@/assets/pitch-hero.jpg";
import problemImage from "@/assets/pitch-problem.jpg";
import solutionImage from "@/assets/pitch-solution.jpg";
import techImage from "@/assets/pitch-tech.jpg";
import demoImage from "@/assets/pitch-demo.jpg";
import impactImage from "@/assets/pitch-impact.jpg";
import { SlideLayout } from "@/components/slides/SlideLayout";

export type PitchSlide = {
  title: string;
  seconds: number;
  script: string;
  render: () => ReactNode;
};

function Source({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="slide-source" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function FlowNode({ icon, label, detail }: { icon: ReactNode; label: string; detail: string }) {
  return (
    <div className="pitch-flow-node">
      <div className="pitch-flow-icon">{icon}</div>
      <strong>{label}</strong>
      <span>{detail}</span>
    </div>
  );
}

export const pitchSlides: PitchSlide[] = [
  {
    title: "Sherlock Holes",
    seconds: 20,
    script:
      "What if your notes could tell you exactly what you do not understand? We are Team Sherlock Holes — Ahad Rahman and Ella Wang. Sherlock Holes is a voice-first study companion built on the Feynman Technique: explain a topic, expose the gaps, then learn precisely what you missed.",
    render: () => (
      <SlideLayout className="pitch-title-slide">
        <img className="pitch-hero-image" src={heroImage} alt="Detective study room with case files" width={1600} height={1080} />
        <div className="pitch-title-card">
          <p className="slide-kicker">Case File 001</p>
          <h1 className="slide-title-lg">Sherlock Holes</h1>
          <p className="slide-subtitle">Finding the gaps in your understanding.</p>
          <p className="slide-body">Team: Ahad Rahman · Ella Wang</p>
          <p className="pitch-hook">What if your notes could talk back?</p>
        </div>
      </SlideLayout>
    ),
  },
  {
    title: "The Problem",
    seconds: 30,
    script:
      "Students often mistake recognition for mastery. Notes look familiar, so they feel ready — until an exam asks them to explain. In Roediger and Karpicke’s classic study, retrieval practice recalled about 61 percent after one week, while repeated study recalled about 40 percent. The issue is not effort; it is invisible knowledge gaps.",
    render: () => (
      <SlideLayout className="pitch-split-slide">
        <div>
          <p className="slide-kicker">The Problem</p>
          <h2 className="slide-title">Familiarity feels like mastery.</h2>
          <p className="slide-body-lg">
            Retrieval practice recalled <strong>61%</strong> after one week; rereading recalled <strong>40%</strong>. Recognition hides gaps.
          </p>
          <Source href="https://pubmed.ncbi.nlm.nih.gov/16507066/">Roediger & Karpicke, Psychological Science (2006)</Source>
        </div>
        <img className="pitch-panel-image" src={problemImage} alt="Student discovering gaps in study notes" width={1400} height={900} loading="lazy" />
      </SlideLayout>
    ),
  },
  {
    title: "The Solution",
    seconds: 30,
    script:
      "Sherlock Holes turns studying into teaching. A student explains their own notes aloud; Sherlock listens, reacts, asks only the most important questions, and creates a focused lesson from every missed concept. A 2019 meta-analysis found preparing to teach improves learning outcomes. Our purpose is simple: make gaps visible before the test does.",
    render: () => (
      <SlideLayout className="pitch-split-slide pitch-reverse">
        <img className="pitch-panel-image" src={solutionImage} alt="Student teaching a friendly study robot" width={1400} height={900} loading="lazy" />
        <div>
          <p className="slide-kicker">The Solution</p>
          <h2 className="slide-title">Explain it. Expose it. Fix it.</h2>
          <p className="slide-body-lg">
            Sherlock turns notes into spoken teaching, targeted Q&A, feedback, and personalized review.
          </p>
          <Source href="https://doi.org/10.1111/jpr.12221">Kobayashi meta-analysis, Japanese Psychological Research (2019)</Source>
        </div>
      </SlideLayout>
    ),
  },
  {
    title: "Tech Stack & Architecture",
    seconds: 25,
    script:
      "The front end captures typed, uploaded, handwritten, and spoken material. The server transcribes speech, reads documents, grades explanations against only the supplied notes, and stores sessions. Voice feedback streams back to the student. The result is a tight loop from input to judgment to review.",
    render: () => (
      <SlideLayout className="pitch-tech-slide">
        <img className="pitch-tech-image" src={techImage} alt="Illustration of connected learning app architecture" width={1400} height={900} loading="lazy" />
        <div className="pitch-tech-content">
          <p className="slide-kicker">Tech Stack & Architecture</p>
          <h2 className="slide-title">One continuous learning loop.</h2>
          <div className="pitch-flow" aria-label="Application architecture flowchart">
            <FlowNode icon={<MonitorPlay />} label="Interface" detail="React" />
            <ArrowRight aria-hidden />
            <FlowNode icon={<FileAudio />} label="Understanding" detail="Voice + OCR" />
            <ArrowRight aria-hidden />
            <FlowNode icon={<Brain />} label="Reasoning" detail="Server AI" />
            <ArrowRight aria-hidden />
            <FlowNode icon={<Database />} label="Memory" detail="Sessions" />
          </div>
          <p className="slide-caption">Streaming voice returns feedback immediately.</p>
        </div>
      </SlideLayout>
    ),
  },
  {
    title: "Live Demo Flow",
    seconds: 75,
    script:
      "Now the prototype. From the homepage, we open a notebook and start a session. We upload handwritten notes; the app scans them and keeps math exact through LaTeX. We set a time limit and teach for thirty seconds while Sherlock reacts live. In Q&A, we answer one question and show the green, yellow, and red expressions. Session feedback marks what needs review. Finally, Learn from Sherlock teaches each missed concept and asks a practice question.",
    render: () => (
      <SlideLayout className="pitch-demo-slide">
        <div className="pitch-demo-copy">
          <p className="slide-kicker">Live Demo Flow</p>
          <h2 className="slide-title">Watch one gap close.</h2>
          <ol className="pitch-demo-steps">
            <li>Open a notebook.</li>
            <li>Scan handwritten notes.</li>
            <li>Teach for 30 seconds.</li>
            <li>Answer one Q&A prompt.</li>
            <li>Review feedback.</li>
            <li>Learn every missed concept.</li>
          </ol>
          <p className="slide-caption">Math stays exact in LaTeX.</p>
        </div>
        <img className="pitch-demo-image" src={demoImage} alt="Detective learning dashboard during a live demo" width={1400} height={900} loading="lazy" />
      </SlideLayout>
    ),
  },
  {
    title: "Value, Impact & Conclusion",
    seconds: 30,
    script:
      "Students gain clearer understanding and more confident explanations. Teachers can rehearse lessons before class; speakers can practice explaining ideas under pressure. We would acquire users through campus pilots, study groups, and teacher referrals. Sherlock Holes does not just measure studying — it shows exactly what to learn next. Know what you know. Find what you do not.",
    render: () => (
      <SlideLayout className="pitch-impact-slide">
        <img className="pitch-impact-image" src={impactImage} alt="Student confidently presenting in a classroom" width={1400} height={900} loading="lazy" />
        <div className="pitch-impact-card">
          <p className="slide-kicker">Value · Impact · Conclusion</p>
          <h2 className="slide-title">Study becomes evidence.</h2>
          <p className="slide-body-lg">
            Students understand more. Teachers rehearse lessons. Speakers sharpen explanations.
          </p>
          <p className="slide-body">Acquisition: campus pilots, study groups, teacher referrals.</p>
          <p className="pitch-closing"><Sparkles aria-hidden /> Know what you know. Find what you do not.</p>
        </div>
      </SlideLayout>
    ),
  },
];
