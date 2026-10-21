import Link from "next/link";
import { headers } from "next/headers";
import { getAuth } from "../../lib/auth.ts";
import { LoginForm } from "./form.tsx";
import { Brand } from "../components/workspace.tsx";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { status } = await searchParams;
  let configured = true;
  let signedIn = false;
  try {
    signedIn = Boolean(
      await getAuth().api.getSession({ headers: await headers() }),
    );
  } catch {
    configured = false;
  }
  const message = status === "signed-out" ? "You have signed out." : null;

  return (
    <main className="lp-login">
      <Brand />
      <section className="lp-panel lp-login-card">
        <p className="lp-eyebrow mb-2">Your learning workspace</p>
        <h1>Welcome back.</h1>
        <p className="mt-3 text-slate-600">
          Use the fictional account provided by the project team.
        </p>
        {message && (
          <p className="lp-notice mt-6" role="status">
            {message}
          </p>
        )}
        {!configured ? (
          <p className="mt-6">
            Sign-in is not ready yet. Ask the project owner to configure the
            demo environment.
          </p>
        ) : (
          <LoginForm signedIn={signedIn} />
        )}
        <Link href="/" className="lp-text-link mt-8">
          Back to the home page
        </Link>
      </section>
    </main>
  );
}
