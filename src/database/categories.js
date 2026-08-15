// src/database/categories.js
export const defaultCategories = [
  { name: "Véhicule", type: "VARIABLE", children: ["Carburant", "Assurance", "Entretien", "Réparation", "Pneus", "Contrôle technique", "Parking", "Péage", "Lavage", "Autre véhicule"] },
  { name: "Logement", type: "FIXED", children: ["Loyer / crédit", "Électricité", "Gaz", "Eau", "Internet", "Assurance habitation", "Entretien", "Autre"] },
  { name: "Abonnements", type: "FIXED", children: ["Téléphone", "Streaming", "Logiciels", "Jeux", "Cloud", "Autre abonnement"] },
  { name: "Alimentation", type: "VARIABLE", children: ["Courses", "Restaurant", "Fast-food", "Livraison", "Autre"] },
  { name: "Loisirs", type: "VARIABLE", children: ["Jeux vidéo", "Sortie", "Cinéma", "Voyage", "Shopping", "Autre"] },
  { name: "Santé", type: "VARIABLE", children: ["Médecin", "Pharmacie", "Mutuelle", "Autre"] },
  { name: "Projets", type: "FIXED", children: ["Épargne projet"] },
  { name: "Dépenses diverses", type: "VARIABLE", children: ["Achat", "Cadeau", "Retrait espèces", "Frais bancaire", "Administratif", "Autre"] }
];
