import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/theme.dart';
import '../models/models.dart';
import '../state/providers.dart';
import 'widgets.dart';

const _grades = ['EXCELLENT', 'VERY_GOOD', 'GOOD', 'FAIR', 'POOR'];
const _mistakeTypes = ['TAJWEED', 'MEMORIZATION', 'PRONUNCIATION'];

/// Quick presets for the memorization fraction picker — matches the web app's
/// options so a Sheikh sees the same scale on both.
const _fractionPresets = [
  (value: 0.0, label: 'Not started'),
  (value: 0.25, label: '¼ — just begun'),
  (value: 0.5, label: '½ — halfway'),
  (value: 0.75, label: '¾ — nearly done'),
  (value: 1.0, label: 'Memorized'),
];

Color gradeColor(String g) => switch (g) {
      'EXCELLENT' => Brand.excellent,
      'VERY_GOOD' => Brand.veryGood,
      'GOOD' => Brand.good,
      'FAIR' => Brand.fair,
      _ => Brand.poor,
    };

class StudentDetailScreen extends ConsumerStatefulWidget {
  final String studentId;
  const StudentDetailScreen({super.key, required this.studentId});

  @override
  ConsumerState<StudentDetailScreen> createState() => _StudentDetailScreenState();
}

class _StudentDetailScreenState extends ConsumerState<StudentDetailScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 5, vsync: this);

  /// Optimistic local view of memorization fractions; the outbox carries the writes.
  Map<String, double>? _fractions;

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(bootstrapProvider);

    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(appBar: AppBar(), body: ErrorState(error: e)),
      data: (b) {
        Student? student;
        for (final s in b?.students ?? const <Student>[]) {
          if (s.id == widget.studentId) {
            student = s;
            break;
          }
        }
        if (b == null || student == null) {
          return Scaffold(
            appBar: AppBar(),
            body: const EmptyState(icon: Icons.person_off_outlined, title: 'Student not found'),
          );
        }
        _fractions ??= {...student.surahFractions};

        return Scaffold(
          appBar: AppBar(
            title: Text(student.fullName, overflow: TextOverflow.ellipsis),
            bottom: TabBar(
              controller: _tabs,
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              tabs: const [
                Tab(text: 'Memorization'),
                Tab(text: 'Revision'),
                Tab(text: 'Assessment'),
                Tab(text: 'Mistakes'),
                Tab(text: 'Remarks'),
              ],
            ),
          ),
          body: Column(
            children: [
              const SyncBanner(),
              _Header(
                student: student,
                target: b.target,
                memorizedFraction: _fractions!.values.fold(0.0, (a, b) => a + b),
              ),
              Expanded(
                child: TabBarView(
                  controller: _tabs,
                  children: [
                    _MemorizationTab(
                      student: student,
                      surahs: b.surahs,
                      fractions: _fractions!,
                      onSetFraction: _setFraction,
                    ),
                    _RevisionTab(student: student, surahs: b.surahs),
                    _AssessmentTab(student: student),
                    _MistakesTab(student: student, surahs: b.surahs),
                    _RemarksTab(student: student),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _setFraction(Student student, Surah surah, double value) async {
    setState(() {
      if (value <= 0) {
        _fractions!.remove(surah.id);
      } else {
        _fractions![surah.id] = value;
      }
    });

    await ref.read(repositoryProvider).setMemorization(
          studentId: student.id,
          surahId: surah.id,
          fraction: value,
        );

    if (mounted) {
      final pct = (value * 100).round();
      showSnack(context, value <= 0 ? '${surah.name} unmarked' : '${surah.name} set to $pct%');
    }
  }
}

class _Header extends StatelessWidget {
  final Student student;
  final int target;
  final double memorizedFraction;

  const _Header({required this.student, required this.target, required this.memorizedFraction});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final percent = target == 0 ? 0.0 : (memorizedFraction / target) * 100;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLowest,
        border: Border(bottom: BorderSide(color: scheme.outlineVariant)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('${student.level} · ${student.schoolCode} · Adm ${student.admissionNo}',
                    style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
              ),
              if (student.enrollmentStatus != EnrollmentStatus.approved) _EnrollmentBadge(student.enrollmentStatus),
            ],
          ),
          if (student.guardianName != null) ...[
            const SizedBox(height: 2),
            Text('Guardian: ${student.guardianName}${student.guardianPhone != null ? ' · ${student.guardianPhone}' : ''}',
                style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: ProgressBar(percent: percent)),
              const SizedBox(width: 12),
              Text('${memorizedFraction.toStringAsFixed(0)}/$target  ·  ${percent.toStringAsFixed(0)}%',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            ],
          ),
        ],
      ),
    );
  }
}

class _EnrollmentBadge extends StatelessWidget {
  final EnrollmentStatus status;
  const _EnrollmentBadge(this.status);

  @override
  Widget build(BuildContext context) {
    final pending = status == EnrollmentStatus.pending;
    final color = pending ? Brand.fair : Brand.poor;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(20)),
      child: Text(
        pending ? 'Awaiting verification' : 'Rejected',
        style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}

// ---------------- Memorization ----------------

class _MemorizationTab extends StatelessWidget {
  final Student student;
  final List<Surah> surahs;
  final Map<String, double> fractions;
  final Future<void> Function(Student, Surah, double) onSetFraction;

  const _MemorizationTab({
    required this.student,
    required this.surahs,
    required this.fractions,
    required this.onSetFraction,
  });

  @override
  Widget build(BuildContext context) {
    // Group by juz so the teacher sees the same structure as the paper sheet.
    final byJuz = <int, List<Surah>>{};
    for (final s in surahs) {
      byJuz.putIfAbsent(s.juz, () => []).add(s);
    }
    final juzKeys = byJuz.keys.toList()..sort();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        Text('Tap a surah to set progress',
            style: TextStyle(fontSize: 12.5, color: Theme.of(context).colorScheme.onSurfaceVariant)),
        const SizedBox(height: 14),
        for (final juz in juzKeys) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 8, top: 6),
            child: Text('Juz $juz',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final s in byJuz[juz]!)
                _SurahChip(
                  surah: s,
                  fraction: fractions[s.id] ?? 0,
                  onTap: () => _openPicker(context, s),
                ),
            ],
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }

  Future<void> _openPicker(BuildContext context, Surah surah) async {
    final current = fractions[surah.id] ?? 0;
    final picked = await showModalBottomSheet<double>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text('${surah.number}. ${surah.name}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  ),
                ],
              ),
            ),
            for (final p in _fractionPresets)
              ListTile(
                leading: SizedBox(
                  width: 22,
                  height: 22,
                  child: p.value >= 1
                      ? const CircleAvatar(backgroundColor: Brand.emerald, child: Icon(Icons.check, size: 14, color: Colors.white))
                      : p.value > 0
                          ? CircleAvatar(
                              backgroundColor: Colors.orange,
                              child: Text('${(p.value * 100).round()}', style: const TextStyle(fontSize: 8, color: Colors.white, fontWeight: FontWeight.bold)),
                            )
                          : CircleAvatar(backgroundColor: Colors.transparent, child: Icon(Icons.circle_outlined, size: 16, color: Theme.of(ctx).colorScheme.outline)),
                ),
                title: Text(p.label),
                trailing: (current - p.value).abs() < 0.01 ? const Icon(Icons.check_rounded, color: Brand.emerald) : null,
                onTap: () => Navigator.pop(ctx, p.value),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (picked != null) await onSetFraction(student, surah, picked);
  }
}

