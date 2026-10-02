import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InsetText } from "@qf/design-system";
import { firstIncompleteStep } from "@qf/journey-engine";
import { motorJourney } from "@qf/journey-motor";
import { SessionTimeoutHost } from "@/components/SessionTimeoutHost";
import { answersSummary } from "@/lib/answers-summary";
import { config } from "@/lib/config";
import { paths } from "@/lib/paths";
import { evalContext, readQuoteSession, remainingMs, touchQuoteSession } from "@/lib/quote-session";
import { services } from "@/lib/services";

export const metadata: Metadata = { title: "Check your answers so far" };

/**
 * End of the milestone 1 slice. Previews the answers summary that the basket page will reuse
 * (collapsible sections with change links) in milestone 3.
 */
export default async function CheckPage() {
  const quote = await readQuoteSession();
  if (quote.state === "none") redirect(paths.start);
  if (quote.state === "ended") redirect(paths.sessionEnded);

  const ctx = evalContext(quote.draft);
  const incomplete = firstIncompleteStep(motorJourney, ctx);
  if (incomplete) redirect(paths.step(incomplete));

  const session = await touchQuoteSession(quote.session);
  const sections = answersSummary(motorJourney, ctx, services.content);

  return (
    <div className="max-w-[40rem]">
      <h1 className="mb-4 text-heading-xl font-bold">Check your answers so far</h1>
      <p className="mb-6">
        Your quote reference is <strong data-testid="quote-reference">{quote.draft.reference}</strong>.
      </p>
      {sections.map((section) => (
        <section key={section.stepId} className="mb-10" aria-labelledby={`summary-${section.stepId}`}>
          <h2 id={`summary-${section.stepId}`} className="mb-4 text-heading-m font-bold">
            {section.title}
          </h2>
          <dl className="border-t border-line">
            {section.rows.map((row) => (
              <div key={row.fieldId} className="grid gap-1 border-b border-line py-3 sm:grid-cols-[1fr_1fr_auto] sm:gap-4">
                <dt className="font-bold">{row.question}</dt>
                <dd>{row.answer}</dd>
                <dd>
                  <Link href={row.changeHref}>
                    Change <span className="visually-hidden">{row.question.toLowerCase()}</span>
                  </Link>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <InsetText>Demo: this is the end of milestone 2. Your quote, add-ons and payment arrive in milestone 3.</InsetText>
      <SessionTimeoutHost remainingMs={remainingMs(session)} warningMs={config.sessionWarningMs} />
    </div>
  );
}
