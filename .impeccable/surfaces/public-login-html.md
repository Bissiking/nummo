---
version: 1
slug: "public-login-html"
primary_target: "public/login.html"
related_targets: ["public/css/login.css","public/js/login.js"]
---

Scope: page `/login`, mode Operate.

Audience et tâche: le gestionnaire ouvre son registre privé depuis ordinateur ou téléphone. En mode local protégé, il saisit ses identifiants ; sans secret configuré, il doit comprendre que l'accès local est volontairement ouvert.

Contenu et contraintes: ne jamais simuler Kyros. Distinguer clairement mode local ouvert, session locale protégée et fournisseur externe non configuré. Le mot de passe reste serveur, la session passe par un cookie HttpOnly.

Direction: forme nommée « fermoir scindé », seed key `nummo-ledger-clasp-v1`, extension directe du « carnet de nuit ». La page agit comme le fermoir du registre : monogramme et raison d'être à gauche, accès concentré à droite. Le geste mémorable est l'ouverture latérale sobre du panneau d'accès vers son action cuivre unique, neutralisée lorsque l'utilisateur préfère réduire les animations.

Décision ouverte: le vrai bouton Kyros sera ajouté uniquement avec l'Authorization Code Flow complet.
