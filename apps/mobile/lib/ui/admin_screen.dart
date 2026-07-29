import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme.dart';
import '../models/models.dart';
import '../state/providers.dart';
import 'widgets.dart';

/// The secretariat's own screen.
///
/// Everything else in the app is shaped around a Shk or Shkt recording their
/// own roster. An admin signing in got that same screen with more rows in it
/// and nothing they could actually act on, so the two jobs a manager plausibly
/// does away from a desk live here: clearing the verification queue, and
/// getting word out.
class AdminScreen extends ConsumerStatefulWidget {
  const AdminScreen({super.key});

  @override
  ConsumerState<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends ConsumerState<AdminScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Secretariat'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Verify'),
            Tab(text: 'Performance'),
            Tab(text: 'Announce'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: const [_PendingTab(), _PerformanceTab(), _AnnounceTab()],
      ),
    );
  }
}

// ---------------- verification queue ----------------

class _PendingTab extends ConsumerStatefulWidget {
  const _PendingTab();

  @override
  ConsumerState<_PendingTab> createState() => _PendingTabState();
}

class _PendingTabState extends ConsumerState<_PendingTab> {
  late Future<List<PendingPupil>> _future = _load();

  Future<List<PendingPupil>> _load() => ref.read(repositoryProvider).pendingEnrolments();

  void _reload() {
    if (!mounted) return;
    setState(() => _future = _load());
  }

  Future<void> _approve(PendingPupil p) async {
    try {
      await ref.read(repositoryProvider).approvePupil(p.id);
      if (mounted) showSnack(context, '${p.fullName} verified');
    } catch (e) {
      if (mounted) showSnack(context, '$e', error: true);
    }
    _reload();
  }

