import { redirect } from 'next/navigation'

// Ancienne page « Support & Bugs » (chiffres fictifs) remplacée par le
// Support Pro (maquette PRO-24.8) et le Support Client (PRO-24.12).
export default function Support() {
  redirect('/dashboard/support-pro')
}
