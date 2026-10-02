import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BackLink, SectionProgress } from "@qf/design-system";
import { checkAccess, holds, navigation, sectionProgress } from "@qf/journey-engine";
import { motorJourney } from "@qf/journey-motor";
import { SessionTimeoutHost } from "@/components/SessionTimeoutHost";
import { StepForm } from "@/components/StepForm";
import { config } from "@/lib/config";
import { paths } from "@/lib/paths";
import { evalContext, readQuoteSession, remainingMs, touchQuoteSession } from "@/lib/quote-session";
import { services } from "@/lib/services";
import { buildStepView, initialValues, sectionTitleKey, stepTitleKey } from "@/lib/step-view";
import { submitStep } from "../../actions";

type Params = Promise<{ section: string; step: string }>;

function findStep(section: string, step: string) {
  return motorJourney.stepByPath.get(`${section}/${step}`);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { section, step: stepSlug } = await params;
  const step = findStep(section, stepSlug);
  if (!step) return {};
  return { title: `${services.content.t(stepTitleKey(step))} – ${services.content.t(sectionTitleKey(step.section))}` };
}

export default async function StepPage({ params }: { params: Params }) {
  const { section, step: stepSlug } = await params;
  const step = findStep(section, stepSlug);
  if (!step) notFound();

  const quote = await readQuoteSession();
  if (quote.state === "none") redirect(paths.start);
  if (quote.state === "ended") redirect(paths.sessionEnded);

  const ctx = evalContext(quote.draft);
  // Route guard: no skipping ahead via deep links.
  const access = checkAccess(motorJourney, step.id, ctx);
  if (!access.ok) redirect(access.redirectTo ? paths.step(access.redirectTo) : paths.check);

  const session = await touchQuoteSession(quote.session);
  const view = buildStepView(step, services.content, quote.draft.answers);
  const { previous } = navigation(motorJourney, step.id, ctx);
  const progress = sectionProgress(motorJourney, ctx, step.id).map((p) => ({
    id: p.section.id,
    label: services.content.t(sectionTitleKey(p.section.id)),
    status: p.status,
    href: paths.step(p.firstStep),
  }));

  // Server-side visibility for conditions the client cannot evaluate (server-only predicates).
  const serverVisible: Record<string, boolean> = {};
  for (const group of step.groups) {
    serverVisible[`group:${group.id}`] = holds(group.showWhen, ctx, motorJourney.predicates);
    for (const field of group.fields) serverVisible[field.id] = holds(field.showWhen, ctx, motorJourney.predicates);
  }

  const prefillReg = quote.draft.entry.prefill?.reg;

  // Strip functions (predicates) before passing the step definition to the client.
  const stepForClient = JSON.parse(JSON.stringify(step)) as typeof step;

  return (
    <>
      <BackLink href={previous ? paths.step(previous) : paths.start} renderLink={(props) => <Link {...props} />} />
      <SectionProgress items={progress} renderLink={(props) => <Link {...props} />} />
      <div className="max-w-[40rem]">
        <StepForm
          step={stepForClient}
          view={view}
          action={submitStep.bind(null, step.id)}
          values={initialValues(step, quote.draft.answers, { registration: prefillReg ? { reg: prefillReg } : undefined })}
          ctx={ctx}
          serverVisible={serverVisible}
          autoLookup={prefillReg && !quote.draft.answers.registration ? "registration" : undefined}
        />
      </div>
      <SessionTimeoutHost remainingMs={remainingMs(session)} warningMs={config.sessionWarningMs} />
    </>
  );
}
