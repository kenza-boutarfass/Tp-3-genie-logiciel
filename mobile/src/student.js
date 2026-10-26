import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getSessionItem } from './sessionStore';
import api, { apiBaseURL, errorMessage } from './api';
import { colors } from './theme';
import { Badge, Button, EmptyState, Field, Page, Panel, Row, Title } from './ui';

const dateText = (value) => new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
function AbsenceDetail({ item, close, onUpdated }) {
  const [file, setFile] = useState(null);
  const [motif, setMotif] = useState('');
  const [dateDebut, setDateDebut] = useState(item.date);
  const [dateFin, setDateFin] = useState(item.date);
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const openDocument = async (justificatif) => {
    const base = apiBaseURL;
    try {
      const token = await getSessionItem('session-token');
      const file = await FileSystem.downloadAsync(`${base}/etudiant/justificatifs/${justificatif.id}/fichier`, `${FileSystem.cacheDirectory}${justificatif.fichier}`, { headers: { Authorization: `Bearer ${token}` } });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { dialogTitle: 'Ouvrir le justificatif' });
    } catch (error) { Alert.alert('Fichier indisponible', error.message || 'Téléchargement impossible.'); }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    if (result.canceled) return;
    const selected = result.assets[0];
    const ext = selected.name?.split('.').pop()?.toLowerCase();
    if (selected.size > 5 * 1024 * 1024 || !['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
      return Alert.alert('Fichier invalide', 'Choisissez un PDF, JPG ou PNG de 5 Mo maximum.');
    }
    setFile(selected);
  };

  const submit = async () => {
    if (!file || !motif.trim() || !dateDebut || !dateFin || dateDebut > dateFin) return Alert.alert('Informations manquantes', 'Ajoutez un fichier, un motif et une période valide.');
    setSending(true);
    const form = new FormData();
    form.append('fichier', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
    form.append('motif', motif.trim());
    form.append('dateDebut', dateDebut);
    form.append('dateFin', dateFin);
    try {
      await api.post(`/etudiant/absences/${item.id}/justificatifs`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      Alert.alert('Justificatif envoyé', 'Votre justificatif est maintenant en attente de validation.');
      onUpdated();
      close();
    } catch (error) { Alert.alert('Envoi impossible', errorMessage(error)); }
    finally { setSending(false); }
  };

  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}><Page>
    <Row><Title eyebrow="Détail de l’absence">{item.matiere}</Title><Pressable accessibilityLabel="Fermer" onPress={close}><Ionicons name="close-circle" size={29} color={colors.muted} /></Pressable></Row>
    <Panel><Row><Text style={styles.detailLabel}>Statut</Text><Badge label={item.statut} /></Row><DetailLine label="Date" value={dateText(item.date)} /><DetailLine label="Horaire" value={`${item.heureDebut} – ${item.heureFin}`} /><DetailLine label="Enseignant" value={item.enseignant} /><DetailLine label="Salle" value={item.salle} /></Panel>
    {item.motifRefus ? <Panel><Text style={styles.sectionHead}>Motif du refus</Text><Text style={styles.body}>{item.motifRefus}</Text></Panel> : null}
    <Button
      title={expanded ? 'Masquer le formulaire' : item.justificatifs?.length ? 'Déposer un autre justificatif' : 'Déposer un justificatif'}
      icon={expanded ? 'chevron-up-outline' : 'document-attach-outline'}
      secondary={!expanded}
      onPress={() => setExpanded(!expanded)}
    />
    {expanded ? <Panel>
      <Text style={styles.body}>PDF, JPG ou PNG · 5 Mo maximum</Text>
      <Button title={file ? file.name : 'Choisir un fichier'} icon="attach-outline" secondary onPress={pickFile} />
      <Field label="Motif" value={motif} onChangeText={setMotif} placeholder="Précisez le motif" multiline />
      <Field label="Date de début (AAAA-MM-JJ)" value={dateDebut} onChangeText={setDateDebut} placeholder={item.date} />
      <Field label="Date de fin (AAAA-MM-JJ)" value={dateFin} onChangeText={setDateFin} placeholder={item.date} />
      <Button title="Envoyer le justificatif" icon="send-outline" loading={sending} onPress={submit} />
    </Panel> : null}
    {item.justificatifs?.map((document) => <Panel key={document.id}><Row><View style={{ flex: 1 }}><Text style={styles.sectionHead}>Statut du justificatif</Text><Text style={styles.small}>{document.fichier}</Text></View><Badge label={document.statut} /></Row><Text style={styles.body}>{document.motif}</Text>{document.motifRefus ? <Text style={styles.body}>Motif du refus : {document.motifRefus}</Text> : null}<Button title="Ouvrir la pièce" icon="open-outline" secondary onPress={() => openDocument(document)} /></Panel>)}
  </Page></Modal>;
}

function DetailLine({ label, value }) {
  return <Row style={styles.detailLine}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></Row>;
}

export function StudentHome({ user }) {
  const [data, setData] = useState({ absences: [], heuresTotal: 0, matieres: [] });
  const [filter, setFilter] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const openAbsence = async (id) => {
    try { const { data: detail } = await api.get(`/etudiant/absences/${id}`); setSelected(detail); }
    catch (error) { Alert.alert('Détail indisponible', errorMessage(error)); }
  };
  const load = useCallback(async () => {
    try { const response = await api.get('/etudiant/absences', { params: filter ? { matiereId: filter } : {} }); setData(response.data); }
    catch (error) { Alert.alert('Chargement impossible', errorMessage(error)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const absenceId = response.notification.request.content.data?.absenceId;
      if (absenceId) {
        openAbsence(absenceId);
      }
    });
    return () => subscription.remove();
  }, []);
  const pendingJustifications = data.absences.filter((item) => item.statutJustificatif === 'En attente').length;

  return <Page>
    <Title eyebrow={`Bonjour ${user.prenom}`}>Vos absences</Title>
    <View style={styles.summary}><View><Text style={styles.summaryKicker}>CUMUL D’ABSENCE</Text><Text style={styles.summaryNumber}>{Number(data.heuresTotal || 0).toLocaleString('fr-FR')}<Text style={styles.summaryUnit}> h</Text></Text></View><View style={styles.summaryIcon}><Ionicons name="time-outline" size={26} color={colors.forest} /></View></View>
    <View style={styles.metricRow}>
      <View style={[styles.metricCard, styles.metricCardCoral]}><View style={[styles.metricIcon, styles.metricIconCoral]}><Ionicons name="document-text-outline" size={18} color={colors.coral} /></View><View><Text style={styles.metricValue}>{data.absences.length}</Text><Text style={styles.metricLabel}>absences enregistrées</Text></View></View>
      <View style={[styles.metricCard, styles.metricCardMint]}><View style={[styles.metricIcon, styles.metricIconMint]}><Ionicons name="hourglass-outline" size={18} color={colors.forest} /></View><View><Text style={styles.metricValue}>{pendingJustifications}</Text><Text style={styles.metricLabel}>justificatifs en attente</Text></View></View>
    </View>
    <View style={styles.filterRow}><Pressable onPress={() => setFilter(null)} style={[styles.filterPill, !filter && styles.filterActive]}><Text style={[styles.filterText, !filter && styles.filterActiveText]}>Toutes</Text></Pressable>{data.matieres.map((subject) => <Pressable key={subject.id} onPress={() => setFilter(filter === subject.id ? null : subject.id)} style={[styles.filterPill, filter === subject.id && styles.filterActive]}><Text style={[styles.filterText, filter === subject.id && styles.filterActiveText]}>{subject.nom}</Text></Pressable>)}</View>
    <View style={styles.listTitle}><Text style={styles.sectionHead}>Historique</Text><Pressable onPress={() => { setRefreshing(true); load(); }}><Ionicons name="refresh-outline" size={20} color={colors.forest} /></Pressable></View>
    {loading ? <Text style={styles.body}>Chargement…</Text> : data.absences.length === 0 ? <EmptyState title="Vous n'avez aucune absence enregistrée pour le moment" description="Vos absences apparaîtront ici après l’appel." /> : data.absences.map((item) => <Pressable key={item.id} onPress={() => openAbsence(item.id)}><Panel style={styles.absenceCard}><Row><View style={{ flex: 1, gap: 4 }}><Text style={styles.cardTitle}>{item.matiere}</Text><Text style={styles.body}>{dateText(item.date)} · {item.heureDebut} – {item.heureFin}</Text><Text style={styles.small}>{item.enseignant}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.muted} /></Row><Badge label={item.statut} />{item.statutJustificatif ? <Row style={styles.justificatifStatus}><Text style={styles.small}>Justificatif</Text><Badge label={item.statutJustificatif} /></Row> : null}</Panel></Pressable>)}
    {selected ? <AbsenceDetail item={selected} close={() => setSelected(null)} onUpdated={load} /> : null}
  </Page>;
}

