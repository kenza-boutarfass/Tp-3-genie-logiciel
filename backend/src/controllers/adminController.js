const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const db = require('../config/database');
const { validEmail, requiredText, positiveId } = require('../utils/validation');

function temporaryPassword() {
  return crypto.randomBytes(9).toString('base64url');
}

function createStudent(req, res) {
  try {
    const nom = requiredText(req.body.nom, 'Nom');
    const prenom = requiredText(req.body.prenom, 'Prénom');
    const email = validEmail(req.body.email);
    const matricule = requiredText(req.body.matricule, 'Matricule', 40);
    const groupeId = positiveId(req.body.groupeId, 'Groupe');
    if (!db.prepare('SELECT id FROM groupes WHERE id = ?').get(groupeId)) return res.status(404).json({ message: 'Groupe introuvable.' });
    const password = temporaryPassword();
    const create = db.transaction(() => {
      const user = db.prepare("INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role) VALUES (?, ?, ?, ?, 'ETUDIANT')")
        .run(nom, prenom, email, bcrypt.hashSync(password, 12));
      const student = db.prepare('INSERT INTO etudiants (matricule, utilisateur_id, groupe_id) VALUES (?, ?, ?)').run(matricule, user.lastInsertRowid, groupeId);
      return { id: student.lastInsertRowid, utilisateurId: user.lastInsertRowid };
    });
    res.status(201).json({ ...create(), motDePasseTemporaire: password });
  } catch (error) {
    res.status(error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 409 : 400).json({ message: error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 'Cet email ou matricule est déjà utilisé.' : error.message });
  }
}

