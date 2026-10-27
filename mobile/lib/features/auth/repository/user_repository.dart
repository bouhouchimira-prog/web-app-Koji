import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:koji/core/supabase_config.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final userRepositoryProvider = Provider<UserRepository>((ref) {
  return UserRepository(SupabaseConfig.client);
});

class UserRepository {
  final SupabaseClient _supabase;
  final Logger _logger = Logger();

  UserRepository(this._supabase);

  Future<void> saveUser(String uid, String email, {bool isPro = false}) async {
    _logger.i('💾 [UserRepository] Saving user to Supabase');
    try {
      await _supabase.from('users').upsert({
        'id': uid,
        'email': email,
        'is_pro': isPro,
        'created_at': DateTime.now().toIso8601String(),
      });
      _logger.i('✅ [UserRepository] User saved successfully');
    } catch (e) {
      _logger.e('❌ [UserRepository] Failed to save user', error: e);
      rethrow;
    }
  }

  /// Mark business-info onboarding as skipped so the splash router stops
  /// sending the user back to /business-info on every cold start.
  /// The user can still fill these fields later from Mon Profil.
  Future<void> markBusinessInfoSkipped(String uid) async {
    _logger.i('⏭️ [UserRepository] Marking business info as skipped');
    try {
      await _supabase.from('users').update({
        'is_business_info_complete': true,
      }).eq('id', uid);
      _logger.i('✅ [UserRepository] Business info skip flag saved');
    } catch (e) {
      _logger.e('❌ [UserRepository] Failed to mark skipped', error: e);
      rethrow;
    }
  }

