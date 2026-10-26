import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api, { errorMessage } from './api';
import { colors } from './theme';
import { Badge, Button, EmptyState, Page, Panel, Row, Title } from './ui';

const prettyDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export function TeacherHome({ user, onLogout }) {
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [students, setStudents] = useState([]);
  const [presence, setPresence] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const loadSessions = useCallback(async () => {
    try { const { data } = await api.get('/enseignant/seances'); setSessions(data); }
    catch (error) { Alert.alert('Séances indisponibles', errorMessage(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadSessions(); }, [loadSessions]);
  const teachingGroups = new Set(sessions.map((session) => session.groupe)).size;

  const openSession = async (session) => {
    setSelected(session);
    setBusy(true);
    try {
      const { data } = await api.get(`/enseignant/seances/${session.id}/etudiants`);
      setStudents(data);
      setPresence(Object.fromEntries(data.map((item) => [item.etudiantId, !item.absent])));
    } catch (error) { Alert.alert('Liste indisponible', errorMessage(error)); setSelected(null); }
    finally { setBusy(false); }
  };

  const submit = () => {
    const presences = students.map((item) => ({ etudiantId: item.etudiantId, present: presence[item.etudiantId] }));
    Alert.alert('Valider l’appel', 'Êtes-vous sûr de valider l’appel ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Valider', onPress: async () => {
        setBusy(true);
        try {
          const { data } = await api.post(`/enseignant/seances/${selected.id}/appel`, { presences });
          Alert.alert('Appel enregistré', data.message);
          setSelected(null);
          loadSessions();
        } catch (error) { Alert.alert('Enregistrement impossible', errorMessage(error)); }
        finally { setBusy(false); }
      } }
    ]);
  };

  return <Page><Title eyebrow={`Enseignant · ${user.prenom}`}>{selected ? 'Faire l’appel' : 'Mes séances'}</Title>
    {!selected ? <Panel style={styles.teacherOverview}><View style={styles.overviewIcon}><Ionicons name="school-outline" size={23} color={colors.gold} /></View><View style={{ flex: 1 }}><Text style={styles.overviewKicker}>VOTRE ESPACE ENSEIGNANT</Text><Text style={styles.overviewTitle}>Une vue claire sur vos groupes</Text><Text style={styles.overviewBody}>{sessions.length} séances planifiées · {teachingGroups} groupes suivis</Text></View></Panel> : null}
    {selected ? <>
      <Panel><Text style={styles.cardTitle}>{selected.matiere} · {selected.groupe}</Text><Text style={styles.body}>{prettyDate(selected.date)} · {selected.heureDebut} – {selected.heureFin} · {selected.salle}</Text></Panel>
      <Row><Text style={styles.sectionHead}>Étudiants</Text><Text style={styles.small}>{students.length} inscrits</Text></Row>
      {students.map((item) => <Pressable key={item.etudiantId} onPress={() => setPresence((current) => ({ ...current, [item.etudiantId]: !current[item.etudiantId] }))} style={styles.studentRow}>
        <View style={[styles.checkbox, presence[item.etudiantId] && styles.checked]}>{presence[item.etudiantId] ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}</View>
        <View style={{ flex: 1 }}><Text style={styles.studentName}>{item.nom} {item.prenom}</Text><Text style={styles.small}>{item.matricule}</Text></View>
        <Text style={[styles.presenceText, { color: presence[item.etudiantId] ? colors.green : colors.red }]}>{presence[item.etudiantId] ? 'Présent' : 'Absent'}</Text>
      </Pressable>)}
      <Button title="Valider l’appel" icon="checkmark-done-outline" loading={busy} onPress={submit} />
      <Button title="Retour aux séances" secondary onPress={() => setSelected(null)} />
    </> : loading ? <Text style={styles.body}>Chargement des séances…</Text> : sessions.length === 0 ? <EmptyState title="Aucune séance disponible" description="Vos séances assignées apparaîtront ici." icon="calendar-outline" /> : sessions.map((session) => <Pressable key={session.id} onPress={() => openSession(session)}><Panel style={styles.sessionCard}>
      <Row><View style={{ flex: 1, gap: 5 }}><Text style={styles.cardTitle}>{session.matiere}</Text><Text style={styles.body}>{session.groupe} · {prettyDate(session.date)}</Text><Text style={styles.small}>{session.heureDebut} – {session.heureFin} · Salle {session.salle}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.forest} /></Row>
      </Panel></Pressable>)}
    {!selected ? <Button title="Se déconnecter" icon="log-out-outline" secondary onPress={onLogout} /> : null}
  </Page>;
}

