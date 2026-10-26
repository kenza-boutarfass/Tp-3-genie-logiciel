const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const filename = process.env.DATABASE_FILE || path.join(__dirname, '../../data/attendance.sqlite');
fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
const db = new Database(filename);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS utilisateurs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    mot_de_passe TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('ETUDIANT','ENSEIGNANT','ADMIN')),
    notifications_actives INTEGER NOT NULL DEFAULT 1,
    expo_push_token TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS groupes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL UNIQUE,
    filiere TEXT NOT NULL,
    niveau TEXT NOT NULL DEFAULT 'L1'
  );
  CREATE TABLE IF NOT EXISTS etudiants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    matricule TEXT NOT NULL UNIQUE,
    utilisateur_id INTEGER NOT NULL UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,
    groupe_id INTEGER REFERENCES groupes(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS enseignants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    utilisateur_id INTEGER NOT NULL UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,
    departement TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS matieres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS seances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    matiere_id INTEGER NOT NULL REFERENCES matieres(id),
    groupe_id INTEGER NOT NULL REFERENCES groupes(id),
    enseignant_id INTEGER NOT NULL REFERENCES enseignants(id),
    date TEXT NOT NULL,
    heure_debut TEXT NOT NULL,
    heure_fin TEXT NOT NULL,
    salle TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS absences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    etudiant_id INTEGER NOT NULL REFERENCES etudiants(id) ON DELETE CASCADE,
    seance_id INTEGER NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
    statut TEXT NOT NULL CHECK(statut IN ('Non justifiée','En attente','Justifiée')) DEFAULT 'Non justifiée',
    date_creation TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_modification TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(etudiant_id, seance_id)
  );
  CREATE TABLE IF NOT EXISTS justificatifs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    absence_id INTEGER NOT NULL REFERENCES absences(id) ON DELETE CASCADE,
    fichier TEXT NOT NULL,
    motif TEXT NOT NULL,
    date_debut TEXT NOT NULL,
    date_fin TEXT NOT NULL,
    statut TEXT NOT NULL CHECK(statut IN ('En attente','Validé','Refusé')) DEFAULT 'En attente',
    motif_refus TEXT,
    date_creation TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS log_absences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    absence_id INTEGER NOT NULL REFERENCES absences(id) ON DELETE CASCADE,
    enseignant_id INTEGER NOT NULL REFERENCES enseignants(id),
    ancienne_valeur TEXT NOT NULL,
    nouvelle_valeur TEXT NOT NULL,
    date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_absences_etudiant ON absences(etudiant_id);
  CREATE INDEX IF NOT EXISTS idx_seances_groupe_date ON seances(groupe_id, date);
`);

const userColumns = db.prepare('PRAGMA table_info(utilisateurs)').all().map((column) => column.name);
if (!userColumns.includes('expo_push_token')) db.exec('ALTER TABLE utilisateurs ADD COLUMN expo_push_token TEXT');

module.exports = db;