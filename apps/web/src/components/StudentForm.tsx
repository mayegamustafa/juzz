'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';

interface School {
  id: string;
  code: string;
  name: string;
}
interface Stream {
  id: string;
  name: string;
}
interface SchoolClass {
  id: string;
  level: string;
  name: string;
  streams: Stream[];
}
interface Teacher {
  id: string;
  fullName: string;
  school: { id: string };
}
interface Student {
  id: string;
  fullName: string;
  admissionNo: string;
  gender: string | null;
  schoolId: string;
  classId: string;
  streamId: string | null;
  primaryTeacherId: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
}

const EMPTY = {
  schoolId: '',
  classId: '',
  streamId: '',
  admissionNo: '',
  fullName: '',
  gender: '',
  guardianName: '',
  guardianPhone: '',
  primaryTeacherId: '',
};

export function StudentForm({
  student,
  canReassign,
  ownSchoolId,
  onClose,
  onSaved,
}: {
  student: Student | null;
  /** Only the secretariat may set the school, class and sheikh. */
  canReassign: boolean;
  /**
   * A Sheikh registering a brand-new pupil still needs to pick a class (it's
   * required), just scoped to their own school — this is that school's id.
   */
  ownSchoolId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const selfRegistering = !canReassign && !student;

  const [form, setForm] = useState(() =>
    student
      ? {
          schoolId: student.schoolId,
          classId: student.classId,
          streamId: student.streamId ?? '',
          admissionNo: student.admissionNo,
          fullName: student.fullName,
          gender: student.gender ?? '',
          guardianName: student.guardianName ?? '',
          guardianPhone: student.guardianPhone ?? '',
          primaryTeacherId: student.primaryTeacherId ?? '',
        }
      : { ...EMPTY, schoolId: ownSchoolId ?? '' },
  );

  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!canReassign) return;
    api.get<School[]>('/schools').then((s) => {
      setSchools(s);
      setForm((f) => (f.schoolId ? f : { ...f, schoolId: s[0]?.id ?? '' }));
    });
    api.get<Teacher[]>('/teachers').then(setTeachers).catch(() => undefined);
  }, [canReassign]);

  // Classes depend on the chosen school; changing school invalidates class + stream.
  // A self-registering Sheikh never changes school, but still needs its class list.
  useEffect(() => {
    if (!form.schoolId) {
      setClasses([]);
      return;
    }
    api
      .get<SchoolClass[]>(`/schools/${form.schoolId}/classes`)
      .then((cs) => {
        setClasses(cs);
        setForm((f) => (cs.some((c) => c.id === f.classId) ? f : { ...f, classId: cs[0]?.id ?? '', streamId: '' }));
      })
      .catch(() => setClasses([]));
  }, [form.schoolId]);

  const streams = classes.find((c) => c.id === form.classId)?.streams ?? [];
  const schoolTeachers = teachers.filter((t) => t.school.id === form.schoolId);

  const save = async () => {
    setSaving(true);
    setError('');
    const payload: Record<string, unknown> = {
      admissionNo: form.admissionNo.trim(),
      fullName: form.fullName.trim(),
      gender: form.gender || undefined,
      guardianName: form.guardianName || undefined,
      guardianPhone: form.guardianPhone || undefined,
    };
    if (canReassign) {
      payload.classId = form.classId;
      payload.streamId = form.streamId || null;
      payload.primaryTeacherId = form.primaryTeacherId || null;
    } else if (selfRegistering) {
      // A Sheikh still has to say which class; the school and sheikh (themselves)
      // are implied server-side.
      payload.classId = form.classId;
      payload.streamId = form.streamId || null;
    }

    try {
      if (student) {
        await api.patch(`/students/${student.id}`, payload);
        toast.success(`${form.fullName} updated`);
      } else {
        await api.post('/students', { ...payload, schoolId: form.schoolId, classId: form.classId });
        toast.success(
          selfRegistering
            ? `${form.fullName} submitted for verification`
            : `${form.fullName} added`,
        );
      }
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const needsClassPicked = canReassign || selfRegistering;
  const valid = form.fullName.trim() && form.admissionNo.trim() && (!needsClassPicked || (form.schoolId && form.classId));

  return (
    <Modal
      open
      onClose={onClose}
      title={student ? `Edit ${student.fullName}` : selfRegistering ? 'Register pupil' : 'Add pupil'}
      description={
        selfRegistering
          ? 'This goes to the secretariat for verification before it joins the official roster. You can keep recording progress for this pupil while it waits.'
          : canReassign
            ? undefined
            : 'You may correct details. Only the secretariat can move a pupil.'
      }
      footer={
        <>
          <button className="btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving || !valid}>
            {saving ? 'Saving…' : student ? 'Save changes' : selfRegistering ? 'Submit for verification' : 'Add pupil'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <label className="label">Admission no.</label>
            <input
              className="input"
              value={form.admissionNo}
              onChange={(e) => setForm({ ...form, admissionNo: e.target.value })}
            />
          </div>
        </div>

        {canReassign && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">School</label>
                <select
                  className="input"
                  value={form.schoolId}
                  disabled={!!student} // moving a pupil between schools is a transfer, not an edit
                  onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Class</label>
                <select className="input" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value, streamId: '' })}>
                  {classes.length === 0 && <option value="">No classes in this school</option>}
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Stream</label>
                <select className="input" value={form.streamId} onChange={(e) => setForm({ ...form, streamId: e.target.value })}>
                  <option value="">None</option>
                  {streams.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Sheikh</label>
                <select
                  className="input"
                  value={form.primaryTeacherId}
                  onChange={(e) => setForm({ ...form, primaryTeacherId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {schoolTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {selfRegistering && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Class</label>
              <select
                className="input"
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value, streamId: '' })}
              >
                {classes.length === 0 && <option value="">Loading…</option>}
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Stream</label>
              <select className="input" value={form.streamId} onChange={(e) => setForm({ ...form, streamId: e.target.value })}>
                <option value="">None</option>
                {streams.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Gender</label>
            <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">—</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
          <div>
            <label className="label">Guardian</label>
            <input
              className="input"
              value={form.guardianName}
              onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Guardian phone</label>
            <input
              className="input"
              value={form.guardianPhone}
              onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
