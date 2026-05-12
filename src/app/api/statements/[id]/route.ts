import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, badRequest, serverError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const { data, error } = await auth.supabase
    .from("statements")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ statement: data });
}

const PatchBody = z.object({
  title: z.string().max(200).optional(),
  job_advert_text: z.string().max(40_000).nullable().optional(),
  cv_text: z.string().max(40_000).nullable().optional(),
  person_spec: z.any().optional(),
  gap_fills: z.any().optional(),
  draft_text: z.string().nullable().optional(),
  final_text: z.string().nullable().optional(),
  status: z.enum(["draft", "in_progress", "completed"]).optional(),
  step: z.number().int().min(0).max(10).optional(),
  last_score: z.number().int().min(0).max(100).nullable().optional(),
  last_decision: z.enum(["shortlist", "borderline", "reject"]).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Invalid input");
  }

  const { id } = await params;
  const { data, error } = await auth.supabase
    .from("statements")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) return serverError(error.message);
  return NextResponse.json({ statement: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const { error } = await auth.supabase.from("statements").delete().eq("id", id);
  if (error) return serverError(error.message);
  return NextResponse.json({ ok: true });
}
