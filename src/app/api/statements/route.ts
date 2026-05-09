import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, badRequest, serverError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.supabase
    .from("statements")
    .select(
      "id, title, sector, status, step, person_spec, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (error) return serverError(error.message);
  return NextResponse.json({ statements: data ?? [] });
}

const CreateBody = z.object({
  title: z.string().max(200).optional(),
  sector: z.literal("nhs").default("nhs"),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof CreateBody>;
  try {
    body = CreateBody.parse(await req.json().catch(() => ({})));
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Invalid input");
  }

  const { data, error } = await auth.supabase
    .from("statements")
    .insert({
      user_id: auth.user.id,
      title: body.title ?? "Untitled statement",
      sector: body.sector,
      status: "draft",
      step: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("statements insert failed:", error);
    return serverError(error.message);
  }
  return NextResponse.json({ statement: data });
}
