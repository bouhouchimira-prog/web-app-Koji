import 'package:flutter/material.dart';
import 'package:koji/core/supabase_config.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SupabaseConfig.initialize();

  final client = Supabase.instance.client;
  print('==== DEBUG SUPABASE ====');
  
  try {
    // 1. Check Auth
    final user = client.auth.currentUser;
    if (user == null) {
      print('ERROR: No authenticated user.');
      return;
    }
    print('User logged in: \${user.id}');

    // 2. Insert test task
    // We assume chantier_id exists or we query one
    final chantiers = await client.from('chantiers').select('id').limit(1);
    if (chantiers.isEmpty) {
      print('ERROR: No chantiers found for this user.');
      return;
    }
    final chantierId = chantiers.first['id'];
    print('Using Chantier ID: \$chantierId');

    print('Attempting to insert into chantier_tasks...');
    final response = await client.from('chantier_tasks').insert({
      'chantier_id': chantierId,
      'label': 'Test CLI Task',
      'is_done': false,
    }).select();

    print('SUCCESS! Inserted row: \$response');

  } catch (e, stack) {
    print('EXCEPTION CAUGHT: \$e');
  }
}
