process.env.JWT_SECRET = 'test-secret-long-enough-for-jwt-validation';
process.env.DATABASE_FILE = ':memory:';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../src/config/database');
const app = require('../src/app');

let teacherToken;
let studentToken;
let unrelatedStudentToken;
let adminToken;
let sessionId;
let studentId;
let groupId;
let subjectId;
const uploadedFiles = [];

beforeAll(() => {
  const password = bcrypt.hashSync('Demo1234!', 4);
  const user = db.prepare("INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role) VALUES ('Alaoui', 'Salma', 'teacher@test.fr', ?, 'ENSEIGNANT')").run(password);
  const teacherId = db.prepare("INSERT INTO enseignants (utilisateur_id, departement) VALUES (?, 'Informatique')").run(user.lastInsertRowid).lastInsertRowid;
  groupId = db.prepare("INSERT INTO groupes (nom, filiere) VALUES ('TEST', 'Info')").run().lastInsertRowid;
  const studentUser = db.prepare("INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role) VALUES ('El Idrissi', 'Yassine', 'student@test.fr', ?, 'ETUDIANT')").run(password);
  studentId = db.prepare('INSERT INTO etudiants (matricule, utilisateur_id, groupe_id) VALUES (?, ?, ?)').run('TEST001', studentUser.lastInsertRowid, groupId).lastInsertRowid;
  const otherGroup = db.prepare("INSERT INTO groupes (nom, filiere) VALUES ('TEST-AUTRE', 'Info')").run().lastInsertRowid;
  const otherStudentUser = db.prepare("INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role) VALUES ('Berrada', 'Imane', 'other-student@test.fr', ?, 'ETUDIANT')").run(password);
  db.prepare('INSERT INTO etudiants (matricule, utilisateur_id, groupe_id) VALUES (?, ?, ?)').run('TEST003', otherStudentUser.lastInsertRowid, otherGroup);
  subjectId = db.prepare("INSERT INTO matieres (nom) VALUES ('Programmation')").run().lastInsertRowid;
  sessionId = db.prepare("INSERT INTO seances (matiere_id, groupe_id, enseignant_id, date, heure_debut, heure_fin, salle) VALUES (?, ?, ?, date('now'), '09:00', '10:00', 'A1')")
    .run(subjectId, groupId, teacherId).lastInsertRowid;
  db.prepare("INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role) VALUES ('El Amrani', 'Kenza', 'admin@test.fr', ?, 'ADMIN')").run(password);
  const teacherLogin = request(app).post('/api/auth/login').send({ email: 'teacher@test.fr', motDePasse: 'Demo1234!' });
  const studentLogin = request(app).post('/api/auth/login').send({ email: 'student@test.fr', motDePasse: 'Demo1234!' });
  const otherStudentLogin = request(app).post('/api/auth/login').send({ email: 'other-student@test.fr', motDePasse: 'Demo1234!' });
  const adminLogin = request(app).post('/api/auth/login').send({ email: 'admin@test.fr', motDePasse: 'Demo1234!' });
  return Promise.all([teacherLogin, studentLogin, otherStudentLogin, adminLogin]).then(([teacher, student, otherStudent, admin]) => {
    teacherToken = teacher.body.token;
    studentToken = student.body.token;
    unrelatedStudentToken = otherStudent.body.token;
    adminToken = admin.body.token;
  });
});

afterAll(() => {
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  for (const filename of uploadedFiles) {
    const filepath = path.join(uploadDir, filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
  db.close();
});

describe('Authentification', () => {
  test('retourne un JWT et le rôle correspondant', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'teacher@test.fr', motDePasse: 'Demo1234!' });
    expect(response.status).toBe(200);
    expect(response.body.utilisateur.role).toBe('ENSEIGNANT');
    expect(response.body.token).toBeTruthy();
  });

  test('refuse un mot de passe incorrect avec un message explicite', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'teacher@test.fr', motDePasse: 'incorrect' });
    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/incorrect/i);
  });

  test('affiche Kenza pour le compte administrateur', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'admin@test.fr', motDePasse: 'Demo1234!' });
    expect(response.status).toBe(200);
    expect(response.body.utilisateur.prenom).toBe('Kenza');
  });

  test('interdit à un étudiant d’accéder aux routes enseignant', async () => {
    const response = await request(app).get('/api/enseignant/seances').set('Authorization', `Bearer ${studentToken}`);
    expect(response.status).toBe(403);
  });
});

