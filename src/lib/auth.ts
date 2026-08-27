import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, readSession } from "./session";

export async function isSignedIn(): Promise<boolean> {
  const store = await cookies();
  return readSession(store.get(COOKIE_NAME)?.value);
}

/** For server components. Sends an unauthenticated visitor to the login screen. */
export async function requireOperator(): Promise<void> {
  if (!(await isSignedIn())) {
    redirect("/login");
  }
}
