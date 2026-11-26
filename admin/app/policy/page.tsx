import { redirect } from 'next/navigation';

// Ancienne politique de l'app mobile (déclarée aux stores). Une seule
// politique fait foi depuis le 26 nov. 2026 : celle du site.
export default function PrivacyPolicy() {
  redirect('https://getkoji.io/legal/confidentialite');
}
