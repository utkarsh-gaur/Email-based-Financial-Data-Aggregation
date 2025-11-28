import React, { useState, useEffect } from 'react';
import { View, Image } from 'react-native';
import { useRouter } from 'expo-router';

import * as WebBrowser from 'expo-web-browser';
import axios from 'axios';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { StyledInput, StyledButton, PageTitle, PageSubtitle, Message } from '../components/AppComponents';
import { API_URL } from '../constants/Config';
import { setItem, getItem } from '../utils/storage';

export default function Index() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [dob, setDob] = useState('');
  const [msg, setMsg] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const id = await getItem('user_id');
      if (id) {
        setUserId(id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async () => {
    if (!fullName || !mobile || !dob) {
      setMsg('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/users`, {
        full_name: fullName,
        mobile,
        dob,
      });

      const newUserId = res.data.user_id;
      setUserId(newUserId);
      await setItem('user_id', newUserId.toString());
      setMsg('Saved user id: ' + newUserId);
      
      setFullName('');
      setMobile('');
      setDob('');
    } catch (err: any) {
      console.error(err);
      setMsg(`Error saving user: ${err.response?.data?.error || err.message} (Target: ${API_URL})`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!userId) {
      alert("Please register first so a user_id is created.");
      return;
    }

    const authUrl = `${API_URL}/auth?user_id=${userId}&platform=mobile`;
    await WebBrowser.openBrowserAsync(authUrl);
  };

  return (
    <ScreenWrapper>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <PageTitle>Create Account</PageTitle>
        <PageSubtitle>Start aggregating your financial data today.</PageSubtitle>

        <View>
          <StyledInput
            label="Full Name"
            placeholder="John Doe"
            value={fullName}
            onChangeText={setFullName}
          />
          <StyledInput
            label="Phone Number"
            placeholder="+91 98765 43210"
            value={mobile}
            onChangeText={setMobile}
            keyboardType="phone-pad"
          />
          <StyledInput
            label="Date of Birth (DD/MM/YYYY)"
            placeholder="DD/MM/YYYY"
            value={dob}
            onChangeText={setDob}
          />

          <StyledButton
            title="Register User"
            onPress={handleSubmit}
            loading={loading}
          />
        </View>

        {msg ? <Message type={msg.startsWith('Error') ? 'error' : 'success'}>{msg}</Message> : null}

        {userId ? (
          <View style={{ marginTop: 20 }}>
            <StyledButton
              title="Connect Gmail Account"
              variant="google"
              onPress={handleGoogleLogin}
              icon={
                <Image
                  source={{ uri: "https://developers.google.com/identity/images/g-logo.png" }}
                  style={{ width: 20, height: 20 }}
                />
              }
            />
            <StyledButton
              title="View Documents & Analyze"
              variant="outline"
              onPress={() => router.push('/dashboard')}
              style={{ marginTop: 10 }}
            />
          </View>
        ) : null}
      </View>
    </ScreenWrapper>
  );
}
