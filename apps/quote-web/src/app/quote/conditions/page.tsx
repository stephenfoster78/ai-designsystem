import type { Metadata } from "next";
import Link from "next/link";
import { EligibilityConditions } from "@/components/eligibility";

export const metadata: Metadata = { title: "Conditions for an online quote" };

/** The eligibility conditions as a page, for links opened without JavaScript or in a new tab. */
export default function ConditionsPage() {
  return (
    <>
      <h1 className="mb-6 text-heading-xl font-bold">Conditions for an online quote</h1>
      <EligibilityConditions />
      <p className="mt-8">
        <Link href="/quote/start">Back to start</Link>
      </p>
    </>
  );
}
