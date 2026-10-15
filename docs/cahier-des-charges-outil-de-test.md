# Cahier des charges — Outil de gestion des tests connecté à Jira

Ce document spécifie un outil web interne de gestion des tests manuels, relié à Jira : ce qu'il doit faire, comment il s'intègre à l'existant et comment le construire.

---

## 1. Contexte technique

| Élément | Situation |
| --- | --- |
| Cas de test | Rédigés en Gherkin, dans des fichiers `.feature` versionnés dans Git |
| Source de vérité | Les fichiers `.feature`. L'outil les importe et ne modifie jamais le contenu d'un cas |
| Tests automatisés | Exécutés en CI, qui produit des rapports au format JUnit XML |
| Suivi des anomalies | Jira Data Center (on-premise), API REST v2. Jira Cloud est à prévoir à terme |
| Annuaire | Fournisseur d'identité compatible OpenID Connect (par exemple Azure AD) |

## 2. Objectifs

L'outil permet de :

1. importer les cas depuis les fichiers `.feature` ;
2. organiser des campagnes de test par build et par environnement ;
3. exécuter les cas pas à pas et mesurer leur durée ;
4. créer ou lier un bug Jira depuis une étape en échec ;
5. suivre l'avancement des campagnes et la couverture des exigences ;
6. recevoir les résultats des tests automatisés.

**Hors périmètre :** la rédaction et la modification des cas (elles se font dans Git), la gestion des exigences (elle reste dans Jira ou dans un fichier de référence), l'exécution des tests automatisés, le remplacement de Jira.

## 3. Rôles

| Rôle | Droits |
| --- | --- |
| Administrateur | Tout : import, campagnes, configuration, utilisateurs, jetons d'API |
| Exécutant | Exécution des cas, création et lien de bugs, commentaires et pièces jointes |
| Lecteur | Consultation des cas, des campagnes et des rapports |

Les rôles sont attribués par groupes de l'annuaire.

## 4. Format d'entrée : fichiers `.feature`

### 4.1 Conventions

Les préfixes et mots-clés sont configurables ; les valeurs ci-dessous sont celles par défaut.

| Élément | Convention par défaut | Effet dans l'outil |
| --- | --- | --- |
| Identifiant | Tag `@TC-<id>` sur chaque scénario, stable et unique, jamais renuméroté | Clé du cas |
| `Scenario Outline` | Une ligne d'`Examples` = un cas | ID suffixé : `TC-<id>.1`, `.2`… ; les `<paramètres>` sont remplacés par les valeurs de la ligne |
| Exigence interne | Tag `@REQ-<id>`, un ou plusieurs | Traçabilité vers le référentiel d'exigences |
| Story Jira | Tag `@JIRA-<clé>`, optionnel | Lien vers une story Jira |
| Priorité | Tags `@critical`, `@standard` (liste configurable) | Priorité du cas |
| Mode | Tag `@manual` | Cas manuel |
| État | Tag `@quarantine` | Cas instable, exclu des campagnes par défaut |
| Autres tags | Libres (`@smoke`…) | Filtres de campagne |
| Champs du cas | Lignes de description `Objective:`, `Test data:`, `Cleanup:` sous le titre du scénario | Champs de la fiche |
| Question ouverte | Commentaire `# TODO: …` dans le scénario | Cas au statut « Draft » ; la question est enregistrée |
| Note | Commentaire `# Note: …` dans le scénario | Notes du cas |
| Préconditions | `Background`, puis les `Given` | Préconditions |
| Étape | Chaque `When` | Une étape |
| Résultat attendu | Les `Then`, et les `And` qui les suivent | Résultat attendu de l'étape précédente |
| Héritage | Les tags de la Feature s'appliquent à tous ses scénarios | — |

Un commentaire appartient au scénario dont il est situé entre le premier tag et le scénario suivant.

### 4.2 Exemple

```gherkin
@manual
Feature: User profile

  @TC-PRF-01 @REQ-12 @critical
  Scenario: A new display name is kept after logging in again
    Objective: Check that a profile change is saved and shown everywhere.
    Test data: A test account with a known display name.
    Given I am logged in with a test account
    When I change my display name
    And I log out and log in again
    Then the new display name is shown in the header
    And the new display name is shown on the profile page
```

