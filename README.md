# Campus Présences

Application de gestion des absences universitaires : API Express/SQLite et application mobile Expo en JavaScript.

## Fonctionnalités

- **Authentification (US01)** : connexion par email, JWT de 12 heures et contrôle d’accès par rôle.
- **Étudiant (US02, US05, US07, US09, US14)** : consulter et filtrer ses absences, voir son emploi du temps, déposer et suivre un justificatif, gérer ses notifications.
- **Enseignant (US03, US04, US08, US10)** : consulter ses séances, effectuer l’appel complet d’un groupe, corriger une absence dans les 24 heures et consulter les statistiques d’un étudiant.
- **Administration (US06, US11, US12, US13, US15)** : créer et modifier les comptes, organiser groupes et séances, traiter les justificatifs, consulter les statistiques et exporter les résultats.

## Prérequis

- Node.js 20 ou supérieur et npm.
- Expo Go ou un simulateur Android/iOS pour l’application mobile.
- Sur Windows, `better-sqlite3` peut nécessiter les outils de compilation C++ si aucun binaire précompilé n’est disponible.

## Guide d’exécution rapide

1. Ouvrez un terminal PowerShell dans le dossier `backend` et installez les dépendances :

```powershell
cd backend
npm install
npm run seed
```

2. Démarrez l’API :

```powershell
npm start
```

3. Ouvrez un second terminal dans le dossier `mobile` pour installer les dépendances et lancer l’application :

```powershell
cd mobile
npm install
npm start
```

4. Vérifiez le service de santé dans le navigateur : `http://localhost:5001/api/health`.

L’application mobile utilisera par défaut l’API locale sur `http://10.0.2.2:5001/api` pour un émulateur Android ou `http://localhost:5001/api` pour un simulateur iOS. Pour la version web, exécutez `npm run build:web` dans `mobile`.

## Installation

Dans un terminal PowerShell ouvert à la racine du projet :

```powershell
cd backend
npm install
npm run seed
```

Dans un second terminal :

```powershell
cd mobile
npm install
```

Le fichier `backend/.env` est prêt pour le développement local. Remplacez `JWT_SECRET` par une valeur aléatoire longue avant toute mise en ligne. Le fichier `.env.example` documente les paramètres disponibles. Les pièces jointes sont conservées dans `backend/uploads/`, et la base SQLite dans `backend/data/`; le schéma est créé au démarrage et `npm run seed` ajoute les données de démonstration manquantes sans effacer les données existantes.

## Démarrage

Dans un terminal PowerShell, démarrez l’API :

```powershell
cd backend
npm start
```

Pour ouvrir l’application dans le navigateur sur `http://localhost:5001/`, générez d’abord le site web :

```powershell
cd mobile
npm run build:web
```

L’API sert alors l’interface web et ses fichiers statiques. Pour utiliser Expo Go ou un simulateur, lancez `npm start` dans `mobile` à la place. L’URL par défaut de l’application est configurée pour l’émulateur Android (`10.0.2.2`), qui pointe vers le PC hébergeant l’API; le navigateur web utilise automatiquement `localhost:5001`.

Sur un téléphone Android réel, remplacez l’URL dans `mobile/app.json` par `http://ADRESSE_IP_DU_PC:5001/api` et connectez les deux appareils au même réseau. Sur un simulateur iOS local, utilisez `http://localhost:5001/api`.

Pour utiliser Expo Go sur un téléphone réel, connectez le téléphone et le PC au même réseau Wi-Fi. L’URL mobile configurée dans `mobile/app.json` pointe actuellement vers `http://192.168.1.139:5001/api`; si l’adresse Wi-Fi du PC change, remplacez-la par `http://ADRESSE_IP_DU_PC:5001/api`, puis redémarrez Expo avec `npx expo start -c`. L’API doit rester démarrée dans le terminal backend. Vérifiez la connexion depuis le téléphone en ouvrant `http://ADRESSE_IP_DU_PC:5001/api/health` dans son navigateur (réponse attendue : `{"status":"ok"}`). Pour un émulateur Android, utilisez `http://10.0.2.2:5001/api`; pour un simulateur iOS local, `http://localhost:5001/api`.

La documentation Swagger couvre les routes de l’API et est disponible sur `http://localhost:5001/api-docs`. Le contrôle de santé est disponible sur `http://localhost:5001/api/health`.

## Comptes de test

Le seed crée un compte administrateur, deux enseignants, dix étudiants, les groupes TD1/TD2, six matières, un emploi du temps réparti sur neuf semaines et des absences avec plusieurs statuts de justificatifs. Le PDF fourni est explicitement fictif et sert uniquement à tester le téléchargement. Mot de passe commun : `Demo1234!`.

- Administrateur : `admin@universite.fr`
- Enseignant : `enseignant@universite.fr`
- Enseignant : `enseignant2@universite.fr`
- Étudiant TD1 : `etudiant1@universite.fr`
- Étudiant TD2 : `etudiant6@universite.fr`

Vous pouvez relancer `npm run seed` pour compléter les données de démonstration; les séances et absences déjà présentes sont conservées et ne sont pas dupliquées.

## Tests

```powershell
cd backend
npm test
```

Les tests d’intégration couvrent l’authentification et les rôles, les absences et justificatifs, les notifications, les statistiques enseignant, la gestion administrative, les exports et la disponibilité de Swagger.

## Notifications push

L’application enregistre un jeton Expo si l’autorisation système est accordée. Pour recevoir des notifications push sur un appareil, configurez un projet EAS et son `projectId` dans `mobile/app.json` (`expo.extra.eas.projectId`). L’envoi passe par Expo Push Service. Les notifications locales sur simulateur dépendent du support fourni par Expo.