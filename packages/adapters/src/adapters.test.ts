import { describe, expect, it } from "vitest";
import {
  createDemoVehicleApi,
  createJsonContent,
  createMemoryDraftStore,
  createMemorySessionStore,
  DEMO_FAILURE_REG,
  DraftLockedError,
  generateReference,
  VehicleLookupError,
} from "./index";

const entry = { source: "direct", identity: "guest", coverSet: "direct" } as const;

describe("content", () => {
  const content = createJsonContent({ "a.label": "Hello {name}", "error.required": "Enter {label}" }, { version: "1", onMissing: () => {} });
  it("interpolates and falls back", () => {
    expect(content.t("a.label", { name: "Sam" })).toBe("Hello Sam");
    expect(content.t("a.error.required", { label: "your name" }, "error.required")).toBe("Enter your name");
  });
  it("marks missing keys visibly and maybe() returns undefined", () => {
    expect(content.t("nope")).toBe("[nope]");
    expect(content.maybe("nope")).toBeUndefined();
  });
});

describe("draft store", () => {
  it("issues one reference per draft and finds it case-insensitively", async () => {
    const store = createMemoryDraftStore();
    const draft = await store.create({ journeyId: "motor", entry });
    const ref = await store.ensureReference(draft.id);
    expect(ref).toMatch(/^MQ-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/);
    expect(await store.ensureReference(draft.id)).toBe(ref);
    expect((await store.findByReference(ref.toLowerCase()))?.id).toBe(draft.id);
  });

  it("returns copies so callers cannot mutate stored state", async () => {
    const store = createMemoryDraftStore();
    const draft = await store.create({ journeyId: "motor", entry });
    draft.answers.x = "tampered";
    expect((await store.get(draft.id))?.answers).toEqual({});
  });

  it("locks drafts once payment has started", async () => {
    const store = createMemoryDraftStore();
    const draft = await store.create({ journeyId: "motor", entry });
    await store.save(draft.id, { status: "payment_pending" });
    await expect(store.save(draft.id, { answers: { a: 1 } })).rejects.toBeInstanceOf(DraftLockedError);
  });

  it("generates references without ambiguous characters", () => {
    for (let i = 0; i < 200; i++) expect(generateReference()).not.toMatch(/[01ILOU]/);
  });
});

describe("session store", () => {
  it("expires after the idle period and keeps the record for the ended page", async () => {
    let t = 0;
    const store = createMemorySessionStore({ idleMs: 1000, now: () => t });
    const session = await store.create("d1");
    t = 999;
    expect((await store.get(session.id))?.endedAt).toBeNull();
    t = 1000;
    expect(await store.get(session.id)).toMatchObject({ draftId: "d1", endedAt: 1000 });
  });

  it("extends on touch but cannot revive an ended session", async () => {
    let t = 0;
    const store = createMemorySessionStore({ idleMs: 1000, now: () => t });
    const session = await store.create("d1");
    t = 900;
    expect((await store.touch(session.id))?.expiresAt).toBe(1900);
    t = 2000;
    expect((await store.touch(session.id))?.endedAt).toBe(1900);
  });
});

describe("demo vehicle api", () => {
  const api = createDemoVehicleApi();
  it("finds vehicles regardless of spacing and case", async () => {
    expect(await api.lookup("ab12 cde")).toMatchObject({ make: "Ford", model: "Fiesta" });
  });
  it("returns null for unknown registrations and rejects for the failure reg", async () => {
    expect(await api.lookup("ZZ99ZZZ")).toBeNull();
    await expect(api.lookup(DEMO_FAILURE_REG)).rejects.toBeInstanceOf(VehicleLookupError);
  });
});
