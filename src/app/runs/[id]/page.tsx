import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/auth";
import { renderProvider } from "@/lib/render";
import { getRun, updateRun } from "@/lib/runs";
import { makeSeed } from "@/lib/prompt/random";
import RunDeck from "@/components/RunDeck";

export const dynamic = "force-dynamic";

export default async function RunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  await requireOperator();

  let run = await getRun(Number((await params).id));
  if (!run) notFound();

  /*
    Minted here, once, and stored. It used to be generated during render, which meant a
    fresh character on every reload and a server/client mismatch that React reported as
    hydration error 418. The seed shown in the panel now actually reproduces the roll.
  */
  if (!run.characterSeed) {
    const seed = makeSeed();
    await updateRun(run.id, { characterSeed: seed });
    run = { ...run, characterSeed: seed };
  }

  const step = (await searchParams)?.step ?? null;

  const operatorAge = Number(process.env.OPERATOR_AGE ?? 30) || 30;

  return <RunDeck run={run} operatorAge={operatorAge} provider={renderProvider()} initialStep={step} />;
}
