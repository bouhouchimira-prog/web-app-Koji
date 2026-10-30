import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/account_provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Builds a minimal `User` so [KojiAccount.from] can be exercised without
/// initializing Supabase.
User _user({String? email = 'jean.dupont@koji.fr'}) => User(
      id: 'u-1',
      appMetadata: const {},
      userMetadata: null,
      aud: 'authenticated',
      createdAt: '2026-01-01T00:00:00Z',
      email: email,
    );

void main() {
  group('KojiAccount.from — ligne absente (valeurs par défaut)', () {
    final user = _user();
    final account = KojiAccount.from(user, null);

    test('reprend l\'identité de la session pour id/email', () {
      expect(account.id, 'u-1');
      expect(account.email, 'jean.dupont@koji.fr');
    });

    test('défauts alignés sur le mapping web : particulier / trial', () {
      expect(account.accountType, 'particulier');
      expect(account.isPro, isFalse);
      expect(account.isAdmin, isFalse);
      expect(account.plan, 'trial');
      expect(account.trialSaveCount, 0);
      expect(account.hasBillingAccount, isFalse);
      expect(account.profileComplete, isFalse);
      expect(account.businessInfoComplete, isFalse);
      expect(account.personalInfoComplete, isFalse);
    });

    test('collections vides et fallbacks du nom', () {
      expect(account.fullName, '');
      expect(account.displayName, 'jean.dupont');
      expect(account.firstName, 'jean.dupont');
      expect(account.businessInfo, isEmpty);
      expect(account.personalInfo, isEmpty);
      expect(account.professions, isEmpty);
      expect(account.logoUrl, '');
    });
  });

  group('KojiAccount.from — ligne entreprise complète', () {
    final user = _user(email: 'bob@biz.fr');
    final row = <String, dynamic>{
      'email': 'bob@biz.fr',
      'full_name': 'Bob Martin',
      'phone': '0600000001',
      'address': '10 rue du Test',
      'is_admin': true,
      'is_profile_complete': true,
      'logo_url': 'https://cdn.example.com/logo.png',
      'business_info': <String, dynamic>{
        'raisonSociale': 'Martin SARL',
        '_accountType': 'entreprise',
        '_isPro': true,
        '_billingPlan': 'pro',
        '_billingInterval': 'month',
        '_billingStatus': 'active',
        '_stripeCustomerId': 'cus_123',
        '_trialStartedAt': '2026-01-02',
        '_trialQuoteId': 'q-1',
        '_trialSaveCount': 3,
        '_logoUrl': 'https://cdn.example.com/ancien-logo.png',
        '_professions': ['Plombier', 'Peintre'],
        '_addonWebsite': true,
        '_addonPremium': true,
        '_personal': <String, dynamic>{
          'firstName': 'Bob',
          'lastName': 'Martin',
          'phone': '0700000002',
        },
      },
    };
    final account = KojiAccount.from(user, row);

    test('identité entreprise depuis business_info', () {
      expect(account.companyName, 'Martin SARL');
      expect(account.accountType, 'entreprise');
      expect(account.isPro, isTrue);
      expect(account.isAdmin, isTrue);
    });

    test('facturation reprise depuis les extras privés', () {
      expect(account.plan, 'pro');
      expect(account.billingInterval, 'month');
      expect(account.billingStatus, 'active');
      expect(account.hasBillingAccount, isTrue);
      expect(account.trialStartedAt, '2026-01-02');
      expect(account.trialQuoteId, 'q-1');
      expect(account.trialSaveCount, 3);
    });

    test('complétude du profil', () {
      expect(account.fullName, 'Bob Martin');
      expect(account.profileComplete, isTrue);
      expect(account.businessInfoComplete, isFalse);
      expect(account.personalInfoComplete, isTrue);
      expect(account.personalInfo['phone'], '0700000002');
    });

    test('priorité de logo : ligne SQL avant extras privés', () {
      expect(account.logoUrl, 'https://cdn.example.com/logo.png');
    });

    test('professions et add-ons', () {
      expect(account.professions, ['Plombier', 'Peintre']);
      expect(account.addonWebsite, isTrue);
      expect(account.premiumTools, isTrue);
    });
  });

  group('KojiAccount.from — cas de repli', () {
    test('plan trial -> pro pour un compte grandfathered', () {
      final account = KojiAccount.from(_user(), <String, dynamic>{
        'business_info': <String, dynamic>{'_grandfathered': true},
      });
      expect(account.plan, 'pro');
    });

    test('professions depuis row[profession] sans extras', () {
      final account = KojiAccount.from(_user(), <String, dynamic>{
        'profession': 'Électricien',
      });
      expect(account.professions, ['Électricien']);
    });

    test('phone/address replis depuis _personal', () {
      final account = KojiAccount.from(_user(), <String, dynamic>{
        'business_info': <String, dynamic>{
          '_personal': <String, dynamic>{
            'phone': '0788888888',
            'address': '2 avenue du Fallback',
          },
        },
      });
      expect(account.phone, '0788888888');
      expect(account.address, '2 avenue du Fallback');
    });

    test('full_name replis : _name puis noms personnels', () {
      final withLegacy = KojiAccount.from(_user(), <String, dynamic>{
        'business_info': <String, dynamic>{'_name': 'Alice Bernard'},
      });
      expect(withLegacy.fullName, 'Alice Bernard');

      final fromPersonal = KojiAccount.from(_user(), <String, dynamic>{
        'business_info': <String, dynamic>{
          '_personal': <String, dynamic>{'firstName': 'Alice', 'lastName': 'Bernard'},
        },
      });
      expect(fromPersonal.fullName, 'Alice Bernard');
    });

    test('logoUrl repli sur _logoUrl', () {
      final account = KojiAccount.from(_user(), <String, dynamic>{
        'business_info': <String, dynamic>{'_logoUrl': 'https://cdn.example.com/extras.png'},
      });
      expect(account.logoUrl, 'https://cdn.example.com/extras.png');
    });

    test('premiumTools via _premiumTools', () {
      final account = KojiAccount.from(_user(), <String, dynamic>{
        'business_info': <String, dynamic>{'_premiumTools': true},
      });
      expect(account.premiumTools, isTrue);
      expect(account.addonWebsite, isFalse);
    });
  });
}
