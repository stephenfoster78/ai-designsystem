"use client";

import {
  AddressLookup,
  Checkbox,
  Checkboxes,
  DateInput,
  Radios,
  RegLookup,
  Select,
  StartDateInput,
  TextInput,
  Typeahead,
  type AddressLookupResult,
  type LookupVehicle,
  type LookupVehicleTree,
  type VehicleLookupResult,
} from "@qf/design-system";
import { isoToParts, type JsonValue } from "@qf/journey-engine";
import type { StepFormState } from "@/app/quote/form-state";
import type { LookupResult } from "@/lib/enrich";
import type { ErrorView, FieldView } from "@/lib/step-view";

type Raw = NonNullable<StepFormState["raw"]>[string];

const loadVehicleTree = (): Promise<LookupVehicleTree> =>
  fetch("/api/vehicle/tree").then((r) => {
    if (!r.ok) throw new Error(`Vehicle tree request failed: ${r.status}`);
    return r.json() as Promise<LookupVehicleTree>;
  });

export interface FieldProps {
  field: FieldView;
  value: JsonValue;
  raw?: Raw;
  error?: Pick<ErrorView, "message" | "parts" | "subTarget">;
  resolved?: JsonValue;
  lookup?: LookupResult;
  mode?: "manual" | "reset";
  focusOnMount?: boolean;
  autoLookup?: boolean;
}

/** Renders one schema field with the matching design system component. */
export function Field({ field, value, raw, error, resolved, lookup, mode, focusOnMount, autoLookup }: FieldProps) {
  const common = { id: field.id, label: field.label, hint: field.hint, error: error?.message };
  const text = (fallback: JsonValue) => (typeof raw === "string" ? raw : fallback === null || fallback === undefined ? "" : String(fallback));
  const asRecord = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : undefined);

  switch (field.type) {
    case "radio":
      return (
        <Radios
          {...common}
          options={field.options ?? []}
          value={typeof raw === "string" ? raw : typeof value === "string" ? value : null}
          inline={(field.options?.length ?? 0) === 2 && !field.options?.some((o) => o.hint)}
        />
      );
    case "select":
      return <Select {...common} options={field.options ?? []} defaultValue={text(value)} autoComplete={field.autocomplete} />;
    case "checkbox":
      return <Checkbox {...common} checked={raw !== undefined ? raw === "true" : value === true} />;
    case "checkboxes":
      return <Checkboxes {...common} options={field.options ?? []} value={Array.isArray(raw) ? raw : Array.isArray(value) ? (value as string[]) : []} />;
    case "date":
      return (
        <DateInput
          {...common}
          value={asRecord(raw) as { day: string; month: string; year: string } | undefined ?? isoToParts(value)}
          errorParts={error?.parts}
          autocomplete={field.autocomplete === "bday" ? "bday" : undefined}
          precision={field.precision}
        />
      );
    case "startDate": {
      const config = field.startDate!;
      const rawRecord = asRecord(raw);
      return (
        <StartDateInput
          {...common}
          errorTarget={error?.subTarget === "date" ? "date" : "choice"}
          today={config.today}
          maxDaysAhead={config.maxDaysAhead}
          value={typeof value === "string" ? value : null}
          raw={rawRecord ? { choice: rawRecord.choice, date: rawRecord.date } : undefined}
          text={config.calendarTitle ? { calendarTitle: config.calendarTitle } : undefined}
        />
      );
    }
    case "typeahead": {
      const saved = field.options?.find((o) => o.value === value)?.label ?? "";
      return <Typeahead {...common} options={field.options ?? []} defaultInputValue={typeof raw === "string" ? raw : saved} />;
    }
    case "vehicle": {
      const saved = (value as unknown as LookupVehicle | null) ?? null;
      const typed = asRecord(raw)?.reg;
      const vehicleLookup = lookup?.kind === "vehicle" ? (lookup as unknown as VehicleLookupResult) : undefined;
      // What to show: after reset or a lookup, the typed registration; after a failed Continue,
      // what the server resolved; otherwise the saved answer.
      const current: LookupVehicle | null =
        mode === "reset" || vehicleLookup ? { reg: typed ?? saved?.reg ?? "" } : ((resolved as unknown as LookupVehicle | undefined) ?? saved);
      return (
        <RegLookup
          {...common}
          hint={field.hint}
          value={current}
          lookup={vehicleLookup}
          loadTree={loadVehicleTree}
          autoLookup={autoLookup}
          focusOnMount={focusOnMount}
        />
      );
    }
    case "address": {
      const addressLookup = lookup?.kind === "address" ? (lookup as unknown as AddressLookupResult) : undefined;
      return (
        <AddressLookup
          {...common}
          errorTarget={error?.subTarget as "postcode" | "address" | "line1" | "town" | undefined}
          value={(resolved ?? value) as never}
          raw={asRecord(raw)}
          lookup={addressLookup}
          manual={mode === "manual"}
          focusOnMount={focusOnMount}
        />
      );
    }
    default:
      return (
        <TextInput
          {...common}
          type={field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"}
          defaultValue={text(value)}
          width={field.width}
          prefix={field.prefix}
          suffix={field.suffix}
          autoComplete={field.autocomplete}
          inputMode={field.inputMode ?? (field.type === "number" || field.type === "currency" ? "numeric" : undefined)}
          spellCheck={false}
        />
      );
  }
}
