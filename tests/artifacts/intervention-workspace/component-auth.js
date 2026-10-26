export function createAuthClient() {
  return {
    useSession: () => ({
      data: {
        user: {
          id: "fixture-teacher",
          name: "Fictional teacher",
          email: "fixture@example.invalid",
        },
      },
    }),
    signOut: async () => {
      throw new Error("Fixture denies sign-out mutation");
    },
  };
}
