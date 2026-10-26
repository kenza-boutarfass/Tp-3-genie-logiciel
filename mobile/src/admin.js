import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import api, { apiBaseURL, errorMessage } from './api';
import { colors } from './theme';
import { Badge, Button, EmptyState, Field, Page, Panel, Row, Title } from './ui';
import { getSessionItem } from './sessionStore';

export function AdminHome({ user, onLogout }) {
  const [refs, setRefs] = useState({ groupes: [] });
  const [users, setUsers] = useState({ etudiants: [], enseignants: [] });
  const [kind, setKind] = useState('ETUDIANT');
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', matricule: '', departement: '', groupeId: '' });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const load = useCallback(async () => {
    try {
      const [references, people] = await Promise.all([api.get('/admin/referentiels'), api.get('/admin/utilisateurs')]);
      setRefs(references.data); setUsers(people.data);
      if (!form.groupeId && references.data.groupes[0]) setForm((current) => ({ ...current, groupeId: String(references.data.groupes[0].id) }));
    } catch (error) { Alert.alert('Données indisponibles', errorMessage(error)); }
  }, [form.groupeId]);
  useEffect(() => { load(); }, [load]);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (!form.nom.trim() || !form.prenom.trim() || !form.email.trim() || (kind === 'ETUDIANT' && (!form.matricule.trim() || !form.groupeId)) || (kind === 'ENSEIGNANT' && !form.departement.trim())) return Alert.alert('Formulaire incomplet', 'Renseignez tous les champs obligatoires.');
    setBusy(true);
    try {
      const payload = kind === 'ETUDIANT' ? { ...form, groupeId: Number(form.groupeId) } : form;
      const { data } = editing ? await api.patch(`/admin/etudiants/${editing.id}`, payload) : await api.post(`/admin/${kind === 'ETUDIANT' ? 'etudiants' : 'enseignants'}`, payload);
      if (data.motDePasseTemporaire) Alert.alert('Compte créé', `Mot de passe temporaire : ${data.motDePasseTemporaire}`);
      else Alert.alert('Enregistré', data.message || 'Les informations ont été mises à jour.');
      setEditing(null); setForm({ nom: '', prenom: '', email: '', matricule: '', departement: '', groupeId: refs.groupes[0] ? String(refs.groupes[0].id) : '' });
      await load();
    } catch (error) { Alert.alert('Enregistrement impossible', errorMessage(error)); }
    finally { setBusy(false); }
  };
  const editStudent = (item) => {
    setKind('ETUDIANT'); setEditing(item);
    setForm({ nom: item.nom, prenom: item.prenom, email: item.email, matricule: item.matricule, groupeId: String(item.groupeId || ''), departement: '' });
  };

  return <Page><Title eyebrow={`Administration · ${user.prenom}`}>Comptes</Title>
    <Panel style={styles.adminOverview}><View style={styles.adminOverviewTop}><View style={styles.adminOverviewIcon}><Ionicons name="sparkles-outline" size={20} color={colors.gold} /></View><View><Text style={styles.adminOverviewKicker}>CAMPUS EN UN COUP D’ŒIL</Text><Text style={styles.adminOverviewTitle}>Une communauté qui grandit</Text></View></View><View style={styles.adminMetricRow}><View style={styles.adminMetric}><Text style={styles.adminMetricValue}>{users.etudiants.length}</Text><Text style={styles.adminMetricLabel}>étudiants</Text></View><View style={styles.adminMetricDivider} /><View style={styles.adminMetric}><Text style={styles.adminMetricValue}>{users.enseignants.length}</Text><Text style={styles.adminMetricLabel}>enseignants</Text></View><View style={styles.adminMetricDivider} /><View style={styles.adminMetric}><Text style={styles.adminMetricValue}>{refs.groupes.length}</Text><Text style={styles.adminMetricLabel}>groupes</Text></View></View></Panel>
    <View style={styles.segment}>{['ETUDIANT', 'ENSEIGNANT'].map((value) => <Pressable key={value} onPress={() => { setKind(value); setEditing(null); }} style={[styles.segmentItem, kind === value && styles.segmentSelected]}><Text style={[styles.segmentText, kind === value && styles.segmentSelectedText]}>{value === 'ETUDIANT' ? 'Étudiant' : 'Enseignant'}</Text></Pressable>)}</View>
    <Panel>
      <Text style={styles.sectionHead}>{editing ? 'Modifier un étudiant' : kind === 'ETUDIANT' ? 'Ajouter un étudiant' : 'Ajouter un enseignant'}</Text>
      <Field label="Nom" value={form.nom} onChangeText={(value) => set('nom', value)} placeholder="Nom" />
      <Field label="Prénom" value={form.prenom} onChangeText={(value) => set('prenom', value)} placeholder="Prénom" />
      <Field label="Email" value={form.email} onChangeText={(value) => set('email', value)} placeholder="nom@universite.fr" keyboardType="email-address" />
      {kind === 'ETUDIANT' ? <><Field label="Matricule" value={form.matricule} onChangeText={(value) => set('matricule', value)} placeholder="U2026001" /><ChoiceField label="Groupe" options={refs.groupes.map((group) => ({ id: group.id, label: group.nom }))} value={Number(form.groupeId)} onSelect={(value) => set('groupeId', String(value))} /></> : <Field label="Département" value={form.departement} onChangeText={(value) => set('departement', value)} placeholder="Informatique" />}
      <Button title={editing ? 'Enregistrer les modifications' : 'Créer le compte'} icon={editing ? 'save-outline' : 'person-add-outline'} loading={busy} onPress={submit} />
      {editing ? <Button title="Annuler" secondary onPress={() => { setEditing(null); setForm({ nom: '', prenom: '', email: '', matricule: '', departement: '', groupeId: '' }); }} /> : null}
    </Panel>
    <Text style={styles.sectionHead}>Étudiants · {users.etudiants.length}</Text>
    {users.etudiants.map((item) => <Pressable key={item.id} onPress={() => editStudent(item)}><Panel style={styles.person}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{item.prenom} {item.nom}</Text><Text style={styles.small}>{item.matricule} · {item.groupe || 'Sans groupe'}</Text><Text style={styles.small}>{item.email}</Text></View><Ionicons name="create-outline" size={19} color={colors.forest} /></Panel></Pressable>)}
    <Text style={styles.sectionHead}>Enseignants · {users.enseignants.length}</Text>
    {users.enseignants.map((item) => <Panel key={item.id} style={styles.person}><View><Text style={styles.cardTitle}>{item.prenom} {item.nom}</Text><Text style={styles.small}>{item.departement} · {item.email}</Text></View></Panel>)}
    <Button title="Se déconnecter" icon="log-out-outline" secondary onPress={onLogout} />
  </Page>;
}

