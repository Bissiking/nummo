<!-- README.md -->
# Nummo

Nummo est un registre personnel permettant de distinguer l'argent réellement détenu des dépenses suivies. L'application ne réalise aucun paiement et ne remplace pas un service bancaire.

## Fonctionnalités

- dépôts et retraits avec solde recalculé depuis l'historique ;
- dépenses fixes ou variables, éventuellement déduites du solde ;
- catégories système et personnalisées ;
- suivi du véhicule et des données de carburant ;
- budgets mensuels, charges récurrentes et projection de fin de mois ;
- projets avec budget cible, formules mensuelles automatiques ou personnalisées, récurrence liée et progression automatique ou manuelle ;
- statistiques sur 3, 6 et 12 mois, comparaisons et graphiques ;
- historique filtrable et exports CSV ;
- API REST et connexion Kyros SSO par Authorization Code Flow.
- registre automatiquement isolé par utilisateur Kyros : chacun ne voit et ne modifie que ses propres données.

## Installation

Prérequis : Node.js 24. Le fichier `.nvmrc` fixe la version utilisée par le projet.

```bash
cp .env.example .env
nvm use
npm install
npm start
```

Ouvrir ensuite [http://localhost:3000](http://localhost:3000). La base SQLite `data/nummo.sqlite` est créée automatiquement, avec un compte initial et les catégories système.

Pour le développement avec rechargement du serveur :

```bash
npm run dev
```

Si Node a été mis à jour après `npm install`, reconstruire le module SQLite natif avant de relancer le serveur :

```bash
npm run rebuild:native
```

## Tests

```bash
npm test
npm run check
```

## Règles métier importantes

- Tous les montants monétaires sont stockés en centimes entiers.
- Le solde n'est jamais stocké : il est calculé depuis les transactions.
- Un retrait supérieur au solde est refusé.
- Une dépense marquée « Déduire du solde » crée un retrait lié dans la même transaction SQLite.
- La suppression ou la modification de cette dépense met à jour proprement le retrait lié.
- Les catégories système sont protégées contre la modification et la suppression.

## API principale

Les ressources sont rattachées à un compte :

```text
GET    /api/accounts
GET    /api/accounts/:accountId/bootstrap
GET    /api/accounts/:accountId/dashboard
GET    /api/accounts/:accountId/history

GET    /api/accounts/:accountId/transactions
POST   /api/accounts/:accountId/transactions
PUT    /api/accounts/:accountId/transactions/:id
DELETE /api/accounts/:accountId/transactions/:id

GET    /api/accounts/:accountId/expenses
POST   /api/accounts/:accountId/expenses
PUT    /api/accounts/:accountId/expenses/:id
DELETE /api/accounts/:accountId/expenses/:id
```

Les catégories, budgets et dépenses récurrentes suivent le même schéma CRUD. Les exports sont disponibles via `/export/transactions.csv` et `/export/expenses.csv`.

## Kyros SSO

Avec `AUTH_PROVIDER=kyros`, Nummo utilise le vrai Authorization Code Flow Kyros : redirection vers `/authorize`, callback serveur `/auth/callback`, échange du code sur `/token`, validation HS256 de l'issuer, des audiences et des scopes, puis cookies HttpOnly avec rotation du refresh token.

Les variables requises figurent dans `.env.example`, notamment la version de protocole `4.4.0`, l'édition, le callback et le scope applicatif. Le `client_secret`, le secret JWT et les jetons restent exclusivement côté serveur.

## Page de connexion locale

La page `/login` fonctionne dans deux modes :

- sans `LOCAL_AUTH_PASSWORD`, elle indique honnêtement que le registre fonctionne en mode local ouvert ;
- avec un mot de passe et un `SESSION_SECRET`, elle protège le registre et l'API avec une session signée en cookie HttpOnly.

Exemple :

```env
AUTH_PROVIDER=local
LOCAL_AUTH_USERNAME=gestionnaire
LOCAL_AUTH_PASSWORD=<mot-de-passe-fort>
SESSION_SECRET=<secret-aleatoire-de-32-caracteres-minimum>
```

En production, utiliser HTTPS afin que le cookie de session porte automatiquement l'attribut `Secure`.

## Structure

```text
src/
  config/       configuration
  controllers/  adaptation HTTP
  database/     schéma et initialisation SQLite
  middleware/   identité, autorisation et erreurs
  repositories/ requêtes SQL paramétrées
  routes/        routes REST
  services/      règles métier et statistiques
  utils/         validation
public/
  css/           interface responsive
  js/            application vanilla
  index.html     shell de l'application
tests/           tests d'intégration
```