  Future<void> setIsPro(String uid, bool isPro) async {
    _logger.i('🔧 [UserRepository] Updating is_pro=$isPro for uid=$uid');
    try {
      await _supabase.from('users').update({'is_pro': isPro}).eq('id', uid);
      _logger.i('✅ [UserRepository] is_pro updated successfully');
    } catch (e) {
      _logger.e('❌ [UserRepository] Failed to update is_pro', error: e);
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> getUser(String uid) async {
    _logger.i('🔍 [UserRepository] Fetching user from Supabase');
    try {
      final response =
          await _supabase.from('users').select().eq('id', uid).maybeSingle();

      if (response != null) {
        _logger.i('✅ [UserRepository] User found in Supabase');
      } else {
        _logger.i('⚠️ [UserRepository] User not found in Supabase');
      }
      return response;
    } catch (e) {
      _logger.e('❌ [UserRepository] Failed to fetch user', error: e);
      rethrow;
    }
  }

  Future<String?> uploadBusinessLogo(String uid, String filePath) async {
    _logger.i('📸 [UserRepository] Uploading business logo');
    try {
      final file = File(filePath);
      final bytes = await file.readAsBytes();
      final fileExt = filePath.split('.').last;
      final fileName = '$uid/logo.$fileExt';

      // Upload to Supabase Storage
      await _supabase.storage.from('business-logos').uploadBinary(
            fileName,
            bytes,
            fileOptions: FileOptions(
              upsert: true, // Replace if exists
              contentType: 'image/$fileExt',
            ),
          );

      // Get public URL
      final logoUrl =
          _supabase.storage.from('business-logos').getPublicUrl(fileName);

      _logger.i('✅ [UserRepository] Logo uploaded successfully');
      return logoUrl;
    } catch (e) {
      _logger.e('❌ [UserRepository] Failed to upload logo', error: e);
      rethrow;
    }
  }

  Future<String?> getLogoUrl(String uid) async {
    _logger.i('🔍 [UserRepository] Fetching logo URL');
    try {
      final userData = await getUser(uid);
      final logoUrl = userData?['logo_url'] as String?;

      if (logoUrl != null) {
        _logger.i('✅ [UserRepository] Logo URL found');
      } else {
        _logger.i('⚠️ [UserRepository] No logo URL found');
      }
      return logoUrl;
    } catch (e) {
      _logger.e('❌ [UserRepository] Failed to fetch logo URL', error: e);
      return null;
    }
  }

  Future<void> updateBusinessInfo({
    required String uid,
    required String raisonSociale,
    required String formeJuridique,
    required String siret,
    required String emailPro,
    required String phone,
    required String address,
    required String tva,
    String rcs = '',
    String? logoUrl,
    double? dailyRate,
    double? hoursPerDay,
  }) async {
    _logger.i('💼 [UserRepository] Updating business info');
    try {
      final updateData = {
        'business_info': {
          'raisonSociale': raisonSociale,
          'formeJuridique': formeJuridique,
          'siret': siret,
          'rcs': rcs,
          'emailPro': emailPro,
          'phone': phone,
          'address': address,
          'tva': tva,
          if (dailyRate != null) 'dailyRate': dailyRate,
          if (hoursPerDay != null) 'hoursPerDay': hoursPerDay,
        },
        'is_business_info_complete': true,
      };

      // Add logo URL if provided
      if (logoUrl != null) {
        updateData['logo_url'] = logoUrl;
      }

      await _supabase.from('users').update(updateData).eq('id', uid);
      _logger.i('✅ [UserRepository] Business info updated successfully');
    } catch (e) {
      _logger.e('❌ [UserRepository] Failed to update business info', error: e);
      rethrow;
    }
  }

  /// Fetch all quotes addressed to a client, matched by the client's email.
  ///
  /// A chantier created by an entreprise stores the client's address in
  /// `chantiers.client_email`. Quotes link back to a chantier via
  /// `quotes.chantier_id`. So a client (a "particulier" account) finds *their*
  /// devis by:
  ///   1. selecting the chantiers whose `client_email` == their login email,
  ///   2. loading every quote attached to those chantiers.
  ///
  /// The result is normalized to the same shape produced by
  /// [QuoteRepository.getUserQuotes] so the client screens and the signature
  /// flow can consume it unchanged.
  ///
  /// NOTE: the previous implementation filtered `quotes.user_id == uid`, but
  /// `user_id` is the *entreprise* owner — never the client — so clients saw
  /// nothing. We now match by email instead. Reading another user's chantiers
  /// requires an RLS policy allowing `client_email = auth.jwt() ->> 'email'`
  /// (see supabase/client_access.sql). Without it this returns an empty list.
  Future<List<Map<String, dynamic>>> getClientQuotes(String uid,
      {String? email}) async {
    final clientEmail =
        (email ?? _supabase.auth.currentUser?.email ?? '').trim().toLowerCase();
    _logger.i('📋 [UserRepository] Fetching client quotes for email=$clientEmail');
    if (clientEmail.isEmpty) return [];
    try {
      final chantierIds = await _clientChantierIds(clientEmail);
      if (chantierIds.isEmpty) {
        _logger.i('⚠️ [UserRepository] No chantiers match this client email');
        return [];
      }

      final response = await _supabase
          .from('quotes')
          .select()
          .inFilter('chantier_id', chantierIds)
          .order('created_at', ascending: false);

      final quotes =
          List<Map<String, dynamic>>.from(response).map(_normalizeQuote).toList();
      _logger.i('✅ [UserRepository] Got ${quotes.length} client quotes');
      return quotes;
    } catch (e) {
      _logger.e('❌ [UserRepository] Failed to fetch client quotes', error: e);
      return [];
    }
  }

  /// Read-only list of the works (tasks) for every chantier addressed to this
  /// client, so they can follow progress. Each task carries its chantier
  /// reference for grouping in the UI.
  Future<List<Map<String, dynamic>>> getClientTasks(String uid,
      {String? email}) async {
    final clientEmail =
        (email ?? _supabase.auth.currentUser?.email ?? '').trim().toLowerCase();
    _logger.i('🧱 [UserRepository] Fetching client tasks for email=$clientEmail');
    if (clientEmail.isEmpty) return [];
    try {
      final chantiers = await _supabase
          .from('chantiers')
          .select('id, reference')
          .ilike('client_email', clientEmail);

      final byId = {
        for (final c in chantiers)
          c['id'] as String: (c['reference'] as String?) ?? 'Chantier'
      };
      if (byId.isEmpty) return [];

      final tasks = await _supabase
          .from('chantier_tasks')
          .select()
          .inFilter('chantier_id', byId.keys.toList())
          .order('created_at', ascending: true);

      return List<Map<String, dynamic>>.from(tasks).map((t) {
        return {
          ...t,
          'chantier_reference': byId[t['chantier_id']] ?? 'Chantier',
        };
      }).toList();
    } catch (e) {
      _logger.e('❌ [UserRepository] Failed to fetch client tasks', error: e);
      return [];
    }
  }

  /// IDs of the chantiers whose `client_email` matches [clientEmail]
  /// (case-insensitive).
  Future<List<String>> _clientChantierIds(String clientEmail) async {
    final rows = await _supabase
        .from('chantiers')
        .select('id')
        .ilike('client_email', clientEmail);
    return rows.map((r) => r['id'] as String).toList();
  }

  /// Maps a raw `quotes` row to the UI shape used across the client screens and
  /// the signature flow (mirrors QuoteRepository.getUserQuotes).
  Map<String, dynamic> _normalizeQuote(Map<String, dynamic> quote) {
    Map<String, dynamic> asMap(dynamic v) {
      if (v is Map<String, dynamic>) return v;
      if (v is Map) return Map<String, dynamic>.from(v);
      return {};
    }

    final metadata = asMap(quote['metadata']);
    final client = asMap(metadata['client']);
    final totalHt = quote['total_ht'] ?? 0;
    final tvaRate = quote['tva_rate'] ?? 20;

    return {
      'id': quote['id'],
      'chantier_id': quote['chantier_id'],
      'status': quote['status'] ?? 'Draft',
      'created_at': quote['created_at'],
      'signed_at': quote['signed_at'],
      'signature_data': quote['signature_data'],
      'client': client,
      'quoteNumber': metadata['quoteNumber'] ?? quote['reference'] ?? 'N/A',
      'reference': quote['reference'] ?? metadata['quoteNumber'] ?? 'N/A',
      'date': metadata['date'] ?? '',
      'validity': metadata['validity'] ?? '',
      'siteAddress': metadata['siteAddress'] ?? '',
      'travauxStart': metadata['travauxStart'] ?? '',
      'travauxDuration': metadata['travauxDuration'] ?? '',
      'company': metadata['company'] ?? {},
      'totals': {
        'ht': totalHt,
        'tva': (totalHt is num ? totalHt : 0) * (tvaRate is num ? tvaRate : 20) / 100,
        'ttc': quote['total_ttc'] ?? 0,
      },
      'expenses': {},
      'tasks': {},
    };
  }

  Future<void> updateClientProfile({
    required String uid,
    required String fullName,
    required String phone,
    required String address,
  }) async {
    _logger.i('👤 [UserRepository] Updating client profile');
    try {
      await _supabase.from('users').update({
        'full_name': fullName,
        'phone': phone,
        'address': address,
      }).eq('id', uid);
      _logger.i('✅ [UserRepository] Client profile updated');
    } catch (e) {
      _logger.e('❌ [UserRepository] Failed to update client profile', error: e);
      rethrow;
    }
  }

  Future<void> updateProfession(String uid, List<String> professions) async {
    final professionsString = professions.join(',');
    _logger.i('👔 [UserRepository] Updating professions');
    try {
      await _supabase.from('users').update({
        'profession': professionsString,
        'is_profile_complete': true,
      }).eq('id', uid);
      _logger.i(
          '✅ [UserRepository] Professions updated successfully - Profile marked complete');
    } catch (e) {
      _logger.e('❌ [UserRepository] Failed to update professions', error: e);
      rethrow;
    }
  }
}
