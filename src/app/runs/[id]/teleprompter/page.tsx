import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/auth";
import { getRun } from "@/lib/runs";
import Teleprompter from "@/components/Teleprompter";

export const dynamic = "force-dynamic";

export default async function TeleprompterPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOperator();

  const run = await getRun(Number((await params).id));
  if (!run) notFound();

  if (!run.beats?.length) {
    return (
      <main className="shell">
        <p className="step-hint">This run has no beat sheet yet.</p>
        <Link href={`/runs/${run.id}`} className="btn" style={{ textDecoration: "none" }}>
          Back to the run
        </Link>
      </main>
    );
  }

  return <Teleprompter runId={run.id} beats={run.beats} />;
}
