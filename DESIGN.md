---
name: "Nummo"
description: "Un registre financier personnel sombre, calme et lisible."
colors:
  ink: "#11100f"
  ink-raised: "#171513"
  ink-soft: "#201d1a"
  paper: "#f3eee5"
  muted: "#c2b9af"
  faint: "#9d968e"
  line: "#332f2b"
  line-soft: "#282521"
  copper: "#d9865b"
  copper-bright: "#f0a276"
  sage: "#8faa91"
  red: "#db7067"
  amber: "#d7ae69"
typography:
  display:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "clamp(44px, 5vw, 72px)"
    fontWeight: 520
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "clamp(27px, 3vw, 39px)"
    fontWeight: 560
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 500
rounded:
  chip: "6px"
  icon: "8px"
  field: "9px"
  control: "10px"
  surface: "14px"
  dialog: "16px"
spacing:
  compact: "4px"
  small: "8px"
  control: "14px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.copper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "40px"
  input:
    backgroundColor: "#0e0d0c"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "9px 11px"
    height: "42px"
  chip:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "5px 9px"
---

# Design System: Nummo

## Overview

**Creative North Star: "Le carnet de nuit"**

Nummo évoque un registre personnel ouvert le soir : sombre, calme, précis et proche de la matière. La densité reste maîtrisée pour rendre les montants immédiatement scannables, avec des couches brunes presque noires, des séparateurs fins et un cuivre utilisé comme annotation chaleureuse.

L'interface est retenue, plate et tonale. Elle doit rester personnelle plutôt que bancaire : pas de chrome institutionnel, pas de surfaces blanches cliniques, pas d'effets luxueux démonstratifs. Les grands chiffres donnent le rythme ; les couleurs sémantiques expliquent l'état sans prendre le dessus.

**Key Characteristics:**

- Encre chaude et papier ivoire, jamais noir et blanc purs.
- Cuivre rare pour l'action et l'orientation.
- Hiérarchie compacte portée par les nombres, les lignes et l'espacement.
- Profondeur tonale au repos ; ombres réservées aux couches temporaires.

## Colors

La palette part de bruns noirs très proches, éclairés par un ivoire doux et un cuivre chaleureux ; sauge, rouge et ambre restent strictement sémantiques.

### Primary

- **Cuivre de marge** : action principale, progression, liens courts et repères actifs.
- **Cuivre éclairé** : survol, focus et accent actif plus lumineux.

### Secondary

- **Sauge comptable** : entrées, valeurs positives et budgets sains.
- **Rouge retenu** : sorties, dépassements, erreurs et actions destructives.
- **Ambre d'échéance** : avertissements et états en attente.

### Neutral

- **Encre de couverture** : fond global et grandes surfaces continues.
- **Encre relevée** : barres de filtres, panneaux secondaires et apartés.
- **Encre souple** : contrôles secondaires, états actifs et marqueurs.
- **Papier ivoire** : texte principal et montants essentiels.
- **Texte feutré / texte lointain** : niveaux secondaires et métadonnées.
- **Trait / trait doux** : structure des grilles, rangées et séparateurs.

### Named Rules

**The Copper Annotation Rule.** Le cuivre signale une action ou une lecture active ; il ne devient jamais une grande couleur de fond décorative.

**The Semantic Restraint Rule.** Sauge, rouge et ambre ne servent qu'à expliquer un état financier ou système.

## Typography

**Display Font:** Sora (avec `system-ui, sans-serif`)
**Body Font:** Sora (avec `system-ui, sans-serif`)

**Character:** Une seule famille variable, géométrique mais douce, donne au registre une voix contemporaine sans le faire ressembler à un tableau bancaire. Les graisses intermédiaires et les approches serrées concentrent l'attention sur les chiffres.

### Hierarchy

- **Display** : réservé au solde principal ; chiffres tabulaires, très grande taille et approche serrée.
- **Headline** : titres de vues, compacts et nettement décrochés du texte d'aide.
- **Title** : titre de page et marque, plus ferme mais sans emphase décorative.
- **Body** : lecture courante courte ; les introductions restent limitées à environ 62 caractères.
- **Label** : métadonnées, contrôles, tableaux et légendes, généralement entre 9 et 12 px.

### Named Rules

**The Numbers Lead Rule.** Les montants majeurs portent la hiérarchie ; les libellés restent petits, calmes et explicites.

## Layout

Sur grand écran, une barre latérale fixe de 232 px accompagne un contenu plafonné à 1600 px, avec un retrait horizontal fluide de 28 à 64 px. Le tableau de bord combine un registre supérieur en trois colonnes et une zone principale asymétrique ; les autres vues privilégient grilles de métriques, listes et doubles colonnes séparées par des traits fins.

