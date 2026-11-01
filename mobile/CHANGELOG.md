# Koji — Changelog

## [0.1.0] - 2026-11-01

### 📱 Two Apps, One Codebase

This version supports **two separate Play Store apps** built from the same Flutter code using flavors:

#### 🏢 **Koji Pro** (Entreprise - Artisans)
- Package: `com.koji.pro`
- Flavor: `entreprise`
- Entry: `lib/main_entreprise.dart`
- Features:
  - Invoice management (Factures) with full CRUD
  - Quote signing and negotiation
  - Team management (équipe)
  - Notifications and messaging
  - Calendar with PDF export
  - Supabase real-time sync

#### 👤 **Koji** (Client - Particulier)
- Package: `com.koji.client`
- Flavor: `client`
- Entry: `lib/main_client.dart`
- Features:
  - Browse and sign quotes
  - Quote messaging
  - Project tracking
  - Notifications for updates
  - Task management
  - Same design system as Koji Pro

### 🎯 Build Commands

```bash
# Koji Pro (Entreprise)
flutter build appbundle --flavor entreprise -t lib/main_entreprise.dart

# Koji (Client)
flutter build appbundle --flavor client -t lib/main_client.dart

# Development
flutter run --flavor entreprise -t lib/main_entreprise.dart
flutter run --flavor client -t lib/main_client.dart
```

### 🔧 Improvements
- Consolidated mobile app in web-app-Koji monorepo
- Flutter flavors for parallel Play Store deployment
- Google Play Billing 8 compliance (targetSdk 36)
- iOS 13+ support with Podfile configuration
- 50+ unit & widget tests passing
- Koji Pro theme with DM Sans typography

### ✅ Testing
- Unit tests: factures_logic_test.dart (7 tests)
- Widget tests: factures_screens_test.dart (3 tests)
- Smoke test: integration_test/app_smoke_test.dart
- All tests passing ✓

---

### Version Details
- Version Code: 56
- Min SDK: 21+
- Target SDK: 36 (Google Play requirement)
- Dart: 3.10.4
- Flutter: 3.38.5
