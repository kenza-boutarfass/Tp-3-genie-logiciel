require('dotenv').config();
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');
const db = require('./config/database');

const demoPassword = bcrypt.hashSync('Demo1234!', 10);

function ensureUser(lastName, firstName, email, role) {
  const existing = db.prepare('SELECT id, role FROM utilisateurs WHERE email = ?').get(email);
  if (existing) {
    if (existing.role !== role) throw new Error(`Le compte ${email} existe avec un rôle différent de ${role}.`);
    return existing.id;
  }
  return db.prepare('INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role) VALUES (?, ?, ?, ?, ?)')
    .run(lastName, firstName, email, demoPassword, role).lastInsertRowid;
}

function ensureGroup(name, filiere) {
  const existing = db.prepare('SELECT id FROM groupes WHERE nom = ?').get(name);
  return existing?.id || db.prepare('INSERT INTO groupes (nom, filiere, niveau) VALUES (?, ?, ?)')
    .run(name, filiere, 'L1').lastInsertRowid;
}

function ensureTeacher(userId, department) {
  const existing = db.prepare('SELECT id FROM enseignants WHERE utilisateur_id = ?').get(userId);
  return existing?.id || db.prepare('INSERT INTO enseignants (utilisateur_id, departement) VALUES (?, ?)')
    .run(userId, department).lastInsertRowid;
}

function ensureStudent(userId, matricule, groupId) {
  const existing = db.prepare('SELECT id FROM etudiants WHERE utilisateur_id = ?').get(userId);
  return existing?.id || db.prepare('INSERT INTO etudiants (matricule, utilisateur_id, groupe_id) VALUES (?, ?, ?)')
    .run(matricule, userId, groupId).lastInsertRowid;
}

function ensureSubject(name) {
  const existing = db.prepare('SELECT id FROM matieres WHERE nom = ?').get(name);
  return existing?.id || db.prepare('INSERT INTO matieres (nom) VALUES (?)').run(name).lastInsertRowid;
}

function ensureDemoDocument() {
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  const filename = 'demo-justificatif.pdf';
  const fullPath = path.join(uploadDir, filename);
  if (fs.existsSync(fullPath)) return Promise.resolve(filename);

  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 60 });
    const output = fs.createWriteStream(fullPath);
    output.on('finish', () => resolve(filename));
    output.on('error', reject);
    document.on('error', reject);
    document.pipe(output);
    document.fontSize(20).text('Justificatif de démonstration', { align: 'center' });
    document.moveDown();
    document.fontSize(12).text('Document fictif pour tester le parcours de dépôt et de consultation.');
    document.moveDown();
    document.text('Ce document n’a aucune valeur administrative ou médicale.');
    document.end();
  });
}

