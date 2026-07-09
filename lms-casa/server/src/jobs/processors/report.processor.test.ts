import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { reportFilePath, REPORTS_DIR } from './report.processor.js';

describe('reportFilePath (Issue #14 — path traversal)', () => {
  it('strips traversal and keeps the file inside REPORTS_DIR', () => {
    const p = reportFilePath('../../etc/passwd');
    expect(p).toBe(path.join(REPORTS_DIR, 'passwd.xlsx'));
    expect(p.startsWith(REPORTS_DIR)).toBe(true);
  });

  it('builds a normal jobId path', () => {
    expect(reportFilePath('abc123')).toBe(path.join(REPORTS_DIR, 'abc123.xlsx'));
  });

  it('REPORTS_DIR is outside the publicly-served uploads/ directory', () => {
    expect(REPORTS_DIR.includes(`${path.sep}uploads${path.sep}`)).toBe(false);
    expect(REPORTS_DIR.endsWith('report-exports')).toBe(true);
  });
});
