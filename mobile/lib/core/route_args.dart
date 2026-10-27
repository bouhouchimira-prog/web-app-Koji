// Route argument types for GoRouter.
// Instead of passing Map<String, dynamic> as `extra`, every route that needs
// parameters receives a typed object. This gives compile-time safety and
// eliminates the class of runtime crash where wrong keys/types are used.

/// Typed args for all /chantier/* detail routes.
class ChantierArgs {
  final String reference;
  final double mainOeuvreReal;
  final double mainOeuvreEstimated;
  final double fournitureReal;
  final double fournitureEstimated;

  const ChantierArgs({
    required this.reference,
    this.mainOeuvreReal = 0.0,
    this.mainOeuvreEstimated = 0.0,
    this.fournitureReal = 0.0,
    this.fournitureEstimated = 0.0,
  });

  /// Fallback for routes that receive an untyped Map from legacy callers.
  factory ChantierArgs.fromMap(Map<String, dynamic> map) {
    return ChantierArgs(
      reference: map['reference'] as String? ?? '',
      mainOeuvreReal: (map['mainOeuvreReal'] as num?)?.toDouble() ?? 0.0,
      mainOeuvreEstimated: (map['mainOeuvreEstimated'] as num?)?.toDouble() ?? 0.0,
      fournitureReal: (map['fournitureReal'] as num?)?.toDouble() ?? 0.0,
      fournitureEstimated: (map['fournitureEstimated'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toMap() => {
        'reference': reference,
        'mainOeuvreReal': mainOeuvreReal,
        'mainOeuvreEstimated': mainOeuvreEstimated,
        'fournitureReal': fournitureReal,
        'fournitureEstimated': fournitureEstimated,
      };
}

/// Typed args for /quote/room-details and /quote/room-estimation.
class QuoteRoomArgs {
  final List<String> roomIds;
  final List<String> images;

  const QuoteRoomArgs({
    required this.roomIds,
    this.images = const [],
  });
}

/// Typed args for /quote/success route.
class QuoteSuccessArgs {
  final String quoteId;
  final Map<String, dynamic> quoteData;

  const QuoteSuccessArgs({
    required this.quoteId,
    this.quoteData = const {},
  });
}

/// Typed args for /workers/* routes (replaces the crash-risk non-nullable
/// `state.extra as Worker` cast on /workers/detail).
class WorkerRouteArgs {
  /// The worker object. Nullable on routes where it is optional (create).
  final dynamic worker; // typed as Worker in the synchronization feature

  const WorkerRouteArgs({this.worker});
}

class QuoteDetailArgs {
  final Map<String, dynamic> data;

  const QuoteDetailArgs({required this.data});
}

class SignatureArgs {
  final Map<String, dynamic> quote;

  const SignatureArgs({required this.quote});
}