class _SurahChip extends StatelessWidget {
  final Surah surah;
  final double fraction;
  final VoidCallback onTap;

  const _SurahChip({required this.surah, required this.fraction, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final done = fraction >= 1;
    final partial = fraction > 0 && fraction < 1;
    final color = done ? Brand.emerald : (partial ? Colors.orange : null);

    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: color ?? scheme.surfaceContainerHighest.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color ?? scheme.outlineVariant),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (done) ...[
              const Icon(Icons.check_rounded, size: 15, color: Colors.white),
              const SizedBox(width: 5),
            ] else if (partial) ...[
              Text('${(fraction * 100).round()}%',
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(width: 5),
            ],
            Text(
              '${surah.number}. ${surah.name}',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: color != null ? FontWeight.w600 : FontWeight.normal,
                color: color != null ? Colors.white : scheme.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------- shared record list (with edit / delete / unlock) ----------------

/// One row's action cluster: a Sheikh may edit/delete their own entry for 24h;
/// after that only the secretariat can, unless they unlock it. Mirrors the web
/// app's RecordActions component.
class _RecordActions extends StatelessWidget {
  final bool canEdit;
  final bool canManage;
  final VoidCallback? onEdit;
  final VoidCallback onDelete;
  final VoidCallback onUnlock;

  const _RecordActions({
    required this.canEdit,
    required this.canManage,
    this.onEdit,
    required this.onDelete,
    required this.onUnlock,
  });

  @override
  Widget build(BuildContext context) {
    if (!canEdit && !canManage) {
      return Tooltip(
        message: 'Locked after 24h — ask the manager to unlock it',
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.lock_outline_rounded, size: 13, color: Theme.of(context).colorScheme.onSurfaceVariant),
            const SizedBox(width: 3),
            Text('Locked', style: TextStyle(fontSize: 10.5, color: Theme.of(context).colorScheme.onSurfaceVariant)),
          ],
        ),
      );
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (canEdit && onEdit != null)
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.edit_outlined, size: 17),
            onPressed: onEdit,
          ),
        if (canEdit)
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.delete_outline_rounded, size: 17, color: Brand.poor),
            onPressed: onDelete,
          ),
        if (canManage && !canEdit)
          IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.lock_open_rounded, size: 17),
            tooltip: 'Unlock for the Sheikh (24h)',
            onPressed: onUnlock,
          ),
      ],
    );
  }
}

