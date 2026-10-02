import type { Metadata } from "next";

export const metadata: Metadata = { title: "Get a quote by phone" };

export default function NotEligiblePage() {
  return (
    <div className="max-w-[40rem]">
      <h1 className="mb-6 text-heading-xl font-bold">Get a quote by phone</h1>
      <p className="mb-4">If you or another driver do not meet the conditions for an online quote, we may still be able to help.</p>
      <p className="mb-4">Call us and we’ll talk through your circumstances. This is a demonstration service, so there is no real phone number.</p>
      <p className="mb-2 font-bold">Telephone: 0300 000 0000 (example)</p>
      <p className="mb-6">Monday to Friday, 8am to 8pm. Saturday, 9am to 5pm.</p>
      <p>If you need to use a relay service or another way to contact us, tell us and we’ll make it work for you.</p>
    </div>
  );
}