export function StudentSchedule() {
  const [mode, setMode] = useState('Jour');
  const [anchor, setAnchor] = useState(new Date());
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const start = new Date(anchor);
  if (mode === 'Semaine') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  if (mode === 'Semaine') end.setDate(end.getDate() + 6);
  const asDate = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const from = asDate(start);
  const to = asDate(end);
  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get('/etudiant/emploi-du-temps', { params: { debut: from, fin: to } }); setSessions(data); }
    catch (error) { Alert.alert('Planning indisponible', errorMessage(error)); }
    finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);
  const shift = (direction) => setAnchor((previous) => { const next = new Date(previous); next.setDate(next.getDate() + direction * (mode === 'Jour' ? 1 : 7)); return next; });

  return <Page><Title eyebrow="Organisation">Emploi du temps</Title>
    <View style={styles.segment}>{['Jour', 'Semaine'].map((value) => <Pressable key={value} onPress={() => setMode(value)} style={[styles.segmentItem, mode === value && styles.segmentSelected]}><Text style={[styles.segmentText, mode === value && styles.segmentSelectedText]}>{value}</Text></Pressable>)}</View>
    <Row><Pressable onPress={() => shift(-1)} style={styles.arrow}><Ionicons name="chevron-back" size={20} color={colors.ink} /></Pressable><Text style={styles.dateRange}>{dateText(from)}{mode === 'Semaine' ? ` – ${dateText(to)}` : ''}</Text><Pressable onPress={() => shift(1)} style={styles.arrow}><Ionicons name="chevron-forward" size={20} color={colors.ink} /></Pressable></Row>
    {loading ? <Text style={styles.body}>Chargement…</Text> : sessions.length === 0 ? <EmptyState title="Aucun cours prévu" description="Aucune séance sur cette période." icon="calendar-clear-outline" /> : sessions.map((item) => <Panel key={item.id} style={styles.session}><View style={styles.timeColumn}><Text style={styles.sessionTime}>{item.heureDebut}</Text><Text style={styles.small}>{item.heureFin}</Text></View><View style={styles.sessionMain}><Text style={styles.cardTitle}>{item.matiere}</Text><Text style={styles.body}>{item.enseignant}</Text><Text style={styles.small}>{item.salle} · {dateText(item.date)}</Text></View></Panel>)}
  </Page>;
}

