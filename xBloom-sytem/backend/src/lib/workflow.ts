// Pure ticket-workflow rules — no I/O, so they are unit-testable.

export const TICKET_STATUSES = [
  "new",
  "diagnose",
  "quote",
  "approved",
  "repairing",
  "repair_done",
  "returned",
  "closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

// Allowed forward transitions; any state may also jump straight to "closed".
export const FLOW: Record<TicketStatus, TicketStatus[]> = {
  new: ["diagnose"],
  diagnose: ["quote"],
  quote: ["approved"],
  approved: ["repairing"],
  repairing: ["repair_done"],
  repair_done: ["returned"],
  returned: ["closed"],
  closed: [],
};

/** A transition is allowed when it stays put, advances one step, or closes. */
export function canTransition(current: TicketStatus, next: TicketStatus): boolean {
  return next === "closed" || next === current || FLOW[current]?.includes(next) === true;
}
