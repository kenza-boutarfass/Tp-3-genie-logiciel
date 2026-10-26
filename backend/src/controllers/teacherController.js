const db = require('../config/database');
const { positiveId } = require('../utils/validation');
const { saveRollCall, updateAbsence } = require('../services/attendanceService');
const { notifyNewAbsences } = require('../services/notificationService');

function teacherIdForUser(userId) {
  return db.prepare('SELECT id FROM enseignants WHERE utilisateur_id = ?').get(userId)?.id;
}

function listSessions(req, res) {
  const teacherId = teacherIdForUser(req.user.id);
  const rows = db.prepare(`SELECT s.id, s.date, s.heure_debut AS heureDebut, s.heure_fin AS heureFin, s.salle,
    m.id AS matiereId, m.nom AS matiere, g.id AS groupeId, g.nom AS groupe
    FROM seances s JOIN matieres m ON m.id = s.matiere_id JOIN groupes g ON g.id = s.groupe_id
    WHERE s.enseignant_id = ? ORDER BY s.date, s.heure_debut`).all(teacherId || -1);
  res.json(rows);
}

function sessionStudents(req, res) {
  const teacherId = teacherIdForUser(req.user.id);
  const sessionId = Number(req.params.id);
  const session = db.prepare('SELECT groupe_id FROM seances WHERE id = ? AND enseignant_id = ?').get(sessionId, teacherId || -1);
  if (!session) return res.status(404).json({ message: 'Séance introuvable ou non autorisée.' });
  const rows = db.prepare(`SELECT et.id AS etudiantId, et.matricule, u.nom, u.prenom,
    EXISTS(SELECT 1 FROM absences a WHERE a.etudiant_id = et.id AND a.seance_id = ?) AS absent
    FROM etudiants et JOIN utilisateurs u ON u.id = et.utilisateur_id
    WHERE et.groupe_id = ? ORDER BY u.nom COLLATE NOCASE, u.prenom COLLATE NOCASE`).all(sessionId, session.groupe_id);
  res.json(rows);
}

function submitRollCall(req, res) {
  try {
    const sessionId = positiveId(req.params.id, 'Séance');
    const result = saveRollCall(teacherIdForUser(req.user.id) || -1, sessionId, req.body.presences);
    notifyNewAbsences(result.insertedStudentIds, sessionId).catch((error) => console.error('Échec notification Expo :', error.message));
    res.json({ message: 'Absences enregistrées avec succès', nombreAbsences: result.absenceCount });
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
}

function patchAbsence(req, res) {
  try {
    updateAbsence(teacherIdForUser(req.user.id) || -1, positiveId(req.params.id, 'Absence'), req.body.statut);
    res.json({ message: 'Absence mise à jour.' });
  } catch (error) {
    res.status(error.status || 400).json({ message: error.message });
  }
}

function studentStatistics(req, res) {
  const studentId = Number(req.params.etudiantId);
  const student = db.prepare('SELECT id FROM etudiants WHERE id = ?').get(studentId);
  if (!student) return res.status(404).json({ message: 'Étudiant introuvable.' });
  const teacherId = teacherIdForUser(req.user.id);
  const visible = db.prepare('SELECT 1 FROM seances s JOIN etudiants e ON e.groupe_id = s.groupe_id WHERE s.enseignant_id = ? AND e.id = ?').get(teacherId || -1, studentId);
  if (!visible) return res.status(403).json({ message: 'Cet étudiant ne fait pas partie de vos groupes.' });
  const rows = db.prepare(`SELECT m.nom AS matiere, COUNT(DISTINCT s.id) AS totalSeances,
    COUNT(DISTINCT a.id) AS absences, ROUND(100.0 * COUNT(DISTINCT a.id) / MAX(COUNT(DISTINCT s.id), 1), 1) AS taux
    FROM seances s JOIN matieres m ON m.id = s.matiere_id LEFT JOIN absences a ON a.seance_id = s.id AND a.etudiant_id = ?
    WHERE s.enseignant_id = ? AND s.groupe_id = (SELECT groupe_id FROM etudiants WHERE id = ?)
    GROUP BY m.id ORDER BY m.nom`).all(studentId, teacherId, studentId);
  const global = rows.reduce((acc, row) => ({ absences: acc.absences + row.absences, total: acc.total + row.totalSeances }), { absences: 0, total: 0 });
  const history = db.prepare(`SELECT a.id, a.statut, s.date, s.heure_debut AS heureDebut, s.heure_fin AS heureFin,
    m.nom AS matiere FROM absences a JOIN seances s ON s.id = a.seance_id JOIN matieres m ON m.id = s.matiere_id
    WHERE a.etudiant_id = ? AND s.enseignant_id = ? ORDER BY s.date DESC, s.heure_debut DESC`).all(studentId, teacherId);
  res.json({ matieres: rows, history, global: { ...global, taux: global.total ? Number((100 * global.absences / global.total).toFixed(1)) : 0 } });
}

module.exports = { listSessions, sessionStudents, submitRollCall, patchAbsence, studentStatistics };