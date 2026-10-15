import { pathToFileURL } from "node:url";
import { betterAuth } from "better-auth";
import { verifyPassword } from "better-auth/crypto";
import { z } from "zod";
import { getAuthOptions } from "../lib/auth-config.ts";
import { getPool } from "../lib/db.ts";

const Credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128),
});

/** Local operator command only; this registration-enabled instance has no HTTP route. */
export async function provisionDemoAccounts() {
  const accounts = [
    {
      key: "teacher",
      prefix: "DEMO_TEACHER",
      name: "Demo Teacher (fictional)",
    },
    {
      key: "studentOne",
      prefix: "DEMO_STUDENT_ONE",
      name: "Student One (fictional)",
    },
    {
      key: "studentTwo",
      prefix: "DEMO_STUDENT_TWO",
      name: "Student Two (fictional)",
    },
  ] as const;
  const inputs = accounts.map((account) => {
    const parsed = Credentials.safeParse({
      email: process.env[`${account.prefix}_EMAIL`]?.trim(),
      password: process.env[`${account.prefix}_PASSWORD`],
    });
    if (!parsed.success)
      throw new Error(
        `Set ${account.prefix}_EMAIL and ${account.prefix}_PASSWORD (12–128 characters) in the ignored environment file.`,
      );
    return { ...account, ...parsed.data };
  });
  if (new Set(inputs.map(({ email }) => email)).size !== inputs.length) {
    throw new Error(
      "The three demo accounts must have different email addresses.",
    );
  }
  const options = getAuthOptions();
  const provisioningAuth = betterAuth({
    ...options,
    emailAndPassword: { ...options.emailAndPassword, disableSignUp: false },
  });
  const ids = { teacher: "", studentOne: "", studentTwo: "" };
  const pool = getPool();
  const lock = await pool.connect();
  try {
    // Concurrent initialization commands must not race to create the same account.
    await lock.query("select pg_advisory_lock(23031503)");
    for (const account of inputs) {
      const { rows } = await pool.query(
        `select u.id, u.name, a.password from auth_user u
         left join auth_account a on a."userId" = u.id and a."providerId" = 'credential'
         where u.email = $1`,
        [account.email],
      );
      if (rows.length) {
        const existing = z
          .object({
            id: z.string().min(1),
            name: z.string(),
            password: z.string().min(1),
          })
          .parse(rows[0]);
        if (
          existing.name !== account.name ||
          !(await verifyPassword({
            hash: existing.password,
            password: account.password,
          }))
        ) {
          throw new Error(
            `${account.prefix} does not match the existing fictional account. No account or password was replaced.`,
          );
        }
        ids[account.key] = existing.id;
      } else {
        const created = await provisioningAuth.api.signUpEmail({
          body: {
            name: account.name,
            email: account.email,
            password: account.password,
          },
        });
        ids[account.key] = created.user.id;
      }
    }
    return ids;
  } finally {
    try {
      await lock.query("select pg_advisory_unlock(23031503)");
    } finally {
      lock.release();
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let pool: ReturnType<typeof getPool> | undefined;
  try {
    pool = getPool();
    await provisionDemoAccounts();
    console.log(
      "Three fictional accounts are ready. Existing passwords and sessions were preserved.",
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Demo account provisioning failed.",
    );
    process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}
