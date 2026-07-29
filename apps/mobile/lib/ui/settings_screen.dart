import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/config.dart';
import '../core/theme.dart';
import '../state/providers.dart';
import 'widgets.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final sync = ref.watch(syncServiceProvider);
    final mode = ref.watch(themeModeProvider);
    final user = auth is AuthSignedIn ? auth.user : null;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          const SyncBanner(),
          if (user != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 26,
                        backgroundColor: Brand.emerald,
                        child: Text(
                          user.fullName.isEmpty ? '?' : user.fullName[0].toUpperCase(),
                          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(user.fullName,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            const SizedBox(height: 2),
                            Text(user.email, style: TextStyle(fontSize: 12.5, color: scheme.onSurfaceVariant)),
                            const SizedBox(height: 6),
                            Wrap(
                              spacing: 6,
                              children: [
                                Chip(
                                  label: Text(user.role.replaceAll('_', ' '),
                                      style: const TextStyle(fontSize: 10.5)),
                                  visualDensity: VisualDensity.compact,
                                  padding: EdgeInsets.zero,
                                ),
                                if (user.schoolName != null)
                                  Chip(
                                    label: Text(user.schoolName!, style: const TextStyle(fontSize: 10.5)),
                                    visualDensity: VisualDensity.compact,
                                    padding: EdgeInsets.zero,
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          const _SectionHeader('Sync'),
          ListTile(
            leading: Icon(
              sync.isOnline ? Icons.cloud_done_rounded : Icons.cloud_off_rounded,
              color: sync.isOnline ? Brand.emerald : Brand.gold,
            ),
            title: Text(sync.isOnline ? 'Online' : 'Offline'),
            subtitle: Text(sync.hasPending
                ? '${sync.pendingCount} change${sync.pendingCount == 1 ? '' : 's'} waiting to sync'
                : 'All changes saved to the server'),
            trailing: sync.hasPending && sync.isOnline
                ? TextButton(
                    onPressed: () => ref.read(syncServiceProvider).drain(),
                    child: const Text('Sync now'),
                  )
                : null,
          ),
          ListTile(
            leading: const Icon(Icons.refresh_rounded),
            title: const Text('Refresh students'),
            subtitle: const Text('Re-download your roster and surah list'),
            onTap: () async {
              await ref.read(repositoryProvider).bootstrap(forceRefresh: true);
              ref.invalidate(bootstrapProvider);
              if (context.mounted) showSnack(context, 'Refreshed');
            },
          ),

          const _SectionHeader('Appearance'),
          RadioGroup<ThemeMode>(
            groupValue: mode,
            onChanged: (v) => ref.read(themeModeProvider.notifier).state = v ?? ThemeMode.system,
            child: const Column(
              children: [
                RadioListTile(value: ThemeMode.system, title: Text('System default')),
                RadioListTile(value: ThemeMode.light, title: Text('Light')),
                RadioListTile(value: ThemeMode.dark, title: Text('Dark')),
              ],
            ),
          ),

          const _SectionHeader('About'),
          const ListTile(
            leading: Icon(Icons.info_outline_rounded),
            title: Text(AppConfig.appName),
            subtitle: Text('Theology Department'),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(
              '© ${DateTime.now().year} ${AppConfig.copyrightHolder}. All rights reserved.',
              style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ),

          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: Brand.poor,
                side: const BorderSide(color: Brand.poor),
                minimumSize: const Size.fromHeight(48),
              ),
              onPressed: () => _confirmLogout(context, ref, sync.pendingCount),
              icon: const Icon(Icons.logout_rounded, size: 18),
              label: const Text('Sign out'),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref, int pending) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out?'),
        content: Text(pending > 0
            ? 'You have $pending unsynced change${pending == 1 ? '' : 's'}. Signing out will discard them.'
            : 'You will need internet to sign back in.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Brand.poor),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (ok == true) await ref.read(authProvider.notifier).logout();
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 6),
      child: Text(title.toUpperCase(),
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.8,
            color: Theme.of(context).colorScheme.primary,
          )),
    );
  }
}
