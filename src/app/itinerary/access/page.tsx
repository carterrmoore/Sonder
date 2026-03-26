import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function MagicLinkAccessPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const { token } = searchParams;

  if (!token) {
    redirect("/");
  }

  const { data: capture } = await adminClient
    .from("email_captures")
    .select("id, itinerary_id, magic_link_expires_at, status, city_slug")
    .eq("magic_link_token", token)
    .single();

  if (!capture) {
    redirect("/itinerary/access/expired");
  }

  const isExpired = new Date(capture.magic_link_expires_at) < new Date();
  if (isExpired) redirect("/itinerary/access/expired");

  if (capture.status === "expired") redirect("/itinerary/access/expired");

  const cookieStore = await cookies();
  cookieStore.set(`sonder_itinerary_access_${capture.itinerary_id}`, "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  redirect(`/${capture.city_slug}/itinerary/${capture.itinerary_id}`);
}
