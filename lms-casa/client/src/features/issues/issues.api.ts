import { api } from '../../lib/api';

export function createIssue(input: { description: string; page?: string }): Promise<void> {
  return api.post('/issues', input);
}
