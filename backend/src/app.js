const express = require('express');
const cors = require('cors');
const path = require('node:path');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const teacherRoutes = require('./routes/teacher');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }), authRoutes);
app.use('/api/etudiant', studentRoutes);
app.use('/api/enseignant', teacherRoutes);
app.use('/api/admin', adminRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: { title: 'API de gestion des absences', version: '1.0.0', description: 'API REST de l’application universitaire.' },
    servers: [{ url: '/api' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } }
  },
  apis: []
});
swaggerSpec.paths = {
  '/health': { get: { summary: 'Vérifier que l’API répond', responses: { 200: { description: 'API opérationnelle' } } } },
  '/auth/login': {
    post: {
      summary: 'Connexion par email et mot de passe',
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'motDePasse'], properties: { email: { type: 'string', format: 'email' }, motDePasse: { type: 'string' } } } } } },
      responses: { 200: { description: 'JWT et profil utilisateur' }, 400: { description: 'Requête invalide' }, 401: { description: 'Identifiants incorrects' } }
    }
  },
  '/etudiant/absences': {
    get: {
      summary: 'Lister et filtrer les absences de l’étudiant connecté',
      security: [{ bearerAuth: [] }],
      parameters: [{ in: 'query', name: 'matiereId', schema: { type: 'integer' }, description: 'Filtrer par matière' }],
      responses: { 200: { description: 'Absences, cumul horaire et matières' }, 401: { description: 'Authentification requise' }, 403: { description: 'Rôle non autorisé' } }
    }
  },
  '/etudiant/absences/{id}': {
    get: {
      summary: 'Consulter le détail d’une absence',
      security: [{ bearerAuth: [] }],
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
      responses: { 200: { description: 'Détail et justificatifs associés' }, 404: { description: 'Absence introuvable' } }
    }
  },
  '/etudiant/emploi-du-temps': {
    get: {
      summary: 'Consulter l’emploi du temps',
      security: [{ bearerAuth: [] }],
      parameters: [
        { in: 'query', name: 'debut', schema: { type: 'string', format: 'date' } },
        { in: 'query', name: 'fin', schema: { type: 'string', format: 'date' } }
      ],
      responses: { 200: { description: 'Séances du groupe sur la période choisie' }, 400: { description: 'Période invalide' } }
    }
  },
  '/etudiant/profil': {
    get: { summary: 'Consulter le profil et les préférences', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Profil étudiant' } } }
  },
  '/etudiant/profil/notifications': {
    patch: {
      summary: 'Activer ou désactiver les notifications',
      security: [{ bearerAuth: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['notificationsActives'], properties: { notificationsActives: { type: 'boolean' } } } } } },
      responses: { 200: { description: 'Préférence mise à jour' }, 400: { description: 'Valeur invalide' } }
    }
  },
  '/etudiant/profil/push-token': {
    post: {
      summary: 'Enregistrer un jeton de notification Expo',
      security: [{ bearerAuth: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } } } } },
      responses: { 200: { description: 'Appareil enregistré' }, 400: { description: 'Jeton invalide' } }
    },
    delete: { summary: 'Désactiver les notifications sur cet appareil', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Appareil désactivé' } } }
  },
  '/etudiant/justificatifs': {
    get: { summary: 'Lister les justificatifs de l’étudiant connecté', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Liste des justificatifs' } } }
  },
  '/etudiant/absences/{id}/justificatifs': {
    post: {
      summary: 'Déposer un justificatif pour une absence',
      security: [{ bearerAuth: [] }],
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
      requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['fichier', 'motif', 'dateDebut', 'dateFin'], properties: { fichier: { type: 'string', format: 'binary' }, motif: { type: 'string' }, dateDebut: { type: 'string', format: 'date' }, dateFin: { type: 'string', format: 'date' } } } } } },
      responses: { 201: { description: 'Justificatif déposé' }, 400: { description: 'Fichier ou période invalide' }, 404: { description: 'Absence introuvable' } }
    }
  },
  '/etudiant/justificatifs/{id}/fichier': {
    get: { summary: 'Télécharger un justificatif appartenant à l’étudiant connecté', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Fichier justificatif' }, 404: { description: 'Fichier introuvable' } } }
  },
  '/enseignant/seances': {
    get: { summary: 'Lister les séances de l’enseignant connecté', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Séances affectées' } } }
  },
  '/enseignant/seances/{id}/etudiants': {
    get: { summary: 'Lister les étudiants d’une séance et leur présence enregistrée', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Étudiants du groupe' }, 404: { description: 'Séance introuvable ou non autorisée' } } }
  },
  '/enseignant/seances/{id}/appel': {
    post: {
      summary: 'Enregistrer atomiquement l’appel complet d’une séance',
      security: [{ bearerAuth: [] }],
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['presences'], properties: { presences: { type: 'array', items: { type: 'object', required: ['etudiantId', 'present'], properties: { etudiantId: { type: 'integer' }, present: { type: 'boolean' } } } } } } } } },
      responses: { 200: { description: 'Appel enregistré' }, 400: { description: 'Présences incomplètes ou invalides' }, 404: { description: 'Séance introuvable ou non autorisée' } }
    }
  },
  '/enseignant/absences/{id}': {
    patch: {
      summary: 'Modifier le statut d’une absence dans les 24 heures de la séance',
      security: [{ bearerAuth: [] }],
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['statut'], properties: { statut: { type: 'string', enum: ['Non justifiée', 'En attente', 'Justifiée'] } } } } } },
      responses: { 200: { description: 'Absence mise à jour et journalisée' }, 403: { description: 'Délai de modification dépassé' }, 404: { description: 'Absence non autorisée ou introuvable' } }
    }
  },
  '/enseignant/etudiants/{etudiantId}/statistiques': {
    get: { summary: 'Consulter les statistiques d’un étudiant appartenant à un groupe enseigné', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'etudiantId', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Taux par matière et historique des absences' }, 403: { description: 'Étudiant hors des groupes de l’enseignant' }, 404: { description: 'Étudiant introuvable' } } }
  },
  '/admin/utilisateurs': {
    get: { summary: 'Lister les comptes étudiants et enseignants', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Comptes administrables' } } }
  },
  '/admin/etudiants': {
    post: {
      summary: 'Créer un compte étudiant et son profil',
      security: [{ bearerAuth: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nom', 'prenom', 'email', 'matricule', 'groupeId'], properties: { nom: { type: 'string' }, prenom: { type: 'string' }, email: { type: 'string', format: 'email' }, matricule: { type: 'string' }, groupeId: { type: 'integer' } } } } } },
      responses: { 201: { description: 'Compte créé avec mot de passe temporaire' }, 409: { description: 'Email ou matricule déjà utilisé' } }
    }
  },
  '/admin/etudiants/{id}': {
    patch: {
      summary: 'Modifier un compte étudiant ou son groupe',
      security: [{ bearerAuth: [] }],
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nom', 'prenom', 'email', 'matricule', 'groupeId'], properties: { nom: { type: 'string' }, prenom: { type: 'string' }, email: { type: 'string', format: 'email' }, matricule: { type: 'string' }, groupeId: { type: 'integer' } } } } } },
      responses: { 200: { description: 'Étudiant mis à jour' }, 404: { description: 'Étudiant introuvable' }, 409: { description: 'Email ou matricule déjà utilisé' } }
    }
  },
  '/admin/enseignants': {
    post: {
      summary: 'Créer un compte enseignant',
      security: [{ bearerAuth: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nom', 'prenom', 'email', 'departement'], properties: { nom: { type: 'string' }, prenom: { type: 'string' }, email: { type: 'string', format: 'email' }, departement: { type: 'string' } } } } } },
      responses: { 201: { description: 'Compte créé avec mot de passe temporaire' }, 409: { description: 'Email déjà utilisé' } }
    }
  },
  '/admin/groupes': {
    get: { summary: 'Lister les groupes et effectifs', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Groupes' } } },
    post: {
      summary: 'Créer un groupe',
      security: [{ bearerAuth: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nom', 'filiere'], properties: { nom: { type: 'string' }, filiere: { type: 'string' }, niveau: { type: 'string', default: 'L1' } } } } } },
      responses: { 201: { description: 'Groupe créé' }, 409: { description: 'Nom de groupe déjà utilisé' } }
    }
  },
  '/admin/groupes/{id}': {
    patch: {
      summary: 'Modifier un groupe',
      security: [{ bearerAuth: [] }],
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nom', 'filiere'], properties: { nom: { type: 'string' }, filiere: { type: 'string' }, niveau: { type: 'string' } } } } } },
      responses: { 200: { description: 'Groupe mis à jour' }, 409: { description: 'Nom de groupe déjà utilisé' } }
    }
  },
  '/admin/seances': {
    post: {
      summary: 'Créer une séance et affecter son enseignant',
      security: [{ bearerAuth: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['matiereId', 'groupeId', 'enseignantId', 'date', 'heureDebut', 'heureFin', 'salle'], properties: { matiereId: { type: 'integer' }, groupeId: { type: 'integer' }, enseignantId: { type: 'integer' }, date: { type: 'string', format: 'date' }, heureDebut: { type: 'string', example: '09:00' }, heureFin: { type: 'string', example: '10:30' }, salle: { type: 'string' } } } } } },
      responses: { 201: { description: 'Séance créée' }, 400: { description: 'Horaire ou référence invalide' } }
    }
  },
  '/admin/referentiels': {
    get: { summary: 'Lister les groupes, matières et enseignants disponibles', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Données de référence' } } }
  },
  '/admin/justificatifs': {
    get: { summary: 'Lister les justificatifs à traiter et leur historique', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Justificatifs étudiants' } } }
  },
  '/admin/justificatifs/{id}': {
    patch: {
      summary: 'Valider ou refuser un justificatif',
      security: [{ bearerAuth: [] }],
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['statut'], properties: { statut: { type: 'string', enum: ['Validé', 'Refusé'] }, motifRefus: { type: 'string' } } } } } },
      responses: { 200: { description: 'Décision enregistrée' }, 400: { description: 'Décision invalide ou motif de refus manquant' }, 404: { description: 'Justificatif introuvable' } }
    }
  },
  '/admin/justificatifs/{id}/fichier': {
    get: { summary: 'Télécharger un justificatif en tant qu’administrateur', security: [{ bearerAuth: [] }], parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Fichier justificatif' }, 404: { description: 'Fichier introuvable' } } }
  },
  '/admin/statistiques': {
    get: {
      summary: 'Consulter les statistiques d’absence par filière, niveau et matière',
      security: [{ bearerAuth: [] }],
      parameters: [{ in: 'query', name: 'debut', schema: { type: 'string', format: 'date' } }, { in: 'query', name: 'fin', schema: { type: 'string', format: 'date' } }],
      responses: { 200: { description: 'Statistiques agrégées' }, 400: { description: 'Période invalide' } }
    }
  },
  '/admin/statistiques.csv': {
    get: {
      summary: 'Exporter les statistiques au format CSV',
      security: [{ bearerAuth: [] }],
      parameters: [{ in: 'query', name: 'debut', schema: { type: 'string', format: 'date' } }, { in: 'query', name: 'fin', schema: { type: 'string', format: 'date' } }],
      responses: { 200: { description: 'Fichier CSV' }, 400: { description: 'Période invalide' } }
    }
  }
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.static(path.resolve(__dirname, '../../mobile/dist')));
app.get('/', (_req, res) => {
  res.status(200).type('html').send(`<!doctype html>
<html lang="fr">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Campus Présences</title></head>
  <body style="font-family:system-ui,sans-serif;max-width:680px;margin:12vh auto;padding:0 24px;color:#183a36">
    <h1>Campus Présences</h1>
    <p>L’API est en ligne, mais l’interface web n’a pas encore été compilée.</p>
    <p>Dans un autre terminal, exécutez <code>cd mobile; npm run build:web</code>, puis actualisez cette page.</p>
    <p><a href="/api-docs/">Documentation API</a> · <a href="/api/health">État de l’API</a></p>
  </body>
</html>`);
});

app.use((error, _req, res, _next) => {
  if (error instanceof require('multer').MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Le fichier dépasse la taille maximale de 5 Mo.' : 'Fichier invalide.';
    return res.status(400).json({ message });
  }
  res.status(400).json({ message: error.message || 'Requête invalide.' });
});

module.exports = app;