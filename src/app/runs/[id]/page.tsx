import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/auth";
import { renderProvider } from "@/lib/render";
import { getRun } from "@/lib/runs";
import RunDeck from "@/components/RunDeck";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOperator();

  const run = await getRun(Number((await params).id));
  if (!run) notFound();

  const operatorAge = Number(process.env.OPERATOR_AGE ?? 30) || 30;

  return <RunDeck run={run} operatorAge={operatorAge} provider={renderProvider()} />;
}