export function StudentProfile({ user, onLogout }) {
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get('/etudiant/profil').then(({ data }) => setEnabled(data.notificationsActives)).catch(() => {}); }, []);
  const toggleNotifications = async () => {
    setBusy(true);
    try {
      const next = !enabled;
      if (next) {
        const permission = await Notifications.requestPermissionsAsync();
        if (!permission.granted) throw new Error('Autorisez les notifications dans les réglages de votre appareil.');
        const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
        if (projectId) {
          const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
          await api.post('/etudiant/profil/push-token', { token });
        }
      } else await api.delete('/etudiant/profil/push-token');
      await api.patch('/etudiant/profil/notifications', { notificationsActives: next });
      setEnabled(next);
    } catch (error) { Alert.alert('Notifications', error.response ? errorMessage(error) : error.message || 'Activation impossible.'); }
    finally { setBusy(false); }
  };
  return <Page><Title eyebrow="Compte">Mon profil</Title>
    <Panel><View style={styles.avatar}><Text style={styles.avatarText}>{user.prenom?.[0]}{user.nom?.[0]}</Text></View><Text style={styles.profileName}>{user.prenom} {user.nom}</Text><Text style={styles.body}>{user.email}</Text><Badge label="ETUDIANT" /></Panel>
    <Panel><Row><View style={{ flex: 1 }}><Text style={styles.sectionHead}>Notifications d’absence</Text><Text style={styles.small}>Recevoir une alerte après l’appel</Text></View><Pressable disabled={busy} accessibilityRole="switch" accessibilityState={{ checked: enabled }} onPress={toggleNotifications} style={[styles.switch, enabled && styles.switchOn]}><View style={[styles.switchKnob, enabled && styles.switchKnobOn]} /></Pressable></Row></Panel>
    <Button title="Se déconnecter" icon="log-out-outline" secondary onPress={onLogout} />
  </Page>;
}

