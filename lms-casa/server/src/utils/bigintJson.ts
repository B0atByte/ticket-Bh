// Patch JSON.stringify to handle BigInt — Express res.json relies on it.
// Express serializes BigInt to string so APIs return ids as strings (safe for JS clients).
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

(BigInt.prototype as BigInt).toJSON = function (): string {
  return this.toString();
};

export {};
