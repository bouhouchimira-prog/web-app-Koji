import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/auth/repository/user_repository.dart';

/// The signed-in user with profile fields aligned with the web app.
class KojiAccount {
  const KojiAccount({
    required this.id,
    required this.email,
    this.fullName = '',
    this.companyName = '',
    this.phone = '',
    this.address = '',
    this.accountType = 'entreprise',
    this.isPro = true,
    this.isAdmin = false,
    this.plan = 'trial',
    this.trialStartedAt,
    this.trialQuoteId,
    this.trialSaveCount = 0,
    this.billingInterval,
    this.billingStatus,
    this.hasBillingAccount = false,
    this.profileComplete = false,
    this.businessInfoComplete = false,
    this.personalInfoComplete = false,
    this.logoUrl = '',
    this.businessInfo = const {},
    this.personalInfo = const {},
    this.professions = const [],
    this.addonWebsite = false,
    this.premiumTools = false,
  });

  final String id;
  final String email;
  final String fullName;
  final String companyName;
  final String phone;
  final String address;
  final String accountType;
  final bool isPro;
  final bool isAdmin;
  final String plan;
  final String? trialStartedAt;
  final String? trialQuoteId;
  final int trialSaveCount;
  final String? billingInterval;
  final String? billingStatus;
  final bool hasBillingAccount;
  final bool profileComplete;
  final bool businessInfoComplete;
  final bool personalInfoComplete;
  final String logoUrl;
  final Map<String, dynamic> businessInfo;
  final Map<String, dynamic> personalInfo;
  final List<dynamic> professions;
  final bool addonWebsite;
  final bool premiumTools;

  /// Company name for an entreprise, else the person's name, else the e-mail.
  String get displayName {
    if (companyName.isNotEmpty) return companyName;
    if (fullName.isNotEmpty) return fullName;
    return email.split('@').first;
  }

  String get firstName {
    if (fullName.isNotEmpty) return fullName.split(' ').first;
    return email.split('@').first;
  }

  factory KojiAccount.from(User user, Map<String, dynamic>? row) {
    String str(dynamic v) => (v as String?)?.trim() ?? '';
    final biz = row?['business_info'];
    final bizMap = biz is Map ? biz : const <String, dynamic>{};
    final extras = <String, dynamic>{};
    for (final entry in bizMap.entries) {
      final key = entry.key.toString();
      if (key.startsWith('_')) {
        extras[key] = entry.value;
      }
    }
    final personal = extras['_personal'] is Map
        ? Map<String, dynamic>.from(extras['_personal'] as Map)
        : const <String, dynamic>{};
    final personalName = [
      personal['firstName'],
      personal['lastName'],
    ].where((v) => (v as String?)?.trim().isNotEmpty == true).join(' ').trim();

    final resolvedFullName = str(row?['full_name']).isNotEmpty
        ? str(row?['full_name'])
        : (str(extras['_name']).isNotEmpty
            ? str(extras['_name'])
            : personalName);

    final professions = extras['_professions'] is List
        ? List<dynamic>.from(extras['_professions'] as List)
        : (row?['profession'] != null ? [row?['profession']] : const []);

    final isPro = row?['is_pro'] == true || extras['_isPro'] == true;
    final accountType = str(extras['_accountType']).isNotEmpty
        ? str(extras['_accountType'])
        : (isPro ? 'entreprise' : 'particulier');

    final billingPlan = str(extras['_billingPlan']);
    final grandfathered = extras['_grandfathered'] == true;
    final plan = billingPlan.isNotEmpty
        ? billingPlan
        : (grandfathered ? 'pro' : 'trial');

    final profileComplete = row?['is_profile_complete'] == true ||
        extras['_profileComplete'] == true;
    final businessInfoComplete = row?['is_business_info_complete'] == true ||
        extras['_businessInfoComplete'] == true;
    final personalInfoComplete = personal['firstName'] != null ||
        personal['lastName'] != null ||
        personal['phone'] != null ||
        personal['address'] != null;

    return KojiAccount(
      id: user.id,
      email: user.email ?? str(row?['email']) ?? '',
      fullName: resolvedFullName,
      companyName: str(bizMap['raisonSociale']),
      phone: str(row?['phone']).isNotEmpty
          ? str(row?['phone'])
          : str(personal['phone']),
      address: str(row?['address']).isNotEmpty
          ? str(row?['address'])
          : str(personal['address']),
      accountType: accountType,
      isPro: isPro,
      isAdmin: row?['is_admin'] == true || extras['_isAdmin'] == true,
      plan: plan,
      trialStartedAt: str(extras['_trialStartedAt']).isNotEmpty
          ? str(extras['_trialStartedAt'])
          : null,
      trialQuoteId: str(extras['_trialQuoteId']).isNotEmpty
          ? str(extras['_trialQuoteId'])
          : null,
      trialSaveCount: extras['_trialSaveCount'] is num
          ? (extras['_trialSaveCount'] as num).toInt()
          : 0,
      billingInterval: str(extras['_billingInterval']).isNotEmpty
          ? str(extras['_billingInterval'])
          : null,
      billingStatus: str(extras['_billingStatus']).isNotEmpty
          ? str(extras['_billingStatus'])
          : null,
      hasBillingAccount: extras['_stripeCustomerId'] != null ||
          extras['_hasBillingAccount'] == true,
      profileComplete: profileComplete,
      businessInfoComplete: businessInfoComplete,
      personalInfoComplete: personalInfoComplete,
      logoUrl: str(row?['logo_url']).isNotEmpty
          ? str(row?['logo_url'])
          : str(extras['_logoUrl']),
      businessInfo: bizMap,
      personalInfo: personal,
      professions: professions,
      addonWebsite: extras['_addonWebsite'] == true,
      premiumTools: extras['_addonPremium'] == true || extras['_premiumTools'] == true,
    );
  }
}

/// Re-evaluates whenever the session changes; `null` when signed out.
final currentAccountProvider = FutureProvider<KojiAccount?>((ref) async {
  final user = ref.watch(authProvider).valueOrNull;
  if (user == null) return null;
  try {
    final row = await ref.read(userRepositoryProvider).getUser(user.id);
    return KojiAccount.from(user, row);
  } catch (_) {
    return KojiAccount.from(user, null);
  }
});
