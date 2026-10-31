import 'package:koji/features/pricing/models/pricing_models.dart';

/// Repository of normative tasks - NOW DEPRECATED
/// Tasks are loaded from Supabase instead of being hardcoded
class PricingData {
  // Kept for backward compatibility during migration
  // Will be removed once RoomTaskScreen uses backend data
  static SmartTask? getTaskById(String id) {
    // This method is now a stub - tasks should be fetched from backend
    // Returning null will force the app to use backend data
    return null;
  }
}
