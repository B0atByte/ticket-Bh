/**
 * Phase 3 — NotesPanel
 * CRUD notes + bookmarks for a lesson.
 * Bookmarks show timestamp; notes show content.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, FileText, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  createLessonNote,
  deleteLessonNote,
  listLessonNotes,
  updateLessonNote,
  type LessonNote,
} from './learning-phase3.api';

interface NotesPanelProps {
  lessonId: string;
  /** Current video position in seconds (for bookmarks) */
  currentTimeSec?: number;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function NotesPanel({ lessonId, currentTimeSec = 0 }: NotesPanelProps) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'NOTE' | 'BOOKMARK'>('NOTE');
  const [newContent, setNewContent] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const notesKey = ['lesson-notes', lessonId, tab];

  const { data, isLoading } = useQuery({
    queryKey: notesKey,
    queryFn: () => listLessonNotes(lessonId, tab),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createLessonNote(lessonId, {
        type: tab,
        content: newContent.trim(),
        timestampSec: tab === 'BOOKMARK' ? Math.round(currentTimeSec) : undefined,
      }),
    onSuccess: () => {
      setNewContent('');
      qc.invalidateQueries({ queryKey: notesKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (note: LessonNote) => updateLessonNote(lessonId, note.id, editContent.trim()),
    onSuccess: () => {
      setEditId(null);
      qc.invalidateQueries({ queryKey: notesKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => deleteLessonNote(lessonId, noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKey }),
  });

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      {/* Tabs */}
      <div className="flex border-b" role="tablist" aria-label="Notes and bookmarks">
        {(['NOTE', 'BOOKMARK'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={[
              'flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors',
              tab === t
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {t === 'NOTE'
              ? <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              : <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />}
            {t === 'NOTE' ? 'Notes' : 'Bookmarks'}
          </button>
        ))}
      </div>

      {/* Add new */}
      <div className="border-b p-3">
        <div className="flex gap-2">
          <Input
            placeholder={tab === 'NOTE' ? 'Add a note…' : 'Bookmark label…'}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newContent.trim()) createMutation.mutate();
            }}
            aria-label={tab === 'NOTE' ? 'New note content' : 'New bookmark label'}
          />
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!newContent.trim() || createMutation.isPending}
            aria-label="Add"
          >
            {createMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <Plus className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
        {tab === 'BOOKMARK' && (
          <p className="mt-1 text-xs text-muted-foreground">
            Will bookmark at {formatTime(currentTimeSec)}
          </p>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2" role="list" aria-label={tab === 'NOTE' ? 'Notes list' : 'Bookmarks list'}>
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No {tab === 'NOTE' ? 'notes' : 'bookmarks'} yet.
          </p>
        )}

        {data?.items.map((note) => (
          <div
            key={note.id}
            role="listitem"
            className="group rounded-md border bg-background p-3 text-sm"
          >
            {editId === note.id ? (
              <div className="space-y-2">
                <textarea
                  className="w-full rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  aria-label="Edit note content"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => updateMutation.mutate(note)}
                    disabled={!editContent.trim() || updateMutation.isPending}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  {note.timestampSec != null && (
                    <span className="mb-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                      {formatTime(note.timestampSec)}
                    </span>
                  )}
                  <p className="whitespace-pre-wrap leading-5">{note.content}</p>
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  {note.type === 'NOTE' && (
                    <button
                      type="button"
                      onClick={() => { setEditId(note.id); setEditContent(note.content); }}
                      className="rounded p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label="Edit note"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(note.id)}
                    className="rounded p-1 text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                    aria-label="Delete note"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