Future<bool> _confirmDelete(BuildContext context, String what) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text('Delete this $what?'),
      content: const Text('This cannot be undone.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: Brand.poor),
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('Delete'),
        ),
      ],
    ),
  );
  return ok == true;
}

class _RecordList extends ConsumerWidget {
  final Future<List<RecordEntry>> future;
  final String emptyText;
  final Widget Function(RecordEntry)? leading;
  final void Function(RecordEntry) onEdit;
  final Future<void> Function(RecordEntry) onDelete;
  final Future<void> Function(RecordEntry) onUnlock;

  const _RecordList({
    required this.future,
    required this.emptyText,
    this.leading,
    required this.onEdit,
    required this.onDelete,
    required this.onUnlock,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canManage = (ref.watch(authProvider) is AuthSignedIn)
        ? (ref.watch(authProvider) as AuthSignedIn).user.isAdmin
        : false;

    return FutureBuilder<List<RecordEntry>>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) return const ListSkeleton(count: 4);
        final items = snap.data ?? const <RecordEntry>[];
        if (items.isEmpty) {
          return EmptyState(icon: Icons.inbox_outlined, title: emptyText);
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: items.length,
          separatorBuilder: (_, _) => const Divider(height: 16),
          itemBuilder: (_, i) {
            final e = items[i];
            return ListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              leading: leading?.call(e),
              title: Text(e.label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
              subtitle: e.detail == null ? null : Text(e.detail!, style: const TextStyle(fontSize: 12)),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(DateFormat('d MMM').format(e.date),
                      style: TextStyle(fontSize: 11.5, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                  const SizedBox(width: 6),
                  _RecordActions(
                    canEdit: e.canEdit,
                    canManage: canManage,
                    onEdit: () => onEdit(e),
                    onDelete: () async {
                      if (await _confirmDelete(context, 'entry')) await onDelete(e);
                    },
                    onUnlock: () => onUnlock(e),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

/// Wraps a record list with an "Add" FAB that opens a bottom sheet.
class _RecordTab extends ConsumerStatefulWidget {
  final Future<List<RecordEntry>> Function() load;
  final String emptyText;
  final String addLabel;
  final Future<bool> Function(BuildContext, {RecordEntry? editing}) onAdd;
  final Future<void> Function(RecordEntry) onDelete;
  final Future<void> Function(RecordEntry) onUnlock;
  final Widget Function(RecordEntry)? leading;

  const _RecordTab({
    required this.load,
    required this.emptyText,
    required this.addLabel,
    required this.onAdd,
    required this.onDelete,
    required this.onUnlock,
    this.leading,
  });

  @override
  ConsumerState<_RecordTab> createState() => _RecordTabState();
}

class _RecordTabState extends ConsumerState<_RecordTab> {
  late Future<List<RecordEntry>> _future = widget.load();

  void _reload() => setState(() => _future = widget.load());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: _RecordList(
        future: _future,
        emptyText: widget.emptyText,
        leading: widget.leading,
        onEdit: (e) async {
          final saved = await widget.onAdd(context, editing: e);
          if (saved) _reload();
        },
        onDelete: (e) async {
          try {
            await widget.onDelete(e);
            if (mounted) showSnack(context, 'Deleted');
          } catch (err) {
            if (mounted) showSnack(context, '$err', error: true);
          } finally {
            _reload();
          }
        },
        onUnlock: (e) async {
          try {
            await widget.onUnlock(e);
            if (mounted) showSnack(context, 'Unlocked for the Sheikh for 24 hours');
          } catch (err) {
            if (mounted) showSnack(context, '$err', error: true);
          } finally {
            _reload();
          }
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final added = await widget.onAdd(context);
          if (added) _reload();
        },
        icon: const Icon(Icons.add_rounded),
        label: Text(widget.addLabel),
      ),
    );
  }
}

// ---------------- Revision ----------------

class _RevisionTab extends ConsumerWidget {
  final Student student;
  final List<Surah> surahs;
  const _RevisionTab({required this.student, required this.surahs});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.watch(repositoryProvider);
    return _RecordTab(
      load: () => repo.revisions(student.id),
      emptyText: 'No revision recorded yet',
      addLabel: 'Record revision',
      onAdd: (ctx, {editing}) => _sheet(ctx, ref, editing: editing),
      onDelete: (e) => repo.removeRevision(e.id),
      onUnlock: (e) => repo.unlockRevision(e.id),
    );
  }

  Future<bool> _sheet(BuildContext context, WidgetRef ref, {RecordEntry? editing}) async {
    Surah? surah;
    int? score = editing != null ? int.tryParse((editing.detail ?? '').split('/').first) : null;
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _SheetScaffold(
        title: editing == null ? 'Record revision' : 'Edit revision',
        onSave: () async {
          if (editing == null) {
            await ref.read(repositoryProvider).addRevision(
                  studentId: student.id,
                  surahId: surah?.id,
                  performanceScore: score,
                );
          } else {
            await ref.read(repositoryProvider).updateRevision(editing.id, performanceScore: score);
          }
          if (ctx.mounted) Navigator.pop(ctx, true);
        },
        builder: (setSheetState) => [
          if (editing == null)
            _SurahPicker(
              surahs: surahs,
              selected: surah,
              onChanged: (s) => setSheetState(() => surah = s),
            ),
          if (editing == null) const SizedBox(height: 16),
          _ScoreField(initial: score, onChanged: (v) => score = v),
        ],
      ),
    );
    if (result == true && context.mounted) showSnack(context, editing == null ? 'Revision saved' : 'Revision updated');
    return result == true;
  }
}

// ---------------- Assessment ----------------

class _AssessmentTab extends ConsumerWidget {
  final Student student;
  const _AssessmentTab({required this.student});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.watch(repositoryProvider);
    return _RecordTab(
      load: () => repo.assessments(student.id),
      emptyText: 'No assessments yet',
      addLabel: 'Assess',
      leading: (e) => CircleAvatar(
        radius: 5,
        backgroundColor: gradeColor(e.label.replaceAll(' ', '_')),
      ),
      onAdd: (ctx, {editing}) => _sheet(ctx, ref, editing: editing),
      onDelete: (e) => repo.removeAssessment(e.id),
      onUnlock: (e) => repo.unlockAssessment(e.id),
    );
  }

  Future<bool> _sheet(BuildContext context, WidgetRef ref, {RecordEntry? editing}) async {
    String grade = editing != null ? editing.label.replaceAll(' ', '_') : _grades.first;
    int? score = editing != null ? int.tryParse((editing.detail ?? '').split('/').first) : null;
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _SheetScaffold(
        title: editing == null ? 'Daily assessment' : 'Edit assessment',
        onSave: () async {
          if (editing == null) {
            await ref.read(repositoryProvider).addAssessment(studentId: student.id, grade: grade, score: score);
          } else {
            await ref.read(repositoryProvider).updateAssessment(editing.id, grade: grade, score: score);
          }
          if (ctx.mounted) Navigator.pop(ctx, true);
        },
        builder: (setSheetState) => [
          const Text('Grade', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final g in _grades)
                ChoiceChip(
                  label: Text(g.replaceAll('_', ' '), style: const TextStyle(fontSize: 12)),
                  selected: grade == g,
                  selectedColor: gradeColor(g),
                  labelStyle: TextStyle(color: grade == g ? Colors.white : null),
                  onSelected: (_) => setSheetState(() => grade = g),
                ),
            ],
          ),
          const SizedBox(height: 18),
          _ScoreField(initial: score, onChanged: (v) => score = v),
        ],
      ),
    );
    if (result == true && context.mounted) showSnack(context, editing == null ? 'Assessment saved' : 'Assessment updated');
    return result == true;
  }
}