À 1100 px, les ensembles de trois ou quatre colonnes se replient en deux. À 780 px, la barre latérale disparaît au profit d'une navigation basse de 76 px, les compositions deviennent linéaires, certaines surfaces débordent jusqu'aux bords de l'écran et les actions tactiles importantes atteignent au moins 42–48 px.

Le rythme alterne densité locale (4–14 px dans les contrôles) et respiration de section (24–72 px). Les séparateurs structurent plus souvent la page que les cartes indépendantes.

## Elevation & Depth

Le système est plat par défaut et construit sa profondeur avec trois encres tonales, des bordures discrètes et un léger dégradé réservé au panneau de solde. Les ombres ne structurent pas la mise en page : elles apparaissent seulement sur les dialogs, les toasts et le point de statut.

### Shadow Vocabulary

- **Dialog suspendu** (`0 28px 80px rgba(0,0,0,.55)`) : détache une tâche modale du registre.
- **Toast bref** (`0 14px 40px rgba(0,0,0,.35)`) : maintient un message temporaire au-dessus du contenu.
- **Halo de statut** (`0 2px 8px rgba(143,170,145,.3)`) : rend le petit indicateur vert perceptible.

### Named Rules

**The Tonal-First Rule.** Une surface permanente gagne en profondeur par la teinte ou le trait, jamais par une ombre portée.

## Shapes

Les formes sont doucement arrondies mais jamais bulbeuses : 9–10 px pour les champs et contrôles, 14 px pour les surfaces, 16 px pour les dialogs. Les pastilles de statut et marqueurs d'opération sont circulaires ; les barres de progression restent droites et très fines. Les listes et rubans utilisent volontiers des angles invisibles et des bordures partagées afin de conserver le geste de registre.

## Components

### Buttons

- **Shape:** contrôle compact à courbe douce, hauteur minimale de 40 px.
- **Primary:** cuivre chaud, texte encre foncée, graisse 600 et padding horizontal de 15 px.
- **Hover / Focus:** translation verticale d'un pixel au survol, cuivre éclairé et focus visible de 2 px décalé de 3 px.
- **Secondary / Quiet / Danger:** encre souple, fond transparent bordé, ou rouge sémantique selon l'engagement de l'action.

### Chips

- **Style:** petite étiquette en encre souple, texte feutré, padding de 5 × 9 px et rayon de 6 px.
- **State:** principalement utilisée pour les sous-catégories ; ce n'est pas un bouton d'action générique.

### Cards / Containers

- **Corner Style:** souvent sans angle visible dans les rubans et listes ; rayon de surface de 14 px pour les apartés autonomes.
- **Background:** encre de couverture, relevée ou souple selon le niveau.
- **Shadow Strategy:** aucune ombre au repos ; profondeur tonale et bordures partagées.
- **Border:** traits fins, continus et peu contrastés.
- **Internal Padding:** généralement 20–30 px pour les panneaux.

### Inputs / Fields

- **Style:** fond presque noir, trait discret, hauteur minimale de 42 px, rayon de 9 px et padding de 9 × 11 px.
- **Focus:** le trait devient cuivre ; le focus clavier global ajoute un contour cuivre éclairé.
- **Error / Disabled:** message rouge clair sous le formulaire ; contrôles désactivés à 45 % d'opacité.

### Navigation

La navigation latérale est compacte et textuelle, avec icônes linéaires de 20 px. L'état actif combine une encre plus chaude, un texte ivoire et une icône cuivre. Sur mobile, cinq destinations/actions occupent une barre basse translucide et floutée ; l'action centrale principale devient circulaire.

### Ledger Rows

Les opérations forment des lignes de 67–72 px séparées par un trait doux. Un marqueur circulaire de 34 px indique le type, le libellé et la métadonnée sont tronqués proprement, et le montant tabulaire reste aligné à droite.

### Dialogs

Les formulaires sont regroupés dans une surface brun-noir de 16 px de rayon, avec une largeur maximale de 580 px, un backdrop sombre flouté et des actions alignées à droite. Les champs se placent par deux puis repassent sur une colonne en mobile.

## Do's and Don'ts

### Do:

- **Do** utiliser les traits et les encres tonales pour organiser les contenus permanents.
- **Do** réserver les grands corps aux montants et garder les libellés compacts.
- **Do** conserver le cuivre pour les actions, le focus, la progression et la navigation active.
- **Do** maintenir les chiffres financiers en variantes tabulaires.

### Don't:

- **Don't** transformer Nummo en interface bancaire bleue, brillante ou institutionnelle.
- **Don't** empiler des cartes flottantes avec des ombres permanentes.
- **Don't** employer les couleurs sémantiques comme décoration.
- **Don't** arrondir chaque conteneur : les listes et rubans doivent rester continus et structurés par leurs lignes.