async function seed() {
  const documentFilename = await ensureDemoDocument();
  const result = db.transaction(() => {
    db.prepare(`UPDATE justificatifs
      SET fichier = ?, motif = 'Document de démonstration'
      WHERE fichier IN ('exemple.pdf', 'exemple.png')`).run(documentFilename);
    const adminId = ensureUser('El Amrani', 'Kenza', 'admin@universite.fr', 'ADMIN');
    const teacherUsers = [
      ensureUser('Alaoui', 'Salma', 'enseignant@universite.fr', 'ENSEIGNANT'),
      ensureUser('Bennani', 'Youssef', 'enseignant2@universite.fr', 'ENSEIGNANT')
    ];
    const teacherIds = teacherUsers.map((userId, index) => ensureTeacher(userId, index ? 'Sciences' : 'Informatique'));
    const groupIds = [
      ensureGroup('TD1', 'Informatique'),
      ensureGroup('TD2', 'Informatique')
    ];

    const lastNames = ['El Idrissi', 'Berrada', 'Tazi', 'Chraibi', 'Mansouri', 'Fassi', 'Lahlou', 'Benjelloun', 'Alaoui', 'Amrani'];
    const firstNames = ['Salma', 'Yassine', 'Imane', 'Mehdi', 'Khadija', 'Amine', 'Sara', 'Hamza', 'Youssef', 'Fatima'];
    const studentIds = lastNames.map((lastName, index) => {
      const email = `etudiant${index + 1}@universite.fr`;
      const userId = ensureUser(lastName, firstNames[index], email, 'ETUDIANT');
      return ensureStudent(userId, `U2026${String(index + 1).padStart(3, '0')}`, groupIds[index < 5 ? 0 : 1]);
    });

    const subjects = ['Programmation', 'Mathématiques', 'Bases de données', 'Algorithmique', 'Réseaux', 'Anglais'];
    const subjectIds = subjects.map(ensureSubject);
    const schedule = [
      { day: 1, subject: 0, teacher: 0, start: '09:00', end: '10:30', room: 'A101' },
      { day: 1, subject: 1, teacher: 1, start: '14:00', end: '15:30', room: 'B204' },
      { day: 2, subject: 2, teacher: 0, start: '10:00', end: '11:30', room: 'Lab 1' },
      { day: 2, subject: 4, teacher: 1, start: '14:00', end: '15:30', room: 'C105' },
      { day: 3, subject: 3, teacher: 0, start: '09:00', end: '10:30', room: 'A103' },
      { day: 3, subject: 5, teacher: 1, start: '13:30', end: '15:00', room: 'D202' },
      { day: 4, subject: 0, teacher: 0, start: '10:00', end: '11:30', room: 'Lab 2' },
      { day: 4, subject: 1, teacher: 1, start: '14:00', end: '15:30', room: 'B204' }
    ];
    const insertSession = db.prepare(`INSERT INTO seances
      (matiere_id, groupe_id, enseignant_id, date, heure_debut, heure_fin, salle)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const findSession = db.prepare(`SELECT id FROM seances
      WHERE matiere_id = ? AND groupe_id = ? AND enseignant_id = ? AND date = ? AND heure_debut = ?`);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const monday = new Date(today);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const sessionsByGroup = [[], []];
    for (let weekDayOffset = -28; weekDayOffset <= 34; weekDayOffset += 1) {
      const date = new Date(monday);
      date.setUTCDate(date.getUTCDate() + weekDayOffset);
      const day = date.getUTCDay();
      if (day < 1 || day > 4) continue;
      const dateString = date.toISOString().slice(0, 10);
      for (let groupIndex = 0; groupIndex < groupIds.length; groupIndex += 1) {
        for (const slot of schedule.filter((item) => item.day === day)) {
          const subjectId = subjectIds[slot.subject];
          const teacherId = teacherIds[slot.teacher];
          const existing = findSession.get(subjectId, groupIds[groupIndex], teacherId, dateString, slot.start);
          const sessionId = existing?.id || insertSession.run(
            subjectId, groupIds[groupIndex], teacherId, dateString, slot.start, slot.end, slot.room
          ).lastInsertRowid;
          sessionsByGroup[groupIndex].push({ id: sessionId, date: dateString, offset: weekDayOffset, slot });
        }
      }
    }

    const findAbsence = db.prepare('SELECT id FROM absences WHERE etudiant_id = ? AND seance_id = ?');
    const insertAbsence = db.prepare("INSERT INTO absences (etudiant_id, seance_id, statut) VALUES (?, ?, 'Non justifiée')");
    const updateStatus = db.prepare('UPDATE absences SET statut = ? WHERE id = ?');
    const findDocument = db.prepare("SELECT id FROM justificatifs WHERE absence_id = ? AND motif = 'Document de démonstration'");
    const insertDocument = db.prepare(`INSERT INTO justificatifs
      (absence_id, fichier, motif, date_debut, date_fin, statut)
      VALUES (?, ?, 'Document de démonstration', ?, ?, ?)`);
    for (let index = 0; index < studentIds.length; index += 1) {
      const groupIndex = index < 5 ? 0 : 1;
      const pastSessions = sessionsByGroup[groupIndex].filter((session) => session.offset < 0);
      const offsets = [4 + (index % 4), 12 + (index % 4), 20 + (index % 4)];
      offsets.forEach((sessionIndex, absenceIndex) => {
        const session = pastSessions[sessionIndex];
        if (!session) return;
        const absence = findAbsence.get(studentIds[index], session.id);
        const absenceId = absence?.id || insertAbsence.run(studentIds[index], session.id).lastInsertRowid;
        const status = absenceIndex === 1 && index % 2 === 0
          ? 'En attente'
          : absenceIndex === 2 && index % 3 === 0
            ? 'Justifiée'
            : 'Non justifiée';
        if (!absence) updateStatus.run(status, absenceId);
        if (status !== 'Non justifiée' && !findDocument.get(absenceId)) {
          insertDocument.run(absenceId, documentFilename, session.date, session.date, status === 'Justifiée' ? 'Validé' : 'En attente');
        }
      });
    }
    return { adminId, sessions: schedule.length * 2 * 9, students: studentIds.length };
  })();

  console.log(`Données de démonstration enrichies (${result.sessions} séances, ${result.students} étudiants, administrateur ${result.adminId}).`);
  console.log('Mot de passe commun : Demo1234!');
}

seed().catch((error) => {
  console.error('Échec du seed :', error.message);
  process.exitCode = 1;
}).finally(() => db.close());
