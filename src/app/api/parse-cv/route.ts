import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { requireUser, badRequest, serverError } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return badRequest("Invalid upload");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return badRequest("No file provided");

  if (file.size > MAX_BYTES) {
    return badRequest("File is too large. Maximum 5MB.");
  }

  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return badRequest(
      "Only PDF files are supported right now. Try copy-pasting the text directly.",
    );
  }

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const { text } = await extractText(pdf, { mergePages: true });
    const clean = (Array.isArray(text) ? text.join("\n") : text)
      .replace(/\r\n/g, "\n")
      .replace(/ /g, " ") // non-breaking spaces
      .replace(/[ \t]+\n/g, "\n")
      .trim();

    if (!clean || clean.length < 80) {
      return badRequest(
        "Couldn't extract text — this looks like a scanned image PDF. Try copy-pasting the text instead.",
      );
    }

    return NextResponse.json({ text: clean });
  } catch (e) {
    console.error("PDF parse failed", e);
    return serverError(
      e instanceof Error
        ? `Couldn't read the PDF: ${e.message}`
        : "Couldn't read the PDF",
    );
  }
}
