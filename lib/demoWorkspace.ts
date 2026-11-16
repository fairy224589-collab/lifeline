export type DemoRequest = { id: string; bloodGroup: string; component: string; units: number; location: string; status: string; unitId?: string; createdAt: string };
export type DemoDonor = { id: string; name: string; bloodGroup: string; area: string; available: boolean };
export type DemoInventory = { id: string; bank: string; bloodGroup: string; component: string; units: number; expiry: string };
export type DemoWorkspace = { requests: DemoRequest[]; donors: DemoDonor[]; inventory: DemoInventory[]; notifications: { id: string; title: string; detail: string; createdAt: string; read: boolean }[] };
const KEY = "lifeline.demo.workspace.v1";
const seed: DemoWorkspace = {
 requests: [{ id: "REQ-DEMO-1001", bloodGroup: "O+", component: "Packed red cells", units: 2, location: "South Delhi", status: "Searching network", createdAt: new Date().toISOString() }],
 donors: [
  { id: "DON-DEMO-001", name: "Aarav Mehta", bloodGroup: "O+", area: "Lajpat Nagar", available: true },
  { id: "DON-DEMO-002", name: "Ananya Rao", bloodGroup: "B+", area: "Saket", available: true },
  { id: "DON-DEMO-003", name: "Kabir Singh", bloodGroup: "A-", area: "Rohini", available: false },
 ],
 inventory: [
  { id: "INV-DEMO-001", bank: "CityCare Demo Blood Centre", bloodGroup: "B+", component: "Whole blood", units: 4, expiry: "2026-12-08" },
  { id: "INV-DEMO-002", bank: "Red Cross Demo Blood Bank", bloodGroup: "O-", component: "Packed red cells", units: 2, expiry: "2026-11-28" },
  { id: "INV-DEMO-003", bank: "Metro Demo Blood Centre", bloodGroup: "A+", component: "Platelets", units: 6, expiry: "2026-11-20" },
 ], notifications: []
};
export function readWorkspace(): DemoWorkspace {
 if (typeof window === "undefined") return seed;
 try { const parsed = JSON.parse(localStorage.getItem(KEY) || "null") as DemoWorkspace | null; return parsed && Array.isArray(parsed.requests) ? parsed : seed; } catch { return seed; }
}
export function writeWorkspace(value: DemoWorkspace) { if (typeof window === "undefined") return; localStorage.setItem(KEY, JSON.stringify(value)); window.dispatchEvent(new CustomEvent("lifeline:workspace-updated")); }
export function addDemoNotification(title: string, detail: string) { const data = readWorkspace(); data.notifications.unshift({ id: `NTF-${Date.now()}`, title, detail, createdAt: new Date().toISOString(), read: false }); writeWorkspace(data); }
