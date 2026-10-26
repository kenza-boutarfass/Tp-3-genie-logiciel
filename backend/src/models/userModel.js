const db = require('../config/database');

function findByEmail(email) {
  return db.prepare('SELECT id, nom, prenom, email, mot_de_passe, role FROM utilisateurs WHERE email = ?').get(email);
}

function findStudentForUser(userId) {
  return db.prepare('SELECT id, groupe_id FROM etudiants WHERE utilisateur_id = ?').get(userId);
}

module.exports = { findByEmail, findStudentForUser };