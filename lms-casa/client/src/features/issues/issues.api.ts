import { submitIssueReport, type Severity } from '../../lib/issueService';

export function createIssue(input: {
  description: string;
  severity: Severity;
  reporterId: string;
  reporterName: string;
  reporterRole?: string;
  page?: string;
  attachment?: File | null;
}): Promise<{ id: string }> {
  return submitIssueReport(input);
}
