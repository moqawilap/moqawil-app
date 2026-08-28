import { useSignUp } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BrandMark } from '@/components/MoqawilUI';
import { useColors } from '@/hooks/useColors';

export default function SignUpScreen() {
  const colors = useColors();
  const { signUp, fetchStatus } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [verificationStarted, setVerificationStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setErrorMessage(null);
    if (!email.trim() || !password) {
      setErrorMessage('Enter your email address and create a password to continue.');
      return;
    }
    setBusy(true);
    try {
      if (!verificationStarted) {
        const result = await signUp.password({ emailAddress: email.trim(), password });
        if (result.error) throw result.error;
        if (signUp.status === 'complete') {
          const finalized = await signUp.finalize();
          if (finalized.error) throw finalized.error;
          router.replace(email.trim().toLowerCase() === 'moqawil.ap@gmail.com' ? '/admin' : '/');
          return;
        }
        const verification = await signUp.verifications.sendEmailCode();
        if (verification.error) throw verification.error;
        setVerificationStarted(true);
        Alert.alert('Check your email', 'We sent a verification code to your email address.');
      } else {
        if (!code.trim()) {
          setErrorMessage('Enter the code sent to your email.');
          return;
        }
        const result = await signUp.verifications.verifyEmailCode({ code: code.trim() });
        if (result.error) throw result.error;
        if (signUp.status === 'complete') {
          const finalized = await signUp.finalize();
          if (finalized.error) throw finalized.error;
          router.replace(email.trim().toLowerCase() === 'moqawil.ap@gmail.com' ? '/admin' : '/');
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Check your details and try again.';
      setErrorMessage(message);
      if (Platform.OS !== 'web') Alert.alert('Unable to create account', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={19} color={colors.foreground} /><Text style={[styles.backText, { color: colors.foreground }]}>Back</Text></Pressable>
        <View style={styles.brand}><BrandMark /></View>
        <Text style={[styles.title, { color: colors.foreground }]}>Create your account</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Join Oman’s trusted marketplace for property and professional services.</Text>
        <Text style={[styles.label, { color: colors.foreground }]}>Email address</Text>
        <TextInput editable={!verificationStarted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
        <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
        <TextInput editable={!verificationStarted} secureTextEntry value={password} onChangeText={setPassword} placeholder="Create a password" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
        {verificationStarted ? <><Text style={[styles.label, { color: colors.foreground }]}>Verification code</Text><TextInput keyboardType="number-pad" value={code} onChangeText={setCode} placeholder="Enter the code from your email" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} /></> : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [styles.submit, { backgroundColor: colors.primary }, pressed && { opacity: 0.86 }]}>
          {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.submitText, { color: colors.primaryForeground }]}>{verificationStarted ? 'Verify email' : 'Create account'}</Text>}
        </Pressable>
        <View style={styles.footerRow}><Text style={[styles.footerText, { color: colors.mutedForeground }]}>Already registered?</Text><Link href="/sign-in" asChild><Pressable><Text style={[styles.link, { color: colors.primary }]}>Sign in</Text></Pressable></Link></View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 22, paddingTop: 34, minHeight: '100%' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 36 },
  backText: { fontSize: 13, fontWeight: '700' },
  brand: { marginBottom: 38 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 30, maxWidth: 330 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 8, marginTop: 15 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, fontSize: 14 },
  submit: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  submitText: { fontSize: 14, fontWeight: '800' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 25 },
  footerText: { fontSize: 13 },
  link: { fontSize: 13, fontWeight: '800' },
  errorText: { color: '#B42318', fontSize: 12, lineHeight: 18, marginTop: 12 },
});