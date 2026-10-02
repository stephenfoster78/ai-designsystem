/** Address lookup by postcode. Demo data is generated deterministically for any valid UK postcode. */

export interface Address {
  id: string;
  line1: string;
  line2?: string;
  town: string;
  postcode: string;
}

export class AddressLookupError extends Error {
  override name = "AddressLookupError";
}

export interface AddressApi {
  /** Addresses at a postcode; empty when none are found. */
  lookup(postcode: string): Promise<Address[]>;
  /** Resolves an id previously returned by lookup for the same postcode. */
  find(postcode: string, id: string): Promise<Address | null>;
}

/** UK postcode format (simplified). */
export const POSTCODE_PATTERN = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/;
/** Crown Dependencies are not part of the UK for insurance purposes. */
export const EXCLUDED_POSTCODE_AREAS = /^(GY|JE|IM)/;

/** Postcode that returns no addresses, for testing the "not found" path. */
export const DEMO_EMPTY_POSTCODE = "ZZ1 1ZZ";

const TOWNS: Array<[RegExp, string]> = [
  [/^LS/, "Leeds"],
  [/^M\d/, "Manchester"],
  [/^EH/, "Edinburgh"],
  [/^G\d/, "Glasgow"],
  [/^BT/, "Belfast"],
  [/^CF/, "Cardiff"],
  [/^B\d/, "Birmingham"],
  [/^(SW|SE|NW|N|E|W|EC|WC)\d/, "London"],
  [/^AL/, "St Albans"],
  [/^EN/, "Enfield"],
];
const STREETS = ["High Street", "Station Road", "Church Lane", "Park Avenue", "Mill Road", "Victoria Street"];

const compact = (postcode: string) => postcode.replace(/\s+/g, "").toUpperCase();

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function generate(postcode: string): Address[] {
  const key = compact(postcode);
  const formatted = `${key.slice(0, -3)} ${key.slice(-3)}`;
  const town = TOWNS.find(([re]) => re.test(key))?.[1] ?? "Anytown";
  const street = STREETS[hash(key) % STREETS.length]!;
  const flats = ["Flat 1", "Flat 2"].map((flat, i) => ({ id: `${key}-f${i + 1}`, line1: `${flat}, 2 ${street}`, town, postcode: formatted }));
  const houses = [1, 3, 5, 7, 9, 11].map((n) => ({ id: `${key}-${n}`, line1: `${n} ${street}`, town, postcode: formatted }));
  return [...flats, ...houses];
}

export function createDemoAddressApi(): AddressApi {
  return {
    async lookup(postcode) {
      const key = compact(postcode);
      if (key === compact(DEMO_EMPTY_POSTCODE) || !POSTCODE_PATTERN.test(key)) return [];
      return generate(key);
    },
    async find(postcode, id) {
      return (await this.lookup(postcode)).find((a) => a.id === id) ?? null;
    },
  };
}
