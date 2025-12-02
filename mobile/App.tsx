import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, Button, Linking, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- IMPORTANT: CONFIGURE API HOST ---
// For Android Emulator, use: 'http://10.0.2.2:8000'
// For physical device, use your computer's local IP address. Find it by typing `ipconfig` (Windows) or `ifconfig` (macOS) in your terminal.
const API_HOST = 'http://172.31.99.143:8000';

// --- Dashboard Placeholder ---
const Dashboard = ({ onBack }) => (
  <View style={styles.container}>
    <TouchableOpacity onPress={onBack} style={styles.backButton}>
      <Text style={styles.backButtonText}>← Back</Text>
    </TouchableOpacity>
    <Text style={styles.title}>Dashboard</Text>
    <Text style={styles.subtitle}>Documents and analysis will be shown here.</Text>
  </View>
);

// --- Main App Component ---
export default function App() {
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [dob, setDob] = useState('');
  const [msg, setMsg] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState('home'); // 'home' or 'dashboard'

  useEffect(() => {
    const loadUserId = async () => {
      const storedUserId = await AsyncStorage.getItem('user_id');
      if (storedUserId) {
        setUserId(storedUserId);
      }
    };
    loadUserId();
  }, []);

  const handleSubmit = async () => {
    try {
      const res = await axios.post(`${API_HOST}/users`, {
        full_name: fullName,
        mobile,
        dob
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

  const handleGoogleLogin = () => {
    if (!userId) {
      alert("Please register first so a user_id is created.");
      return;
    }
    const authUrl = `${API_HOST}/auth?user_id=${userId}`;
    Linking.openURL(authUrl).catch(err => console.error("Couldn't load page", err));
  };

  // Simple router logic
  if (view === 'dashboard') {
    return <Dashboard onBack={() => setView('home')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Start aggregating your financial data today.</Text>

      <TextInput
        style={styles.input}
        placeholder="Full Name (John Doe)"
        value={fullName}
        onChangeText={setFullName}
        placeholderTextColor="#999"
      />
      <TextInput
        style={styles.input}
        placeholder="Phone Number (+91 98765 43210)"
        value={mobile}
        onChangeText={setMobile}
        keyboardType="tel"
        placeholderTextColor="#999"
      />
      <TextInput
        style={styles.input}
        placeholder="Date of Birth (DD/MM/YYYY)"
        value={dob}
        onChangeText={setDob}
        placeholderTextColor="#999"
      />

      <Button title="Register User" onPress={handleSubmit} />

      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      {userId && (
        <View style={styles.buttonContainer}>
          <Button title="Connect Gmail Account" onPress={handleGoogleLogin} />
          <View style={{ marginVertical: 5 }} />
          <Button title="View Documents & Analyze" onPress={() => setView('dashboard')} color="#555" />
        </View>
      )}
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#121212',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#AAA',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#333',
    color: '#FFF',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },
  msg: {
    marginTop: 20,
    color: '#FFF',
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 20,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 18,
  },
});
