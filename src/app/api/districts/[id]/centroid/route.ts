import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireUser, serverError } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * The centre of a district's registered houses.
 *
 * A gazetteer says where a district's administrative centre is. This says
 * where the households actually being audited are, which is what the map is
 * for. It also needs no input and corrects itself as coverage grows, so it is
 * the better answer once any houses exist.
 *
 * A plain mean of latitude and longitude is fine at district scale - the
 * distortion only matters across hundreds of kilometres or near the poles.
 */
export async function GET(_request: Request, { params }: Params) {
  const { error } = await requireUser();
  if (error) return error;

  const { id } = await params;

  try {
    const snap = await adminDb()
      .collection("houses")
      .where("districtId", "==", id)
      .get();

    const points = snap.docs
      .map((doc) => ({
        lat: doc.data().refLat as number | null,
        lng: doc.data().refLng as number | null,
      }))
      .filter(
        (p): p is { lat: number; lng: number } =>
          typeof p.lat === "number" &&
          typeof p.lng === "number" &&
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lng),
      );

    if (points.length === 0) {
      return NextResponse.json({
        count: 0,
        centroid: null,
        message: "No houses with a location have been registered here yet.",
      });
    }

    const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;

    return NextResponse.json({
      count: points.length,
      centroid: { lat, lng },
    });
  } catch {
    return serverError("Could not work out the centre of this district.");
  }
}
