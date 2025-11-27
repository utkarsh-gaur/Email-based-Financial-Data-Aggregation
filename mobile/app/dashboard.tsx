import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { StyledButton, PageTitle, PageSubtitle, Message } from '../components/AppComponents';
import { API_URL } from '../constants/Config';
import { Colors } from '../constants/theme';

export default function Dashboard() {
  const router = useRouter();
  const [pdfs, setPdfs] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    fetchUserId();
    fetchPdfs();
  }, []);

  const fetchUserId = async () => {
    const id = await SecureStore.getItemAsync('user_id');
    if (id) setUserId(id);
  };

  const fetchPdfs = async () => {
    try {
      const res = await axios.get(`${API_URL}/pdfs`);
      setPdfs(res.data);
    } catch (err) {
      console.error("Failed to fetch PDFs", err);
    }
  };

  const handleAnalyzeAll = async () => {
    if (!userId) {
      alert("Please register/login first!");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const res = await axios.post(`${API_URL}/analyze`, {
        user_id: userId
      });
      setResult(res.data);
    } catch (err: any) {
      console.error(err);
      alert("Analysis failed: " + (err.response?.data?.error || err.message));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <StyledButton
          title="← Back"
          variant="outline"
          onPress={() => router.back()}
          style={styles.backButton}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PageTitle>Your Documents</PageTitle>
        <PageSubtitle>PDFs found in your temp folder.</PageSubtitle>

        <View style={styles.actionContainer}>
          <StyledButton
            title={analyzing ? 'Analyzing All Documents...' : 'Analyze All Documents with AI'}
            onPress={handleAnalyzeAll}
            disabled={analyzing || pdfs.length === 0}
            loading={analyzing}
          />
        </View>

        {result && (
          <View style={styles.resultContainer}>
            <Text style={styles.resultTitle}>Analysis Result</Text>
            <Text style={styles.resultText}>
              {JSON.stringify(result, null, 2)}
            </Text>
          </View>
        )}

        <View style={styles.pdfList}>
          {pdfs.length === 0 && <Text style={styles.emptyText}>No PDFs found.</Text>}

          {pdfs.map((pdf, index) => (
            <View key={index} style={styles.pdfItem}>
              <Text style={styles.pdfIcon}>📄</Text>
              <Text style={styles.pdfName}>{pdf}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 0,
  },
  content: {
    paddingBottom: 40,
  },
  actionContainer: {
    marginBottom: 20,
  },
  resultContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  resultText: {
    fontSize: 14,
    color: Colors.accentHover,
    fontFamily: 'monospace',
  },
  pdfList: {
    gap: 10,
  },
  pdfItem: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pdfIcon: {
    marginRight: 10,
    fontSize: 18,
  },
  pdfName: {
    color: 'white',
    fontWeight: '500',
    fontSize: 16,
  },
  emptyText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
});
