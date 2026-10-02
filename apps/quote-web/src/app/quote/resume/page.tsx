import type { Metadata } from "next";
import { ResumeForm } from "./ResumeForm";

export const metadata: Metadata = { title: "Continue a saved quote" };

export default function ResumePage() {
  return (
    <div className="max-w-[40rem]">
      <h1 className="mb-6 text-heading-xl font-bold">Continue a saved quote</h1>
      <p className="mb-6">Enter your quote reference and date of birth. We’ll take you back to where you left off.</p>
      <ResumeForm />
    </div>
  );
}