  Future<void> _reject(PendingPupil p) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final controller = TextEditingController();
        return AlertDialog(
          title: Text('Reject ${p.fullName}?'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'The record is kept so whoever registered them can see why, but it '
                'will not join the official roster.',
                style: TextStyle(fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                decoration: const InputDecoration(labelText: 'Reason (optional)'),
                autofocus: true,
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: Brand.poor),
              onPressed: () => Navigator.pop(ctx, controller.text.trim()),
              child: const Text('Reject'),
            ),
          ],
        );
      },
    );
    if (reason == null) return; // cancelled

    try {
      await ref.read(repositoryProvider).rejectPupil(p.id, reason: reason.isEmpty ? null : reason);
      if (mounted) showSnack(context, '${p.fullName} rejected');
    } catch (e) {
      if (mounted) showSnack(context, '$e', error: true);
    }
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<PendingPupil>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) return const ListSkeleton(count: 4);
        if (snap.hasError) return ErrorState(error: snap.error!);

        final items = snap.data ?? const <PendingPupil>[];
        if (items.isEmpty) {
          return RefreshIndicator(
            onRefresh: () async => _reload(),
            child: ListView(
              children: const [
                SizedBox(height: 80),
                EmptyState(
                  icon: Icons.verified_outlined,
                  title: 'Nothing waiting',
                  subtitle: 'Pupils registered by a Shk or Shkt appear here for verification.',
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (_, i) {
              final p = items[i];
              return Card(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 8, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(p.fullName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                      const SizedBox(height: 2),
                      Text(
                        [
                          'Adm ${p.admissionNo}',
                          if (p.level != null) p.level!,
                          if (p.schoolCode != null) p.schoolCode!,
                        ].join(' · '),
                        style: TextStyle(
                          fontSize: 12,
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                      if (p.registeredBy != null)
                        Text(
                          'Registered by ${p.registeredBy}',
                          style: TextStyle(
                            fontSize: 12,
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                        ),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                            onPressed: () => _reject(p),
                            style: TextButton.styleFrom(foregroundColor: Brand.poor),
                            child: const Text('Reject'),
                          ),
                          const SizedBox(width: 4),
                          FilledButton(
                            onPressed: () => _approve(p),
                            child: const Text('Verify'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

// ---------------- announcements ----------------

const _types = ['ANNOUNCEMENT', 'REMINDER', 'INFO', 'ACHIEVEMENT', 'ALERT'];

String _typeLabel(String t) => t[0] + t.substring(1).toLowerCase();

class _AnnounceTab extends ConsumerStatefulWidget {
  const _AnnounceTab();

  @override
  ConsumerState<_AnnounceTab> createState() => _AnnounceTabState();
}

class _AnnounceTabState extends ConsumerState<_AnnounceTab> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  String _type = 'ANNOUNCEMENT';
  String? _schoolId;
  bool _sending = false;
  List<SchoolOption> _schools = const [];

  @override
  void initState() {
    super.initState();
    // Offline or a stale token: the school picker just stays on "All schools",
    // which is a usable default rather than a blocked screen.
    ref.read(repositoryProvider).schools().then((s) {
      if (mounted) setState(() => _schools = s);
    }).onError((_, _) {});
  }

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final title = _title.text.trim();
    final body = _body.text.trim();
    if (title.isEmpty || body.isEmpty) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Send this announcement?'),
        content: Text(
          _schoolId == null
              ? 'It goes to everyone in the organisation and cannot be recalled.'
              : 'It goes to everyone at the selected school and cannot be recalled.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Send')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _sending = true);
    try {
      final n = await ref.read(repositoryProvider).sendAnnouncement(
            title: title,
            body: body,
            type: _type,
            schoolId: _schoolId,
          );
      if (mounted) {
        showSnack(context, n == 0 ? 'Nobody matched that audience' : 'Sent to $n ${n == 1 ? 'person' : 'people'}');
        _title.clear();
        _body.clear();
      }
    } catch (e) {
      if (mounted) showSnack(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: _title,
          maxLength: 120,
          decoration: const InputDecoration(labelText: 'Title', hintText: 'e.g. Staff meeting on Friday'),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _body,
          maxLength: 2000,
          maxLines: 5,
          decoration: const InputDecoration(
            labelText: 'Message',
            hintText: 'What do they need to know?',
            alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: _type,
          decoration: const InputDecoration(labelText: 'Type'),
          items: _types
              .map((t) => DropdownMenuItem(value: t, child: Text(_typeLabel(t))))
              .toList(),
          onChanged: (v) => setState(() => _type = v ?? 'ANNOUNCEMENT'),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String?>(
          initialValue: _schoolId,
          decoration: const InputDecoration(labelText: 'Send to'),
          items: [
            const DropdownMenuItem<String?>(value: null, child: Text('All schools')),
            ..._schools.map((s) => DropdownMenuItem<String?>(value: s.id, child: Text('${s.code} · ${s.name}'))),
          ],
          onChanged: (v) => setState(() => _schoolId = v),
        ),
        const SizedBox(height: 20),
        FilledButton.icon(
          onPressed: _sending ? null : _send,
          icon: _sending
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2))
              : const Icon(Icons.campaign_rounded),
          label: Text(_sending ? 'Sending...' : 'Send announcement'),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
        ),
        const SizedBox(height: 12),
        Text(
          'It appears in their notifications and, if push is set up, pops up on '
          'their phone even when the app is closed.',
          style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
      ],
    );
  }
}


// ---------------- Shk / Shkt performance ----------------

/// How each Shk and Shkt's roster is doing, ranked by average progress.
/// The secretariat's view of their staff, which is a different question from
/// the progress screens a Shk sees for their own pupils.
class _PerformanceTab extends ConsumerStatefulWidget {
  const _PerformanceTab();

  @override
  ConsumerState<_PerformanceTab> createState() => _PerformanceTabState();
}

class _PerformanceTabState extends ConsumerState<_PerformanceTab> {
  late Future<List<StaffRanking>> _future = ref.read(repositoryProvider).staffRanking();

  void _reload() {
    if (!mounted) return;
    setState(() => _future = ref.read(repositoryProvider).staffRanking());
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<StaffRanking>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) return const ListSkeleton(count: 5);
        if (snap.hasError) return ErrorState(error: snap.error!, onRetry: _reload);

        final rows = snap.data ?? const <StaffRanking>[];
        if (rows.isEmpty) {
          return const EmptyState(
            icon: Icons.leaderboard_outlined,
            title: 'Nothing to rank yet',
            subtitle: 'Averages appear once pupils are assigned and progress recorded.',
          );
        }

        final best = rows.first.avgPercent;
        return RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: rows.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final r = rows[i];
              final scheme = Theme.of(context).colorScheme;
              return Card(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  child: Row(
                    children: [
                      // Rank, not a medal: this is a management view, and the
                      // ordering is the point rather than a competition.
                      SizedBox(
                        width: 26,
                        child: Text(
                          '${i + 1}',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                            color: i == 0 ? Brand.emerald : scheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(r.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                            const SizedBox(height: 2),
                            Text(
                              [
                                '${r.pupils} pupil${r.pupils == 1 ? '' : 's'}',
                                if (r.avgScore != null) 'avg score ${r.avgScore}',
                              ].join(' · '),
                              style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
                            ),
                            const SizedBox(height: 6),
                            // Scaled against the leader so the spread is legible
                            // even when every average is low early in a term.
                            ProgressBar(percent: best == 0 ? 0 : (r.avgPercent / best) * 100),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        '${r.avgPercent.toStringAsFixed(1)}%',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}
