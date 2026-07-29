import 'package:package_info_plus/package_info_plus.dart';

import 'api_client.dart';

class AppRelease {
  final int versionCode;
  final String versionName;
  final String downloadUrl;
  final String? releaseNotes;
  final bool mandatory;

  const AppRelease({
    required this.versionCode,
    required this.versionName,
    required this.downloadUrl,
    this.releaseNotes,
    required this.mandatory,
  });

  factory AppRelease.fromJson(Map<String, dynamic> j) => AppRelease(
        versionCode: j['versionCode'] is int ? j['versionCode'] as int : int.tryParse('${j['versionCode']}') ?? 0,
        versionName: j['versionName'] as String? ?? '',
        downloadUrl: j['downloadUrl'] as String? ?? '',
        releaseNotes: j['releaseNotes'] as String?,
        mandatory: j['mandatory'] as bool? ?? false,
      );
}

/// Checks the secretariat-published release against the app actually
/// installed on the device.
///
/// The app is distributed as an APK outside the Play Store (built via
/// Codemagic), so there is no store to push updates automatically. Installing
/// a new APK signed with the same key over the old one *is* a real update —
/// it keeps the app's data and login, no uninstall needed — the only manual
/// step left is downloading it and tapping "Install", which this triggers.
class UpdateService {
  final ApiClient _api;
  UpdateService(this._api);

  /// Returns the published release only if it is newer than what's installed.
  /// Null means the app is current (or no release has ever been published).
  Future<AppRelease?> checkForUpdate() async {
    try {
      final data = await _api.get('/app-release');
      if (data == null) return null;
      final release = AppRelease.fromJson(data as Map<String, dynamic>);
      if (release.versionCode <= 0 || release.downloadUrl.isEmpty) return null;

      final info = await PackageInfo.fromPlatform();
      final installed = int.tryParse(info.buildNumber) ?? 0;
      return release.versionCode > installed ? release : null;
    } catch (_) {
      // Never let an update check block or crash the app — worst case it
      // just doesn't offer an update this time.
      return null;
    }
  }
}
