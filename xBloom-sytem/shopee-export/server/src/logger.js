/** Minimal structured logger (timestamped). Keeps step-by-step traces per the spec. */
function line(level, msg, meta) {
  const ts = new Date().toISOString();
  const extra = meta ? " " + JSON.stringify(meta) : "";
  // eslint-disable-next-line no-console
  console.log(`${ts} [${level}] ${msg}${extra}`);
}

export const log = {
  info: (msg, meta) => line("INFO", msg, meta),
  warn: (msg, meta) => line("WARN", msg, meta),
  error: (msg, meta) => line("ERROR", msg, meta),
};