// ---------------- Mistakes ----------------

class _MistakesTab extends ConsumerWidget {
  final Student student;
  final List<Surah> surahs;
  const _MistakesTab({required this.student, required this.surahs});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.watch(repositoryProvider);
    return _RecordTab(
      load: () => repo.mistakes(student.id),
      emptyText: 'No mistakes recorded',
      addLabel: 'Record mistake',
      leading: (_) => const Icon(Icons.warning_amber_rounded, size: 18, color: Brand.fair),
      onAdd: (ctx, {editing}) => _sheet(ctx, ref, editing: editing),
      onDelete: (e) => repo.removeMistake(e.id),
      onUnlock: (e) => repo.unlockMistake(e.id),
    );
  }

  Future<bool> _sheet(BuildContext context, WidgetRef ref, {RecordEntry? editing}) async {
    String type = editing != null ? editing.label : _mistakeTypes.first;
    int count = editing != null ? (int.tryParse(RegExp(r'×(\d+)').firstMatch(editing.detail ?? '')?.group(1) ?? '1') ?? 1) : 1;
    Surah? surah;
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _SheetScaffold(
        title: editing == null ? 'Record mistake' : 'Edit mistake',
        onSave: () async {
          if (editing == null) {
            await ref.read(repositoryProvider).addMistake(
                  studentId: student.id,
                  type: type,
                  count: count,
                  surahId: surah?.id,
                );
          } else {
            await ref.read(repositoryProvider).updateMistake(editing.id, type: type, count: count);
          }
          if (ctx.mounted) Navigator.pop(ctx, true);
        },
        builder: (setSheetState) => [
          const Text('Type', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            children: [
              for (final t in _mistakeTypes)
                ChoiceChip(
                  label: Text(t, style: const TextStyle(fontSize: 12)),
                  selected: type == t,
                  onSelected: (_) => setSheetState(() => type = t),
                ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              const Text('Count', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const Spacer(),
              IconButton.filledTonal(
                onPressed: count > 1 ? () => setSheetState(() => count--) : null,
                icon: const Icon(Icons.remove_rounded, size: 18),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Text('$count', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
              ),
              IconButton.filledTonal(
                onPressed: () => setSheetState(() => count++),
                icon: const Icon(Icons.add_rounded, size: 18),
              ),
            ],
          ),
          if (editing == null) ...[
            const SizedBox(height: 16),
            _SurahPicker(
              surahs: surahs,
              selected: surah,
              onChanged: (s) => setSheetState(() => surah = s),
            ),
          ],
        ],
      ),
    );
    if (result == true && context.mounted) showSnack(context, editing == null ? 'Mistake recorded' : 'Mistake updated');
    return result == true;
  }
}

// ---------------- Remarks ----------------

class _RemarksTab extends ConsumerWidget {
  final Student student;
  const _RemarksTab({required this.student});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repo = ref.watch(repositoryProvider);
    return _RecordTab(
      load: () => repo.remarks(student.id),
      emptyText: 'No remarks yet',
      addLabel: 'Add remark',
      leading: (_) => const Icon(Icons.chat_bubble_outline_rounded, size: 18),
      onAdd: (ctx, {editing}) => _sheet(ctx, ref, editing: editing),
      onDelete: (e) => repo.removeRemark(e.id),
      onUnlock: (e) => repo.unlockRemark(e.id),
    );
  }

  Future<bool> _sheet(BuildContext context, WidgetRef ref, {RecordEntry? editing}) async {
    final controller = TextEditingController(text: editing?.label ?? '');
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _SheetScaffold(
        title: editing == null ? 'Teacher remark' : 'Edit remark',
        onSave: () async {
          final text = controller.text.trim();
          if (text.isEmpty) return;
          if (editing == null) {
            await ref.read(repositoryProvider).addRemark(studentId: student.id, body: text);
          } else {
            await ref.read(repositoryProvider).updateRemark(editing.id, text);
          }
          if (ctx.mounted) Navigator.pop(ctx, true);
        },
        builder: (_) => [
          TextField(
            controller: controller,
            maxLines: 4,
            autofocus: true,
            decoration: const InputDecoration(
              hintText: 'e.g. Needs more revision on Juz 30.',
            ),
          ),
        ],
      ),
    );
    controller.dispose();
    if (result == true && context.mounted) showSnack(context, editing == null ? 'Remark added' : 'Remark updated');
    return result == true;
  }
}

