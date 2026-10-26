const db = require('../config/database');
const attendance = require('../models/attendanceModel');

function saveRollCall(teacherId, sessionId, records) {
  const session = attendance.findSessionForTeacher(sessionId, teacherId);
  if (!session) throw Object.assign(new Error('Séance introuvable ou non autorisée.'), { status: 404 });
  const students = attendance.listGroupStudentIds(session.groupe_id);
  const validIds = new Set(students.map((student) => student.id));
  const receivedIds = Array.isArray(records) ? records.map((item) => Number(item.etudiantId)) : [];
  if (!Array.isArray(records) || records.length !== students.length || new Set(receivedIds).size !== students.length || records.some((item) => !validIds.has(Number(item.etudiantId)) || typeof item.present !== 'boolean')) {
    throw Object.assign(new Error('L’appel doit contenir une présence valide pour chaque étudiant du groupe.'), { status: 400 });
  }

  const upsert = db.prepare(`INSERT INTO absences (etudiant_id, seance_id, statut)
    VALUES (?, ?, 'Non justifiée') ON CONFLICT(etudiant_id, seance_id) DO NOTHING`);
  const remove = db.prepare('DELETE FROM absences WHERE etudiant_id = ? AND seance_id = ?');
  return db.transaction(() => {
    const insertedStudentIds = [];
    for (const item of records) {
      if (item.present) remove.run(Number(item.etudiantId), sessionId);
      else if (upsert.run(Number(item.etudiantId), sessionId).changes) insertedStudentIds.push(Number(item.etudiantId));
    }
    return { absenceCount: records.filter((item) => !item.present).length, insertedStudentIds };
  })();
}

function updateAbsence(teacherId, absenceId, status) {
  const allowed = ['Non justifiée', 'En attente', 'Justifiée'];
  if (!allowed.includes(status)) throw Object.assign(new Error('Statut d’absence invalide.'), { status: 400 });
  const absence = db.prepare(`SELECT a.id, a.statut, s.date, s.heure_debut, s.enseignant_id
    FROM absences a JOIN seances s ON s.id = a.seance_id WHERE a.id = ? AND s.enseignant_id = ?`).get(absenceId, teacherId);
  if (!absence) throw Object.assign(new Error('Absence introuvable ou non autorisée.'), { status: 404 });
  const sessionTime = new Date(`${absence.date}T${absence.heure_debut}:00`).getTime();
  if (!Number.isFinite(sessionTime) || Date.now() - sessionTime > 24 * 60 * 60 * 1000 || Date.now() < sessionTime) {
    throw Object.assign(new Error('La modification est autorisée uniquement dans les 24 heures suivant la séance.'), { status: 403 });
  }
  db.transaction(() => {
    db.prepare('UPDATE absences SET statut = ?, date_modification = CURRENT_TIMESTAMP WHERE id = ?').run(status, absenceId);
    db.prepare('INSERT INTO log_absences (absence_id, enseignant_id, ancienne_valeur, nouvelle_valeur) VALUES (?, ?, ?, ?)')
      .run(absenceId, teacherId, absence.statut, status);
  })();
}

module.exports = { saveRollCall, updateAbsence };