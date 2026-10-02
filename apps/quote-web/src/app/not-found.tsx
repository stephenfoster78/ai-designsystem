import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-[40rem]">
      <h1 className="mb-6 text-heading-xl font-bold">Page not found</h1>
      <p className="mb-4">If you typed the web address, check it is correct.</p>
      <p>
        <Link href="/quote/start">Start a car insurance quote</Link>
      </p>
    </div>
  );
}