function updateStudent(req, res) {
  try {
    const id = positiveId(req.params.id, 'Étudiant');
    const current = db.prepare('SELECT utilisateur_id FROM etudiants WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ message: 'Étudiant introuvable.' });
    const nom = requiredText(req.body.nom, 'Nom');
    const prenom = requiredText(req.body.prenom, 'Prénom');
    const email = validEmail(req.body.email);
    const matricule = requiredText(req.body.matricule, 'Matricule', 40);
    const groupeId = positiveId(req.body.groupeId, 'Groupe');
    db.transaction(() => {
      db.prepare('UPDATE utilisateurs SET nom = ?, prenom = ?, email = ? WHERE id = ?').run(nom, prenom, email, current.utilisateur_id);
      db.prepare('UPDATE etudiants SET matricule = ?, groupe_id = ? WHERE id = ?').run(matricule, groupeId, id);
    })();
    res.json({ message: 'Étudiant mis à jour.' });
  } catch (error) {
    res.status(error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 409 : 400).json({ message: error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 'Email ou matricule déjà utilisé.' : error.message });
  }
}

function createTeacher(req, res) {
  try {
    const nom = requiredText(req.body.nom, 'Nom');
    const prenom = requiredText(req.body.prenom, 'Prénom');
    const email = validEmail(req.body.email);
    const departement = requiredText(req.body.departement, 'Département');
    const password = temporaryPassword();
    const create = db.transaction(() => {
      const user = db.prepare("INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role) VALUES (?, ?, ?, ?, 'ENSEIGNANT')")
        .run(nom, prenom, email, bcrypt.hashSync(password, 12));
      const teacher = db.prepare('INSERT INTO enseignants (utilisateur_id, departement) VALUES (?, ?)').run(user.lastInsertRowid, departement);
      return { id: teacher.lastInsertRowid };
    });
    res.status(201).json({ ...create(), motDePasseTemporaire: password });
  } catch (error) {
    res.status(error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 409 : 400).json({ message: error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 'Email déjà utilisé.' : error.message });
  }
}

function listUsers(req, res) {
  const students = db.prepare(`SELECT e.id, e.matricule, u.nom, u.prenom, u.email, g.id AS groupeId, g.nom AS groupe
    FROM etudiants e JOIN utilisateurs u ON u.id = e.utilisateur_id LEFT JOIN groupes g ON g.id = e.groupe_id ORDER BY u.nom, u.prenom`).all();
  const teachers = db.prepare(`SELECT e.id, u.nom, u.prenom, u.email, e.departement FROM enseignants e JOIN utilisateurs u ON u.id = e.utilisateur_id ORDER BY u.nom, u.prenom`).all();
  res.json({ etudiants: students, enseignants: teachers });
}

function groups(req, res) {
  if (req.method === 'GET') return res.json(db.prepare(`SELECT g.id, g.nom, g.filiere, g.niveau, COUNT(e.id) AS nombreEtudiants
    FROM groupes g LEFT JOIN etudiants e ON e.groupe_id = g.id GROUP BY g.id ORDER BY g.nom`).all());
  try {
    const nom = requiredText(req.body.nom, 'Nom du groupe', 80);
    const filiere = requiredText(req.body.filiere, 'Filière', 120);
    const niveau = requiredText(req.body.niveau || 'L1', 'Niveau', 30);
    const result = req.method === 'POST'
      ? db.prepare('INSERT INTO groupes (nom, filiere, niveau) VALUES (?, ?, ?)').run(nom, filiere, niveau)
      : db.prepare('UPDATE groupes SET nom = ?, filiere = ?, niveau = ? WHERE id = ?').run(nom, filiere, niveau, positiveId(req.params.id, 'Groupe'));
    if (req.method === 'PATCH' && !result.changes) return res.status(404).json({ message: 'Groupe introuvable.' });
    res.status(req.method === 'POST' ? 201 : 200).json({ id: result.lastInsertRowid || Number(req.params.id), message: 'Groupe enregistré.' });
  } catch (error) {
    res.status(error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 409 : 400).json({ message: error.code === 'SQLITE_CONSTRAINT_UNIQUE' ? 'Ce nom de groupe existe déjà.' : error.message });
  }
}

function reviewJustificatif(req, res) {
  try {
    const status = req.body.statut;
    if (!['Validé', 'Refusé'].includes(status)) throw new Error('Décision invalide.');
    const reason = status === 'Refusé' ? requiredText(req.body.motifRefus, 'Motif de refus', 1000) : null;
    const id = positiveId(req.params.id, 'Justificatif');
    const review = db.transaction(() => {
      const row = db.prepare('SELECT absence_id FROM justificatifs WHERE id = ?').get(id);
      if (!row) return false;
      db.prepare('UPDATE justificatifs SET statut = ?, motif_refus = ? WHERE id = ?').run(status, reason, id);
      db.prepare('UPDATE absences SET statut = ?, date_modification = CURRENT_TIMESTAMP WHERE id = ?').run(status === 'Validé' ? 'Justifiée' : 'Non justifiée', row.absence_id);
      return true;
    });
    if (!review()) return res.status(404).json({ message: 'Justificatif introuvable.' });
    res.json({ message: 'Décision enregistrée.' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

function statistics(req, res) {
  const start = req.query.debut || '0000-01-01';
  const end = req.query.fin || '9999-12-31';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return res.status(400).json({ message: 'Période invalide.' });
  const rows = db.prepare(`SELECT g.filiere, g.niveau, m.nom AS matiere, COUNT(DISTINCT a.id) AS absences,
    COUNT(DISTINCT s.id) AS seances, ROUND(100.0 * COUNT(DISTINCT a.id) / MAX(COUNT(DISTINCT s.id) * COUNT(DISTINCT e.id), 1), 1) AS taux
    FROM seances s JOIN groupes g ON g.id = s.groupe_id JOIN matieres m ON m.id = s.matiere_id
    LEFT JOIN etudiants e ON e.groupe_id = g.id LEFT JOIN absences a ON a.seance_id = s.id AND a.etudiant_id = e.id
    WHERE s.date BETWEEN ? AND ? GROUP BY g.filiere, g.niveau, m.id ORDER BY g.filiere, g.niveau, m.nom`).all(start, end);
  res.json(rows);
}

function statisticsCsv(req, res) {
  const start = req.query.debut || '0000-01-01';
  const end = req.query.fin || '9999-12-31';
  if (typeof start !== 'string' || typeof end !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    return res.status(400).json({ message: 'Période invalide.' });
  }
  const rows = db.prepare(`SELECT g.filiere, g.niveau, m.nom AS matiere, COUNT(DISTINCT a.id) AS absences, COUNT(DISTINCT s.id) AS seances
    FROM seances s JOIN groupes g ON g.id = s.groupe_id JOIN matieres m ON m.id = s.matiere_id
    LEFT JOIN etudiants e ON e.groupe_id = g.id LEFT JOIN absences a ON a.seance_id = s.id AND a.etudiant_id = e.id
    WHERE s.date BETWEEN ? AND ? GROUP BY g.filiere, g.niveau, m.id ORDER BY g.filiere, g.niveau, m.nom`).all(start, end);
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = ['Filière,Niveau,Matière,Absences,Séances', ...rows.map((row) => [row.filiere, row.niveau, row.matiere, row.absences, row.seances].map(quote).join(','))].join('\n');
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="statistiques-absences.csv"').send(`\uFEFF${csv}`);
}

function pendingJustificatifs(req, res) {
  const rows = db.prepare(`SELECT j.id, j.absence_id AS absenceId, j.fichier, j.motif, j.date_debut AS dateDebut,
    j.date_fin AS dateFin, j.statut, u.nom, u.prenom, e.matricule, m.nom AS matiere, s.date
    FROM justificatifs j JOIN absences a ON a.id = j.absence_id JOIN etudiants e ON e.id = a.etudiant_id
    JOIN utilisateurs u ON u.id = e.utilisateur_id JOIN seances s ON s.id = a.seance_id JOIN matieres m ON m.id = s.matiere_id
    ORDER BY CASE j.statut WHEN 'En attente' THEN 0 ELSE 1 END, j.id DESC`).all();
  res.json(rows);
}

module.exports = { createStudent, updateStudent, createTeacher, listUsers, groups, reviewJustificatif, statistics, statisticsCsv, pendingJustificatifs };