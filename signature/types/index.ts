export interface Service {
  id: string;
  title: string;
  description: string;
  iconName: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
}

export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'en_cours' | 'accepte' | 'refuse';

export interface Attachment {
  id: string;
  bucket_id: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  original_name: string;
  signedUrl: string | null;
}

export interface QuoteComment {
  id: string;
  text: string;
  author: string; // or author_name
  author_email?: string;
  date: string; // created_at
  attachments?: Attachment[];
}

export interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Optional unit label (e.g. "u", "m²", "h") carried from the generator. */
  unit?: string;
  /** Room/zone this line belongs to, so the client can see the grouping. */
  room?: string;
  /** Trade/lot family (e.g. "Peinture", "Plomberie"), used for grouping. */
  famille?: string;
  /** Short task code shown as a badge, mirroring the mobile devis. */
  code?: string;
  /** Whether this is a flat-price (forfait) line. */
  forfait?: boolean;
  /** Per-unit labour (main d'œuvre) price, in € HT. */
  moUnitPrice?: number;
  /** Per-unit materials (fournitures) price, in € HT. */
  fournituresUnitPrice?: number;
  /** Hours per unit, used to print the MO breakdown like the mobile app. */
  hours?: number;
  /** Effective hourly rate (taux × coefficient), for the MO breakdown. */
  effectiveRate?: number;
}

/** Entreprise (company) details shown in the devis header. */
export interface CompanyInfo {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  siret?: string;
  rcs?: string;
  tva?: string;
  formeJuridique?: string;
  /** Capital social (e.g. "10 000 €"), shown in the legal footer. */
  capital?: string;
  /** IBAN / BIC for the "Informations de paiement" block on the devis. */
  iban?: string;
  bic?: string;
  /** Public URL of the company logo. */
  logo?: string;
}

export interface Quote {
  id: string;
  clientName: string;
  clientEmail: string;
  /** The entreprise that issued the devis (from metadata.company). */
  company?: CompanyInfo;
  projectTitle: string;
  /** Devis number, e.g. "2026-0001". */
  quoteNumber?: string;
  /** Devis version, e.g. "01" — tracks revisions of the same devis. */
  version?: string;
  status: QuoteStatus;
  issuedDate: string;
  validUntil: string;
  startDate?: string;
  comments?: QuoteComment[];
  items: QuoteLineItem[];
  /** Total TTC (kept for backwards compatibility with existing callers). */
  total: number;
  /** Real pre-tax total as computed by the generator. */
  totalHT?: number;
  /** Real tax-included total as computed by the generator. */
  totalTTC?: number;
  /** VAT rate in percent (e.g. 20). */
  tvaRate?: number;
  signature?: string; // Base64 signature
  signedAt?: string;
}
