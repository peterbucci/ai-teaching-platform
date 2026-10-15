import Link from "next/link";
import { headers } from "next/headers";
import { getAuth } from "../../lib/auth.ts";
import { LoginForm } from "./form.tsx";

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
    <main className="mx-auto max-w-md px-6 py-16 text-slate-900">
      <h1 className="text-3xl font-semibold">Demo sign-in</h1>
      <p className="mt-3 text-slate-600">
        Use the fictional account provided by the project team.
      </p>
      {message && (
        <p className="mt-6" role="status">
          {message}
        </p>
      )}
      {!configured ? (
        <p className="mt-6">
          Sign-in is not ready yet. Ask the project owner to configure the demo
          environment.
        </p>
      ) : (
        <LoginForm signedIn={signedIn} />
      )}
      <Link href="/" className="mt-8 inline-block underline">
        Back to the home page
      </Link>
    </main>
  );
}