Résultat de l'import :

| Champ | Valeur |
| --- | --- |
| ID | `TC-PRF-01` |
| Exigences | `REQ-12` |
| Priorité | Critical |
| Préconditions | I am logged in with a test account |
| Étape 1 | I change my display name |
| Étape 2 | I log out and log in again — attendu : the new display name is shown in the header ; the new display name is shown on the profile page |

### 4.3 Règles d'import

1. Parser avec `@cucumber/gherkin`.
2. Rejeter l'import entier, avec un rapport qui donne le fichier et la ligne, si un scénario n'a pas d'identifiant, si deux cas partagent un identifiant, ou si un tag obligatoire configuré (par exemple `@REQ-`) manque.
3. Calculer une empreinte (hash) du contenu de chaque cas. Créer une nouvelle version d'un cas seulement si son empreinte change.
4. Un cas présent auparavant et absent du nouvel import passe au statut « Retiré ». Il n'est jamais supprimé, pour garder l'historique de ses exécutions.
5. Enregistrer chaque import comme une révision : date, auteur, commit Git s'il est fourni, rapport.

## 5. Exigences fonctionnelles

Lot : **MVP** = première version utilisable, **V1** = version complète, **V2** = plus tard.

### 5.1 Référentiel de cas

| ID | Exigence | Lot |
| --- | --- | --- |
| EF-01 | Importer une archive `.zip` de fichiers `.feature`, par téléversement ou par l'API (appel depuis la CI) | MVP |
| EF-02 | Appliquer les règles d'import du §4.3 et afficher le rapport : cas créés, modifiés, retirés, erreurs | MVP |
| EF-03 | Lister les cas avec recherche (ID, texte) et filtres (tags, priorité, statut Ready / Draft / Retiré, exigence) | MVP |
| EF-04 | Fiche de cas en lecture seule : objectif, préconditions, données, étapes et résultats attendus, nettoyage, notes, questions ouvertes, source (fichier et ligne), historique des versions et des exécutions | MVP |
| EF-05 | Importer le référentiel d'exigences depuis un fichier Excel ou CSV (identifiant, titre, description, priorité), avec correspondance des colonnes configurable. En MVP, les exigences sont créées à partir des tags | V1 |

### 5.2 Campagnes

| ID | Exigence | Lot |
| --- | --- | --- |
| EF-06 | Créer une campagne : nom, build ou version, environnement, dates prévues, expression de tags pour sélectionner les cas (par exemple `@critical and not @quarantine`, syntaxe de `@cucumber/tag-expressions`) avec aperçu du nombre de cas. Les cas Draft et Retirés sont exclus par défaut | MVP |
| EF-07 | Figer la sélection au lancement : la campagne garde la version de chaque cas, un import ultérieur ne la modifie pas | MVP |
| EF-08 | Assigner chaque cas à un exécutant, individuellement ou en lot | MVP |
| EF-09 | Clôturer une campagne. Au-delà d'un seuil configurable de cas « Blocked » (10 % par défaut), la signaler « à rejouer » | MVP |
| EF-10 | Dupliquer une campagne pour la rejouer sur un autre build | MVP |
| EF-11 | Définir des critères d'entrée et de sortie par campagne, affichés sous forme de liste à cocher | V1 |

### 5.3 Exécution

