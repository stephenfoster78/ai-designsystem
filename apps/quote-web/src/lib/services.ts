import "server-only";
import {
  createDemoAddressApi,
  createDemoVehicleApi,
  createJsonContent,
  createMemoryDraftStore,
  createMemoryRateLimiter,
  createMemorySessionStore,
  type AddressApi,
  type ContentAdapter,
  type DraftStore,
  type RateLimiter,
  type SessionStore,
  type VehicleApi,
} from "@qf/adapters";
import { MOTOR_CONTENT_VERSION, motorContent } from "@qf/journey-motor";
import { config } from "./config";

/**
 * Composition root: the one place that chooses adapter implementations. Swapping demo
 * adapters for real ones (database, CMS, vehicle and address providers) happens here only.
 */
interface Services {
  drafts: DraftStore;
  sessions: SessionStore;
  content: ContentAdapter;
  vehicles: VehicleApi;
  addresses: AddressApi;
  /** Resume attempts: 5 failures lock a reference for 15 minutes. */
  resumeLimiter: RateLimiter;
}

function createServices(): Services {
  return {
    drafts: createMemoryDraftStore({ referencePrefix: "MQ" }),
    sessions: createMemorySessionStore({ idleMs: config.sessionIdleMs }),
    content: createJsonContent(motorContent, { version: MOTOR_CONTENT_VERSION }),
    vehicles: createDemoVehicleApi({ latencyMs: 300 }),
    addresses: createDemoAddressApi(),
    resumeLimiter: createMemoryRateLimiter({ maxAttempts: 5, lockoutMs: 15 * 60_000 }),
  };
}

// In-memory stores must survive dev-server hot reloads, so keep them on globalThis.
// Bump the key when the shape of Services changes.
const globalForServices = globalThis as typeof globalThis & { __qfServicesV2?: Services };
export const services: Services = (globalForServices.__qfServicesV2 ??= createServices());
