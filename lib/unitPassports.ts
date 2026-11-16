export type UnitStatus = "Available" | "Reserved" | "Dispatched" | "Handed over";

export type UnitPassportRecord = {
  id: string;
  bank: string;
  group: string;
  component: string;
  units: number;
  collected: string;
  expires: string;
  status: UnitStatus;
  batch: string;
  createdAt: string;
  source: "rapid-finder" | "sample";
};

export const UNIT_PASSPORTS_KEY = "lifeline.demo.unit-passports.v1";

export function readUnitPassports(): UnitPassportRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(UNIT_PASSPORTS_KEY);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? (parsed as UnitPassportRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveUnitPassports(records: UnitPassportRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(UNIT_PASSPORTS_KEY, JSON.stringify(records));
  window.dispatchEvent(new CustomEvent("lifeline:unit-passports-updated"));
}

export function createUnitId() {
  const date = new Date();
  const year = date.getFullYear();
  const serial = `${date.getTime().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
  return `LL-RBC-${year}-${serial}`;
}
