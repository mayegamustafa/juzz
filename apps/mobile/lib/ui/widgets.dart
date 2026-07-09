import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme.dart';
import '../data/sync_service.dart';
import '../state/providers.dart';

/// Shown under the app bar whenever we're offline or have queued writes.
class SyncBanner extends ConsumerWidget {
  const SyncBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sync = ref.watch(syncServiceProvider);
    if (sync.isOnline && !sync.hasPending) return const SizedBox.shrink();

    final (color, icon, text) = switch (sync.state) {
      SyncState.offline => (
          Brand.gold,
          Icons.cloud_off_rounded,
          sync.hasPending
              ? 'Offline · ${sync.pendingCount} change${sync.pendingCount == 1 ? '' : 's'} queued'
              : 'Offline · changes will sync automatically',
        ),
      SyncState.syncing => (Brand.emerald, Icons.sync_rounded, 'Syncing ${sync.pendingCount}…'),
      SyncState.error => (Brand.poor, Icons.error_outline_rounded, 'Sync failed · will retry'),
      SyncState.idle => (
          Brand.emerald,
          Icons.cloud_upload_outlined,
          '${sync.pendingCount} change${sync.pendingCount == 1 ? '' : 's'} queued',
        ),
    };

    return Material(
      color: color.withValues(alpha: 0.12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 8),
            Expanded(
              child: Text(text, style: TextStyle(fontSize: 12.5, color: color, fontWeight: FontWeight.w600)),
            ),
            if (sync.hasPending && sync.isOnline)
              TextButton(
                onPressed: () => ref.read(syncServiceProvider).drain(),
                style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                child: const Text('Retry', style: TextStyle(fontSize: 12)),
              ),
          ],
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? action;

  const EmptyState({super.key, required this.icon, required this.title, this.subtitle, this.action});

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: muted.withValues(alpha: 0.5)),
            const SizedBox(height: 16),
            Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(subtitle!, textAlign: TextAlign.center, style: TextStyle(color: muted, fontSize: 13)),
            ],
            if (action != null) ...[const SizedBox(height: 20), action!],
          ],
        ),
      ),
    );
  }
}

class ErrorState extends StatelessWidget {
  final Object error;
  final VoidCallback? onRetry;

  const ErrorState({super.key, required this.error, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: Icons.error_outline_rounded,
      title: 'Something went wrong',
      subtitle: '$error',
      action: onRetry == null
          ? null
          : OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Try again'),
            ),
    );
  }
}

/// Skeleton placeholder with a subtle shimmer sweep.
class Shimmer extends StatefulWidget {
  final double height;
  final double? width;
  final BorderRadius? radius;

  const Shimmer({super.key, this.height = 16, this.width, this.radius});

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = Theme.of(context).colorScheme.surfaceContainerHighest;
    final highlight = Theme.of(context).colorScheme.surface;
    return AnimatedBuilder(
      animation: _c,
      builder: (_, _) => Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(
          borderRadius: widget.radius ?? BorderRadius.circular(8),
          gradient: LinearGradient(
            begin: Alignment(-1 + _c.value * 2, 0),
            end: Alignment(1 + _c.value * 2, 0),
            colors: [base, highlight, base],
          ),
        ),
      ),
    );
  }
}

class ListSkeleton extends StatelessWidget {
  final int count;
  const ListSkeleton({super.key, this.count = 6});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: count,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (_, _) => Row(
        children: [
          const Shimmer(height: 44, width: 44, radius: BorderRadius.all(Radius.circular(22))),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Shimmer(height: 14, width: 160),
                SizedBox(height: 8),
                Shimmer(height: 11, width: 100),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A labelled progress bar in brand colours.
class ProgressBar extends StatelessWidget {
  final double percent; // 0..100
  final double height;

  const ProgressBar({super.key, required this.percent, this.height = 8});

  @override
  Widget build(BuildContext context) {
    final v = (percent / 100).clamp(0.0, 1.0);
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: LinearProgressIndicator(
        value: v,
        minHeight: height,
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
        valueColor: AlwaysStoppedAnimation(
          v >= 1 ? Brand.gold : Theme.of(context).colorScheme.primary,
        ),
      ),
    );
  }
}

void showSnack(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: error ? Brand.poor : null,
      duration: const Duration(seconds: 2),
    ));
}
