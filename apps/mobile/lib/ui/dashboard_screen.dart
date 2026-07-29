import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/theme.dart';
import '../models/models.dart';
import '../state/providers.dart';
import 'student_detail_screen.dart';
import 'widgets.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final name = auth is AuthSignedIn ? auth.user.fullName.split(' ').first : '';
    final async = ref.watch(bootstrapProvider);
    // "Shk NYOMBI". The secretariat carries no title, so they are greeted by
    // name alone rather than with an honorific they do not hold.
    final title = async.value?.title;
    final greeting = title == null || title.isEmpty ? name : '$title $name';

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'السلام عليكم',
              style: TextStyle(
                fontSize: 13,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.normal,
              ),
            ),
            Text(greeting, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
      body: Column(
        children: [
          const SyncBanner(),
          Expanded(
            child: async.when(
              loading: () => const ListSkeleton(),
              error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(bootstrapProvider)),
              data: (b) {
                if (b == null) {
                  return EmptyState(
                    icon: Icons.cloud_off_rounded,
                    title: 'No data yet',
                    subtitle: 'Connect to the internet once to download your pupils.',
                    action: OutlinedButton.icon(
                      onPressed: () => ref.invalidate(bootstrapProvider),
                      icon: const Icon(Icons.refresh_rounded, size: 18),
                      label: const Text('Retry'),
                    ),
                  );
                }
                return _Content(b);
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _Content extends ConsumerWidget {
  final Bootstrap b;
  const _Content(this.b);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final students = b.students;
    final avg = students.isEmpty
        ? 0.0
        : students.map((s) => s.percent).reduce((a, c) => a + c) / students.length;
    final onTrack = students.where((s) => s.percent >= 50).length;
    final behind = students.where((s) => s.percent < 25).length;

    final top = [...students]..sort((a, c) => c.memorized.compareTo(a.memorized));

    return RefreshIndicator(
      onRefresh: () async {
        await ref.read(repositoryProvider).bootstrap(forceRefresh: true);
        ref.invalidate(bootstrapProvider);
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(child: _Stat(label: 'Pupils', value: '${students.length}', icon: Icons.groups_rounded)),
              const SizedBox(width: 12),
              Expanded(child: _Stat(label: 'Avg. progress', value: '${avg.toStringAsFixed(1)}%', icon: Icons.trending_up_rounded)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _Stat(label: 'On track', value: '$onTrack', icon: Icons.check_circle_outline_rounded, color: Brand.emerald)),
              const SizedBox(width: 12),
              Expanded(child: _Stat(label: 'Needs help', value: '$behind', icon: Icons.priority_high_rounded, color: Brand.fair)),
            ],
          ),

          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Top pupils', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              Text('of ${b.target} surahs',
                  style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
            ],
          ),
          const SizedBox(height: 12),

          if (top.isEmpty)
            const EmptyState(icon: Icons.groups_outlined, title: 'No pupils assigned yet')
          else
            Card(
              child: Column(
                children: [
                  for (var i = 0; i < top.length && i < 5; i++) ...[
                    if (i > 0) const Divider(height: 1),
                    _StudentRow(student: top[i], rank: i + 1),
                  ],
                ],
              ),
            ),

          const SizedBox(height: 20),
          const _LastSynced(),
        ],
      ),
    );
  }
}

class _LastSynced extends ConsumerWidget {
  const _LastSynced();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder(
      future: ref.read(repositoryProvider).lastSyncedAt(),
      builder: (context, snap) {
        if (!snap.hasData || snap.data == null) return const SizedBox.shrink();
        final when = DateFormat('d MMM, HH:mm').format(snap.data!);
        return Center(
          child: Text('Last synced $when',
              style: TextStyle(fontSize: 11.5, color: Theme.of(context).colorScheme.onSurfaceVariant)),
        );
      },
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? color;

  const _Stat({required this.label, required this.value, required this.icon, this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.primary;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: c),
            const SizedBox(height: 10),
            Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            Text(label,
                style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }
}

class _StudentRow extends StatelessWidget {
  final Student student;
  final int rank;

  const _StudentRow({required this.student, required this.rank});

  @override
  Widget build(BuildContext context) {
    final medal = rank == 1 ? Brand.gold : Theme.of(context).colorScheme.surfaceContainerHighest;
    return ListTile(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => StudentDetailScreen(studentId: student.id)),
      ),
      leading: CircleAvatar(
        radius: 16,
        backgroundColor: medal,
        child: Text('$rank',
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: rank == 1 ? Colors.white : Theme.of(context).colorScheme.onSurfaceVariant)),
      ),
      title: Text(student.fullName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 6),
        child: ProgressBar(percent: student.percent, height: 5),
      ),
      trailing: Text('${student.percent.toStringAsFixed(0)}%',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
    );
  }
}
