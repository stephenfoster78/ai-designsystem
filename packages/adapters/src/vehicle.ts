/** Vehicle lookup by registration, plus the make → model → transmission → year → variant tree for manual lookup. Demo data only. */

export interface Vehicle {
  reg: string;
  make: string;
  model: string;
  year: number;
  transmission: "Manual" | "Automatic";
  variant: string;
  fuel: "Petrol" | "Diesel" | "Hybrid" | "Electric";
}

export type ManualVehicle = Pick<Vehicle, "make" | "model" | "transmission" | "year" | "variant">;

export class VehicleLookupError extends Error {
  override name = "VehicleLookupError";
}

/** make → model → transmission → year → variants */
export type VehicleTree = Record<string, Record<string, Partial<Record<Vehicle["transmission"], Record<string, string[]>>>>>;

export interface VehicleApi {
  /** Resolves null when no vehicle matches. Rejects with VehicleLookupError when the service fails. */
  lookup(reg: string): Promise<Vehicle | null>;
  /** Tree for the dependent dropdowns in the manual lookup. */
  tree(): Promise<VehicleTree>;
  /** True when the manual selection is a real combination in the tree. */
  isValidManual(vehicle: ManualVehicle): Promise<boolean>;
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

const years = (from: number, to: number, variants: string[]) =>
  Object.fromEntries(Array.from({ length: to - from + 1 }, (_, i) => [String(to - i), variants]));

export const DEMO_VEHICLE_TREE: VehicleTree = {
  Ford: {
    Fiesta: { Manual: years(2012, 2023, ["1.0 EcoBoost Zetec 5dr", "1.1 Trend 5dr", "1.25 Zetec 5dr"]), Automatic: years(2015, 2023, ["1.0 EcoBoost Titanium 5dr Auto"]) },
    Focus: { Manual: years(2014, 2025, ["1.0 EcoBoost ST-Line 5dr", "1.5 EcoBlue Titanium 5dr"]), Automatic: years(2018, 2025, ["1.0 EcoBoost ST-Line 5dr Auto"]) },
  },
  Volkswagen: {
    Golf: { Manual: years(2013, 2025, ["1.0 TSI Life 5dr", "1.5 TSI Style 5dr"]), Automatic: years(2013, 2025, ["1.5 TSI Life 5dr DSG", "2.0 TDI Style 5dr DSG"]) },
    Polo: { Manual: years(2014, 2025, ["1.0 Life 5dr", "1.0 TSI Match 5dr"]), Automatic: years(2018, 2025, ["1.0 TSI Style 5dr DSG"]) },
  },
  Toyota: {
    Yaris: { Automatic: years(2012, 2025, ["1.5 Hybrid Icon 5dr CVT", "1.5 Hybrid Design 5dr CVT"]), Manual: years(2012, 2019, ["1.0 VVT-i Active 5dr"]) },
    Corolla: { Automatic: years(2019, 2025, ["1.8 Hybrid Icon 5dr CVT", "2.0 Hybrid GR Sport 5dr CVT"]) },
  },
  Kia: {
    Niro: { Automatic: years(2017, 2025, ["1.6 GDi Hybrid 2 5dr DCT", "e-Niro 64kWh 3 5dr"]) },
    Picanto: { Manual: years(2012, 2025, ["1.0 1 5dr", "1.0 2 5dr"]), Automatic: years(2017, 2025, ["1.25 3 5dr Auto"]) },
  },
  Vauxhall: {
    Astra: { Manual: years(2012, 2025, ["1.2 Turbo SRi 5dr", "1.6 CDTi SRi 5dr"]), Automatic: years(2016, 2025, ["1.4T Elite Nav 5dr Auto"]) },
    Corsa: { Manual: years(2012, 2025, ["1.2 SE 5dr", "1.4 Design 5dr"]), Automatic: years(2020, 2025, ["Corsa-e 50kWh SE 5dr"]) },
  },
  Nissan: {
    Qashqai: { Manual: years(2014, 2025, ["1.3 DIG-T Acenta Premium 5dr", "1.5 dCi N-Connecta 5dr"]), Automatic: years(2014, 2025, ["1.3 DIG-T Tekna 5dr DCT"]) },
  },
  BMW: {
    "1 Series": { Manual: years(2012, 2025, ["118i Sport 5dr", "116d SE 5dr"]), Automatic: years(2012, 2025, ["118i M Sport 5dr Step Auto"]) },
  },
  Tesla: {
    "Model 3": { Automatic: years(2019, 2025, ["RWD 4dr Auto", "Long Range AWD 4dr Auto"]) },
  },
};

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
    async tree() {
      return DEMO_VEHICLE_TREE;
    },
    async isValidManual(v) {
      return DEMO_VEHICLE_TREE[v.make]?.[v.model]?.[v.transmission]?.[String(v.year)]?.includes(v.variant) ?? false;
    },
  };
}
