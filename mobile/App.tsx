import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Linking,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import { API_BASE_URL } from './config';

// --------------------- Types ---------------------
interface DashboardProps {
  onBack: () => void;
  userId: string | null;
}

interface DeepLinkEvent {
  url: string;
}

// --------------------- Dashboard Component ---------------------
const Dashboard: React.FC<DashboardProps> = ({ onBack, userId }) => {
  const [pdfs, setPdfs] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetchPdfs();
  }, []);

  const fetchPdfs = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/pdfs`);
      setPdfs(res.data);
    } catch (err) {
      console.error("Failed to fetch PDFs", err);
    }
  };

  const handleAnalyzeAll = async () => {
    if (!userId) {
      Alert.alert("Error", "Please register/login first!");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/analyze`, {
        user_id: userId
      });
      setResult(res.data);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Analysis failed", err.response?.data?.error || err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.glassContainer}>
          <Text style={styles.title}>Your Documents</Text>
          <Text style={styles.subtitle}>PDFs found in your temp folder.</Text>

          <TouchableOpacity
            onPress={handleAnalyzeAll}
            disabled={analyzing || pdfs.length === 0}
            style={[
              styles.gradientButton,
              (analyzing || pdfs.length === 0) && styles.disabledButton
            ]}
          >
            {analyzing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Analyze All Documents with AI</Text>
            )}
          </TouchableOpacity>

          {result && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>Analysis Result</Text>
              <Text style={styles.resultText}>
                {JSON.stringify(result, null, 2)}
              </Text>
            </View>
          )}

          <View style={styles.listContainer}>
            {pdfs.length === 0 && <Text style={styles.textSecondary}>No PDFs found.</Text>}
            {pdfs.map((pdf, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listIcon}>📄</Text>
                <Text style={styles.listText}>{pdf}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

// --------------------- Main App ---------------------
export default function App() {
  const [fullName, setFullName] = useState<string>('');
  const [mobile, setMobile] = useState<string>('');
  const [dob, setDob] = useState<string>('');
  const [msg, setMsg] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'dashboard'>('home');

  // ---------------- Load User ID + Deep Link ----------------
  useEffect(() => {
    const loadId = async () => {
      const stored = await AsyncStorage.getItem('user_id');
      if (stored) setUserId(stored);
    };
    loadId();

    const handleDeepLink = async (event: DeepLinkEvent) => {
      const incomingUrl = event.url;
      console.log('Deep link received:', incomingUrl);

      if (incomingUrl.includes('oauth/callback')) {
        try {
          const processed = incomingUrl.replace(
            'com.emailbasedfinancialdataaggregation:',
            'http://dummy'
          );

          const urlObj = new URL(processed);
          const id = (urlObj.searchParams as any).get('user_id') || null;

          if (id) {
            await AsyncStorage.setItem('user_id', id);
            setUserId(id);
            setMsg('Successfully connected Gmail!');
            setView('dashboard');
            
            // Show success alert
            Alert.alert(
              'Success!',
              'Gmail account connected successfully. Redirecting to dashboard...',
              [{ text: 'OK' }]
            );
          }
        } catch (e) {
          console.log('URL parse error', e);
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });

    return () => {
      if (subscription && 'remove' in subscription) {
        subscription.remove();
      }
    };
  }, []);

  // ---------------- Register User ----------------
  const handleSubmit = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/users`, {
        full_name: fullName,
        mobile,
        dob,
      });

      if (res.data.user_id) {
        await AsyncStorage.setItem('user_id', res.data.user_id);
        setUserId(res.data.user_id);
        setMsg('Saved user id: ' + res.data.user_id);
        setFullName('');
        setMobile('');
        setDob('');
      }
    } catch (err) {
      console.error(err);
      setMsg('Error saving user');
    }
  };

  // ---------------- Connect Gmail OAuth ----------------
  const handleGoogleLogin = async () => {
    if (!userId) {
      Alert.alert('Registration Required', 'Please register first.');
      return;
    }

    const authUrl = `${API_BASE_URL}/auth?user_id=${userId}&client_type=android`;
    const redirectUrl = 'com.emailbasedfinancialdataaggregation:/oauth/callback';

    try {
      // Check if InAppBrowser is available
      if (await InAppBrowser.isAvailable()) {
        const result = await InAppBrowser.openAuth(authUrl, redirectUrl, {
          // iOS Options
          ephemeralWebSession: false,
          // Android Options
          showTitle: true,
          enableUrlBarHiding: true,
          enableDefaultShare: false,
          // Styling to match app theme
          toolbarColor: '#6c5ce7',
          secondaryToolbarColor: '#302b63',
          navigationBarColor: '#0f0c29',
          navigationBarDividerColor: '#302b63',
          // Animations
          animations: {
            startEnter: 'slide_in_right',
            startExit: 'slide_out_left',
            endEnter: 'slide_in_left',
            endExit: 'slide_out_right'
          },
          headers: {
            'User-Agent': 'EmailFinanceApp/1.0'
          }
        });
        
        console.log('InAppBrowser result:', result);
      } else {
        // Fallback to external browser if InAppBrowser is not available
        console.log('InAppBrowser not available, using external browser');
        Linking.openURL(authUrl).catch(err =>
          console.error("Couldn't open page", err)
        );
      }
    } catch (error: any) {
      console.error('OAuth error:', error);
      if (error.message !== 'User cancelled') {
        Alert.alert('Authentication Error', 'Failed to open authentication page');
      }
    }
  };

  // ---------------- Simple Router ----------------
  if (view === 'dashboard') {
    return <Dashboard onBack={() => setView('home')} userId={userId} />;
  }

  return (
    <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.glassContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start aggregating your financial data.</Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                value={fullName}
                onChangeText={setFullName}
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="+91 98765 43210"
                value={mobile}
                onChangeText={setMobile}
                keyboardType="phone-pad"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date of Birth (DD/MM/YYYY)</Text>
              <TextInput
                style={styles.input}
                placeholder="DD/MM/YYYY"
                value={dob}
                onChangeText={setDob}
                placeholderTextColor="#999"
              />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleSubmit}>
              <Text style={styles.buttonText}>Register User</Text>
            </TouchableOpacity>
          </View>

          {msg ? <Text style={styles.msg}>{msg}</Text> : null}

          {userId && (
            <View style={styles.buttonSpacer}>
              <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleLogin}>
                {/* Placeholder for Google Logo - simple text G for now */}
                <Text style={styles.googleBtnText}>G  Connect Gmail Account</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.outlineButton}
                onPress={() => setView('dashboard')}
              >
                <Text style={styles.outlineButtonText}>View Documents & Analyze</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

// --------------------- Styles ---------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  glassContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 30,
    width: '100%',
    shadowColor: '#1f2687',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.37,
    shadowRadius: 32,
    elevation: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: 'System', 
  },
  subtitle: {
    fontSize: 16,
    color: '#b3b3b3',
    textAlign: 'center',
    marginBottom: 30,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    color: '#b3b3b3',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    color: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#6c5ce7',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#6c5ce7',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 5,
  },
  gradientButton: {
    backgroundColor: '#6c5ce7', // Fallback for gradient
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  msg: {
    marginTop: 20,
    padding: 10,
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    borderColor: 'rgba(46, 204, 113, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    color: '#2ecc71',
    textAlign: 'center',
  },
  buttonSpacer: {
    marginTop: 20,
    gap: 15,
  },
  googleBtn: {
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  googleBtnText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: '#FFF',
    fontSize: 16,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 18,
  },
  // Dashboard specific
  resultContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 20,
    borderRadius: 12,
    marginVertical: 20,
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
  },
  resultTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultText: {
    color: '#a29bfe',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  listContainer: {
    gap: 10,
    marginTop: 20,
  },
  listItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 15,
    borderRadius: 8,
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  listIcon: {
    marginRight: 10,
    fontSize: 20,
  },
  listText: {
    color: '#FFF',
    fontWeight: '500',
  },
  textSecondary: {
    color: '#b3b3b3',
    textAlign: 'center',
  },
});
