import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../core/theme.dart';
import '../models/models.dart';
import '../state/providers.dart';
import 'widgets.dart';

Color _typeColor(String type) => switch (type) {
      'ANNOUNCEMENT' => Brand.emerald,
      'ACHIEVEMENT' => Brand.gold,
      'REMINDER' => Colors.blue,
      'ALERT' => Brand.poor,
      _ => Colors.blueGrey,
    };

IconData _typeIcon(String type) => switch (type) {
      'ANNOUNCEMENT' => Icons.campaign_rounded,
      'ACHIEVEMENT' => Icons.emoji_events_rounded,
      'REMINDER' => Icons.alarm_rounded,
      'ALERT' => Icons.warning_amber_rounded,
      _ => Icons.info_outline_rounded,
    };

String _timeAgo(DateTime d) {
  final s = DateTime.now().difference(d);
  if (s.inMinutes < 1) return 'just now';
  if (s.inMinutes < 60) return '${s.inMinutes}m ago';
  if (s.inHours < 24) return '${s.inHours}h ago';
  if (s.inDays < 7) return '${s.inDays}d ago';
  return DateFormat('d MMM').format(d);
}

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(notificationsProvider);
    final unread = ref.watch(unreadCountProvider).value ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          if (unread > 0)
            TextButton(
              onPressed: () async {
                await ref.read(notificationServiceProvider).markAllRead();
                ref.invalidate(notificationsProvider);
              },
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: Column(
        children: [
          const SyncBanner(),
          Expanded(
            child: async.when(
              loading: () => const ListSkeleton(),
              error: (e, _) => ErrorState(error: e, onRetry: () => ref.invalidate(notificationsProvider)),
              data: (items) {
                if (items.isEmpty) {
                  return const EmptyState(
                    icon: Icons.notifications_none_rounded,
                    title: 'No notifications',
                    subtitle: 'Announcements and reminders will appear here.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async {
                    await ref.read(notificationServiceProvider).check();
                    ref.invalidate(notificationsProvider);
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _Tile(item: items[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _Tile extends ConsumerWidget {
  final AppNotification item;
  const _Tile({required this.item});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final color = _typeColor(item.type);
    final scheme = Theme.of(context).colorScheme;

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: item.isUnread
            ? () async {
                await ref.read(notificationServiceProvider).markRead(item.id);
                ref.invalidate(notificationsProvider);
              }
            : null,
        child: Opacity(
          opacity: item.isUnread ? 1 : 0.62,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(_typeIcon(item.type), size: 18, color: color),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(item.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                          ),
                          if (item.isUnread)
                            Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(color: Brand.emerald, shape: BoxShape.circle),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(item.body, style: TextStyle(fontSize: 13, color: scheme.onSurfaceVariant)),
                      const SizedBox(height: 8),
                      Text(_timeAgo(item.createdAt),
                          style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
