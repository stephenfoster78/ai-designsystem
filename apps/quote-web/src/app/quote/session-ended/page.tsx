import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClasses } from "@qf/design-system";
import { firstIncompleteStep } from "@qf/journey-engine";
import { motorJourney } from "@qf/journey-motor";
import { idleLimitText } from "@/lib/config";
import { paths } from "@/lib/paths";
import { evalContext, readQuoteSession } from "@/lib/quote-session";

export const metadata: Metadata = { title: "Your session has ended" };

export default async function SessionEndedPage() {
  const quote = await readQuoteSession();
  if (quote.state === "active") {
    const next = firstIncompleteStep(motorJourney, evalContext(quote.draft));
    redirect(next ? paths.step(next) : paths.check);
  }
  const reference = quote.state === "ended" ? quote.draft?.reference : null;

  return (
    <div className="max-w-[40rem]">
      <h1 className="mb-6 text-heading-xl font-bold">Your session has ended</h1>
      <p className="mb-4">For your security, we ended your session because there was no activity for {idleLimitText()}.</p>
      {reference ? (
        <>
          <p className="mb-4">We saved your answers. Your quote reference is:</p>
          <p className="mb-6 text-heading-l font-bold" data-testid="quote-reference">
            {reference}
          </p>
          <p className="mb-8">To continue your quote, you’ll need this reference and your date of birth or postcode.</p>
        </>
      ) : (
        <p className="mb-8">You had not answered any questions, so there was nothing to save.</p>
      )}
      <Link href={paths.start} className={buttonClasses("primary")}>
        Start a new quote
      </Link>
    </div>
  );
}
