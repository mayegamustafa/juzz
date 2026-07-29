import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/config.dart';
import 'core/theme.dart';
import 'state/providers.dart';
import 'ui/home_shell.dart';
import 'ui/login_screen.dart';
import 'ui/splash_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final container = ProviderContainer();

  // Permissions + notification channel must exist before any poll fires.
  await container.read(notificationServiceProvider).init();

  // Push is what delivers notifications while the app is closed. It is
  // best-effort: without Firebase configured, or if the Sheikh declines the
  // permission, the app carries on with the in-app poll instead.
  await container.read(pushServiceProvider).init();

  await container.read(authProvider.notifier).restore();

  runApp(
    UncontrolledProviderScope(container: container, child: const QpmsApp()),
  );
}

class QpmsApp extends ConsumerWidget {
  const QpmsApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final mode = ref.watch(themeModeProvider);

    return MaterialApp(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: buildLightTheme(),
      darkTheme: buildDarkTheme(),
      themeMode: mode,
      home: switch (auth) {
        AuthLoading() => const SplashScreen(),
        AuthSignedOut(:final message) => LoginScreen(notice: message),
        AuthSignedIn() => const HomeShell(),
      },
    );
  }
}
