/** Eligibility conditions for an online quote. Shown in a modal from the Start page and as a page. */
export const ELIGIBILITY_CONDITIONS = [
  "have never had insurance refused, cancelled or made void",
  "do not have any unspent non-motoring criminal convictions",
  "have not been declared bankrupt and do not have any unsatisfied court judgements, such as county court judgements (CCJs)",
  "have told the DVLA (or the relevant licensing authority) about any medical condition that could affect your ability to drive safely, and they have agreed to issue you a licence",
  "live at a fixed address in the UK (Great Britain or Northern Ireland, not the Channel Islands or the Isle of Man)",
  "are aged 85 or younger",
];

export function EligibilityConditions() {
  return (
    <div className="max-w-[var(--qf-size-measure)]">
      <p className="mb-3">To get a quote online, you and anyone else who will drive the car must:</p>
      <ul className="mb-6 list-disc pl-6 [&>li]:mb-2">
        {ELIGIBILITY_CONDITIONS.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <details className="mb-6">
        <summary className="cursor-pointer text-link underline">What is an unspent conviction?</summary>
        <p className="mt-3 border-l-4 border-line-strong pl-4">
          A conviction is unspent if its rehabilitation period has not ended. Custodial sentences of more than two and a half years can never be considered
          spent.
        </p>
      </details>
      <p>
        If you do not meet these conditions, you may still be able to get a quote by phone. <a href="/quote/not-eligible">Find out what to do</a>.
      </p>
    </div>
  );
}
