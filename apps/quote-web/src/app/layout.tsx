import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { SkipLink } from "@qf/design-system";
import { CONSENT_COOKIE, parseConsent } from "@qf/design-system/consent";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { SiteDialogs } from "@/components/SiteDialogs";
import { config } from "@/lib/config";
import "./globals.css";

const SERVICE_NAME = "Car insurance quote";

export const metadata: Metadata = {
  title: { template: `%s – ${SERVICE_NAME}`, default: SERVICE_NAME },
  description: "Get a car insurance quote (demonstration service).",
  robots: { index: false, follow: false },
};

// Never set maximum-scale or user-scalable=no: users must be able to zoom (WCAG 1.4.4).
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1d4f91" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const consent = parseConsent((await cookies()).get(CONSENT_COOKIE)?.value);
  return (
    <html lang="en-GB">
      <body className="flex min-h-screen flex-col">
        <SkipLink />
        <SiteDialogs initialConsent={consent} consentDomain={config.consentDomain}>
          <SiteHeader serviceName={SERVICE_NAME} />
          <div className="mx-auto w-full max-w-[70rem] flex-1 px-4 pt-6 sm:px-6 sm:pt-8">
            <main id="main-content" tabIndex={-1} className="focus:outline-none">
              {children}
            </main>
          </div>
          <SiteFooter />
        </SiteDialogs>
      </body>
    </html>
  );
}
