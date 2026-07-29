import 'package:flutter/material.dart';

import '../core/theme.dart';

/// The screen shown for the brief moment the app checks whether a session is
/// already stored. Kept lively (entrance animation, a soft breathing glow)
/// rather than a static logo-and-spinner, since — unlike the OS-level native
/// splash — Flutter is already running here and can animate freely.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..forward();

  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  )..repeat(reverse: true);

  late final Animation<double> _logoScale = CurvedAnimation(
    parent: _entrance,
    curve: const Interval(0.0, 0.7, curve: Curves.easeOutBack),
  );
  late final Animation<double> _logoFade = CurvedAnimation(
    parent: _entrance,
    curve: const Interval(0.0, 0.5, curve: Curves.easeIn),
  );
  late final Animation<double> _textSlide = CurvedAnimation(
    parent: _entrance,
    curve: const Interval(0.4, 1.0, curve: Curves.easeOutCubic),
  );

  @override
  void dispose() {
    _entrance.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Brand.emerald,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 140,
              height: 140,
              child: AnimatedBuilder(
                animation: Listenable.merge([_entrance, _pulse]),
                builder: (context, child) {
                  // A soft ring breathes behind the mark — subtle, not flashy.
                  final glow = 0.85 + (_pulse.value * 0.15);
                  return Stack(
                    alignment: Alignment.center,
                    children: [
                      Opacity(
                        opacity: (0.18 * _logoFade.value) * (1 - (_pulse.value * 0.3)),
                        child: Transform.scale(
                          scale: glow,
                          child: Container(
                            width: 140,
                            height: 140,
                            decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white),
                          ),
                        ),
                      ),
                      Opacity(
                        opacity: _logoFade.value,
                        child: Transform.scale(
                          scale: _logoScale.value,
                          child: child,
                        ),
                      ),
                    ],
                  );
                },
                child: Image.asset('assets/icon/icon_mark_white.png', width: 88, height: 88),
              ),
            ),
            const SizedBox(height: 22),
            AnimatedBuilder(
              animation: _textSlide,
              builder: (context, child) => Opacity(
                opacity: _textSlide.value,
                child: Transform.translate(
                  offset: Offset(0, (1 - _textSlide.value) * 12),
                  child: child,
                ),
              ),
              child: const Column(
                children: [
                  Text(
                    'SAK/CPS JUZZ TRACKING',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.8,
                    ),
                  ),
                  SizedBox(height: 6),
                  Text(
                    'Theology Department',
                    style: TextStyle(color: Colors.white70, fontSize: 12.5, letterSpacing: 0.5),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 40),
            FadeTransition(
              opacity: _textSlide,
              child: const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white70),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
