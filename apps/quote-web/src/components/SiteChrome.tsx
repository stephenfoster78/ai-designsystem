import { DialogLink } from "./SiteDialogs";

export function SiteHeader({ serviceName }: { serviceName: string }) {
  return (
    <header className="bg-brand text-ink-inverse">
      <div className="mx-auto flex max-w-[70rem] items-center gap-4 px-4 py-4 sm:px-6">
        <span className="text-heading-s font-bold">Demo Insurance</span>
        <span aria-hidden="true" className="h-6 border-l border-ink-inverse/50" />
        <span className="text-body">{serviceName}</span>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const link = "text-ink! visited:text-ink";
  return (
    <footer className="mt-16 border-t-4 border-brand bg-surface-subtle">
      <div className="mx-auto max-w-[70rem] px-4 py-8 sm:px-6">
        <h2 className="visually-hidden">Support links</h2>
        <ul className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-body-small">
          <li>
            <DialogLink dialog="accessibility" href="/accessibility" className={link}>
              Accessibility statement
            </DialogLink>
          </li>
          <li>
            <DialogLink dialog="privacy" href="/privacy" className={link}>
              Privacy
            </DialogLink>
          </li>
          <li>
            <DialogLink dialog="cookies" href="/cookies" className={link}>
              Cookies
            </DialogLink>
          </li>
        </ul>
        <p className="text-body-small text-ink-muted">This is a demonstration service. It does not provide real insurance quotes.</p>
      </div>
    </footer>
  );
}
