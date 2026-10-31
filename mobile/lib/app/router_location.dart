import 'package:go_router/go_router.dart';

/// Location of the page actually on top. `GoRouterState.uri` only reflects the
/// last `go`, so after a `push` (e.g. a section opened over `/home`) it still
/// reads `/home`; the last route match carries the pushed page's location.
String currentRoutePath(GoRouter router) {
  final config = router.routerDelegate.currentConfiguration;
  if (config.matches.isEmpty) return config.uri.path;
  return config.last.matchedLocation;
}
