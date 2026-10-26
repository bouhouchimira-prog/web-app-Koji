import { Quote } from '@/types';

export const quotes: Quote[] = [
  {
    id: "Q-2024-001",
    clientName: "Morgan Creative Group",
    clientEmail: "alex@creative.com",
    projectTitle: "Aménagement de Bureau Minimaliste",
    status: "Sent",
    issuedDate: "2024-03-10",
    validUntil: "2024-03-24",
    total: 12500,
    items: [
      {
        id: "1",
        description: "Conception & Planification Spatiale",
        quantity: 1,
        unitPrice: 2500,
      },
      {
        id: "2",
        description: "Menuiserie Sur Mesure (Banque d'Accueil)",
        quantity: 1,
        unitPrice: 4500,
      },
      {
        id: "3",
        description: "Cloisons Vitrées Acoustiques (Salle de Réunion)",
        quantity: 25,
        unitPrice: 180,
      },
      {
        id: "4",
        description: "Installation & Gestion de Chantier",
        quantity: 1,
        unitPrice: 1000,
      },
    ],
  },
  {
    id: "Q-2024-002",
    clientName: "Morgan Creative Group",
    clientEmail: "alex@creative.com",
    projectTitle: "Rénovation du Hall Phase 1",
    status: "Accepted",
    issuedDate: "2024-01-15",
    validUntil: "2024-01-30",
    total: 8200,
    items: [],
    signedAt: "2024-01-18T10:30:00Z",
  },
];
