import type { OptionDef } from "@qf/journey-engine";

/**
 * Demo reference data. Codes are invented (OCC-/IND-), shaped like the licensed ABI lists a
 * real insurer would use. Offence codes follow the public DVLA endorsement code format.
 */

const list = (prefix: string, labels: string[]): OptionDef[] =>
  labels.map((label, i) => ({ value: `${prefix}-${String(i + 1).padStart(3, "0")}`, label }));

export const OCCUPATIONS: OptionDef[] = list("OCC", [
  "Accountant", "Actor", "Administrator", "Architect", "Baker", "Bank clerk", "Barista", "Bricklayer", "Builder",
  "Bus driver", "Butcher", "Care assistant", "Carpenter", "Cashier", "Chef", "Civil servant", "Cleaner", "Customer service adviser",
  "Data analyst", "Delivery driver", "Dental nurse", "Dentist", "Designer", "Doctor", "Electrician", "Engineer", "Estate agent",
  "Farmer", "Firefighter", "Florist", "Gardener", "Graphic designer", "Hairdresser", "Health visitor", "HGV driver", "Housekeeper",
  "IT consultant", "Journalist", "Lawyer", "Lecturer", "Librarian", "Machine operator", "Marketing manager", "Mechanic",
  "Midwife", "Musician", "Nurse", "Optician", "Painter and decorator", "Paramedic", "Pharmacist", "Photographer",
  "Physiotherapist", "Plasterer", "Plumber", "Police officer", "Postal worker", "Project manager", "Receptionist",
  "Retail assistant", "Sales representative", "Scientist", "Secretary", "Security guard", "Shop manager", "Social worker",
  "Software developer", "Solicitor", "Surveyor", "Taxi driver", "Teacher", "Teaching assistant", "Train driver",
  "UX designer", "Vet", "Waiter", "Warehouse operative", "Web developer", "Welder", "Youth worker",
]);

export const INDUSTRIES: OptionDef[] = list("IND", [
  "Accountancy", "Advertising", "Agriculture", "Armed forces", "Banking", "Building and construction", "Care services",
  "Catering", "Charity", "Chemicals", "Civil service", "Courier services", "Dentistry", "Education", "Electricity supply",
  "Engineering", "Entertainment", "Estate agency", "Financial services", "Food manufacture", "Hairdressing", "Health care",
  "Hospitality", "Information technology", "Insurance", "Legal services", "Local government", "Manufacturing", "Media",
  "Motor trade", "Music", "Oil and gas", "Pharmaceuticals", "Police", "Postal services", "Property", "Publishing",
  "Recruitment", "Retail", "Road haulage", "Science and research", "Security", "Social services", "Sport",
  "Telecommunications", "Transport", "Travel and tourism", "Utilities", "Veterinary", "Wholesale",
]);

export const CONVICTION_CODES: OptionDef[] = [
  ["SP30", "Exceeding statutory speed limit on a public road"],
  ["SP50", "Exceeding speed limit on a motorway"],
  ["SP10", "Exceeding goods vehicle speed limits"],
  ["CU80", "Breach of requirements as to control of the vehicle, such as using a mobile phone"],
  ["CU10", "Using a vehicle with defective brakes"],
  ["CU30", "Using a vehicle with defective tyres"],
  ["TS10", "Failing to comply with traffic light signals"],
  ["TS20", "Failing to comply with double white lines"],
  ["TS50", "Failing to comply with traffic signs"],
  ["MS90", "Failure to give information as to identity of driver"],
  ["MW10", "Contravention of special roads regulations (excluding speed limits)"],
  ["PC20", "Contravention of pedestrian crossing regulations with moving vehicle"],
  ["CD10", "Driving without due care and attention"],
  ["CD30", "Driving without due care and attention or without reasonable consideration for other road users"],
  ["IN10", "Using a vehicle uninsured against third party risks"],
  ["LC20", "Driving otherwise than in accordance with a licence"],
  ["DR10", "Driving or attempting to drive with alcohol level above limit"],
  ["DG10", "Driving or attempting to drive with drug level above the specified limit"],
  ["DD40", "Dangerous driving"],
  ["AC10", "Failing to stop after an accident"],
].map(([code, description]) => ({ value: code!, label: `${code}: ${description}` }));
