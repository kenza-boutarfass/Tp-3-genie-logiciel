const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const teacher = require('../controllers/teacherController');

const router = express.Router();
router.use(authenticate, authorize('ENSEIGNANT'));
router.get('/seances', teacher.listSessions);
router.get('/seances/:id/etudiants', teacher.sessionStudents);
router.post('/seances/:id/appel', teacher.submitRollCall);
router.patch('/absences/:id', teacher.patchAbsence);
router.get('/etudiants/:etudiantId/statistiques', teacher.studentStatistics);
module.exports = router;