function ChoiceField({ label, options, value, onSelect }) {
  return <View style={{ gap: 8 }}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.choices}>{options.map((item) => <Pressable key={item.id} onPress={() => onSelect(item.id)} style={[styles.choice, value === item.id && styles.choiceOn]}><Text style={[styles.choiceText, value === item.id && styles.choiceTextOn]}>{item.label}</Text></Pressable>)}</View></View>;
}

export function AdminGroups() {
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState({ etudiants: [] });
  const [refs, setRefs] = useState({ matieres: [], enseignants: [] });
  const [form, setForm] = useState({ nom: '', filiere: '', niveau: 'L1' });
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [transfer, setTransfer] = useState({ studentId: '', groupId: '' });
  const [sessionForm, setSessionForm] = useState({ groupeId: '', matiereId: '', enseignantId: '', date: '', heureDebut: '', heureFin: '', salle: '' });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [groupResult, people, references] = await Promise.all([api.get('/admin/groupes'), api.get('/admin/utilisateurs'), api.get('/admin/referentiels')]);
      setGroups(groupResult.data); setUsers(people.data); setRefs(references.data);
      setSessionForm((current) => ({ ...current, groupeId: current.groupeId || String(groupResult.data[0]?.id || ''), matiereId: current.matiereId || String(references.data.matieres[0]?.id || ''), enseignantId: current.enseignantId || String(references.data.enseignants[0]?.id || '') }));
    }
    catch (error) { Alert.alert('Chargement impossible', errorMessage(error)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const saveGroup = async () => {
    if (!form.nom.trim() || !form.filiere.trim()) return Alert.alert('Champs requis', 'Saisissez le nom du groupe et sa filière.');
    setBusy(true);
    try {
      if (editingGroupId) await api.patch(`/admin/groupes/${editingGroupId}`, form);
      else await api.post('/admin/groupes', form);
      setEditingGroupId(null);
      setForm({ nom: '', filiere: '', niveau: 'L1' });
      await load();
    }
    catch (error) { Alert.alert(editingGroupId ? 'Modification impossible' : 'Création impossible', errorMessage(error)); }
    finally { setBusy(false); }
  };
  const editGroup = (group) => {
    setEditingGroupId(group.id);
    setForm({ nom: group.nom, filiere: group.filiere, niveau: group.niveau });
  };
  const transferStudent = async () => {
    const student = users.etudiants.find((item) => String(item.id) === transfer.studentId);
    if (!student || !transfer.groupId) return Alert.alert('Sélection requise', 'Choisissez un étudiant et son groupe de destination.');
    try { await api.patch(`/admin/etudiants/${student.id}`, { nom: student.nom, prenom: student.prenom, email: student.email, matricule: student.matricule, groupeId: Number(transfer.groupId) }); Alert.alert('Transfert effectué', `${student.prenom} a changé de groupe.`); await load(); }
    catch (error) { Alert.alert('Transfert impossible', errorMessage(error)); }
  };
  const createSession = async () => {
    if (Object.values(sessionForm).some((value) => !String(value).trim())) return Alert.alert('Séance incomplète', 'Renseignez le groupe, la matière, l’enseignant, la date, les horaires et la salle.');
    try {
      await api.post('/admin/seances', { ...sessionForm, groupeId: Number(sessionForm.groupeId), matiereId: Number(sessionForm.matiereId), enseignantId: Number(sessionForm.enseignantId) });
      Alert.alert('Séance créée', 'La séance et son affectation ont été enregistrées.');
      setSessionForm((current) => ({ ...current, date: '', heureDebut: '', heureFin: '', salle: '' }));
    } catch (error) { Alert.alert('Création impossible', errorMessage(error)); }
  };
  return <Page><Title eyebrow="Administration">Groupes & affectations</Title>
    <Panel><Text style={styles.sectionHead}>{editingGroupId ? 'Modifier un groupe' : 'Créer un groupe'}</Text><Field label="Nom" value={form.nom} onChangeText={(nom) => setForm((current) => ({ ...current, nom }))} placeholder="TD3" /><Field label="Filière" value={form.filiere} onChangeText={(filiere) => setForm((current) => ({ ...current, filiere }))} placeholder="Informatique" /><Field label="Niveau" value={form.niveau} onChangeText={(niveau) => setForm((current) => ({ ...current, niveau }))} placeholder="L1" /><Button title={editingGroupId ? 'Enregistrer les modifications' : 'Créer le groupe'} icon={editingGroupId ? 'save-outline' : 'add-outline'} loading={busy} onPress={saveGroup} />{editingGroupId ? <Button title="Annuler" secondary onPress={() => { setEditingGroupId(null); setForm({ nom: '', filiere: '', niveau: 'L1' }); }} /> : null}</Panel>
    {groups.map((group) => <Panel key={group.id}><Row><View><Text style={styles.cardTitle}>{group.nom}</Text><Text style={styles.small}>{group.filiere} · {group.niveau}</Text></View><Row><Badge label={`${group.nombreEtudiants} étudiants`} /><Pressable accessibilityRole="button" accessibilityLabel={`Modifier le groupe ${group.nom}`} onPress={() => editGroup(group)} style={{ padding: 6 }}><Ionicons name="create-outline" size={19} color={colors.forest} /></Pressable></Row></Row></Panel>)}
    <Panel><Text style={styles.sectionHead}>Transférer un étudiant</Text><ChoiceField label="Étudiant" options={users.etudiants.map((item) => ({ id: item.id, label: `${item.prenom} ${item.nom}` }))} value={Number(transfer.studentId)} onSelect={(id) => setTransfer((current) => ({ ...current, studentId: String(id) }))} /><ChoiceField label="Groupe cible" options={groups.map((item) => ({ id: item.id, label: item.nom }))} value={Number(transfer.groupId)} onSelect={(id) => setTransfer((current) => ({ ...current, groupId: String(id) }))} /><Button title="Transférer" icon="swap-horizontal-outline" onPress={transferStudent} /></Panel>
    <Panel><Text style={styles.sectionHead}>Créer une séance et affecter un enseignant</Text>
      <ChoiceField label="Groupe" options={groups.map((item) => ({ id: item.id, label: item.nom }))} value={Number(sessionForm.groupeId)} onSelect={(value) => setSessionForm((current) => ({ ...current, groupeId: String(value) }))} />
      <ChoiceField label="Matière" options={refs.matieres.map((item) => ({ id: item.id, label: item.nom }))} value={Number(sessionForm.matiereId)} onSelect={(value) => setSessionForm((current) => ({ ...current, matiereId: String(value) }))} />
      <ChoiceField label="Enseignant" options={refs.enseignants.map((item) => ({ id: item.id, label: `${item.prenom} ${item.nom}` }))} value={Number(sessionForm.enseignantId)} onSelect={(value) => setSessionForm((current) => ({ ...current, enseignantId: String(value) }))} />
      <Field label="Date (AAAA-MM-JJ)" value={sessionForm.date} onChangeText={(value) => setSessionForm((current) => ({ ...current, date: value }))} placeholder="2026-10-20" />
      <Row><View style={{ flex: 1 }}><Field label="Début (HH:MM)" value={sessionForm.heureDebut} onChangeText={(value) => setSessionForm((current) => ({ ...current, heureDebut: value }))} placeholder="09:00" /></View><View style={{ flex: 1 }}><Field label="Fin (HH:MM)" value={sessionForm.heureFin} onChangeText={(value) => setSessionForm((current) => ({ ...current, heureFin: value }))} placeholder="10:30" /></View></Row>
      <Field label="Salle" value={sessionForm.salle} onChangeText={(value) => setSessionForm((current) => ({ ...current, salle: value }))} placeholder="B201" />
      <Button title="Créer la séance" icon="calendar-outline" onPress={createSession} />
    </Panel>
  </Page>;
}

export function AdminReview() {
  const [items, setItems] = useState([]);
  const [reasons, setReasons] = useState({});
  const load = useCallback(async () => {
    try { const { data } = await api.get('/admin/justificatifs'); setItems(data); }
    catch (error) { Alert.alert('Dossiers indisponibles', errorMessage(error)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const decide = async (item, status) => {
    const motifRefus = reasons[item.id]?.trim();
    if (status === 'Refusé' && !motifRefus) return Alert.alert('Motif obligatoire', 'Saisissez le motif de refus avant de continuer.');
    try { await api.patch(`/admin/justificatifs/${item.id}`, { statut: status, motifRefus }); Alert.alert('Décision enregistrée', `Le justificatif a été ${status.toLowerCase()}.`); await load(); }
    catch (error) { Alert.alert('Mise à jour impossible', errorMessage(error)); }
  };
  return <Page><Title eyebrow="Administration">Justificatifs</Title>
    {items.length === 0 ? <EmptyState title="Aucun dossier à traiter" description="Les justificatifs déposés apparaîtront ici." icon="documents-outline" /> : items.map((item) => <Panel key={item.id}>
      <Row><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{item.prenom} {item.nom}</Text><Text style={styles.small}>{item.matiere} · {item.date}</Text></View><Badge label={item.statut} /></Row>
      <Text style={styles.body}>{item.motif}</Text><Text style={styles.small}>Période : {item.dateDebut} au {item.dateFin}</Text>
      <Pressable onPress={async () => {
        try {
          const token = await getSessionItem('session-token');
          const base = apiBaseURL;
          const file = await FileSystem.downloadAsync(`${base}/admin/justificatifs/${item.id}/fichier`, `${FileSystem.cacheDirectory}${item.fichier}`, { headers: { Authorization: `Bearer ${token}` } });
          if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { dialogTitle: 'Ouvrir le justificatif' });
        } catch (error) { Alert.alert('Fichier indisponible', error.message || 'Téléchargement impossible.'); }
      }} style={styles.fileLink}><Ionicons name="document-attach-outline" size={17} color={colors.forest} /><Text style={styles.fileName}>{item.fichier} · Ouvrir</Text></Pressable>
      {item.statut === 'En attente' ? <><Field label="Motif de refus (obligatoire en cas de refus)" value={reasons[item.id] || ''} onChangeText={(value) => setReasons((current) => ({ ...current, [item.id]: value }))} placeholder="Précisez la raison" multiline /><Row><Button title="Valider" icon="checkmark" onPress={() => decide(item, 'Validé')} style={{ flex: 1 }} /><Button title="Refuser" icon="close" secondary onPress={() => decide(item, 'Refusé')} style={{ flex: 1 }} /></Row></> : null}
      {item.statut === 'Refusé' ? <Text style={styles.small}>Déjà refusé</Text> : null}
    </Panel>)}
  </Page>;
}

export function AdminStats() {
  const [items, setItems] = useState([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const { data } = await api.get('/admin/statistiques', { params: { ...(start ? { debut: start } : {}), ...(end ? { fin: end } : {}) } }); setItems(data); }
    catch (error) { Alert.alert('Statistiques indisponibles', errorMessage(error)); }
  }, [start, end]);
  useEffect(() => { load(); }, [load]);
  const exportCsv = async () => {
    setBusy(true);
    try {
      const token = await getSessionItem('session-token');
      const base = apiBaseURL;
      const filename = `${FileSystem.documentDirectory}statistiques-absences.csv`;
      const params = [start && `debut=${encodeURIComponent(start)}`, end && `fin=${encodeURIComponent(end)}`].filter(Boolean).join('&');
      const result = await FileSystem.downloadAsync(`${base}/admin/statistiques.csv${params ? `?${params}` : ''}`, filename, { headers: { Authorization: `Bearer ${token}` } });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { mimeType: 'text/csv', dialogTitle: 'Exporter les statistiques' });
      else await Share.share({ message: items.map((item) => `${item.filiere},${item.niveau},${item.matiere},${item.absences},${item.seances}`).join('\n') });
    } catch (error) { Alert.alert('Export impossible', error.message || 'Impossible de générer le fichier CSV.'); }
    finally { setBusy(false); }
  };
  const max = Math.max(...items.map((item) => item.absences), 1);
  return <Page><Title eyebrow="Vue d’ensemble">Statistiques</Title>
    <Panel><Text style={styles.sectionHead}>Période</Text><Field label="Du (AAAA-MM-JJ)" value={start} onChangeText={setStart} placeholder="2026-09-01" /><Field label="Au (AAAA-MM-JJ)" value={end} onChangeText={setEnd} placeholder="2026-12-31" /><Button title="Actualiser" icon="filter-outline" secondary onPress={load} /></Panel>
    <Button title="Exporter en CSV" icon="download-outline" loading={busy} onPress={exportCsv} />
    {items.length === 0 ? <EmptyState title="Aucune donnée pour cette période" icon="bar-chart-outline" /> : items.map((item, index) => {
      const accent = [colors.coral, colors.forest, colors.blue, colors.amber, colors.red, colors.burgundyDeep][index % 6];
      return <Panel key={`${item.filiere}-${item.niveau}-${item.matiere}`} style={{ borderLeftColor: accent }}><Row><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{item.matiere}</Text><Text style={styles.small}>{item.filiere} · {item.niveau}</Text></View><Text style={[styles.statNumber, { color: accent }]}>{item.absences}</Text></Row><View style={styles.track}><View style={[styles.bar, { width: `${Math.max(4, item.absences / max * 100)}%`, backgroundColor: accent }]} /></View><Text style={styles.small}>{item.absences} absence(s) · {item.seances} séance(s) agrégées · {item.taux}%</Text></Panel>;
    })}
  </Page>;
}

const styles = StyleSheet.create({
  adminOverview: { backgroundColor: colors.burgundyDeep, borderColor: colors.burgundyDeep, borderLeftColor: colors.gold, borderLeftWidth: 4, gap: 18, padding: 20 },
  adminOverviewTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adminOverviewIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  adminOverviewKicker: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  adminOverviewTitle: { color: colors.white, fontSize: 16, fontWeight: '800', marginTop: 4 },
  adminMetricRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)' },
  adminMetric: { alignItems: 'center', flex: 1, gap: 3 },
  adminMetricValue: { color: colors.white, fontSize: 22, fontWeight: '900' },
  adminMetricLabel: { color: '#E8D8DC', fontSize: 10, fontWeight: '700' },
  adminMetricDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.18)' },
  segment: { flexDirection: 'row', backgroundColor: colors.frost, padding: 4, borderRadius: 12 },
  segmentItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 6 },
  segmentSelected: { backgroundColor: colors.white, elevation: 2 },
  segmentText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  segmentSelectedText: { color: colors.forest },
  sectionHead: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  cardTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  small: { color: colors.muted, fontSize: 12 },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  person: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderLeftColor: colors.sky },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: colors.white },
  choiceOn: { borderColor: colors.forest, backgroundColor: colors.forest },
  choiceText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  choiceTextOn: { color: colors.white },
  fileLink: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 6 },
  fileName: { color: colors.forest, fontSize: 13, fontWeight: '700' },
  track: { height: 7, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  bar: { height: 7, borderRadius: 4, backgroundColor: colors.coral },
  statNumber: { color: colors.ink, fontSize: 20, fontWeight: '900' }
});