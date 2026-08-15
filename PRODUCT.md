<!-- PRODUCT.md -->
# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Node.js, Express, SQLite, HTML, CSS et JavaScript vanilla. L'application doit démarrer avec `npm install` puis `npm start`, et créer automatiquement sa base locale.

## Users

Nummo sert d'abord à une personne qui tient un registre d'argent conservé pour un proche. Le gestionnaire saisit et corrige les mouvements, dépenses, catégories, budgets et récurrences. Le propriétaire consulte sa situation financière sans pouvoir la modifier.

## Product Purpose

Nummo est un registre financier personnel : il distingue l'argent réellement détenu des dépenses observées, y compris lorsque ces dépenses sont payées depuis un autre compte. Il rend immédiatement lisibles le solde, les coûts mensuels, les tendances, les engagements récurrents et les budgets. Il ne réalise aucun paiement et n'est pas un produit bancaire.

## Positioning

La distinction explicite entre « argent détenu » et « dépense suivie » permet de tenir un compte pour une autre personne sans confondre caisse réelle, habitudes de dépense et paiements externes.

## Operating Context

L'usage est fréquent, sur téléphone comme sur ordinateur : ajout rapide d'un dépôt, retrait ou achat, puis consultation du tableau de bord, de l'historique, du véhicule, des budgets et des statistiques mensuelles. Les montants sont exprimés en euros et conservés en centimes entiers.

## Capabilities and Constraints

- Transactions de dépôt et retrait, avec solde toujours recalculé.
- Dépenses catégorisées, fixes ou variables, éventuellement déduites du solde.
- Catégories système et personnalisées, récurrences, budgets, projections et comparaisons.
- Projets financés dans le temps : comparaison de rythmes mensuels, choix d'une formule, récurrence liée et suivi automatique ou manuel des mensualités.
- Suivi véhicule et carburant avec champs spécialisés facultatifs.
- Recherche, filtres et exports CSV.
- API REST organisée par compte, requêtes paramétrées et validation côté serveur.
- Kyros SSO réel par Authorization Code Flow, vérification des jetons et rotation des refresh tokens ; rôles applicatifs `manager` et `owner`.
- Un compte Nummo propre est provisionné pour chaque identité Kyros ; comptes, mouvements, dépenses, budgets, récurrences et exports sont isolés par utilisateur.
- Page de connexion locale optionnelle avec session signée et cookie HttpOnly lorsque les secrets serveur sont configurés.
- Le premier utilisateur Kyros récupère le compte initial afin de préserver les données existantes ; les suivants reçoivent chacun un registre vide.
- La cible de déploiement reste à décider ; la V1 est autonome en local.

## Brand Commitments

Le produit s'appelle Nummo. La voix est claire, directe et rassurante. L'interface doit être sombre, moderne, élégante, minimaliste et légèrement premium, tout en évitant les codes visuels d'une banque traditionnelle.

## Evidence on Hand

Le cahier des charges complet et ses exemples chiffrés sont fournis dans le prompt de développement. Aucune donnée utilisateur réelle, identité graphique ou ressource de marque n'est fournie ; les données de démonstration ne doivent pas être présentées comme réelles.

## Product Principles

- Distinguer sans ambiguïté argent détenu, dépenses observées et estimations.
- Donner la situation essentielle en quelques secondes, puis permettre d'explorer le détail.
- Garder chaque saisie courte, explicite et sûre sur téléphone.
- Calculer les agrégats depuis les faits enregistrés, jamais depuis des totaux modifiables.
- Rester un outil personnel léger, pas un ERP comptable.

## Accessibility & Inclusion

Navigation clavier, focus visible, contrastes lisibles, libellés explicites, erreurs actionnables et respect de la préférence de réduction des animations.