| ID | Exigence | Lot |
| --- | --- | --- |
| EF-12 | Exécuter un cas pas à pas : préconditions et données affichées en tête, puis chaque étape avec son action, son résultat attendu et un statut à choisir (Passed, Failed, Blocked, Not run) | MVP |
| EF-13 | Statut du cas déduit des étapes : Failed si une étape est Failed, sinon Blocked si une étape est Blocked, sinon Passed si toutes sont Passed, sinon Not run. Modifiable manuellement, avec une trace | MVP |
| EF-14 | Commentaire et pièces jointes (captures d'écran, fichiers) par étape ; coller une capture depuis le presse-papiers ; taille maximale configurable | MVP |
| EF-15 | Chronomètre : démarrage à l'ouverture, pause, arrêt à la validation ; durée corrigible | MVP |
| EF-16 | Motif obligatoire pour le statut « Blocked » | MVP |
| EF-17 | Verrou : un cas en cours d'exécution ne peut pas être ouvert en écriture par une autre personne | MVP |
| EF-18 | Sauvegarde automatique à chaque changement : fermer l'onglet ne fait rien perdre | MVP |
| EF-19 | Passer au cas suivant de la campagne sans revenir à la liste | MVP |

### 5.4 Intégration Jira

| ID | Exigence | Lot |
| --- | --- | --- |
| EF-20 | Créer un bug Jira depuis une étape en échec, dans une fenêtre pré-remplie et modifiable : résumé, description (ID et titre du cas, étape, résultat attendu, résultat observé, build, environnement, lien vers l'exécution), champs obligatoires du projet. Les pièces jointes de l'étape sont envoyées au bug | MVP |
| EF-21 | Lier un bug existant par sa clé Jira, après vérification qu'il existe | MVP |
| EF-22 | Ajouter dans le bug un lien distant vers l'exécution | MVP |
| EF-23 | Afficher le statut et la résolution des bugs liés, rafraîchis à l'affichage (avec un cache de 5 minutes) | MVP |
| EF-24 | Afficher le titre et le statut des stories référencées par `@JIRA-<clé>` | V1 |

### 5.5 Rapports

| ID | Exigence | Lot |
| --- | --- | --- |
| EF-25 | Tableau de bord d'une campagne : avancement, répartition des statuts, taux d'exécution, taux de réussite (Passed sur Passed + Failed), durée totale, bugs liés et leur statut | MVP |
| EF-26 | Page d'accueil : campagnes en cours, cas qui me sont assignés | MVP |
| EF-27 | Matrice de traçabilité : pour chaque exigence, ses cas et leur dernier statut ; couverture « Ready », « Draft » ou « Non couverte » | V1 |
| EF-28 | Historique d'un cas sur toutes les campagnes ; signalement des cas instables (deux verdicts différents sur un même build) | V1 |
| EF-29 | Exports Excel des campagnes et de la matrice ; rapport de campagne imprimable en HTML | V1 |
| EF-30 | Indicateurs dans le temps : durée des campagnes, délai de résolution des bugs (dates lues dans Jira), part des exécutions automatisées | V2 |

### 5.6 Résultats automatisés

| ID | Exigence | Lot |
| --- | --- | --- |
| EF-31 | Recevoir par l'API un rapport JUnit XML, avec le build, l'environnement et éventuellement la campagne cible | V1 |
| EF-32 | Rattacher chaque test au cas dont l'identifiant `TC-<id>` apparaît dans son nom. Créer une exécution de type « automatisée » ; lister les tests sans correspondance dans le rapport de réception | V1 |
| EF-33 | Distinguer exécutions manuelles et automatisées dans tous les rapports | V1 |

### 5.7 Administration

| ID | Exigence | Lot |
| --- | --- | --- |
| EF-34 | Associer les groupes de l'annuaire aux rôles | MVP |
| EF-35 | Configurer Jira : URL, jeton, projet, type de ticket, valeurs par défaut des champs obligatoires ; bouton « Tester la connexion » | MVP |
| EF-36 | Configurer les conventions d'import du §4.1 (préfixes de tags, tags de priorité, mots-clés de description et de commentaires, tags obligatoires) | MVP |
| EF-37 | Créer et révoquer des jetons d'API pour la CI | MVP |
| EF-38 | Journal d'audit : qui a importé, exécuté, modifié un statut, créé un bug, et quand | V1 |

## 6. Exigences non fonctionnelles

| ID | Exigence |
| --- | --- |
| ENF-01 | Déploiement sur un serveur interne avec `docker compose` : application, base PostgreSQL, volume pour les pièces jointes. Sauvegarde quotidienne de la base et du volume, procédure de restauration documentée |
| ENF-02 | Authentification unique par OpenID Connect. Pas de comptes locaux, sauf un compte administrateur de secours désactivable |
| ENF-03 | API authentifiée par jeton de service (en-tête `Authorization: Bearer`), jamais par un compte utilisateur |
| ENF-04 | Jira : jeton d'accès personnel (PAT) d'un compte de service, stocké chiffré. Le connecteur est isolé derrière une interface pour ajouter Jira Cloud plus tard |
| ENF-05 | Sécurité : HTTPS uniquement, en-têtes de sécurité, protection CSRF, validation de tous les fichiers téléversés (type, taille), analyse des dépendances en CI, aucun secret dans le dépôt |
| ENF-06 | Confidentialité : les pièces jointes peuvent contenir des données sensibles. Accès réservé aux utilisateurs connectés selon leur rôle, durée de conservation configurable, aucun lien public |
| ENF-07 | Volumétrie : jusqu'à 500 cas, 50 campagnes par an, 10 utilisateurs. Pages affichées en moins d'une seconde |
| ENF-08 | Navigateurs Edge et Chrome récents, sur poste de travail. Interface en français |
| ENF-09 | Réversibilité : export complet des données en JSON |
| ENF-10 | Qualité : tests unitaires du parseur, du calcul des statuts et du connecteur Jira (Jira simulé) ; tests de bout en bout des parcours principaux ; CI sur chaque merge request ; README d'installation et d'exploitation |

## 7. Architecture proposée

| Couche | Choix proposé | Raison |
| --- | --- | --- |
| Frontend | Angular ou React, en TypeScript | Écosystème courant, typage partagé avec le backend |
| Backend | Node.js avec NestJS, en TypeScript | Réutilise `@cucumber/gherkin` et `@cucumber/tag-expressions` |
| Base de données | PostgreSQL, accès par Prisma ou TypeORM | Relationnel, migrations versionnées |
| Authentification | OpenID Connect | Compatible avec les annuaires d'entreprise |
| Pièces jointes | Volume Docker monté sur le serveur | Simple ; à remplacer par un stockage objet si le volume grossit |
| Déploiement | Image Docker unique (front servi par le back) et `docker compose` | Une seule chose à installer |

Modules du backend : `auth`, `imports`, `cases`, `campaigns`, `executions`, `attachments`, `jira`, `reports`, `automation`, `admin`.

## 8. Modèle de données

| Entité | Champs principaux |
| --- | --- |
| User | id, identifiant de l'annuaire, nom, email, rôle |
| Requirement | id, titre, description, priorité, source (fichier ou tag) |
| ImportRevision | id, date, auteur, commit Git, rapport (JSON) |
| TestCase | id (`TC-<id>`), statut (READY, DRAFT, RETIRED), priorité, tags, exigences, version courante |
| TestCaseVersion | id, testCase, révision, empreinte, titre, objectif, données, préconditions, nettoyage, notes, questions ouvertes, fichier source, ligne |
| Step | id, version, ordre, action, résultat attendu |
| Campaign | id, nom, build, environnement, expression de tags, dates, statut (DRAFT, RUNNING, CLOSED), indicateur « à rejouer » |
| Execution | id, campagne, version de cas, assigné, type (MANUAL, AUTOMATED), statut, durée, début, fin, verrou |
| StepResult | id, exécution, étape, statut, commentaire |
| Attachment | id, résultat d'étape, nom, type MIME, taille, chemin, date |
| BugLink | id, exécution, étape, clé Jira, statut et résolution en cache, date de rafraîchissement |
| ImportSettings | préfixes de tags, tags de priorité, mots-clés, tags obligatoires |
| ApiToken | id, nom, empreinte du jeton, création, révocation |
| AuditEvent | id, utilisateur, action, objet, date, détail |

## 9. Écrans

| Écran | Contenu | Lot |
| --- | --- | --- |
| Accueil | Campagnes en cours, cas qui me sont assignés | MVP |
| Cas | Liste filtrable, puis fiche de cas | MVP |
| Import | Téléversement de l'archive, rapport du dernier import, historique des révisions | MVP |
| Campagnes | Liste ; création avec aperçu de la sélection ; vue d'une campagne avec cas, exécutants, statuts et tableau de bord | MVP |
| Exécution | Préconditions, étapes avec statuts, commentaires et pièces jointes, chronomètre, bouton « Créer un bug » sur une étape en échec, bouton « Cas suivant » | MVP |
| Traçabilité | Matrice exigences, cas et statuts | V1 |
| Administration | Rôles, configuration Jira, conventions d'import, jetons d'API, journal d'audit | MVP (audit en V1) |

## 10. API

| Méthode et chemin | Rôle |
| --- | --- |
| `POST /api/imports` | Importer une archive `.zip` de features (multipart) ; renvoie le rapport |
| `GET /api/cases` | Lister les cas, avec filtres en paramètres |
| `GET /api/cases/{id}` | Détail d'un cas, versions et historique |
| `POST /api/campaigns` | Créer une campagne |
| `GET /api/campaigns/{id}` | Détail et indicateurs d'une campagne |
| `POST /api/campaigns/{id}/close` | Clôturer une campagne |
| `PUT /api/executions/{id}/steps/{stepId}` | Enregistrer le statut et le commentaire d'une étape |
| `POST /api/executions/{id}/attachments` | Ajouter une pièce jointe |
| `POST /api/executions/{id}/bugs` | Créer un bug Jira |
| `POST /api/executions/{id}/bugs/link` | Lier un bug existant |
| `POST /api/automation/results` | Recevoir un rapport JUnit XML (jeton de service) |
| `GET /api/reports/traceability` | Matrice de traçabilité |

## 11. Intégration Jira Data Center

| Besoin | Appel REST v2 |
| --- | --- |
| Lire les champs obligatoires du type de ticket | Métadonnées de création du projet et du type de ticket (`createmeta`) |
| Créer le bug | `POST /rest/api/2/issue` |
| Joindre les captures | `POST /rest/api/2/issue/{clé}/attachments`, avec l'en-tête `X-Atlassian-Token: no-check` |
| Ajouter le lien vers l'exécution | `POST /rest/api/2/issue/{clé}/remotelink` |
| Lire statut et résolution | `GET /rest/api/2/issue/{clé}?fields=status,resolution,summary` |

Authentification : en-tête `Authorization: Bearer <PAT>`. Les erreurs Jira (champ manquant, droits, indisponibilité) sont affichées à l'utilisateur ; le bug peut être créé plus tard sans perdre le contenu saisi.

## 12. Points d'attention

- **Scenario Outline et résultats automatisés.** Un framework BDD produit en général un test par ligne d'exemple, mais leur ordre dans le rapport peut ne pas suivre les suffixes `.1`, `.2`. Rattacher par les valeurs de l'exemple présentes dans le nom du test, ou à défaut au cas de base.
- **Réimport pendant une campagne.** Une campagne en cours garde ses versions de cas ; afficher un avertissement si une version plus récente existe.
- **Migration Jira.** Tout appel à Jira passe par le module `jira`, pour pouvoir ajouter un connecteur Jira Cloud sans toucher au reste.

## 13. Critères d'acceptation du MVP

1. Un jeu de fichiers `.feature` d'exemple, fourni avec le projet et contenant au moins un `Scenario Outline`, s'importe avec le nombre de cas et les identifiants attendus. Un second import identique ne crée aucune nouvelle version de cas.
2. Un import contenant deux cas de même identifiant, ou un scénario sans identifiant, est rejeté avec un rapport qui donne le fichier et la ligne.
3. Une campagne `@critical and not @quarantine` s'exécute pas à pas jusqu'à sa clôture, durées enregistrées. Les taux affichés sont égaux à ceux calculés à la main.
4. Depuis une étape en échec, un bug est créé dans Jira Data Center avec les champs pré-remplis, la capture d'écran et le lien vers l'exécution. Un changement de statut dans Jira apparaît dans l'outil.
5. La connexion passe par l'annuaire ; un lecteur ne peut ni exécuter ni importer.
6. Une sauvegarde est restaurée avec succès sur un environnement vierge.

## 14. Informations à obtenir avant de démarrer

- Version exacte de Jira Data Center ; jetons d'accès personnels autorisés ; compte de service ; champs obligatoires du type « Bug » dans le projet cible.
- Serveur d'hébergement, autorisation de Docker, certificat HTTPS.
- Enregistrement de l'application auprès du fournisseur d'identité et groupes à utiliser pour les rôles.
- Durée de conservation des pièces jointes.