import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import api, { errorMessage } from './src/api';
import { colors } from './src/theme';
import { Page, Button, Field } from './src/ui';
import { StudentHome, StudentSchedule, StudentProfile } from './src/student';
import { TeacherHome, TeacherStats } from './src/teacher';
import { AdminHome, AdminGroups, AdminReview, AdminStats } from './src/admin';
import { deleteSessionItem, getSessionItem, setSessionItem } from './src/sessionStore';

const Tab = createBottomTabNavigator();
const isWeb = Platform.OS === 'web';
const isWideWeb = isWeb && Dimensions.get('window').width >= 900;
const tabStyle = {
  headerShown: false,
  tabBarPosition: isWideWeb ? 'left' : 'bottom',
  tabBarActiveTintColor: colors.forest,
  tabBarInactiveTintColor: colors.muted,
  tabBarActiveBackgroundColor: isWideWeb ? colors.ice : colors.white,
  tabBarStyle: isWideWeb
    ? { width: 246, paddingHorizontal: 14, paddingVertical: 26, borderRightWidth: 1, borderRightColor: colors.line, backgroundColor: colors.white }
    : { height: 74, paddingTop: 10, paddingBottom: 11, borderTopColor: colors.line, backgroundColor: colors.white, shadowColor: colors.ink, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 8 },
  tabBarItemStyle: isWideWeb ? { height: 52, borderRadius: 14, marginVertical: 5 } : { borderRadius: 12, marginHorizontal: 5 },
  tabBarLabelPosition: isWideWeb ? 'beside-icon' : 'below-icon',
  tabBarLabelStyle: { fontSize: 12, fontWeight: '700' }
};

function RoleTabs({ role, user, onLogout }) {
  const screens = role === 'ETUDIANT'
    ? [['Accueil', StudentHome, 'grid-outline'], ['Planning', StudentSchedule, 'calendar-outline'], ['Profil', StudentProfile, 'person-circle-outline']]
    : role === 'ENSEIGNANT'
      ? [['Appel', TeacherHome, 'clipboard-outline'], ['Suivi', TeacherStats, 'stats-chart-outline']]
      : [['Gestion', AdminHome, 'people-outline'], ['Groupes', AdminGroups, 'albums-outline'], ['Dossiers', AdminReview, 'documents-outline'], ['Stats', AdminStats, 'bar-chart-outline']];
  return <Tab.Navigator screenOptions={({ route }) => ({ ...tabStyle, tabBarIcon: ({ color, size }) => <Ionicons name={screens.find(([name]) => name === route.name)?.[2] || 'ellipse'} size={size} color={color} /> })}>
    {screens.map(([name, component]) => <Tab.Screen key={name} name={name}>{(props) => React.createElement(component, { ...props, user, onLogout })}</Tab.Screen>)}
  </Tab.Navigator>;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!email.trim() || !password) return Alert.alert('Champs requis', 'Saisissez votre email et votre mot de passe.');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: email.trim(), motDePasse: password });
      await setSessionItem('session-token', data.token);
      await setSessionItem('session-user', JSON.stringify(data.utilisateur));
      onLogin(data.utilisateur);
    } catch (error) { Alert.alert('Connexion impossible', errorMessage(error)); }
    finally { setLoading(false); }
  };

  return <SafeAreaView style={styles.loginRoot}><StatusBar style="dark" /><Page style={styles.loginPage}>
    <View style={styles.loginFrame}>
      <View style={styles.loginHero}>
        <View style={styles.heroOrbLarge} /><View style={styles.heroOrbSmall} />
        <View style={styles.heroBrand}><Text style={styles.heroBrandText}>CAMPUS<Text style={{ color: colors.gold }}> / </Text>PRÉSENCES</Text></View>
        <View style={styles.heroCopy}>
          <View style={styles.heroPill}><Ionicons name="sparkles-outline" size={14} color={colors.gold} /><Text style={styles.heroPillText}>L’ESPRIT DU CAMPUS, EN MIEUX</Text></View>
          <Text style={styles.heroTitle}>Chaque présence{'\n'}compte.</Text>
          <Text style={styles.heroDescription}>Un espace clair et serein pour suivre le rythme de la vie universitaire.</Text>
        </View>
        <View style={styles.heroFoot}><View style={styles.heroFootLine} /><Text style={styles.heroFootText}>ÉTUDIANTS · ENSEIGNANTS · ADMINISTRATION</Text></View>
      </View>
      <View style={styles.loginContent}>
        <View style={styles.mobileBrand}><Text style={styles.mobileBrandText}>CAMPUS <Text style={{ color: colors.forest }}>/</Text> PRÉSENCES</Text></View>
        <View style={styles.welcome}><Text style={styles.welcomeKicker}>VOTRE ESPACE UNIVERSITAIRE</Text><Text style={styles.welcomeTitle}>Ravi de vous retrouver.</Text><Text style={styles.welcomeSub}>Connectez-vous pour reprendre le fil de votre campus.</Text></View>
        <View style={styles.loginForm}>
          <Field label="Adresse email" value={email} onChangeText={setEmail} placeholder="nom@universite.fr" keyboardType="email-address" autoCorrect={false} />
          <Field label="Mot de passe" value={password} onChangeText={setPassword} placeholder="Votre mot de passe" secureTextEntry onSubmitEditing={submit} />
          <Button title="Se connecter" icon="arrow-forward" loading={loading} onPress={submit} style={{ marginTop: 8 }} />
          <View style={styles.loginHintRow}><Ionicons name="lock-closed-outline" size={14} color={colors.muted} /><Text style={styles.loginHint}>Accès sécurisé réservé aux membres de l’université</Text></View>
        </View>
      </View>
    </View>
  </Page></SafeAreaView>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all([getSessionItem('session-token'), getSessionItem('session-user')]).then(([token, raw]) => {
      if (token && raw) setUser(JSON.parse(raw));
    }).catch(() => {}).finally(() => setReady(true));
  }, []);
  const logout = async () => {
    await deleteSessionItem('session-token');
    await deleteSessionItem('session-user');
    setUser(null);
  };
  if (!ready) return <View style={styles.loading}><ActivityIndicator color={colors.forest} /></View>;
  return <NavigationContainer><StatusBar style="dark" />{user ? <RoleTabs role={user.role} user={user} onLogout={logout} /> : <Login onLogin={setUser} />}</NavigationContainer>;
}

