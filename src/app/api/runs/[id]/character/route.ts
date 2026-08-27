import { NextResponse } from "next/server";
import { z } from "zod";
import type { Character } from "@/db/schema";
import { isSignedIn } from "@/lib/auth";
import { generateCharacter, rerollCharacterField } from "@/lib/beats";
import { getRun, updateRun } from "@/lib/runs";

export const dynamic = "force-dynamic";

const characterSchema = z.object({
  age: z.number().int().min(1).max(120),
  gender: z.string(),
  profession: z.string(),
  build: z.string(),
  hair: z.string(),
  outfit: z.string(),
  product: z.string(),
});

const body = z.union([
  z.object({ action: z.literal("generate") }),
  z.object({ action: z.literal("save"), character: characterSchema }),
  z.object({
    action: z.literal("reroll"),
    field: z.enum(["age", "gender", "profession", "build", "hair", "outfit", "product"]),
    character: characterSchema,
  }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const id = Number((await params).id);
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (parsed.data.action === "generate") {
    try {
      const character = await generateCharacter({
        productName: run.product.name,
        productCategory: run.product.categoryName ?? "",
        hookAngle: run.hookAngle,
        operatorAge: Number(process.env.OPERATOR_AGE ?? 30) || 30,
      });
      await updateRun(id, { character });
      return NextResponse.json({ character });
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 502 });
    }
  }

  if (parsed.data.action === "save") {
    await updateRun(id, { character: parsed.data.character as Character });
    return NextResponse.json({ ok: true });
  }

  try {
    const value = await rerollCharacterField(
      parsed.data.field,
      parsed.data.character as Character,
      run.product.name,
    );
    // age is the only numeric field, so a text reroll has to be coerced back.
    const coerced = parsed.data.field === "age" ? Number(value.replace(/\D/g, "")) || parsed.data.character.age : value;
    return NextResponse.json({ value: coerced });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
