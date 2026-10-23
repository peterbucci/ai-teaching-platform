import { notFound } from "next/navigation";
import { Workspace } from "../../components/workspace.tsx";
import { VisualPlayerSamples } from "./sample.tsx";
import "./sample.css";

export default function VisualPlayerSamplePage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <Workspace area="student" section="Visual player samples">
      <VisualPlayerSamples />
    </Workspace>
  );
}
