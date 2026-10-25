"use client";

import Link from "next/link";
import { TeacherFrame } from "../presentation.tsx";
import "../lessons/authoring.css";
import "./materials.css";

export default function MaterialError({ reset }: { reset: () => void }) {
  return (
    <TeacherFrame section="Lessons">
      <div className="la-workspace lp-material-workspace">
        <section className="lp-material-card" role="alert">
          <h1>Teaching material is unavailable</h1>
          <p>
            The saved source could not be loaded. Try again to check its current
            version. Any recoverable import text remains in this browser tab.
          </p>
          <div className="lp-material-actions">
            <button
              type="button"
              className="lp-button lp-button-primary"
              onClick={reset}
            >
              Try again
            </button>
            <Link className="lp-button" href="/teacher/lessons">
              Return to lessons
            </Link>
          </div>
        </section>
      </div>
    </TeacherFrame>
  );
}
