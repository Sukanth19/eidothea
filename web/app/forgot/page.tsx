import type { Metadata } from "next";
import { ForgotForm } from "@/components/AccountForms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="flicker" style={{ textAlign: "center" }}>Lost your way back in?</h1>
      <ForgotForm />
    </>
  );
}
