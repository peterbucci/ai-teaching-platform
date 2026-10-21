import Link from "next/link";
import { TeacherFrame } from "./presentation.tsx";
export default function NotFound() {
  return (
    <TeacherFrame>
      <section className="lp-panel lp-empty">
        <h1 className="text-2xl font-semibold">
          This evidence isn’t available
        </h1>
        <p className="my-4">
          Check your teacher account and assignment. Only the class’s teacher
          can inspect these records.
        </p>
        <Link href="/teacher" className="underline">
          Back to your classes
        </Link>
      </section>
    </TeacherFrame>
  );
}
