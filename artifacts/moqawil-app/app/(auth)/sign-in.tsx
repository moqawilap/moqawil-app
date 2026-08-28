import { useSignIn } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BrandMark } from '@/components/MoqawilUI';
import { useColors } from '@/hooks/useColors';

export default function SignInScreen() {
  const colors = useColors();
  const { signIn, fetchStatus } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!email.trim() || !password) {
      Alert.alert('Sign in required', 'Enter your email and password to continue.');
      return;
    }
    setBusy(true);
    try {
      const result = await signIn.password({ identifier: email.trim(), password });
      if (result.error) throw result.error;
      if (signIn.status === 'complete') {
        await signIn.finalize();
        router.replace('/');
      } else {
        Alert.alert('Additional verification required', 'Your account needs an additional verification step. Please finish it in Clerk and try again.');
      }
    } catch (error) {
      Alert.alert('Unable to sign in', error instanceof Error ? error.message : 'Check your details and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={19} color={colors.foreground} /><Text style={[styles.backText, { color: colors.foreground }]}>Back</Text></Pressable>
        <View style={styles.brand}><BrandMark /></View>
        <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sign in to manage your Moqawil account and access admin tools.</Text>
        <Text style={[styles.label, { color: colors.foreground }]}>Email address</Text>
        <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
        <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
        <TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
        <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [styles.submit, { backgroundColor: colors.primary }, pressed && { opacity: 0.86 }]}>
          {busy || fetchStatus === 'fetching' ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.submitText, { color: colors.primaryForeground }]}>Sign in</Text>}
        </Pressable>
        <View style={styles.footerRow}><Text style={[styles.footerText, { color: colors.mutedForeground }]}>New to Moqawil?</Text><Link href="/sign-up" asChild><Pressable><Text style={[styles.link, { color: colors.primary }]}>Create an account</Text></Pressable></Link></View>
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
});