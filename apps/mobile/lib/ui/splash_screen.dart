import 'package:flutter/material.dart';

import '../core/theme.dart';

/// Shown while the app checks for a stored session.
///
/// Built to match the supervision app's splash: a deep gradient with soft
/// decorative circles, both school crests as ringed badges, then the wordmark
/// and a spinner arriving in sequence rather than all at once. The staggering
/// is what makes it read as deliberate instead of merely loading.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..forward();

  // Kept separate from the entrance so it can keep breathing for as long as the
  // session check takes, rather than stopping once the entrance finishes.
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  )..repeat(reverse: true);

  Animation<double> _step(double begin, double end, {Curve curve = Curves.easeOut}) =>
      CurvedAnimation(parent: _entrance, curve: Interval(begin, end, curve: curve));

  late final Animation<double> _badges = _step(0.0, 0.5, curve: Curves.easeOutBack);
  late final Animation<double> _title = _step(0.25, 0.7);
  late final Animation<double> _subtitle = _step(0.4, 0.85);
  late final Animation<double> _spinner = _step(0.6, 1.0);
  late final Animation<double> _footer = _step(0.7, 1.0);

  @override
  void dispose() {
    _entrance.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Brand.emeraldLight, Brand.emerald, Color(0xFF022C22)],
            stops: [0.0, 0.5, 1.0],
          ),
        ),
        child: Stack(
          children: [
            // Barely-there circles that keep the gradient from reading flat.
            const _Bokeh(top: -80, right: -70, size: 220),
            const _Bokeh(bottom: -60, left: -60, size: 180),
            const _Bokeh(top: 180, left: 40, size: 96, opacity: 0.04),

            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _Rise(
                    animation: _badges,
                    offsetY: 0,
                    child: ScaleTransition(
                      scale: _badges,
                      child: AnimatedBuilder(
                        animation: _pulse,
                        builder: (context, child) => Transform.scale(
                          scale: 1 + (_pulse.value * 0.02),
                          child: child,
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            _Badge('assets/icon/badge_sak.png'),
                            SizedBox(width: 16),
                            _Badge('assets/icon/badge_cps.png'),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 26),

                  _Rise(
                    animation: _title,
                    child: const Text(
                      'Juzz Tracking',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  _Rise(
                    animation: _subtitle,
                    child: const Text(
                      'Theology Department',
                      style: TextStyle(
                        color: Brand.goldLight,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  _Rise(
                    animation: _subtitle,
                    child: const Text(
                      'القرآن الكريم',
                      style: TextStyle(color: Colors.white70, fontSize: 15),
                    ),
                  ),

                  const SizedBox(height: 40),
                  FadeTransition(
                    opacity: _spinner,
                    child: const SizedBox(
                      width: 30,
                      height: 30,
                      child: CircularProgressIndicator(
                        strokeWidth: 3,
                        color: Brand.goldLight,
                        backgroundColor: Colors.white24,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            Positioned(
              left: 0,
              right: 0,
              bottom: 28,
              child: FadeTransition(
                opacity: _footer,
                child: const Text(
                  'SIR APOLLO KAGGWA SCHOOLS - SINCE 1996',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white38, fontSize: 10, letterSpacing: 1.1),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Fades in while sliding up a little, so each element arrives rather than
/// simply appearing.
class _Rise extends StatelessWidget {
  final Animation<double> animation;
  final Widget child;
  final double offsetY;

  const _Rise({required this.animation, required this.child, this.offsetY = 14});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, child) => Opacity(
        opacity: animation.value.clamp(0.0, 1.0),
        child: Transform.translate(
          offset: Offset(0, (1 - animation.value) * offsetY),
          child: child,
        ),
      ),
      child: child,
    );
  }
}

class _Badge extends StatelessWidget {
  final String asset;
  const _Badge(this.asset);

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 84,
      width: 84,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white24, width: 2),
        boxShadow: const [
          BoxShadow(color: Colors.black26, blurRadius: 18, offset: Offset(0, 8)),
        ],
      ),
      child: ClipOval(child: Image.asset(asset, fit: BoxFit.cover)),
    );
  }
}

/// A soft translucent circle used purely to give the background some depth.
class _Bokeh extends StatelessWidget {
  final double? top, bottom, left, right;
  final double size;
  final double opacity;

  const _Bokeh({
    this.top,
    this.bottom,
    this.left,
    this.right,
    required this.size,
    this.opacity = 0.06,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: top,
      bottom: bottom,
      left: left,
      right: right,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Brand.goldLight.withValues(alpha: opacity),
        ),
      ),
    );
  }
}
