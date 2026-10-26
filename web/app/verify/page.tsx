import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmail } from "@/components/AccountForms";
import { currentUser } from "@/lib/server-api";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyPage() {
  const user = await currentUser();
  return (
    <div className="ledger">
      <h1 className="flicker" style={{ marginTop: 0 }}>Confirm your email</h1>
      <Suspense>
        <VerifyEmail user={user} />
      </Suspense>
    </div>
  );
}
