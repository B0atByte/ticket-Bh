import { fetchMyIssues, postIssueComment, submitIssueReport, type Category, type IssueComment, type MyIssue, type Severity } from '../../lib/issueService';

export function createIssue(input: {
  description: string;
  severity: Severity;
  reporterId: string;
  reporterName: string;
  reporterRole?: string;
  page?: string;
  attachment?: File | null;
  category: Category;
  subject?: string;
  contactInfo?: string;
}): Promise<{ id: string }> {
  return submitIssueReport(input);
}

export function getMyIssues(reporterId: string): Promise<MyIssue[]> {
  return fetchMyIssues(reporterId);
}

export function addIssueComment(issueId: string, reporterId: string, message: string): Promise<IssueComment[]> {
  return postIssueComment(issueId, reporterId, message);
}
