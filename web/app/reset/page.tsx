import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "@/components/AccountForms";

export const metadata: Metadata = { title: "New password" };

export default function ResetPage() {
  return (
    <>
      <h1 className="flicker" style={{ textAlign: "center" }}>Choose a new password</h1>
      <Suspense>
        <ResetForm />
      </Suspense>
    </>
  );
}
