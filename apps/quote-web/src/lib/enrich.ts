import "server-only";
import { VehicleLookupError } from "@qf/adapters";
import type { AddressValue, FieldDef, FieldError, GroupDef, JsonValue, StepInput, VehicleValue } from "@qf/journey-engine";
import { services } from "./services";

/**
 * Server-side resolution of composite answers before validation. The browser never decides
 * what car or address an answer refers to: a looked-up vehicle is fetched again by
 * registration, a manual selection is checked against the vehicle data, and an address id is
 * resolved against the lookup for that postcode.
 */
export async function enrichInput(groups: GroupDef[], input: StepInput): Promise<StepInput> {
  const values = { ...input.values };
  const parseErrors = { ...input.parseErrors };
  const fields = groups.flatMap((g) => g.fields);

  await Promise.all(
    fields.map(async (field) => {
      const value = values[field.id];
      if (!value || typeof value !== "object" || Array.isArray(value) || parseErrors[field.id]) return;
      if (field.type === "vehicle") {
        const result = await resolveVehicle(value as unknown as VehicleValue);
        if ("error" in result) parseErrors[field.id] = result.error;
        else values[field.id] = result.value as unknown as JsonValue;
      }
      if (field.type === "address") {
        values[field.id] = (await resolveAddress(value as unknown as AddressValue)) as unknown as JsonValue;
      }
    }),
  );
  return { ...input, values, parseErrors };
}

async function resolveVehicle(value: VehicleValue): Promise<{ value: VehicleValue } | { error: FieldError }> {
  if (value.source === "manual") {
    const ok = await services.vehicles.isValidManual({
      make: value.make!,
      model: value.model!,
      transmission: value.transmission as "Manual" | "Automatic",
      year: value.year!,
      variant: value.variant!,
    });
    return ok ? { value } : { error: { code: "invalidManual" } };
  }
  if (!value.reg || !/^[A-Z0-9 ]{1,8}$/.test(value.reg)) return { value }; // left to the pattern rule
  try {
    const vehicle = await services.vehicles.lookup(value.reg);
    return vehicle ? { value: { ...vehicle, reg: value.reg, source: "lookup" } } : { error: { code: "lookupNotFound" } };
  } catch (error) {
    if (error instanceof VehicleLookupError) return { error: { code: "lookupFailed" } };
    throw error;
  }
}

async function resolveAddress(value: AddressValue): Promise<AddressValue> {
  if (value.source === "manual" || !value.addressId) return value;
  const found = await services.addresses.find(value.postcode, value.addressId);
  if (!found) return { postcode: value.postcode };
  return { postcode: found.postcode, line1: found.line1, line2: found.line2, town: found.town, addressId: found.id, source: "lookup" };
}

export type LookupResult =
  | { kind: "vehicle"; status: "found"; vehicle: VehicleValue }
  | { kind: "vehicle"; status: "notFound" | "failed" | "invalid"; message: string }
  | { kind: "address"; status: "found"; postcode: string; addresses: Array<{ id: string; label: string }> }
  | { kind: "address"; status: "notFound" | "invalid"; message: string };

/** "Find car" / "Find address": runs one lookup without validating or saving the step. */
export async function runLookup(field: FieldDef, input: StepInput, message: (key: string) => string): Promise<LookupResult> {
  const value = input.values[field.id] as unknown as (VehicleValue & AddressValue) | null;
  if (field.type === "vehicle") {
    const reg = value?.reg ?? "";
    if (!reg) return { kind: "vehicle", status: "invalid", message: message(`${field.id}.error.required`) };
    if (!/^[A-Z0-9 ]{1,8}$/.test(reg)) return { kind: "vehicle", status: "invalid", message: message("error.lookupInvalid") };
    try {
      const vehicle = await services.vehicles.lookup(reg);
      return vehicle
        ? { kind: "vehicle", status: "found", vehicle: { ...vehicle, reg, source: "lookup" } }
        : { kind: "vehicle", status: "notFound", message: message("error.lookupNotFound") };
    } catch (error) {
      if (error instanceof VehicleLookupError) return { kind: "vehicle", status: "failed", message: message("error.lookupFailed") };
      throw error;
    }
  }
  const postcode = value?.postcode ?? "";
  if (!postcode) return { kind: "address", status: "invalid", message: message(`${field.id}.error.required`) };
  for (const rule of field.validate ?? []) {
    if (rule.rule === "notPattern" && new RegExp(rule.value).test(postcode)) return { kind: "address", status: "invalid", message: message(`error.${rule.code}`) };
    if (rule.rule === "pattern" && !new RegExp(rule.value).test(postcode)) return { kind: "address", status: "invalid", message: message("error.postcode") };
  }
  const addresses = await services.addresses.lookup(postcode);
  if (!addresses.length) return { kind: "address", status: "notFound", message: message("error.addressNotFound") };
  return {
    kind: "address",
    status: "found",
    postcode,
    addresses: addresses.map((a) => ({ id: a.id, label: [a.line1, a.line2, a.town].filter(Boolean).join(", ") })),
  };
}
