import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/auth/repository/user_repository.dart';

/// The signed-in user with the few profile fields the shells display.
class KojiAccount {
  const KojiAccount({
    required this.id,
    required this.email,
    this.fullName = '',
    this.companyName = '',
    this.phone = '',
    this.address = '',
  });

  final String id;
  final String email;
  final String fullName;
  final String companyName;
  final String phone;
  final String address;

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
    final bizMap = biz is Map ? biz : const {};
    return KojiAccount(
      id: user.id,
      email: user.email ?? '',
      fullName: str(row?['full_name']),
      companyName: str(bizMap['raisonSociale']),
      phone: str(row?['phone']),
      address: str(row?['address']),
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
