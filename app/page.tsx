import Link from "next/link";
import { Workspace } from "./components/workspace.tsx";
import { Icon } from "./components/icons.tsx";

export default function Home() {
  return (
    <Workspace area="home" section="Welcome">
      <div className="lp-welcome">
        <p className="lp-eyebrow">Welcome to Learning Pulse</p>
        <h1 className="lp-title">
          A little insight.
          <br />A better next step.
        </h1>
        <p className="lp-intro">
          A place to work through your reasoning, learn with support, and see
          the evidence behind understanding.
        </p>
        <div className="lp-entry-grid">
          <section className="lp-panel lp-entry">
            <span className="lp-avatar lp-entry-icon">
              <Icon name="book" />
            </span>
            <h2>Your next learning moment</h2>
            <p>
              Open your assigned lesson, work through a question with your
              tutor, and pick up where you left off.
            </p>
            <Link href="/study" className="lp-button lp-button-primary">
              Open your study session
              <Icon name="arrow" />
            </Link>
          </section>
          <section className="lp-panel lp-entry">
            <span className="lp-avatar lp-entry-icon">
              <Icon name="chart" />
            </span>
            <h2>See how your class is thinking</h2>
            <p>
              Explore class learning signals and the original responses behind
              them, with uncertainty and assistance in view.
            </p>
            <Link href="/teacher" className="lp-button">
              Open teacher evidence
              <Icon name="arrow" />
            </Link>
          </section>
        </div>
        <p className="mt-7 text-xs text-slate-600">
          PEAAII AI Applications Hackathon · Fictional accounts and clearly
          labeled demonstration evidence.
        </p>
      </div>
    </Workspace>
  );
}
