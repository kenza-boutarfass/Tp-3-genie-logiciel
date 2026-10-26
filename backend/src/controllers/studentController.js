const db = require('../config/database');
const users = require('../models/userModel');
const { positiveId } = require('../utils/validation');

function studentIdForUser(userId) {
  return users.findStudentForUser(userId);
}

function listAbsences(req, res) {
  const student = studentIdForUser(req.user.id);
  if (!student) return res.status(404).json({ message: 'Profil étudiant introuvable.' });
  const filters = [student.id];
  let subjectClause = '';
  if (req.query.matiereId) {
    try { filters.push(positiveId(req.query.matiereId, 'Matière')); }
    catch (error) { return res.status(400).json({ message: error.message }); }
    subjectClause = ' AND m.id = ?';
  }
  const rows = db.prepare(`SELECT a.id, a.statut, a.date_creation AS dateCreation, a.date_modification AS dateModification,
    s.date, s.heure_debut AS heureDebut, s.heure_fin AS heureFin, s.salle, m.id AS matiereId, m.nom AS matiere,
    u.prenom || ' ' || u.nom AS enseignant,
    (SELECT j.id FROM justificatifs j WHERE j.absence_id = a.id ORDER BY j.id DESC LIMIT 1) AS justificatifId,
    (SELECT j.statut FROM justificatifs j WHERE j.absence_id = a.id ORDER BY j.id DESC LIMIT 1) AS statutJustificatif,
    (SELECT j.motif_refus FROM justificatifs j WHERE j.absence_id = a.id ORDER BY j.id DESC LIMIT 1) AS motifRefus
    FROM absences a JOIN seances s ON s.id = a.seance_id JOIN matieres m ON m.id = s.matiere_id
    JOIN enseignants e ON e.id = s.enseignant_id JOIN utilisateurs u ON u.id = e.utilisateur_id
    WHERE a.etudiant_id = ?${subjectClause} ORDER BY s.date DESC, s.heure_debut DESC`).all(...filters);
  const hours = rows.reduce((sum, row) => {
    const [startHour, startMinute] = row.heureDebut.split(':').map(Number);
    const [endHour, endMinute] = row.heureFin.split(':').map(Number);
    return sum + Math.max(0, ((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) / 60);
  }, 0);
  const subjects = db.prepare('SELECT DISTINCT m.id, m.nom FROM absences a JOIN seances s ON s.id = a.seance_id JOIN matieres m ON m.id = s.matiere_id WHERE a.etudiant_id = ? ORDER BY m.nom').all(student.id);
  res.json({ absences: rows, heuresTotal: hours, matieres: subjects });
}

function absenceDetail(req, res) {
  const student = studentIdForUser(req.user.id);
  const absence = student && db.prepare(`SELECT a.id, a.statut, a.date_creation AS dateCreation, s.date,
    s.heure_debut AS heureDebut, s.heure_fin AS heureFin, s.salle, m.nom AS matiere,
    u.prenom || ' ' || u.nom AS enseignant FROM absences a JOIN seances s ON s.id = a.seance_id
    JOIN matieres m ON m.id = s.matiere_id JOIN enseignants e ON e.id = s.enseignant_id
    JOIN utilisateurs u ON u.id = e.utilisateur_id WHERE a.id = ? AND a.etudiant_id = ?`).get(Number(req.params.id), student.id);
  if (!absence) return res.status(404).json({ message: 'Absence introuvable.' });
  absence.justificatifs = db.prepare('SELECT id, fichier, motif, date_debut AS dateDebut, date_fin AS dateFin, statut, motif_refus AS motifRefus, date_creation AS dateCreation FROM justificatifs WHERE absence_id = ? ORDER BY id DESC').all(absence.id);
  res.json(absence);
}

function schedule(req, res) {
  const student = studentIdForUser(req.user.id);
  if (!student) return res.status(404).json({ message: 'Profil étudiant introuvable.' });
  const start = typeof req.query.debut === 'string' ? req.query.debut : new Date().toISOString().slice(0, 10);
  const end = typeof req.query.fin === 'string' ? req.query.fin : start;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return res.status(400).json({ message: 'Période invalide.' });
  const rows = db.prepare(`SELECT s.id, s.date, s.heure_debut AS heureDebut, s.heure_fin AS heureFin, s.salle,
    m.nom AS matiere, u.prenom || ' ' || u.nom AS enseignant
    FROM seances s JOIN matieres m ON m.id = s.matiere_id JOIN enseignants e ON e.id = s.enseignant_id
    JOIN utilisateurs u ON u.id = e.utilisateur_id WHERE s.groupe_id = ? AND s.date BETWEEN ? AND ? ORDER BY s.date, s.heure_debut`).all(student.groupe_id, start, end);
  res.json(rows);
}

function updateProfile(req, res) {
  if (typeof req.body.notificationsActives !== 'boolean') return res.status(400).json({ message: 'Valeur de notification invalide.' });
  db.prepare('UPDATE utilisateurs SET notifications_actives = ? WHERE id = ?').run(req.body.notificationsActives ? 1 : 0, req.user.id);
  res.json({ notificationsActives: req.body.notificationsActives });
}

function getProfile(req, res) {
  const user = db.prepare('SELECT nom, prenom, email, notifications_actives AS notificationsActives FROM utilisateurs WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ message: 'Profil introuvable.' });
  res.json({ ...user, notificationsActives: Boolean(user.notificationsActives) });
}

module.exports = { studentIdForUser, listAbsences, absenceDetail, schedule, updateProfile, getProfile };