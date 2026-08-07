import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL ||
      "http://localhost:3000";

    const baseUrl = origin.startsWith("http") ? origin : `https://${origin}`;
    const redirectTo = `${baseUrl}/dashboard`;

    const { data, error } = await createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ).auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error || !data?.url) {
      console.error("[signin] OAuth error:", error);
      return NextResponse.redirect(`${baseUrl}/landing?auth_error=1`, {
        status: 302,
      });
    }

    return NextResponse.redirect(data.url, { status: 302 });
  } catch (err) {
    console.error("[signin] Unexpected error:", err);
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_URL ||
      "http://localhost:3000";
    const baseUrl = origin.startsWith("http") ? origin : `https://${origin}`;
    return NextResponse.redirect(`${baseUrl}/landing?auth_error=1`, {
      status: 302,
    });
  }
}
