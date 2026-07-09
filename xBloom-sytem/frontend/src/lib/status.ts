// Ticket workflow — keys match the backend enum; labels match the spec wording.
export const TICKET_FLOW = [
  { key: "new", label: "New case" },
  { key: "diagnose", label: "Diagnose" },
  { key: "quote", label: "Quote cost" },
  { key: "approved", label: "Customer approved" },
  { key: "repairing", label: "Repairing" },
  { key: "repair_done", label: "Repair done" },
  { key: "returned", label: "Returned to customer" },
  { key: "closed", label: "Close ticket" },
] as const;

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  TICKET_FLOW.map((s) => [s.key, s.label]),
);

// Coarse buckets for the All Cases status filter.
export const STATUS_BUCKET: Record<string, "incoming" | "ongoing" | "closed"> = {
  new: "incoming",
  diagnose: "ongoing",
  quote: "ongoing",
  approved: "ongoing",
  repairing: "ongoing",
  repair_done: "ongoing",
  returned: "ongoing",
  closed: "closed",
};

export const GLOBAL_STATUS = [
  { key: "awaiting", label: "Awaiting Global response" },
  { key: "accepted", label: "Global accepted" },
  { key: "rejected", label: "Global rejected" },
] as const;
