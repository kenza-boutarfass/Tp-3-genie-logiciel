const db = require('../config/database');

function findSessionForTeacher(sessionId, teacherId) {
  return db.prepare('SELECT id, groupe_id FROM seances WHERE id = ? AND enseignant_id = ?').get(sessionId, teacherId);
}

function listGroupStudentIds(groupId) {
  return db.prepare('SELECT id FROM etudiants WHERE groupe_id = ?').all(groupId);
}

module.exports = { findSessionForTeacher, listGroupStudentIds };