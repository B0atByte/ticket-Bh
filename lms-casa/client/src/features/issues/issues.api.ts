import { fetchMyIssues, submitIssueReport, type MyIssue, type Severity } from '../../lib/issueService';

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

export function getMyIssues(reporterId: string): Promise<MyIssue[]> {
  return fetchMyIssues(reporterId);
}
