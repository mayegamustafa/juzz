'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Plus, Trash, Pencil } from '@/components/icons';
import { Spinner } from '@/components/ui';

interface Stream {
  id: string;
  name: string;
}
interface SchoolClass {
  id: string;
  level: string;
  name: string;
  order: number;
  streams: Stream[];
  _count: { students: number };
}

export function SchoolClasses({
  school,
  canManage,
  onClose,
}: {
  school: { id: string; name: string; code: string };
  canManage: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [newLevel, setNewLevel] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<SchoolClass | null>(null);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<SchoolClass | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [streamFor, setStreamFor] = useState<string | null>(null);
  const [streamName, setStreamName] = useState('');

  const load = useCallback(() => {
    api
      .get<SchoolClass[]>(`/schools/${school.id}/classes`)
      .then(setClasses)
      .catch((e) => toast.error(e.message));
  }, [school.id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const addClass = async () => {
    const level = newLevel.trim();
    if (!level) return;
    setAdding(true);
    try {
      await api.post(`/schools/${school.id}/classes`, { level });
      toast.success(`${level} added`);
      setNewLevel('');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAdding(false);
    }
  };

  const removeClass = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`/classes/${deleting.id}`);
      toast.success(`${deleting.level} removed`);
      setDeleting(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const saveRename = async () => {
    if (!renaming || !renameValue.trim()) return;
    try {
      await api.patch(`/classes/${renaming.id}`, { name: renameValue.trim() });
      toast.success('Class renamed');
      setRenaming(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const addStream = async (classId: string) => {
    const name = streamName.trim();
    if (!name) return;
    try {
      await api.post(`/classes/${classId}/streams`, { name });
      toast.success(`Stream ${name} added`);
      setStreamName('');
      setStreamFor(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const removeStream = async (id: string, name: string) => {
    try {
      await api.del(`/streams/${id}`);
      toast.success(`Stream ${name} removed`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`Classes: ${school.name}`}
        description="Classes and their streams. A class holding pupils cannot be removed."
        width="max-w-2xl"
        footer={
          <button className="btn-outline" onClick={onClose}>
            Done
          </button>
        }
      >
        {canManage && (
          <div className="mb-4 flex gap-2">
            <input
              className="input"
              placeholder="New class level, e.g. P.4"
              value={newLevel}
              onChange={(e) => setNewLevel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addClass()}
            />
            <button className="btn-primary shrink-0" onClick={addClass} disabled={adding || !newLevel.trim()}>
              <Plus size={16} /> Add
            </button>
          </div>
        )}

        {!classes ? (
          <Spinner />
        ) : classes.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
            No classes yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {classes.map((c) => (
              <li key={c.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {c.name}
                      {c.name !== c.level && (
                        <span className="ml-2 text-xs" style={{ color: 'var(--muted)' }}>
                          ({c.level})
                        </span>
                      )}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {c._count.students} pupil{c._count.students === 1 ? '' : 's'}
                      {c.streams.length > 0 && ` · ${c.streams.length} stream${c.streams.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        className="btn-icon"
                        title="Rename"
                        onClick={() => {
                          setRenaming(c);
                          setRenameValue(c.name);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn-icon"
                        title="Add stream"
                        onClick={() => setStreamFor(streamFor === c.id ? null : c.id)}
                      >
                        <Plus size={14} />
                      </button>
                      <button className="btn-icon btn-icon-danger" title="Delete class" onClick={() => setDeleting(c)}>
                        <Trash size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {c.streams.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.streams.map((s) => (
                      <span
                        key={s.id}
                        className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {s.name}
                        {canManage && (
                          <button
                            className="ml-1.5 opacity-50 hover:opacity-100"
                            onClick={() => removeStream(s.id, s.name)}
                            aria-label={`Remove stream ${s.name}`}
                          >
                            <Trash size={11} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {streamFor === c.id && canManage && (
                  <div className="mt-3 flex gap-2">
                    <input
                      className="input"
                      placeholder="Stream name, e.g. A"
                      value={streamName}
                      autoFocus
                      onChange={(e) => setStreamName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addStream(c.id)}
                    />
                    <button className="btn-primary shrink-0" onClick={() => addStream(c.id)} disabled={!streamName.trim()}>
                      Add stream
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={removeClass}
        busy={busy}
        title={`Delete ${deleting?.name}?`}
        message="This also removes its streams. A class holding pupils cannot be deleted."
      />

      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title={`Rename ${renaming?.level}`}
        width="max-w-sm"
        footer={
          <>
            <button className="btn-outline" onClick={() => setRenaming(null)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={saveRename} disabled={!renameValue.trim()}>
              Save
            </button>
          </>
        }
      >
        <label className="label">Display name</label>
        <input className="input" value={renameValue} autoFocus onChange={(e) => setRenameValue(e.target.value)} />
      </Modal>
    </>
  );
}
