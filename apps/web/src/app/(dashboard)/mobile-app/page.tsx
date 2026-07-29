'use client';

import { useEffect, useState } from 'react';
import { useAuth, isAdmin } from '@/lib/auth';
import { api } from '@/lib/api';
import { PageHeader, Spinner, Empty } from '@/components/ui';
import { useToast } from '@/components/Toast';

interface Release {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
  releaseNotes: string | null;
  mandatory: boolean;
  updatedAt: string;
}

export default function MobileAppPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    versionCode: '',
    versionName: '',
    downloadUrl: '',
    releaseNotes: '',
    mandatory: false,
  });

  useEffect(() => {
    api
      .get<Release | null>('/app-release')
      .then((r) => {
        setRelease(r);
        if (r) {
          setForm({
            versionCode: String(r.versionCode),
            versionName: r.versionName,
            downloadUrl: r.downloadUrl,
            releaseNotes: r.releaseNotes ?? '',
            mandatory: r.mandatory,
          });
        } else {
          setForm((f) => ({ ...f, versionCode: '2' }));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (!isAdmin(user?.role)) {
    return <Empty>Only the secretariat can manage the teacher app's releases.</Empty>;
  }

  const publish = async () => {
    setSaving(true);
    try {
      const saved = await api.post<Release>('/app-release', {
        versionCode: Number(form.versionCode),
        versionName: form.versionName,
        downloadUrl: form.downloadUrl,
        releaseNotes: form.releaseNotes || undefined,
        mandatory: form.mandatory,
      });
      setRelease(saved);
      toast.success('Release published. Every Sheikh will be offered this update next time they open the app.');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Teacher app updates"
        subtitle="Publish a new build after every Codemagic run, and Sheikhs are offered it next time they open the app"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Publish a release</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Version code</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  placeholder="e.g. 2"
                  value={form.versionCode}
                  onChange={(e) => setForm({ ...form, versionCode: e.target.value })}
                />
                <p className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
                  Must be higher than the currently installed build (starts at 1).
                </p>
              </div>
              <div>
                <label className="label">Version name</label>
                <input
                  className="input"
                  placeholder="e.g. 1.1.0"
                  value={form.versionName}
                  onChange={(e) => setForm({ ...form, versionName: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Download URL (APK)</label>
              <input
                className="input"
                placeholder="https://... (Codemagic artifact or GitHub release link)"
                value={form.downloadUrl}
                onChange={(e) => setForm({ ...form, downloadUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Release notes (optional)</label>
              <textarea
                className="input min-h-20"
                placeholder="What changed in this build…"
                value={form.releaseNotes}
                onChange={(e) => setForm({ ...form, releaseNotes: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.mandatory}
                onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
              />
              Mandatory: Sheikhs must update before continuing
            </label>
            <button
              className="btn-primary w-full"
              onClick={publish}
              disabled={saving || !form.versionCode || !form.versionName || !form.downloadUrl}
            >
              {saving ? 'Publishing…' : 'Publish release'}
            </button>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Currently published</h2>
          {!release ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              No release published yet, so every installed app is treated as current.
            </p>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt style={{ color: 'var(--muted)' }}>Version</dt>
                <dd className="font-medium">
                  {release.versionName} (build {release.versionCode})
                </dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: 'var(--muted)' }}>Mandatory</dt>
                <dd className="font-medium">{release.mandatory ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between">
                <dt style={{ color: 'var(--muted)' }}>Published</dt>
                <dd className="font-medium">{new Date(release.updatedAt).toLocaleString()}</dd>
              </div>
              {release.releaseNotes && (
                <div>
                  <dt className="mb-1" style={{ color: 'var(--muted)' }}>
                    Notes
                  </dt>
                  <dd>{release.releaseNotes}</dd>
                </div>
              )}
            </dl>
          )}
          <div className="mt-4 rounded-lg border p-3 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
            Sheikhs get a prompt (or a required update if marked mandatory) the next time they open
            the app. Installing the new APK over the old one keeps their data and login, with no
            uninstall needed, since it's signed with the same key.
          </div>
        </div>
      </div>
    </div>
  );
}