// ---------------- sheet building blocks ----------------

class _SheetScaffold extends StatefulWidget {
  final String title;
  final Future<void> Function() onSave;
  final List<Widget> Function(void Function(VoidCallback)) builder;

  const _SheetScaffold({required this.title, required this.onSave, required this.builder});

  @override
  State<_SheetScaffold> createState() => _SheetScaffoldState();
}

class _SheetScaffoldState extends State<_SheetScaffold> {
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(widget.title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
            const SizedBox(height: 18),
            ...widget.builder(setState),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving
                  ? null
                  : () async {
                      setState(() => _saving = true);
                      try {
                        await widget.onSave();
                      } finally {
                        if (mounted) setState(() => _saving = false);
                      }
                    },
              child: _saving
                  ? const SizedBox(
                      height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
                  : const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SurahPicker extends StatelessWidget {
  final List<Surah> surahs;
  final Surah? selected;
  final ValueChanged<Surah?> onChanged;

  const _SurahPicker({required this.surahs, required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<Surah?>(
      initialValue: selected,
      isExpanded: true,
      decoration: const InputDecoration(labelText: 'Surah (optional)', isDense: true),
      items: [
        const DropdownMenuItem<Surah?>(value: null, child: Text('— None —')),
        for (final s in surahs)
          DropdownMenuItem<Surah?>(value: s, child: Text('${s.number}. ${s.name}')),
      ],
      onChanged: onChanged,
    );
  }
}

class _ScoreField extends StatelessWidget {
  final int? initial;
  final ValueChanged<int?> onChanged;
  const _ScoreField({this.initial, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: TextEditingController(text: initial?.toString() ?? ''),
      keyboardType: TextInputType.number,
      decoration: const InputDecoration(labelText: 'Score out of 100 (optional)', isDense: true),
      onChanged: (v) {
        final n = int.tryParse(v);
        onChanged(n != null && n >= 0 && n <= 100 ? n : null);
      },
    );
  }
}
