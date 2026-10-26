const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const admin = require('../controllers/adminController');
const db = require('../config/database');
const path = require('node:path');
const { requiredText, positiveId } = require('../utils/validation');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));
router.get('/utilisateurs', admin.listUsers);
router.post('/etudiants', admin.createStudent);
router.patch('/etudiants/:id', admin.updateStudent);
router.post('/enseignants', admin.createTeacher);
router.get('/groupes', admin.groups);
router.post('/groupes', admin.groups);
router.patch('/groupes/:id', admin.groups);
router.get('/justificatifs', admin.pendingJustificatifs);
router.get('/justificatifs/:id/fichier', (req, res) => {
  const row = db.prepare('SELECT fichier FROM justificatifs WHERE id = ?').get(Number(req.params.id));
  if (!row) return res.status(404).json({ message: 'Fichier introuvable.' });
  res.download(path.join(path.resolve(process.env.UPLOAD_DIR || './uploads'), path.basename(row.fichier)));
});
router.patch('/justificatifs/:id', admin.reviewJustificatif);
router.get('/statistiques', admin.statistics);
router.get('/statistiques.csv', admin.statisticsCsv);
router.get('/referentiels', (_req, res) => res.json({
  groupes: db.prepare('SELECT id, nom, filiere, niveau FROM groupes ORDER BY nom').all(),
  matieres: db.prepare('SELECT id, nom FROM matieres ORDER BY nom').all(),
  enseignants: db.prepare(`SELECT e.id, u.nom, u.prenom, e.departement FROM enseignants e JOIN utilisateurs u ON u.id = e.utilisateur_id ORDER BY u.nom`).all()
}));
router.post('/seances', (req, res) => {
  try {
    const matiereId = positiveId(req.body.matiereId, 'Matière');
    const groupeId = positiveId(req.body.groupeId, 'Groupe');
    const enseignantId = positiveId(req.body.enseignantId, 'Enseignant');
    const date = requiredText(req.body.date, 'Date', 10);
    const heureDebut = requiredText(req.body.heureDebut, 'Heure de début', 5);
    const heureFin = requiredText(req.body.heureFin, 'Heure de fin', 5);
    const salle = requiredText(req.body.salle, 'Salle', 80);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(heureDebut) || !/^\d{2}:\d{2}$/.test(heureFin) || heureDebut >= heureFin) throw new Error('Date ou horaire invalide.');
    const result = db.prepare('INSERT INTO seances (matiere_id, groupe_id, enseignant_id, date, heure_debut, heure_fin, salle) VALUES (?, ?, ?, ?, ?, ?, ?)').run(matiereId, groupeId, enseignantId, date, heureDebut, heureFin, salle);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (error) { res.status(400).json({ message: error.message }); }
});
module.exports = router;