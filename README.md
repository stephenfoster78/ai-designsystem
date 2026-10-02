# Quote framework

A reusable framework for insurance quote journeys, with a car insurance quote as the first journey. It comprises a journey engine, a design system driven by design tokens, demo adapters, and a Next.js app.

**Status: milestone 1 (foundations).** The engine, tokens pipeline, demo adapters, session timeout and cookie consent are in place. They are proven by a three-step vertical slice of the motor journey: *Your car → Owning and using the car → Your details*.

> Demonstration service. It does not provide real insurance quotes and all data is fake.

## Run it locally (Windows, macOS or Linux)

Prerequisites: [Node.js 22 LTS](https://nodejs.org/) and Git.

```powershell
git clone https://github.com/stephenfoster78/ai-designsystem.git H:\Projects\Framework
cd H:\Projects\Framework
corepack enable          # once per machine; provides the pinned pnpm version
pnpm install
pnpm dev                 # http://localhost:3000
```

If `corepack enable` fails with a permissions error on a managed Windows machine, run `npm install -g pnpm@10` instead.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Builds tokens, then runs the app in development mode |
| `pnpm build` / `pnpm start` | Production build and server |
| `pnpm test` | Unit, component (with axe) and token contrast tests (Vitest) |
| `pnpm test:e2e` | End-to-end and axe accessibility tests (Playwright). Run `pnpm build` first, and `pnpm --filter quote-web exec playwright install chromium` once |
| `pnpm typecheck` / `pnpm lint` | TypeScript and ESLint (including `jsx-a11y` strict rules) |
| `pnpm check` | Typecheck, lint and unit tests together |

Try `http://localhost:3000/quote/start?reg=AB12CDE` to see a registration passed through from the direct site.

### Configuration

Copy `apps/quote-web/.env.example` to `apps/quote-web/.env.local` to override defaults.

| Variable | Default | Purpose |
| --- | --- | --- |
| `QF_SESSION_IDLE_SECONDS` | `1800` | Idle session length (30 minutes) |
| `QF_SESSION_WARNING_SECONDS` | `120` | Timeout warning lead time (2 minutes) |
| `NEXT_PUBLIC_CONSENT_DOMAIN` | unset | Cookie domain shared with the direct site, e.g. `.example.co.uk` |

To try the timeout warning quickly, set `QF_SESSION_IDLE_SECONDS=150`. The warning then appears after 30 seconds.

## Structure

```
apps/quote-web            Next.js 16 app (App Router, server actions, Tailwind v4)
packages/journey-engine   Framework-agnostic engine: schema types, conditions, step resolver,
                          route guard, validation, answer sanitising. Pure TypeScript.
packages/design-system    Accessible React components, styled only through tokens
packages/tokens           DTCG design tokens → CSS variables, Tailwind theme, JSON
packages/adapters         Adapter interfaces + demo implementations (drafts, sessions,
                          content, vehicle lookup)
journeys/motor            Motor journey: schema, predicates, content (en-GB)
```

Workspace packages ship TypeScript source; Next.js compiles them (`transpilePackages`), so there is no package build step except tokens.

## How a journey works

A journey is **data plus code** (the hybrid model):

- **Schema (data)**: sections, steps, grouped fields, validation rules and declarative conditions (`showWhen` on fields and groups, `skipWhen` on steps). See [`journeys/motor/src/schema.ts`](journeys/motor/src/schema.ts).
- **Code**: named predicates for logic too complex for an expression, and (from milestone 2) custom step layouts.

Conditions use a small JSON Logic-style language:

```ts
{ id: "purchaseDate", type: "date", required: true,
  showWhen: { "==": [{ var: "purchased" }, "yes"] },
  validate: [{ rule: "notFuture" }] }
```

The same pure evaluator runs in two places: in the browser to reveal questions as the user answers, and on the server to validate. On every submit the server:

1. reads the form into normalised values (`readStep`)
2. validates only the fields visible after the change (`commitStep`)
3. strips answers to hidden fields and skipped steps (`sanitiseAnswers`), so stale branch answers never reach pricing
4. autosaves the draft, issues the quote reference on the first save, and moves to the next active step

`defineJourney` validates a schema when it loads: duplicate ids, unknown sections, unknown fields in conditions and unknown predicates all fail fast. A content test fails CI if any label, option or required-error copy is missing.

### Route guard

Each step has its own route (`/quote/car/usage`). A step can be opened only if every active step before it is complete. Deep links further ahead redirect to the first incomplete step, while completed steps can always be revisited.

### State

Drafts are held server-side, keyed by an opaque id. The browser holds only an `httpOnly` session cookie, and no personal data goes into `localStorage` or URLs. Demo stores are in memory, so they reset when the server restarts. A database adapter replaces them in [`apps/quote-web/src/lib/services.ts`](apps/quote-web/src/lib/services.ts), the only file that chooses implementations.

## Tokens

The single source of truth is the [DTCG](https://www.designtokens.org/) JSON in `packages/tokens/tokens/`. Style Dictionary builds it into:

- `dist/tokens.css`: `--qf-*` custom properties
- `dist/tailwind.css`: a Tailwind v4 `@theme` that maps utilities such as `text-ink`, `bg-surface-subtle` and `border-line-strong` onto those variables. Tailwind's default palette is removed, so only semantic tokens are available.
- `dist/tokens.json`: resolved values for Figma plugins and documentation

For Figma, point Tokens Studio's GitHub sync at `packages/tokens/tokens/`. A contrast test checks every text and UI colour pairing against WCAG 2.2 AA, so a token change that breaks contrast fails CI.

## Accessibility

The target is WCAG 2.2 AA as a minimum. It is built in as follows:

- One clear error per field, an error summary that takes focus, an `Error:` title prefix, and links that focus the field (including the first date part in error)
- Questions grouped in fieldsets with legends. Hints and errors are linked with `aria-describedby`, and autocomplete tokens are used for personal data.
- A session timeout warning 2 minutes before expiry. It can be extended with one action or Escape, the visual countdown is hidden from assistive technology, and a polite live region announces at 2 min, 1 min, 50 s, 30 s and 10 s.
- Native `<dialog>` modals: the background is inert, focus is trapped and restored, and Escape closes them
- A non-modal cookie banner with equal-weight accept and reject. Consent is shared with the direct site's cookie domain.
- Works without JavaScript. Forms post to server actions, and footer links fall back to real pages.
- A two-tone focus indicator that also works in forced-colours mode, and 44px minimum targets
- Automated checks with axe in component tests and on every page in Playwright (desktop and mobile). These do not replace manual testing with NVDA, JAWS and VoiceOver.

## Milestones

1. **Foundations** ✅ monorepo, tokens pipeline, journey engine, demo adapters, timeout modal, cookie panel
2. Direct journey, guest path: Start through Review. Includes reg lookup, typeahead and repeater components, and resume by reference with date of birth or postcode.
3. Quote and payment: tiered quote with live re-pricing, add-ons, basket with answers summary, auto-renewal, direct debit, and fake Worldpay with all four outcomes
4. Signed-in path: handoff token, prepopulated details, Clubcard pricing, account sync prompt, household-cars lookup
5. Second entry point: aggregator variant

Storybook (the component showcase) is planned alongside milestone 2, once the reg lookup and typeahead components land.
