import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CONSENT_COOKIE, parseConsent } from "@qf/design-system/consent";
import { CookiesPageForm } from "./CookiesPageForm";
import { config } from "@/lib/config";

export const metadata: Metadata = { title: "Cookie settings" };

export default async function CookiesPage() {
  const consent = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);
  return (
    <div className="max-w-[40rem]">
      <h1 className="mb-6 text-heading-xl font-bold">Cookie settings</h1>
      <CookiesPageForm consent={consent} consentDomain={config.consentDomain} />
    </div>
  );
}
