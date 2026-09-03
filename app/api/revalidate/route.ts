import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * Admin-triggered cache clear: POST /api/revalidate with ?secret=<token>.
 * Demo builds render live from the seed catalogue, so nothing is cached yet —
 * this becomes useful once products live in Supabase and pages are statically
 * generated.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const { searchParams } = new URL(request.url);
  if (!secret || searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  revalidatePath("/sarees");
  revalidatePath("/", "layout");
  return NextResponse.json({ revalidated: true });
}