const styles = StyleSheet.create({
  loginRoot: { flex: 1, backgroundColor: colors.paper },
  loginPage: { backgroundColor: colors.paper },
  loginFrame: { flex: 1, width: '100%', maxWidth: 1220, minHeight: isWideWeb ? 'calc(100vh - 56px)' : undefined, alignSelf: 'center', flexDirection: isWideWeb ? 'row' : 'column', gap: isWideWeb ? 52 : 28, paddingVertical: isWideWeb ? 12 : 0 },
  loginHero: { flex: isWideWeb ? 1.02 : undefined, minHeight: isWideWeb ? 590 : 250, borderRadius: 28, padding: isWideWeb ? 40 : 25, backgroundColor: colors.burgundyDeep, justifyContent: 'space-between', overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  heroOrbLarge: { position: 'absolute', width: 380, height: 380, borderRadius: 190, right: -150, top: -120, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  heroOrbSmall: { position: 'absolute', width: 240, height: 240, borderRadius: 120, right: -78, top: -50, backgroundColor: 'rgba(235,216,220,0.12)' },
  heroBrand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroBrandText: { color: colors.white, fontSize: 15, fontWeight: '900', letterSpacing: 1.2 },
  heroCopy: { maxWidth: 440, gap: 16, marginVertical: isWideWeb ? 38 : 24 },
  heroPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  heroPillText: { color: '#F0E5D6', fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  heroTitle: { color: colors.white, fontSize: isWideWeb ? 49 : 35, lineHeight: isWideWeb ? 56 : 42, letterSpacing: -1.4, fontWeight: '800' },
  heroDescription: { color: '#E0D7DB', fontSize: 15, lineHeight: 23, maxWidth: 350 },
  heroFoot: { gap: 12 },
  heroFootLine: { width: 42, height: 3, borderRadius: 2, backgroundColor: colors.gold },
  heroFootText: { color: '#E8D4D9', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  loginContent: { flex: 1, justifyContent: 'center', maxWidth: isWideWeb ? 440 : undefined, alignSelf: isWideWeb ? 'center' : 'stretch', width: '100%', paddingVertical: isWideWeb ? 32 : 0 },
  mobileBrand: { display: isWideWeb ? 'none' : 'flex', flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 20 },
  mobileBrandText: { color: colors.ink, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  welcome: { marginBottom: 28 },
  welcomeKicker: { color: colors.forest, fontWeight: '800', fontSize: 10, letterSpacing: 1.5, marginBottom: 11 },
  welcomeTitle: { color: colors.ink, fontWeight: '800', fontSize: 32, lineHeight: 39, letterSpacing: -0.8 },
  welcomeSub: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 10, maxWidth: 360 },
  loginForm: { gap: 17, backgroundColor: colors.white, borderRadius: 22, padding: 24, borderWidth: 1, borderColor: colors.line, borderTopWidth: 4, borderTopColor: colors.gold, shadowColor: colors.ink, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.09, shadowRadius: 24, elevation: 4 },
  loginHintRow: { flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  loginHint: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  loading: { flex: 1, justifyContent: 'center', backgroundColor: colors.paper }
});