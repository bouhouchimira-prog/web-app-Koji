import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Firebase project KOJI (koji-2e5fb). On iOS the GoogleService-Info.plist is
/// not bundled in the Xcode project, so the options are passed here, picked by
/// the build flavor. Android reads android/app/google-services.json instead.
class KojiFirebaseOptions {
  KojiFirebaseOptions._();

  static FirebaseOptions? get currentPlatform {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.iOS) return null;
    return appFlavor == 'client' ? iosClient : iosPro;
  }

  static const FirebaseOptions iosPro = FirebaseOptions(
    apiKey: 'AIzaSyAro0ia916DtZ2s-5QYkEa2uGdQb35f05w',
    appId: '1:4703912546:ios:5d6a1939626b5ebc89873b',
    messagingSenderId: '4703912546',
    projectId: 'koji-2e5fb',
    storageBucket: 'koji-2e5fb.firebasestorage.app',
    iosBundleId: 'com.koji.pro',
  );

  static const FirebaseOptions iosClient = FirebaseOptions(
    apiKey: 'AIzaSyAro0ia916DtZ2s-5QYkEa2uGdQb35f05w',
    appId: '1:4703912546:ios:9bd725db46abdfc989873b',
    messagingSenderId: '4703912546',
    projectId: 'koji-2e5fb',
    storageBucket: 'koji-2e5fb.firebasestorage.app',
    iosBundleId: 'com.koji.client',
  );
}
