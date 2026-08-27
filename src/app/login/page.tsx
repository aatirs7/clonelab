import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isSignedIn()) redirect("/");

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "19rem" }}>
        <p className="wordmark" style={{ padding: 0, marginBottom: "2rem" }}>
          Clone<span>Lab</span>
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
