import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Panel, buttonClasses } from "@qf/design-system";
import { firstIncompleteStep } from "@qf/journey-engine";
import { motorJourney } from "@qf/journey-motor";
import { SessionTimeoutHost } from "@/components/SessionTimeoutHost";
import { config, idleLimitText } from "@/lib/config";
import { paths } from "@/lib/paths";
import { evalContext, readQuoteSession, remainingMs } from "@/lib/quote-session";

export const metadata: Metadata = { title: "Your quote has been saved" };

export default async function SavedPage() {
  const quote = await readQuoteSession();
  if (quote.state === "none") redirect(paths.start);
  if (quote.state === "ended") redirect(paths.sessionEnded);

  const next = firstIncompleteStep(motorJourney, evalContext(quote.draft));

  return (
    <div className="max-w-[40rem]">
      <Panel title="Your quote has been saved">
        Your quote reference is
        <br />
        <strong className="text-heading-l" data-testid="quote-reference">
          {quote.draft.reference}
        </strong>
      </Panel>
      <p className="mb-4">Make a note of your reference. You’ll need it, and your date of birth, to continue your quote later.</p>
      <p className="mb-8">For your security, we’ll end this session after {idleLimitText()} without activity. Your answers stay saved.</p>
      <Link href={next ? paths.step(next) : paths.check} className={buttonClasses("primary")}>
        Continue your quote
      </Link>
      {/* Not touched on view: reading a confirmation is not activity on the quote. */}
      <SessionTimeoutHost remainingMs={remainingMs(quote.session)} warningMs={config.sessionWarningMs} />
    </div>
  );
}
