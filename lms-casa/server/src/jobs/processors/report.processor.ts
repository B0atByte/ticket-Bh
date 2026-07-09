import fs from 'node:fs';
import path from 'node:path';
import type { ReportJob } from '../queue.js';
import {
  buildExamResultsWorkbook,
  buildCourseCompletionWorkbook,
} from '../../modules/reports/reports.service.js';

/**
 * Where generated report files live. Deliberately OUTSIDE `uploads/` (which is
 * served by express.static) so report files — which contain PII / exam scores —
 * can only be fetched through the authenticated download endpoint.
 */
export const REPORTS_DIR = path.resolve(process.cwd(), 'report-exports');

export function reportFilePath(jobId: string): string {
  // basename() neutralizes any path-traversal in a caller-supplied jobId.
  return path.join(REPORTS_DIR, `${path.basename(jobId)}.xlsx`);
}

export async function processReportJob(jobId: string, data: ReportJob): Promise<void> {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const wb =
    data.kind === 'exam-results'
      ? await buildExamResultsWorkbook({
          examId: data.examId ? BigInt(data.examId) : undefined,
          from: data.from ? new Date(data.from) : undefined,
          to: data.to ? new Date(data.to) : undefined,
        })
      : await buildCourseCompletionWorkbook();

  await wb.xlsx.writeFile(reportFilePath(jobId));
}
