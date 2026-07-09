#!/usr/bin/env node
/**
 * Aggregate vitest JSON outputs (server + client) and write an Excel report.
 * Usage:
 *   node scripts/export-test-results.mjs
 *
 * Inputs (must be produced beforehand):
 *   reports/test-runs/server-tests.json    -- `vitest run --reporter=json --outputFile=...`
 *   reports/test-runs/client-tests.json    -- same, in client/
 *   server/coverage/coverage-summary.json  -- `vitest run --coverage` with json-summary
 *   client/coverage/coverage-final.json    -- vitest's default coverage-final
 *
 * Output:
 *   reports/test-results-<YYYYMMDD-HHMMSS>.xlsx
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const serverJsonPath = resolve(ROOT, 'reports/test-runs/server-tests.json');
const clientJsonPath = resolve(ROOT, 'reports/test-runs/client-tests.json');
const e2eJsonPath = resolve(ROOT, 'reports/test-runs/e2e-tests.json');
const serverCovPath = resolve(ROOT, 'server/coverage/coverage-summary.json');
const clientCovPath = resolve(ROOT, 'client/coverage/coverage-final.json');

function readJson(path) {
  if (!existsSync(path)) {
    console.warn(`[warn] missing: ${path}`);
    return null;
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function flattenAssertions(suite, parentNames = []) {
  const out = [];
  const localName = suite.name ?? suite.title ?? '';
  const path = localName ? [...parentNames, localName] : parentNames;
  if (Array.isArray(suite.assertionResults)) {
    for (const a of suite.assertionResults) {
      out.push({
        ancestors: (a.ancestorTitles ?? []).join(' › '),
        title: a.title ?? a.fullName ?? '(no title)',
        fullName: a.fullName ?? `${(a.ancestorTitles ?? []).join(' › ')} ${a.title ?? ''}`.trim(),
        status: a.status, // passed | failed | pending | skipped | todo
        durationMs: a.duration ?? 0,
        failureMessages: Array.isArray(a.failureMessages) ? a.failureMessages.join('\n') : '',
      });
    }
  }
  if (Array.isArray(suite.testResults)) {
    for (const child of suite.testResults) {
      out.push(...flattenAssertions(child, path));
    }
  }
  return out;
}

function summarizeVitestJson(report) {
  if (!report) return { totals: null, files: [], rows: [] };
  const totals = {
    numTotalTests: report.numTotalTests ?? 0,
    numPassedTests: report.numPassedTests ?? 0,
    numFailedTests: report.numFailedTests ?? 0,
    numPendingTests: report.numPendingTests ?? 0,
    numTodoTests: report.numTodoTests ?? 0,
    numTotalTestSuites: report.numTotalTestSuites ?? 0,
    numPassedTestSuites: report.numPassedTestSuites ?? 0,
    numFailedTestSuites: report.numFailedTestSuites ?? 0,
    startTime: report.startTime ?? null,
    success: report.success ?? false,
  };
  const files = [];
  const rows = [];
  for (const fileResult of report.testResults ?? []) {
    const filePath = fileResult.name ?? fileResult.testFilePath ?? '(unknown file)';
    const assertions = flattenAssertions(fileResult);
    const passed = assertions.filter((a) => a.status === 'passed').length;
    const failed = assertions.filter((a) => a.status === 'failed').length;
    const skipped = assertions.filter((a) => a.status === 'skipped' || a.status === 'pending').length;
    files.push({
      file: filePath,
      status: fileResult.status ?? (failed === 0 ? 'passed' : 'failed'),
      passed,
      failed,
      skipped,
      total: assertions.length,
      durationMs: fileResult.endTime != null && fileResult.startTime != null
        ? fileResult.endTime - fileResult.startTime
        : 0,
    });
    for (const a of assertions) {
      rows.push({ file: filePath, ...a });
    }
  }
  return { totals, files, rows };
}

function summarizePlaywrightJson(report) {
  if (!report) return { totals: null, rows: [] };
  const totals = {
    expected: report.stats?.expected ?? 0,
    skipped: report.stats?.skipped ?? 0,
    unexpected: report.stats?.unexpected ?? 0,
    flaky: report.stats?.flaky ?? 0,
    durationMs: report.stats?.duration ?? 0,
    startTime: report.stats?.startTime ?? null,
  };
  const rows = [];
  function walk(suite, parentTitles, file) {
    const currentFile = suite.file ?? file ?? '';
    const titles = suite.title ? [...parentTitles, suite.title] : parentTitles;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const last = (test.results ?? [])[test.results.length - 1] ?? {};
        const projectName = test.projectName ?? '';
        const status = last.status === 'passed'
          ? 'passed'
          : last.status === 'skipped'
            ? 'skipped'
            : 'failed';
        rows.push({
          file: currentFile,
          suite: titles.join(' › '),
          title: spec.title,
          project: projectName,
          status,
          durationMs: last.duration ?? 0,
          failureMessages:
            last.error?.message ??
            last.errors?.map((e) => e.message).filter(Boolean).join('\n') ??
            '',
        });
      }
    }
    for (const sub of suite.suites ?? []) {
      walk(sub, titles, currentFile);
    }
  }
  for (const top of report.suites ?? []) {
    walk(top, [], top.file ?? '');
  }
  return { totals, rows };
}

function loadServerCoverage() {
  const cov = readJson(serverCovPath);
  if (!cov) return { total: null, files: [] };
  const { total, ...rest } = cov;
  const files = Object.entries(rest).map(([path, c]) => ({
    file: path,
    statementsPct: c.statements?.pct ?? 0,
    statementsCovered: c.statements?.covered ?? 0,
    statementsTotal: c.statements?.total ?? 0,
    branchesPct: c.branches?.pct ?? 0,
    branchesCovered: c.branches?.covered ?? 0,
    branchesTotal: c.branches?.total ?? 0,
    functionsPct: c.functions?.pct ?? 0,
    functionsCovered: c.functions?.covered ?? 0,
    functionsTotal: c.functions?.total ?? 0,
    linesPct: c.lines?.pct ?? 0,
    linesCovered: c.lines?.covered ?? 0,
    linesTotal: c.lines?.total ?? 0,
  }));
  return { total, files };
}

function loadClientCoverage() {
  const cov = readJson(clientCovPath);
  if (!cov) return { total: null, files: [] };
  const files = [];
  let stTotal = 0;
  let stCovered = 0;
  let brTotal = 0;
  let brCovered = 0;
  let fnTotal = 0;
  let fnCovered = 0;
  for (const [path, entry] of Object.entries(cov)) {
    const sMap = entry.s ?? {};
    const sTotal = Object.keys(sMap).length;
    const sCov = Object.values(sMap).filter((v) => v > 0).length;
    const bMap = entry.b ?? {};
    let bTotal = 0;
    let bCov = 0;
    for (const arr of Object.values(bMap)) {
      bTotal += arr.length;
      bCov += arr.filter((v) => v > 0).length;
    }
    const fMap = entry.f ?? {};
    const fTotal = Object.keys(fMap).length;
    const fCov = Object.values(fMap).filter((v) => v > 0).length;
    stTotal += sTotal;
    stCovered += sCov;
    brTotal += bTotal;
    brCovered += bCov;
    fnTotal += fTotal;
    fnCovered += fCov;
    files.push({
      file: path,
      statementsPct: sTotal > 0 ? Number(((sCov / sTotal) * 100).toFixed(2)) : 0,
      statementsCovered: sCov,
      statementsTotal: sTotal,
      branchesPct: bTotal > 0 ? Number(((bCov / bTotal) * 100).toFixed(2)) : 0,
      branchesCovered: bCov,
      branchesTotal: bTotal,
      functionsPct: fTotal > 0 ? Number(((fCov / fTotal) * 100).toFixed(2)) : 0,
      functionsCovered: fCov,
      functionsTotal: fTotal,
    });
  }
  const total = {
    statements: {
      pct: stTotal > 0 ? Number(((stCovered / stTotal) * 100).toFixed(2)) : 0,
      covered: stCovered,
      total: stTotal,
    },
    branches: {
      pct: brTotal > 0 ? Number(((brCovered / brTotal) * 100).toFixed(2)) : 0,
      covered: brCovered,
      total: brTotal,
    },
    functions: {
      pct: fnTotal > 0 ? Number(((fnCovered / fnTotal) * 100).toFixed(2)) : 0,
      covered: fnCovered,
      total: fnTotal,
    },
    lines: { pct: 0, covered: 0, total: 0 },
  };
  return { total, files };
}

function shortPath(absPath) {
  try {
    const rel = relative(ROOT, absPath);
    return rel.length < absPath.length ? rel.replace(/\\/g, '/') : absPath;
  } catch {
    return absPath;
  }
}

function statusFill(status) {
  switch (status) {
    case 'passed':
      return 'FFD1FAE5';
    case 'failed':
      return 'FFFEE2E2';
    case 'skipped':
    case 'pending':
      return 'FFFEF3C7';
    default:
      return 'FFF1F5F9';
  }
}

async function main() {
  const exceljsEntry = resolve(ROOT, 'server/node_modules/exceljs/excel.js');
  const ExcelJSModule = await import(
    /* @vite-ignore */ new URL('file://' + exceljsEntry.replace(/\\/g, '/')).href
  ).catch(() => import('exceljs'));
  const ExcelJS = ExcelJSModule.default ?? ExcelJSModule;

  const server = summarizeVitestJson(readJson(serverJsonPath));
  const client = summarizeVitestJson(readJson(clientJsonPath));
  const e2e = summarizePlaywrightJson(readJson(e2eJsonPath));
  const serverCov = loadServerCoverage();
  const clientCov = loadClientCoverage();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'LMS Casa test exporter';
  wb.created = new Date();

  // ── Sheet 1: Summary ────────────────────────────────────────────────────────
  const sum = wb.addWorksheet('Summary');
  sum.columns = [
    { header: 'Scope', key: 'scope', width: 18 },
    { header: 'Metric', key: 'metric', width: 26 },
    { header: 'Value', key: 'value', width: 18 },
  ];
  sum.getRow(1).font = { bold: true };
  function pushSummary(scope, label, value) {
    sum.addRow({ scope, metric: label, value });
  }
  const now = new Date();
  pushSummary('Meta', 'Generated at', now.toISOString());
  pushSummary('Meta', 'Project', 'LMS Casa');

  if (server.totals) {
    pushSummary('Server', 'Total tests', server.totals.numTotalTests);
    pushSummary('Server', 'Passed', server.totals.numPassedTests);
    pushSummary('Server', 'Failed', server.totals.numFailedTests);
    pushSummary('Server', 'Skipped/Pending', server.totals.numPendingTests + server.totals.numTodoTests);
    pushSummary('Server', 'Test files', server.totals.numTotalTestSuites);
    pushSummary('Server', 'Success', server.totals.success);
  }
  if (serverCov.total) {
    pushSummary('Server', 'Coverage statements %', serverCov.total.statements.pct);
    pushSummary('Server', 'Coverage branches %', serverCov.total.branches.pct);
    pushSummary('Server', 'Coverage functions %', serverCov.total.functions.pct);
    pushSummary('Server', 'Coverage lines %', serverCov.total.lines.pct);
  }
  if (client.totals) {
    pushSummary('Client', 'Total tests', client.totals.numTotalTests);
    pushSummary('Client', 'Passed', client.totals.numPassedTests);
    pushSummary('Client', 'Failed', client.totals.numFailedTests);
    pushSummary('Client', 'Skipped/Pending', client.totals.numPendingTests + client.totals.numTodoTests);
    pushSummary('Client', 'Test files', client.totals.numTotalTestSuites);
    pushSummary('Client', 'Success', client.totals.success);
  }
  if (clientCov.total) {
    pushSummary('Client', 'Coverage statements %', clientCov.total.statements.pct);
    pushSummary('Client', 'Coverage branches %', clientCov.total.branches.pct);
    pushSummary('Client', 'Coverage functions %', clientCov.total.functions.pct);
  }
  if (e2e.totals) {
    const e2eTotal = e2e.totals.expected + e2e.totals.unexpected + e2e.totals.skipped;
    pushSummary('E2E', 'Total tests', e2eTotal);
    pushSummary('E2E', 'Passed (expected)', e2e.totals.expected);
    pushSummary('E2E', 'Failed (unexpected)', e2e.totals.unexpected);
    pushSummary('E2E', 'Skipped', e2e.totals.skipped);
    pushSummary('E2E', 'Flaky', e2e.totals.flaky);
    pushSummary('E2E', 'Duration (ms)', Math.round(e2e.totals.durationMs));
  }
  sum.autoFilter = { from: 'A1', to: 'C1' };

  // ── Sheet 2: Server tests (per test case) ──────────────────────────────────
  function writeTestsSheet(name, rows) {
    const ws = wb.addWorksheet(name);
    ws.columns = [
      { header: 'File', key: 'file', width: 60 },
      { header: 'Suite', key: 'ancestors', width: 40 },
      { header: 'Test', key: 'title', width: 80 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Duration (ms)', key: 'durationMs', width: 14 },
      { header: 'Failure', key: 'failureMessages', width: 60 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const r of rows) {
      const row = ws.addRow({ ...r, file: shortPath(r.file) });
      row.getCell('status').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: statusFill(r.status) },
      };
    }
    ws.autoFilter = { from: 'A1', to: 'F1' };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  writeTestsSheet('Server tests', server.rows);
  writeTestsSheet('Client tests', client.rows);

  // ── E2E tests ──────────────────────────────────────────────────────────────
  if (e2e.totals) {
    const ws = wb.addWorksheet('E2E tests');
    ws.columns = [
      { header: 'File', key: 'file', width: 50 },
      { header: 'Suite', key: 'suite', width: 40 },
      { header: 'Test', key: 'title', width: 70 },
      { header: 'Project', key: 'project', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Duration (ms)', key: 'durationMs', width: 14 },
      { header: 'Failure', key: 'failureMessages', width: 60 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const r of e2e.rows) {
      const row = ws.addRow({ ...r, file: shortPath(r.file) });
      row.getCell('status').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: statusFill(r.status) },
      };
    }
    ws.autoFilter = { from: 'A1', to: 'G1' };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // ── Sheet: per-file test stats ─────────────────────────────────────────────
  function writeFilesSheet(name, files) {
    const ws = wb.addWorksheet(name);
    ws.columns = [
      { header: 'File', key: 'file', width: 70 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Total', key: 'total', width: 8 },
      { header: 'Passed', key: 'passed', width: 8 },
      { header: 'Failed', key: 'failed', width: 8 },
      { header: 'Skipped', key: 'skipped', width: 8 },
      { header: 'Duration (ms)', key: 'durationMs', width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const f of files) {
      const row = ws.addRow({ ...f, file: shortPath(f.file) });
      row.getCell('status').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: statusFill(f.status) },
      };
    }
    ws.autoFilter = { from: 'A1', to: 'G1' };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  writeFilesSheet('Server test files', server.files);
  writeFilesSheet('Client test files', client.files);

  // ── Sheet: Coverage per file ───────────────────────────────────────────────
  function writeCoverageSheet(name, files) {
    const ws = wb.addWorksheet(name);
    ws.columns = [
      { header: 'File', key: 'file', width: 70 },
      { header: 'Stmt %', key: 'statementsPct', width: 10 },
      { header: 'Stmt cov/total', key: 'stmt', width: 16 },
      { header: 'Branch %', key: 'branchesPct', width: 10 },
      { header: 'Branch cov/total', key: 'br', width: 16 },
      { header: 'Func %', key: 'functionsPct', width: 10 },
      { header: 'Func cov/total', key: 'fn', width: 16 },
      { header: 'Line %', key: 'linesPct', width: 10 },
      { header: 'Line cov/total', key: 'ln', width: 16 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const f of files) {
      ws.addRow({
        ...f,
        file: shortPath(f.file),
        stmt: `${f.statementsCovered}/${f.statementsTotal}`,
        br: `${f.branchesCovered}/${f.branchesTotal}`,
        fn: `${f.functionsCovered}/${f.functionsTotal}`,
        ln: f.linesTotal != null ? `${f.linesCovered ?? 0}/${f.linesTotal ?? 0}` : '',
      });
    }
    ws.autoFilter = { from: 'A1', to: 'I1' };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  writeCoverageSheet('Server coverage', serverCov.files);
  writeCoverageSheet('Client coverage', clientCov.files);

  // ── Save ───────────────────────────────────────────────────────────────────
  const stamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const outDir = resolve(ROOT, 'reports');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `test-results-${stamp}.xlsx`);
  await wb.xlsx.writeFile(outPath);
  console.log(`OK: ${shortPath(outPath)}`);
  console.log(
    `Server: ${server.totals?.numPassedTests ?? 0}/${server.totals?.numTotalTests ?? 0} passed | ` +
      `Client: ${client.totals?.numPassedTests ?? 0}/${client.totals?.numTotalTests ?? 0} passed | ` +
      `E2E: ${e2e.totals?.expected ?? 0}/${
        (e2e.totals?.expected ?? 0) + (e2e.totals?.unexpected ?? 0) + (e2e.totals?.skipped ?? 0)
      } passed`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