export function TeacherStats({}) {
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/enseignant/seances').then(({ data }) => setSessions(data)).catch((error) => Alert.alert('Chargement impossible', errorMessage(error))).finally(() => setLoading(false));
  }, []);
  const selectSession = async (session) => {
    try {
      const { data } = await api.get(`/enseignant/seances/${session.id}/etudiants`);
      setStudents(data);
      setSelectedId(null);
      setStats(null);
    } catch (error) { Alert.alert('Chargement impossible', errorMessage(error)); }
  };
  const selectStudent = async (id) => {
    setSelectedId(id);
    try { const { data } = await api.get(`/enseignant/etudiants/${id}/statistiques`); setStats(data); }
    catch (error) { Alert.alert('Statistiques indisponibles', errorMessage(error)); }
  };
  const editAbsence = (item) => Alert.alert('Modifier l’absence', 'Choisissez le nouveau statut.', [
    { text: 'Annuler', style: 'cancel' },
    ...['Non justifiée', 'En attente', 'Justifiée'].map((statut) => ({ text: statut, onPress: async () => {
      try { await api.patch(`/enseignant/absences/${item.id}`, { statut }); await selectStudent(selectedId); }
      catch (error) { Alert.alert('Modification impossible', errorMessage(error)); }
    } }))
  ]);
  const exportPdf = async () => {
    if (!stats) return;
    const content = stats.matieres.map((row) => `<tr><td>${row.matiere}</td><td>${row.absences}</td><td>${row.totalSeances}</td><td>${row.taux}%</td></tr>`).join('');
    const html = `<html><body style="font-family:Arial;padding:32px;color:#20283B"><h1 style="color:#74263D">Récapitulatif des absences</h1><p>${students.find((item) => item.etudiantId === selectedId)?.prenom || ''} ${students.find((item) => item.etudiantId === selectedId)?.nom || ''}</p><h2 style="color:#74263D">Taux global : ${stats.global.taux}%</h2><table style="width:100%;border-collapse:collapse"><tr><th>Matière</th><th>Absences</th><th>Séances</th><th>Taux</th></tr>${content}</table></body></html>`;
    const file = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Exporter le récapitulatif' });
  };

  return <Page><Title eyebrow="Suivi pédagogique">Taux d’absence</Title>
    <Text style={styles.body}>Choisissez une séance pour afficher les étudiants de vos groupes.</Text>
    {loading ? <Text style={styles.body}>Chargement…</Text> : sessions.map((session) => <Pressable key={session.id} onPress={() => selectSession(session)}><Panel style={styles.sessionCard}><Row><Text style={styles.cardTitle}>{session.matiere} · {session.groupe}</Text><Ionicons name="chevron-down" color={colors.forest} size={18} /></Row></Panel></Pressable>)}
    {students.length ? <Panel><Text style={styles.sectionHead}>Étudiants du groupe</Text>{students.map((item) => <Pressable key={item.etudiantId} onPress={() => selectStudent(item.etudiantId)} style={styles.studentPick}><Text style={styles.studentName}>{item.nom} {item.prenom}</Text><Ionicons name="chevron-forward" size={16} color={colors.muted} /></Pressable>)}</Panel> : null}
    {stats ? <>
      <Panel style={{ backgroundColor: stats.global.taux > 20 ? '#F5E8EC' : colors.mint }}><Text style={styles.small}>TAUX GLOBAL</Text><Text style={[styles.rate, { color: stats.global.taux > 20 ? colors.red : colors.forest }]}>{stats.global.taux}%</Text><Text style={styles.body}>{stats.global.absences} absence(s) sur {stats.global.total} séance(s)</Text></Panel>
      {stats.matieres.map((item) => <Panel key={item.matiere}><Row><Text style={styles.cardTitle}>{item.matiere}</Text><Badge label={`${item.taux}%`} /></Row><Text style={styles.small}>{item.absences} absence(s) / {item.totalSeances} séances</Text><View style={styles.track}><View style={[styles.bar, { width: `${Math.min(item.taux, 100)}%`, backgroundColor: item.taux > 20 ? colors.red : colors.forest }]} /></View></Panel>)}
      {stats.history?.length ? <Panel><Text style={styles.sectionHead}>Historique des absences</Text>{stats.history.map((item) => <Pressable key={item.id} onPress={() => editAbsence(item)}><Row style={{ paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.line }}><View><Text style={styles.cardTitle}>{item.matiere}</Text><Text style={styles.small}>{prettyDate(item.date)} · {item.heureDebut} · modifier</Text></View><Badge label={item.statut} /></Row></Pressable>)}</Panel> : null}
      <Button title="Exporter le PDF" icon="document-text-outline" secondary onPress={exportPdf} />
    </> : null}
  </Page>;
}

const styles = StyleSheet.create({
  cardTitle: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  small: { color: colors.muted, fontSize: 12 },
  sectionHead: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  sessionCard: { padding: 16, borderLeftColor: colors.coral },
  teacherOverview: { backgroundColor: colors.burgundyDeep, borderColor: colors.burgundyDeep, borderLeftColor: colors.gold, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center', gap: 15, padding: 19 },
  overviewIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  overviewKicker: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  overviewTitle: { color: colors.white, fontSize: 16, fontWeight: '800', marginTop: 4 },
  overviewBody: { color: '#E8D8DC', fontSize: 12, marginTop: 5 },
  studentRow: { minHeight: 62, paddingHorizontal: 13, backgroundColor: colors.white, borderRadius: 8, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 11 },
  checkbox: { width: 23, height: 23, borderWidth: 1.5, borderColor: colors.line, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.forest, borderColor: colors.forest },
  studentName: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  presenceText: { fontSize: 12, fontWeight: '800' },
  studentPick: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rate: { fontSize: 38, fontWeight: '900', marginVertical: 5 },
  track: { height: 7, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  bar: { height: 7, borderRadius: 4 }
});