const styles = StyleSheet.create({
  summary: { backgroundColor: colors.burgundyDeep, borderRadius: 22, padding: 22, minHeight: 128, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden', borderBottomWidth: 4, borderBottomColor: colors.gold, shadowColor: colors.burgundyDeep, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 4 },
  summaryKicker: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  summaryNumber: { color: colors.white, fontWeight: '900', fontSize: 38, marginTop: 6 },
  summaryUnit: { fontSize: 17, color: colors.frost },
  summaryIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.frost, justifyContent: 'center', alignItems: 'center' },
  metricRow: { flexDirection: 'row', gap: 12 },
  metricCard: { flex: 1, minHeight: 100, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 11 },
  metricCardCoral: { backgroundColor: '#FFF4EF' },
  metricCardMint: { backgroundColor: '#E8F4F0' },
  metricIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  metricIconCoral: { backgroundColor: '#FCE1D6' },
  metricIconMint: { backgroundColor: colors.frost },
  metricValue: { color: colors.ink, fontSize: 23, fontWeight: '900' },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', lineHeight: 14 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterPill: { borderWidth: 1, borderColor: colors.line, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.white },
  filterActive: { borderColor: colors.forest, backgroundColor: colors.forest },
  filterText: { fontSize: 12, color: colors.ink, fontWeight: '700' },
  filterActiveText: { color: colors.white },
  listTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHead: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  absenceCard: { padding: 16, gap: 11, borderLeftColor: colors.coral },
  cardTitle: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  small: { color: colors.muted, fontSize: 12 },
  detailLabel: { color: colors.muted, fontSize: 13 },
  detailLine: { paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.line },
  detailValue: { color: colors.ink, fontSize: 13, fontWeight: '700', maxWidth: '65%', textAlign: 'right' },
  justificatifStatus: { paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  segment: { flexDirection: 'row', backgroundColor: colors.frost, padding: 4, borderRadius: 12 },
  segmentItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 6 },
  segmentSelected: { backgroundColor: colors.white, elevation: 2 },
  segmentText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  segmentSelectedText: { color: colors.forest },
  arrow: { width: 36, height: 36, borderRadius: 7, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  dateRange: { color: colors.ink, fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'center' },
  session: { flexDirection: 'row', gap: 14, borderLeftWidth: 4, borderLeftColor: colors.forest },
  timeColumn: { minWidth: 46, paddingTop: 2, gap: 4 },
  sessionTime: { color: colors.forest, fontWeight: '900', fontSize: 14 },
  sessionMain: { gap: 5, flex: 1 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.mint, justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  avatarText: { color: colors.forest, fontWeight: '900', fontSize: 19 },
  profileName: { textAlign: 'center', color: colors.ink, fontWeight: '900', fontSize: 19 },
  switch: { width: 46, height: 27, borderRadius: 15, backgroundColor: '#C7D0DC', padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.forest },
  switchKnob: { height: 21, width: 21, borderRadius: 11, backgroundColor: colors.white },
  switchKnobOn: { alignSelf: 'flex-end' }
});