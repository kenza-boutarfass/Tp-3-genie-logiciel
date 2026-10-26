const db = require('../config/database');

async function notifyNewAbsences(studentIds, sessionId) {
  if (!studentIds.length || typeof fetch !== 'function') return;
  const rows = db.prepare(`SELECT u.expo_push_token AS token, a.id AS absenceId
    FROM etudiants e JOIN utilisateurs u ON u.id = e.utilisateur_id
    JOIN absences a ON a.etudiant_id = e.id AND a.seance_id = ?
    WHERE e.id IN (${studentIds.map(() => '?').join(',')}) AND u.notifications_actives = 1 AND u.expo_push_token IS NOT NULL`).all(sessionId, ...studentIds);
  if (!rows.length) return;
  const messages = rows.map((row) => ({ to: row.token, sound: 'default', title: 'Nouvelle absence enregistrée', body: 'Une absence vient d’être ajoutée à votre dossier.', data: { absenceId: row.absenceId } }));
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(messages)
  });
  if (!response.ok) throw new Error(`Expo Push a répondu avec le statut ${response.status}.`);
}

module.exports = { notifyNewAbsences };