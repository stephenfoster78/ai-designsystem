import type { Metadata } from "next";
import Link from "next/link";
import { InsetText } from "@qf/design-system";
import { DialogLink } from "@/components/SiteDialogs";
import { cleanRegParam } from "@/lib/entry";
import { StartForm } from "./StartForm";

export const metadata: Metadata = { title: "Get a car insurance quote" };

export default async function StartPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const reg = cleanRegParam((await searchParams).reg);

  return (
    <div className="max-w-[var(--qf-size-measure)]">
      <h1 className="mb-6 text-heading-xl font-bold">Get a car insurance quote</h1>
      <p className="mb-4">It usually takes about 10 minutes. We save your answers as you go, so you can stop and come back later.</p>

      <h2 className="mt-8 mb-4 text-heading-m font-bold">Before you start</h2>
      <p className="mb-3">You’ll need:</p>
      <ul className="mb-6 list-disc pl-6 [&>li]:mb-2">
        <li>your car’s registration number</li>
        <li>your driving licence details</li>
        <li>details of any claims, accidents or motoring convictions in the last 5 years, for you and anyone else who will drive</li>
        <li>how many years of no claims discount you have</li>
      </ul>

      {reg && (
        <InsetText>
          We’ll use the registration <strong>{reg}</strong> you entered. You can change it on the next page.
        </InsetText>
      )}

      <p className="mb-4">
        We use your information to give you a quote and to prevent fraud.{" "}
        <DialogLink dialog="privacy" href="/privacy">
          Find out how we use your information
        </DialogLink>
        .
      </p>
      <p className="mb-4">
        Already started a quote? <Link href="/quote/resume">Continue a saved quote</Link>.
      </p>

      <StartForm reg={reg} />
    </div>
  );
}
