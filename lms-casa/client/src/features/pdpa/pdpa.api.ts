import { api } from '../../lib/api';

/**
 * Trigger the browser to download a ZIP of the user's data.
 * Uses axios to fetch as blob (so auth header gets attached).
 */
export async function downloadMyDataExport(): Promise<void> {
  const res = await api.get('/me/data-export', { responseType: 'blob' });
  const blob = new Blob([res.data as BlobPart], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lmscasa-data-export-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function anonymizeMyAccount(): Promise<void> {
  await api.delete('/me');
}
