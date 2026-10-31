import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseConfig {
  // Both values must be provided via --dart-define at build/run time.
  // Example:
  //   flutter run \
  //     --dart-define=SUPABASE_URL=https://xxxx.supabase.co \
  //     --dart-define=SUPABASE_ANON_KEY=your_anon_key
  static const String _supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const String _supabaseAnonKey =
      String.fromEnvironment('SUPABASE_ANON_KEY');

  static String get supabaseUrl {
    assert(
      _supabaseUrl.isNotEmpty,
      'Missing SUPABASE_URL — pass it via --dart-define=SUPABASE_URL=...',
    );
    return _supabaseUrl;
  }

  static String get supabaseAnonKey {
    assert(
      _supabaseAnonKey.isNotEmpty,
      'Missing SUPABASE_ANON_KEY — pass it via --dart-define=SUPABASE_ANON_KEY=...',
    );
    return _supabaseAnonKey;
  }

  static SupabaseClient get client => Supabase.instance.client;

  static Future<void> initialize() async {
    // In release builds, missing keys will cause an uninformative error deep in
    // the Supabase SDK. Fail fast here instead.
    if (!kDebugMode) {
      if (_supabaseUrl.isEmpty || _supabaseAnonKey.isEmpty) {
        throw StateError(
          'Supabase URL and anon key must be provided via --dart-define. '
          'Build the app with:\n'
          '  flutter build apk \\\n'
          '    --dart-define=SUPABASE_URL=<url> \\\n'
          '    --dart-define=SUPABASE_ANON_KEY=<key>',
        );
      }
    }

    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.implicit,
      ),
    );
  }
}
