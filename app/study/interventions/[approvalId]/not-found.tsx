import { ReviewWorkspace } from "../../notebook/reviews/review-workspace.tsx";
import Link from "next/link";
import "../../notebook/reviews/reviews.css";

/** Same response for missing and unauthorized approvals; no activity identity. */
export default function ReviewNotFound() {
  return (
    <ReviewWorkspace
      title="Review unavailable"
      returnContext={{ href: "/study/assignments", label: "My learning" }}
    >
      <section
        className="sn-reviews sn-review-panel"
        aria-labelledby="review-unavailable-heading"
      >
        <h2 id="review-unavailable-heading">
          This review isn’t available to you
        </h2>
        <p>
          It may belong to a class you’re not in, or it may have been removed.
          Your saved work has not changed.
        </p>
        <p>
          If your teacher sent you this link, ask them to check that it was sent
          to you.
        </p>
        <Link className="sn-review-button" href="/study/assignments">
          Go to My learning
        </Link>
        <Link className="sn-review-link" href="/study/history">
          Open your notebook
        </Link>
      </section>
    </ReviewWorkspace>
  );
}