describe('Enregistrement des absences', () => {
  test('enregistre en un appel puis expose l’absence au seul étudiant concerné', async () => {
    const response = await request(app).post(`/api/enseignant/seances/${sessionId}/appel`)
      .set('Authorization', `Bearer ${teacherToken}`).send({ presences: [{ etudiantId: studentId, present: false }] });
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Absences enregistrées avec succès');
    const visible = await request(app).get('/api/etudiant/absences').set('Authorization', `Bearer ${studentToken}`);
    expect(visible.body.absences).toHaveLength(1);
    expect(visible.body.absences[0].statut).toBe('Non justifiée');
  });

  test('refuse un appel incomplet sans écrire partiellement', async () => {
    const response = await request(app).post(`/api/enseignant/seances/${sessionId}/appel`)
      .set('Authorization', `Bearer ${teacherToken}`).send({ presences: [] });
    expect(response.status).toBe(400);
    expect(db.prepare('SELECT COUNT(*) AS count FROM absences').get().count).toBe(1);
  });
});

describe('Espace étudiant', () => {
  test('expose le planning et le profil, et met à jour les préférences', async () => {
    const schedule = await request(app).get('/api/etudiant/emploi-du-temps')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(schedule.status).toBe(200);
    expect(schedule.body).toHaveLength(1);
    expect(schedule.body[0].id).toBe(sessionId);

    const profile = await request(app).get('/api/etudiant/profil')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(profile.body.email).toBe('student@test.fr');
    expect(profile.body.notificationsActives).toBe(true);

    const preference = await request(app).patch('/api/etudiant/profil/notifications')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ notificationsActives: false });
    expect(preference.status).toBe(200);
    expect(preference.body.notificationsActives).toBe(false);

    const invalidToken = await request(app).post('/api/etudiant/profil/push-token')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ token: 'invalid' });
    expect(invalidToken.status).toBe(400);
  });

  test('dépose un justificatif et limite son accès à son propriétaire', async () => {
    const absence = db.prepare('SELECT id FROM absences WHERE etudiant_id = ? AND seance_id = ?').get(studentId, sessionId);
    const response = await request(app).post(`/api/etudiant/absences/${absence.id}/justificatifs`)
      .set('Authorization', `Bearer ${studentToken}`)
      .field('motif', 'Certificat médical')
      .field('dateDebut', new Date().toISOString().slice(0, 10))
      .field('dateFin', new Date().toISOString().slice(0, 10))
      .attach('fichier', Buffer.from('%PDF-1.4 test justificatif'), { filename: 'certificat.pdf', contentType: 'application/pdf' });
    expect(response.status).toBe(201);

    const row = db.prepare('SELECT id, fichier FROM justificatifs WHERE id = ?').get(response.body.id);
    uploadedFiles.push(row.fichier);
    const detail = await request(app).get(`/api/etudiant/absences/${absence.id}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.justificatifs).toHaveLength(1);
    expect(detail.body.justificatifs[0].statut).toBe('En attente');

    const absences = await request(app).get('/api/etudiant/absences')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(absences.body.absences[0].statutJustificatif).toBe('En attente');

    const download = await request(app).get(`/api/etudiant/justificatifs/${row.id}/fichier`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(download.status).toBe(200);

    const otherStudent = await request(app).get(`/api/etudiant/absences/${absence.id}`)
      .set('Authorization', `Bearer ${unrelatedStudentToken}`);
    expect(otherStudent.status).toBe(404);
  });
});

describe('Espace enseignant', () => {
  test('liste les séances et étudiants puis fournit les statistiques', async () => {
    const sessions = await request(app).get('/api/enseignant/seances')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(sessions.status).toBe(200);
    expect(sessions.body).toHaveLength(1);

    const students = await request(app).get(`/api/enseignant/seances/${sessionId}/etudiants`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(students.body).toHaveLength(1);

    const stats = await request(app).get(`/api/enseignant/etudiants/${studentId}/statistiques`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(stats.status).toBe(200);
    expect(stats.body.global.absences).toBe(1);
    expect(stats.body.global.taux).toBe(100);
    expect(stats.body.history).toHaveLength(1);
  });

  test('journalise une modification autorisée du statut d’absence', async () => {
    const absence = db.prepare('SELECT id FROM absences WHERE etudiant_id = ? AND seance_id = ?').get(studentId, sessionId);
    const response = await request(app).patch(`/api/enseignant/absences/${absence.id}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ statut: 'En attente' });
    expect(response.status).toBe(200);
    expect(db.prepare('SELECT COUNT(*) AS count FROM log_absences WHERE absence_id = ?').get(absence.id).count).toBe(1);

    const justified = await request(app).patch(`/api/enseignant/absences/${absence.id}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ statut: 'Justifiée' });
    expect(justified.status).toBe(200);

    const visible = await request(app).get('/api/etudiant/absences')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(visible.body.absences[0].statut).toBe('Justifiée');
  });
});

describe('Espace administrateur et documentation', () => {
  test('gère les groupes, les comptes et les affectations', async () => {
    const groups = await request(app).get('/api/admin/groupes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(groups.status).toBe(200);

    const createdGroup = await request(app).post('/api/admin/groupes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'TEST-2', filiere: 'Info', niveau: 'L2' });
    expect(createdGroup.status).toBe(201);

    const updatedGroup = await request(app).patch(`/api/admin/groupes/${createdGroup.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'TEST-2', filiere: 'Informatique', niveau: 'L2' });
    expect(updatedGroup.status).toBe(200);

    const missingGroup = await request(app).patch('/api/admin/groupes/99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'Inexistant', filiere: 'Info', niveau: 'L2' });
    expect(missingGroup.status).toBe(404);

    const student = await request(app).post('/api/admin/etudiants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'Nouveau', prenom: 'Sam', email: 'new-student@test.fr', matricule: 'TEST002', groupeId: createdGroup.body.id });
    expect(student.status).toBe(201);
    expect(student.body.motDePasseTemporaire).toBeTruthy();

    const updatedStudent = await request(app).patch(`/api/admin/etudiants/${student.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'El Idrissi', prenom: 'Yassine', email: 'new-student@test.fr', matricule: 'TEST002', groupeId: createdGroup.body.id });
    expect(updatedStudent.status).toBe(200);

    const teacher = await request(app).post('/api/admin/enseignants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nom: 'Prof', prenom: 'Alex', email: 'new-teacher@test.fr', departement: 'Informatique' });
    expect(teacher.status).toBe(201);

    const session = await request(app).post('/api/admin/seances')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ matiereId: subjectId, groupeId: createdGroup.body.id, enseignantId: teacher.body.id, date: '2026-10-24', heureDebut: '09:00', heureFin: '10:00', salle: 'A2' });
    expect(session.status).toBe(201);

    const people = await request(app).get('/api/admin/utilisateurs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(people.body.etudiants).toHaveLength(3);
    expect(people.body.enseignants).toHaveLength(2);
  });

  test('traite les justificatifs et exporte les statistiques', async () => {
    const review = await request(app).get('/api/admin/justificatifs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(review.status).toBe(200);
    expect(review.body).toHaveLength(1);

    const decision = await request(app).patch(`/api/admin/justificatifs/${review.body[0].id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ statut: 'Validé' });
    expect(decision.status).toBe(200);

    const stats = await request(app).get('/api/admin/statistiques')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(stats.status).toBe(200);

    const csv = await request(app).get('/api/admin/statistiques.csv')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('Filière,Niveau,Matière,Absences,Séances');

    const invalidPeriod = await request(app).get('/api/admin/statistiques.csv?debut=2026-12-31&fin=2026-01-01')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalidPeriod.status).toBe(400);
  });

  test('publie la documentation Swagger', async () => {
    const home = await request(app).get('/');
    expect(home.status).toBe(200);
    expect(home.text).toMatch(/Campus Présences|<div id="root">/);

    const response = await request(app).get('/api-docs/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger-ui');
  });
});