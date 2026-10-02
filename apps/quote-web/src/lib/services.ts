import "server-only";
import {
  createDemoVehicleApi,
  createJsonContent,
  createMemoryDraftStore,
  createMemorySessionStore,
  type ContentAdapter,
  type DraftStore,
  type SessionStore,
  type VehicleApi,
} from "@qf/adapters";
import { MOTOR_CONTENT_VERSION, motorContent } from "@qf/journey-motor";
import { config } from "./config";

/**
 * Composition root: the one place that chooses adapter implementations. Swapping demo
 * adapters for real ones (database, CMS, vehicle provider) happens here only.
 */
interface Services {
  drafts: DraftStore;
  sessions: SessionStore;
  content: ContentAdapter;
  vehicles: VehicleApi;
}

function createServices(): Services {
  return {
    drafts: createMemoryDraftStore({ referencePrefix: "MQ" }),
    sessions: createMemorySessionStore({ idleMs: config.sessionIdleMs }),
    content: createJsonContent(motorContent, { version: MOTOR_CONTENT_VERSION }),
    vehicles: createDemoVehicleApi({ latencyMs: 300 }),
  };
}

// In-memory stores must survive dev-server hot reloads, so keep them on globalThis.
const globalForServices = globalThis as typeof globalThis & { __qfServices?: Services };
export const services: Services = (globalForServices.__qfServices ??= createServices());
