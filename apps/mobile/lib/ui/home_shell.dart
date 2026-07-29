import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/update_service.dart';
import '../state/providers.dart';
import 'attendance_screen.dart';
import 'dashboard_screen.dart';
import 'notifications_screen.dart';
import 'settings_screen.dart';
import 'students_screen.dart';

class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key});

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> with WidgetsBindingObserver {
  int _index = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Give the first frame a moment to settle before popping a dialog over it.
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkForUpdate());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Coming back to the foreground is the best moment to flush the outbox and
    // pick up notifications raised while we were away.
    if (state == AppLifecycleState.resumed) {
      ref.read(syncServiceProvider).drain();
      ref.read(notificationServiceProvider).check();
      _checkForUpdate();
    }
  }

  Future<void> _checkForUpdate() async {
    final release = await ref.read(updateServiceProvider).checkForUpdate();
    if (release != null && mounted) _showUpdateDialog(release);
  }

  Future<void> _showUpdateDialog(AppRelease release) async {
    await showDialog<void>(
      context: context,
      barrierDismissible: !release.mandatory,
      builder: (ctx) => PopScope(
        canPop: !release.mandatory,
        child: AlertDialog(
          icon: const Icon(Icons.system_update_rounded, color: Colors.teal, size: 32),
          title: Text(release.mandatory ? 'Update required' : 'Update available'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Version ${release.versionName} is ready.'),
              if (release.releaseNotes != null && release.releaseNotes!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(release.releaseNotes!, style: const TextStyle(fontSize: 13)),
              ],
              const SizedBox(height: 8),
              Text(
                'Installing keeps your data and login. No need to uninstall first.',
                style: TextStyle(fontSize: 12, color: Theme.of(ctx).colorScheme.onSurfaceVariant),
              ),
            ],
          ),
          actions: [
            if (!release.mandatory)
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Later')),
            FilledButton(
              onPressed: () async {
                final uri = Uri.tryParse(release.downloadUrl);
                if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
                if (ctx.mounted && !release.mandatory) Navigator.pop(ctx);
              },
              child: const Text('Update now'),
            ),
          ],
        ),
      ),
    );
  }

  static const _pages = [
    DashboardScreen(),
    StudentsScreen(),
    AttendanceScreen(),
    NotificationsScreen(),
    SettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final unread = ref.watch(unreadCountProvider).value ?? 0;

    return Scaffold(
      body: IndexedStack(index: _index, children: _pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard_rounded),
            label: 'Home',
          ),
          const NavigationDestination(
            icon: Icon(Icons.groups_outlined),
            selectedIcon: Icon(Icons.groups_rounded),
            label: 'Students',
          ),
          const NavigationDestination(
            icon: Icon(Icons.event_available_outlined),
            selectedIcon: Icon(Icons.event_available_rounded),
            label: 'Attendance',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.notifications_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.notifications_rounded),
            ),
            label: 'Alerts',
          ),
          const NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings_rounded),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}
