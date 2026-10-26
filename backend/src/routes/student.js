const express = require('express');
const multer = require('multer');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const student = require('../controllers/studentController');
const { requiredText, positiveId } = require('../utils/validation');

const router = express.Router();
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, callback) => callback(null, `${Date.now()}-${require('node:crypto').randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
    const extensions = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
    if (!allowed.has(file.mimetype) || !extensions.has(path.extname(file.originalname).toLowerCase())) {
      return callback(new Error('Format invalide. Formats acceptés : PDF, JPG ou PNG (5 Mo maximum).'));
    }
    callback(null, true);
  }
});

router.use(authenticate, authorize('ETUDIANT'));
router.get('/absences', student.listAbsences);
router.get('/absences/:id', student.absenceDetail);
router.get('/emploi-du-temps', student.schedule);
router.get('/profil', student.getProfile);
router.patch('/profil/notifications', student.updateProfile);
router.post('/profil/push-token', (req, res) => {
  const token = req.body.token;
  if (typeof token !== 'string' || !/^ExponentPushToken\[[^\]]+\]$/.test(token)) return res.status(400).json({ message: 'Jeton de notification invalide.' });
  db.prepare('UPDATE utilisateurs SET expo_push_token = ? WHERE id = ?').run(token, req.user.id);
  res.json({ message: 'Appareil enregistré.' });
});
router.delete('/profil/push-token', (req, res) => {
  db.prepare('UPDATE utilisateurs SET expo_push_token = NULL WHERE id = ?').run(req.user.id);
  res.json({ message: 'Appareil désactivé.' });
});
router.get('/justificatifs', (req, res) => {
  const profile = student.studentIdForUser(req.user.id);
  if (!profile) return res.status(404).json({ message: 'Profil étudiant introuvable.' });
  const rows = db.prepare(`SELECT j.id, j.absence_id AS absenceId, j.fichier, j.motif, j.date_debut AS dateDebut,
    j.date_fin AS dateFin, j.statut, j.motif_refus AS motifRefus, j.date_creation AS dateCreation,
    m.nom AS matiere, s.date FROM justificatifs j JOIN absences a ON a.id = j.absence_id
    JOIN seances s ON s.id = a.seance_id JOIN matieres m ON m.id = s.matiere_id
    WHERE a.etudiant_id = ? ORDER BY j.id DESC`).all(profile.id);
  res.json(rows);
});
router.post('/absences/:id/justificatifs', upload.single('fichier'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Un fichier PDF, JPG ou PNG est obligatoire (5 Mo maximum).' });
    const profile = student.studentIdForUser(req.user.id);
    const absenceId = positiveId(req.params.id, 'Absence');
    const absence = profile && db.prepare('SELECT id FROM absences WHERE id = ? AND etudiant_id = ?').get(absenceId, profile.id);
    if (!absence) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Absence introuvable.' });
    }
    const motif = requiredText(req.body.motif, 'Motif', 1000);
    const dateDebut = requiredText(req.body.dateDebut, 'Date de début', 10);
    const dateFin = requiredText(req.body.dateFin, 'Date de fin', 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateDebut) || !/^\d{4}-\d{2}-\d{2}$/.test(dateFin) || dateDebut > dateFin) {
      throw new Error('La période du justificatif est invalide.');
    }
    const create = db.transaction(() => {
      const result = db.prepare(`INSERT INTO justificatifs (absence_id, fichier, motif, date_debut, date_fin)
        VALUES (?, ?, ?, ?, ?)`).run(absenceId, path.basename(req.file.path), motif, dateDebut, dateFin);
      db.prepare("UPDATE absences SET statut = 'En attente', date_modification = CURRENT_TIMESTAMP WHERE id = ?").run(absenceId);
      return result.lastInsertRowid;
    });
    res.status(201).json({ id: create(), message: 'Justificatif déposé.' });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(400).json({ message: error.message });
  }
});
router.get('/justificatifs/:id/fichier', (req, res) => {
  const profile = student.studentIdForUser(req.user.id);
  const row = profile && db.prepare('SELECT j.fichier FROM justificatifs j JOIN absences a ON a.id = j.absence_id WHERE j.id = ? AND a.etudiant_id = ?').get(Number(req.params.id), profile.id);
  if (!row) return res.status(404).json({ message: 'Fichier introuvable.' });
  res.download(path.join(uploadDir, path.basename(row.fichier)));
});

module.exports = router;