import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme.dart';
import '../models/models.dart';
import '../state/providers.dart';
import 'register_student_screen.dart';
import 'student_detail_screen.dart';
import 'widgets.dart';

class StudentsScreen extends ConsumerStatefulWidget {
  const StudentsScreen({super.key});

  @override
  ConsumerState<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends ConsumerState<StudentsScreen> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(bootstrapProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My students'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_alt_1_rounded),
            tooltip: 'Register pupil',
            onPressed: () => _openRegister(context, async.value?.classes ?? const []),
          ),
        ],
      ),
      body: Column(
        children: [
          const SyncBanner(),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _search,
              onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
              decoration: InputDecoration(
                hintText: 'Search by name or admission no.',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () {
                          _search.clear();
                          setState(() => _query = '');
                        },
                      ),
                isDense: true,
              ),
            ),
          ),
          Expanded(
            child: async.when(
              loading: () => const ListSkeleton(),
              error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(bootstrapProvider)),
              data: (b) {
                if (b == null || b.students.isEmpty) {
                  return const EmptyState(
                    icon: Icons.groups_outlined,
                    title: 'No students',
                    subtitle: 'Students assigned to you will appear here.',
                  );
                }
                final list = b.students.where((s) {
                  if (_query.isEmpty) return true;
                  return s.fullName.toLowerCase().contains(_query) ||
                      s.admissionNo.toLowerCase().contains(_query);
                }).toList();

                if (list.isEmpty) {
                  return EmptyState(
                    icon: Icons.search_off_rounded,
                    title: 'No matches',
                    subtitle: 'Nothing found for "$_query".',
                  );
                }

                return RefreshIndicator(
                  onRefresh: () async {
                    await ref.read(repositoryProvider).bootstrap(forceRefresh: true);
                    ref.invalidate(bootstrapProvider);
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    itemCount: list.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _StudentCard(student: list[i], target: b.target),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openRegister(BuildContext context, List<SchoolClass> classes) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => RegisterStudentScreen(classes: classes)),
    );
    if (saved == true) {
      await ref.read(repositoryProvider).bootstrap(forceRefresh: true);
      ref.invalidate(bootstrapProvider);
    }
  }
}

class _StudentCard extends StatelessWidget {
  final Student student;
  final int target;

  const _StudentCard({required this.student, required this.target});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final initials = student.fullName
        .trim()
        .split(RegExp(r'\s+'))
        .take(2)
        .map((w) => w.isEmpty ? '' : w[0])
        .join()
        .toUpperCase();

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => StudentDetailScreen(studentId: student.id)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: scheme.primaryContainer,
                child: Text(initials,
                    style: TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 14, color: scheme.onPrimaryContainer)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(student.fullName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                        ),
                        if (student.enrollmentStatus != EnrollmentStatus.approved) ...[
                          const SizedBox(width: 6),
                          _StatusDot(student.enrollmentStatus),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text('${student.level} · ${student.admissionNo}',
                        style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
                    const SizedBox(height: 8),
                    ProgressBar(percent: student.percent, height: 6),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('${student.percent.toStringAsFixed(0)}%',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  Text('${student.memorized}/$target',
                      style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  final EnrollmentStatus status;
  const _StatusDot(this.status);

  @override
  Widget build(BuildContext context) {
    final pending = status == EnrollmentStatus.pending;
    final color = pending ? Brand.fair : Brand.poor;
    return Tooltip(
      message: pending ? 'Awaiting verification' : 'Rejected by the secretariat',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(20)),
        child: Text(
          pending ? 'Pending' : 'Rejected',
          style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: color),
        ),
      ),
    );
  }
}
