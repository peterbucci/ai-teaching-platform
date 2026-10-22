import { redirect } from "next/navigation";
import { AuthError, requireActor } from "../lib/auth.ts";
import { getPool } from "../lib/db.ts";
import { z } from "zod";

export const dynamic = "force-dynamic";

export default async function Home() {
  let actor;
  try {
    actor = await requireActor();
  } catch (error) {
    if (error instanceof AuthError && [401, 403].includes(error.status))
      redirect("/login");
    throw error;
  }
  // Classroom ownership is server-owned. Login input and browser role claims
  // cannot select a privileged workspace; each destination still authorizes access.
  const result = await getPool().query(
    "SELECT EXISTS(SELECT 1 FROM classes WHERE teacher_id=$1) AS teaches",
    [actor.profileId],
  );
  const { teaches } = z.object({ teaches: z.boolean() }).parse(result.rows[0]);
  redirect(teaches ? "/teacher" : "/study/assignments");
}
