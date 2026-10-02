import type { Metadata } from "next";
import { PrivacyNotice } from "@/components/site-content";

export const metadata: Metadata = { title: "How we use your information" };

export default function PrivacyPage() {
  return (
    <>
      <h1 className="mb-6 text-heading-xl font-bold">How we use your information</h1>
      <PrivacyNotice />
    </>
  );
}
