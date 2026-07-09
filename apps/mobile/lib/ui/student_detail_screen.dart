import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/theme.dart';
import '../models/models.dart';
import '../state/providers.dart';
import 'widgets.dart';

const _grades = ['EXCELLENT', 'VERY_GOOD', 'GOOD', 'FAIR', 'POOR'];
const _mistakeTypes = ['TAJWEED', 'MEMORIZATION', 'PRONUNCIATION'];

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

  /// Optimistic local view of memorized surahs; the outbox carries the writes.
  Set<String>? _memorized;

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
        _memorized ??= {...student.memorizedSurahIds};

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
              _Header(student: student, target: b.target, memorized: _memorized!.length),
              Expanded(
                child: TabBarView(
                  controller: _tabs,
                  children: [
                    _MemorizationTab(
                      student: student,
                      surahs: b.surahs,
                      memorized: _memorized!,
                      onToggle: _toggleSurah,
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

  Future<void> _toggleSurah(Student student, Surah surah) async {
    final nowMemorized = !_memorized!.contains(surah.id);
    setState(() {
      nowMemorized ? _memorized!.add(surah.id) : _memorized!.remove(surah.id);
    });

    await ref.read(repositoryProvider).setMemorization(
          studentId: student.id,
          surahId: surah.id,
          memorized: nowMemorized,
        );

    if (mounted) {
      showSnack(context, nowMemorized ? '${surah.name} marked memorized' : '${surah.name} unmarked');
    }
  }
}

class _Header extends StatelessWidget {
  final Student student;
  final int target;
  final int memorized;

  const _Header({required this.student, required this.target, required this.memorized});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final percent = target == 0 ? 0.0 : (memorized / target) * 100;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLowest,
        border: Border(bottom: BorderSide(color: scheme.outlineVariant)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${student.level} · ${student.schoolCode} · Adm ${student.admissionNo}',
              style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
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
              Text('$memorized/$target  ·  ${percent.toStringAsFixed(0)}%',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------- Memorization ----------------

class _MemorizationTab extends StatelessWidget {
  final Student student;
  final List<Surah> surahs;
  final Set<String> memorized;
  final Future<void> Function(Student, Surah) onToggle;

  const _MemorizationTab({
    required this.student,
    required this.surahs,
    required this.memorized,
    required this.onToggle,
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
        Text('Tap a surah to mark it memorized',
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
                  selected: memorized.contains(s.id),
                  onTap: () => onToggle(student, s),
                ),
            ],
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _SurahChip extends StatelessWidget {
  final Surah surah;
  final bool selected;
  final VoidCallback onTap;

  const _SurahChip({required this.surah, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? Brand.emerald : scheme.surfaceContainerHighest.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected ? Brand.emerald : scheme.outlineVariant),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (selected) ...[
              const Icon(Icons.check_rounded, size: 15, color: Colors.white),
              const SizedBox(width: 5),
            ],
            Text(
              '${surah.number}. ${surah.name}',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                color: selected ? Colors.white : scheme.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------- shared record list ----------------

class _RecordList extends StatelessWidget {
  final Future<List<RecordEntry>> future;
  final String emptyText;
  final Widget Function(RecordEntry)? leading;

  const _RecordList({required this.future, required this.emptyText, this.leading});

  @override
  Widget build(BuildContext context) {
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
              trailing: Text(DateFormat('d MMM').format(e.date),
                  style: TextStyle(fontSize: 11.5, color: Theme.of(context).colorScheme.onSurfaceVariant)),
            );
          },
        );
      },
    );
  }
}

/// Wraps a record list with an "Add" FAB that opens a bottom sheet.
class _RecordTab extends StatefulWidget {
  final Future<List<RecordEntry>> Function() load;
  final String emptyText;
  final String addLabel;
  final Future<bool> Function(BuildContext) onAdd;
  final Widget Function(RecordEntry)? leading;

  const _RecordTab({
    required this.load,
    required this.emptyText,
    required this.addLabel,
    required this.onAdd,
    this.leading,
  });

  @override
  State<_RecordTab> createState() => _RecordTabState();
}

class _RecordTabState extends State<_RecordTab> {
  late Future<List<RecordEntry>> _future = widget.load();

  void _reload() => setState(() => _future = widget.load());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: _RecordList(future: _future, emptyText: widget.emptyText, leading: widget.leading),
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
      onAdd: (ctx) => _sheet(ctx, ref),
    );
  }

  Future<bool> _sheet(BuildContext context, WidgetRef ref) async {
    Surah? surah;
    int? score;
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _SheetScaffold(
        title: 'Record revision',
        onSave: () async {
          await ref.read(repositoryProvider).addRevision(
                studentId: student.id,
                surahId: surah?.id,
                performanceScore: score,
              );
          if (ctx.mounted) Navigator.pop(ctx, true);
        },
        builder: (setSheetState) => [
          _SurahPicker(
            surahs: surahs,
            selected: surah,
            onChanged: (s) => setSheetState(() => surah = s),
          ),
          const SizedBox(height: 16),
          _ScoreField(onChanged: (v) => score = v),
        ],
      ),
    );
    if (result == true && context.mounted) showSnack(context, 'Revision saved');
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
      onAdd: (ctx) => _sheet(ctx, ref),
    );
  }

  Future<bool> _sheet(BuildContext context, WidgetRef ref) async {
    String grade = _grades.first;
    int? score;
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _SheetScaffold(
        title: 'Daily assessment',
        onSave: () async {
          await ref.read(repositoryProvider).addAssessment(
                studentId: student.id,
                grade: grade,
                score: score,
              );
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
          _ScoreField(onChanged: (v) => score = v),
        ],
      ),
    );
    if (result == true && context.mounted) showSnack(context, 'Assessment saved');
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
      onAdd: (ctx) => _sheet(ctx, ref),
    );
  }

  Future<bool> _sheet(BuildContext context, WidgetRef ref) async {
    String type = _mistakeTypes.first;
    int count = 1;
    Surah? surah;
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _SheetScaffold(
        title: 'Record mistake',
        onSave: () async {
          await ref.read(repositoryProvider).addMistake(
                studentId: student.id,
                type: type,
                count: count,
                surahId: surah?.id,
              );
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
          const SizedBox(height: 16),
          _SurahPicker(
            surahs: surahs,
            selected: surah,
            onChanged: (s) => setSheetState(() => surah = s),
          ),
        ],
      ),
    );
    if (result == true && context.mounted) showSnack(context, 'Mistake recorded');
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
      onAdd: (ctx) => _sheet(ctx, ref),
    );
  }

  Future<bool> _sheet(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _SheetScaffold(
        title: 'Teacher remark',
        onSave: () async {
          final text = controller.text.trim();
          if (text.isEmpty) return;
          await ref.read(repositoryProvider).addRemark(studentId: student.id, body: text);
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
    if (result == true && context.mounted) showSnack(context, 'Remark added');
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
  final ValueChanged<int?> onChanged;
  const _ScoreField({required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return TextField(
      keyboardType: TextInputType.number,
      decoration: const InputDecoration(labelText: 'Score out of 100 (optional)', isDense: true),
      onChanged: (v) {
        final n = int.tryParse(v);
        onChanged(n != null && n >= 0 && n <= 100 ? n : null);
      },
    );
  }
}
