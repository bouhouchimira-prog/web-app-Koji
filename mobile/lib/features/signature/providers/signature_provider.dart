import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/features/signature/repository/signature_repository.dart';

final signatureRepositoryProvider = Provider<SignatureRepository>((ref) {
  return SignatureRepository();
});
