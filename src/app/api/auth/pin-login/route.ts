// src/app/api/auth/pin-login/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminDb, getAdminAuth } from "@/lib/server/firebaseAdmin";

type Role = "admin" | "manager" | "cashier" | "waiter" | "kitchen";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const uid = (body.id || body.uid || "").trim();
    const pin = (body.pin || "").trim();

    if (!uid || !pin) {
      return NextResponse.json({ error: "Missing id/pin" }, { status: 400 });
    }

    const db = getAdminDb();

    // 1) Load public user profile for status/role
    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists) {
      console.warn("pin-login: user not found", uid);
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }
    const user = userSnap.data() as { active?: boolean; role?: Role; name?: string } | undefined;
    if (!user?.active) {
      console.warn("pin-login: user inactive", uid);
      return NextResponse.json({ error: "User inactive" }, { status: 401 });
    }
    const role = user.role as Role;
    const ALLOWED: Role[] = ["admin", "manager", "cashier", "waiter", "kitchen"];
    if (!ALLOWED.includes(role)) {
      console.warn("pin-login: invalid role", uid, role);
      return NextResponse.json({ error: "Invalid role" }, { status: 401 });
    }

    // 2) Load secret hash from user_secrets/{uid}
    const secretSnap = await db.doc(`user_secrets/${uid}`).get();
    if (!secretSnap.exists) {
      console.warn("pin-login: pin not set", uid);
      return NextResponse.json({ error: "PIN not set" }, { status: 401 });
    }
    const { pinHash } = secretSnap.data() as { pinHash?: string };
    if (typeof pinHash !== "string" || pinHash.length < 20) {
      console.warn("pin-login: bad pinHash", uid);
      return NextResponse.json({ error: "PIN not set" }, { status: 401 });
    }

    // 3) Verify PIN
    const ok = await bcrypt.compare(pin, pinHash);
    if (!ok) {
      console.warn("pin-login: invalid pin", uid);
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    // 4) Mint custom token with role claim
    const auth = getAdminAuth();
    const token = await auth.createCustomToken(uid, { role });

    return NextResponse.json({ token, role }, { status: 200 });
  } catch (e: any) {
    console.error("pin-login error:", e?.message || e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
