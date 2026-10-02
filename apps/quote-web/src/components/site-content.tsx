/**
 * Placeholder legal content. Shown in modals from the footer, and as standalone pages so
 * the links work without JavaScript. Real copy comes from legal and compliance.
 */

export function AccessibilityStatement() {
  return (
    <div className="flex max-w-[var(--qf-size-measure)] flex-col gap-4">
      <p>This demo service is designed to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.</p>
      <p>You should be able to:</p>
      <ul className="list-disc pl-6">
        <li>zoom in up to 400% without the text spilling off the screen</li>
        <li>navigate the whole service using just a keyboard</li>
        <li>use the service with a screen reader, including NVDA, JAWS and VoiceOver</li>
        <li>change colours and contrast using your browser or operating system settings</li>
      </ul>
      <p>
        If you find a problem not listed here, or need information in a different format, tell us. This statement is a placeholder and
        will be replaced with the organisation’s published statement.
      </p>
    </div>
  );
}

export function PrivacyNotice() {
  return (
    <div className="flex max-w-[var(--qf-size-measure)] flex-col gap-4">
      <p>We use the information you give us to calculate your quote, check the details you provide and prevent fraud.</p>
      <p>We save your answers as you go so you can come back to your quote later using your quote reference.</p>
      <p>This notice is a placeholder for the demo service and will be replaced with the organisation’s privacy notice.</p>
    </div>
  );
}
