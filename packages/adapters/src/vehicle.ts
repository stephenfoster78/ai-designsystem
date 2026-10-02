/** Vehicle lookup by registration. Demo data only; the real adapter would call a vehicle data provider. */

export interface Vehicle {
  reg: string;
  make: string;
  model: string;
  year: number;
  transmission: "Manual" | "Automatic";
  variant: string;
  fuel: "Petrol" | "Diesel" | "Hybrid" | "Electric";
}

export class VehicleLookupError extends Error {
  override name = "VehicleLookupError";
}

export interface VehicleApi {
  /** Resolves null when no vehicle matches. Rejects with VehicleLookupError when the service fails. */
  lookup(reg: string): Promise<Vehicle | null>;
}

/** Matches the component spec: A–Z, 0–9 and spaces, 1–8 characters, after uppercasing. */
export const REG_PATTERN = /^[A-Z0-9 ]{1,8}$/;

export function normaliseReg(reg: string): string {
  return reg.replace(/\s+/g, "").toUpperCase();
}

const DEMO_VEHICLES: Vehicle[] = [
  { reg: "AB12CDE", make: "Ford", model: "Fiesta", year: 2012, transmission: "Manual", variant: "1.25 Zetec 5dr", fuel: "Petrol" },
  { reg: "KM19XYZ", make: "Volkswagen", model: "Golf", year: 2019, transmission: "Automatic", variant: "1.5 TSI Life 5dr DSG", fuel: "Petrol" },
  { reg: "YR68HBX", make: "Toyota", model: "Yaris", year: 2018, transmission: "Automatic", variant: "1.5 Hybrid Icon 5dr CVT", fuel: "Hybrid" },
  { reg: "LV21EVE", make: "Kia", model: "Niro", year: 2021, transmission: "Automatic", variant: "e-Niro 64kWh 3 5dr", fuel: "Electric" },
  { reg: "SN15DSL", make: "Vauxhall", model: "Astra", year: 2015, transmission: "Manual", variant: "1.6 CDTi SRi 5dr", fuel: "Diesel" },
];

/** Registrations that simulate failures, so error states can be tested end to end. */
export const DEMO_FAILURE_REG = "ERR0R";

export function createDemoVehicleApi(options: { latencyMs?: number } = {}): VehicleApi {
  const index = new Map(DEMO_VEHICLES.map((v) => [v.reg, v]));
  return {
    async lookup(reg) {
      const key = normaliseReg(reg);
      if (options.latencyMs) await new Promise((r) => setTimeout(r, options.latencyMs));
      if (key === DEMO_FAILURE_REG) throw new VehicleLookupError("Demo vehicle service failure");
      const vehicle = index.get(key);
      return vehicle ? { ...vehicle } : null;
    },
  };
}
