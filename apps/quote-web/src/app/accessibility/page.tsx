import type { Metadata } from "next";
import { AccessibilityStatement } from "@/components/site-content";

export const metadata: Metadata = { title: "Accessibility statement" };

export default function AccessibilityPage() {
  return (
    <>
      <h1 className="mb-6 text-heading-xl font-bold">Accessibility statement</h1>
      <AccessibilityStatement />
    </>
  );
}
