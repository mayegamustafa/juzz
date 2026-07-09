import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/theme.dart';
import '../data/api_client.dart';
import '../models/models.dart';
import '../state/providers.dart';
import 'widgets.dart';

Color statusColor(AttendanceStatus s) => switch (s) {
      AttendanceStatus.present => Brand.present,
      AttendanceStatus.absent => Brand.absent,
      AttendanceStatus.sick => Brand.sick,
      AttendanceStatus.permission => Brand.permission,
    };

class AttendanceScreen extends ConsumerStatefulWidget {
  const AttendanceScreen({super.key});

  @override
  ConsumerState<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends ConsumerState<AttendanceScreen> {
  List<AttendanceRow>? _rows;
  bool _loading = false;
  Object? _error;
  String? _loadedFor;

  Future<void> _load(String classId, DateTime date) async {
    final key = '$classId|${DateFormat('yyyy-MM-dd').format(date)}';
    if (_loadedFor == key && _rows != null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await ref.read(repositoryProvider).attendanceSheet(classId, date);
      if (!mounted) return;
      setState(() {
        _rows = rows;
        _loadedFor = key;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e is OfflineException ? 'Not available offline yet' : e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _mark(AttendanceRow row, AttendanceStatus status, DateTime date) async {
    setState(() {
      _rows = _rows!
          .map((r) => r.studentId == row.studentId ? r.copyWith(status: status) : r)
          .toList();
    });
    await ref.read(repositoryProvider).setAttendance(
          studentId: row.studentId,
          date: date,
          status: status,
        );
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(bootstrapProvider);
    final date = ref.watch(selectedDateProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Attendance')),
      body: Column(
        children: [
          const SyncBanner(),
          Expanded(
            child: async.when(
              loading: () => const ListSkeleton(),
              error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(bootstrapProvider)),
              data: (b) {
                if (b == null || b.classes.isEmpty) {
                  return const EmptyState(
                    icon: Icons.class_outlined,
                    title: 'No classes',
                    subtitle: 'Classes with assigned students appear here.',
                  );
                }

                final selected = ref.watch(selectedClassProvider) ?? b.classes.first.id;
                // Kick off the load for the current selection.
                WidgetsBinding.instance.addPostFrameCallback((_) => _load(selected, date));

                return Column(
                  children: [
                    _Controls(
                      classes: b.classes,
                      selectedClassId: selected,
                      date: date,
                      onClassChanged: (id) {
                        ref.read(selectedClassProvider.notifier).state = id;
                        setState(() => _rows = null);
                      },
                      onDateChanged: (d) {
                        ref.read(selectedDateProvider.notifier).state = d;
                        setState(() => _rows = null);
                      },
                    ),
                    if (_rows != null) _Summary(rows: _rows!),
                    Expanded(child: _body(selected, date)),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _body(String classId, DateTime date) {
    if (_loading && _rows == null) return const ListSkeleton();
    if (_error != null && _rows == null) {
      return ErrorState(error: _error!, onRetry: () => _load(classId, date));
    }
    final rows = _rows ?? const <AttendanceRow>[];
    if (rows.isEmpty) {
      return const EmptyState(icon: Icons.groups_outlined, title: 'No students in this class');
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      itemCount: rows.length,
      separatorBuilder: (_, _) => const Divider(height: 20),
      itemBuilder: (_, i) {
        final r = rows[i];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(r.fullName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            const SizedBox(height: 8),
            Row(
              children: [
                for (final s in AttendanceStatus.values) ...[
                  Expanded(
                    child: _StatusButton(
                      status: s,
                      selected: r.status == s,
                      onTap: () => _mark(r, s, date),
                    ),
                  ),
                  if (s != AttendanceStatus.values.last) const SizedBox(width: 6),
                ],
              ],
            ),
          ],
        );
      },
    );
  }
}

class _Controls extends StatelessWidget {
  final List<SchoolClass> classes;
  final String selectedClassId;
  final DateTime date;
  final ValueChanged<String> onClassChanged;
  final ValueChanged<DateTime> onDateChanged;

  const _Controls({
    required this.classes,
    required this.selectedClassId,
    required this.date,
    required this.onClassChanged,
    required this.onDateChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          Expanded(
            child: DropdownButtonFormField<String>(
              initialValue: selectedClassId,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Class', isDense: true),
              items: [
                for (final c in classes) DropdownMenuItem(value: c.id, child: Text(c.name)),
              ],
              onChanged: (v) => v == null ? null : onClassChanged(v),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: date,
                  firstDate: DateTime.now().subtract(const Duration(days: 365)),
                  lastDate: DateTime.now().add(const Duration(days: 1)),
                );
                if (picked != null) onDateChanged(DateTime(picked.year, picked.month, picked.day));
              },
              child: InputDecorator(
                decoration: const InputDecoration(labelText: 'Date', isDense: true),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(DateFormat('d MMM yyyy').format(date), style: const TextStyle(fontSize: 14)),
                    const Icon(Icons.calendar_today_rounded, size: 15),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  final List<AttendanceRow> rows;
  const _Summary({required this.rows});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        children: [
          for (final s in AttendanceStatus.values)
            Padding(
              padding: const EdgeInsets.only(right: 14),
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(color: statusColor(s), shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 5),
                  Text('${rows.where((r) => r.status == s).length}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(width: 3),
                  Text(s.label, style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _StatusButton extends StatelessWidget {
  final AttendanceStatus status;
  final bool selected;
  final VoidCallback onTap;

  const _StatusButton({required this.status, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = statusColor(status);
    return InkWell(
      borderRadius: BorderRadius.circular(9),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 130),
        padding: const EdgeInsets.symmetric(vertical: 9),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? color : Colors.transparent,
          borderRadius: BorderRadius.circular(9),
          border: Border.all(color: selected ? color : Theme.of(context).colorScheme.outlineVariant),
        ),
        child: Text(
          status.label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? Colors.white : Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}
