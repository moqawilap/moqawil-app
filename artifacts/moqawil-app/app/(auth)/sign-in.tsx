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
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetStep, setResetStep] = useState<'idle' | 'code' | 'newPassword'>('idle');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const finishSignIn = async () => {
    const finalized = await signIn.finalize();
    if (finalized.error) throw finalized.error;
    router.replace(email.trim().toLowerCase() === 'moqawil.ap@gmail.com' ? '/admin' : '/');
  };

  const submit = async () => {
    if (busy) return;
    setErrorMessage(null);
    if (!email.trim() || !password) {
      setErrorMessage('Enter your email and password to continue.');
      return;
    }
    setBusy(true);
    try {
      const result = await signIn.password({ identifier: email.trim(), password });
      if (result.error) throw result.error;
      if (signIn.status === 'complete') {
        await finishSignIn();
      } else {
        setErrorMessage('Additional verification is required. Complete the verification step and try again.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Check your email and password and try again.';
      setErrorMessage(message);
      if (Platform.OS !== 'web') Alert.alert('Unable to sign in', message);
    } finally {
      setBusy(false);
    }
  };

  const sendResetCode = async () => {
    if (busy) return;
    setErrorMessage(null);
    if (!email.trim()) {
      setErrorMessage('Enter your email address first.');
      return;
    }
    setBusy(true);
    try {
      const result = await signIn.create({ identifier: email.trim() });
      if (result.error) throw result.error;
      const codeResult = await signIn.resetPasswordEmailCode.sendCode();
      if (codeResult.error) throw codeResult.error;
      setResetStep('code');
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '';
      const message = /couldn.?t find|not found|does not exist|no account/i.test(rawMessage)
        ? 'No account was found with this email in the current development app. Create the account first, then try again.'
        : rawMessage || 'We could not send a reset code. Check your email and try again.';
      setErrorMessage(message);
      if (Platform.OS !== 'web') Alert.alert('Unable to reset password', message);
    } finally {
      setBusy(false);
    }
  };

  const verifyResetCode = async () => {
    if (busy) return;
    setErrorMessage(null);
    if (!resetCode.trim()) {
      setErrorMessage('Enter the verification code from your email.');
      return;
    }
    setBusy(true);
    try {
      const result = await signIn.resetPasswordEmailCode.verifyCode({ code: resetCode.trim() });
      if (result.error) throw result.error;
      setResetStep('newPassword');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'That code is not valid. Request a new code and try again.';
      setErrorMessage(message);
      if (Platform.OS !== 'web') Alert.alert('Invalid verification code', message);
    } finally {
      setBusy(false);
    }
  };

  const saveNewPassword = async () => {
    if (busy) return;
    setErrorMessage(null);
    if (newPassword.length < 15) {
      setErrorMessage('Password must be at least 15 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const result = await signIn.resetPasswordEmailCode.submitPassword({
        password: newPassword,
        signOutOfOtherSessions: true,
      });
      if (result.error) throw result.error;
      if (signIn.status !== 'complete') throw new Error('Password reset needs another verification step.');
      await finishSignIn();
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '';
      const message = /online data breach|compromised|password.*breach/i.test(rawMessage)
        ? 'This password appeared in a data breach. Choose a different, unique password with at least 15 characters.'
        : rawMessage || 'We could not update your password. Try again.';
      setErrorMessage(message);
      if (Platform.OS !== 'web') Alert.alert('Unable to change password', message);
    } finally {
      setBusy(false);
    }
  };

  const resetFlow = async () => {
    setErrorMessage(null);
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setResetStep('idle');
    await signIn.reset();
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
        {resetStep === 'idle' ? <>
          <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
          <TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
          <Pressable onPress={sendResetCode} disabled={busy} style={styles.secondaryAction}>
            <Text style={[styles.link, { color: colors.primary }]}>Forgot password?</Text>
          </Pressable>
        </> : resetStep === 'code' ? <>
          <Text style={[styles.resetHint, { color: colors.mutedForeground }]}>We sent a verification code to your email address.</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>Verification code</Text>
          <TextInput keyboardType="number-pad" value={resetCode} onChangeText={setResetCode} placeholder="Enter the code" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
        </> : <>
          <Text style={[styles.resetHint, { color: colors.mutedForeground }]}>Choose a new password with at least 15 characters.</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>New password</Text>
          <TextInput secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholder="Enter a new password" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
          <Text style={[styles.label, { color: colors.foreground }]}>Confirm new password</Text>
          <TextInput secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat the new password" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} />
        </>}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        <Pressable onPress={resetStep === 'idle' ? submit : resetStep === 'code' ? verifyResetCode : saveNewPassword} disabled={busy} style={({ pressed }) => [styles.submit, { backgroundColor: colors.primary }, pressed && { opacity: 0.86 }]}>
          {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.submitText, { color: colors.primaryForeground }]}>{resetStep === 'idle' ? 'Sign in' : resetStep === 'code' ? 'Verify code' : 'Save new password'}</Text>}
        </Pressable>
        {resetStep !== 'idle' ? <Pressable onPress={resetFlow} disabled={busy} style={styles.secondaryAction}>
          <Text style={[styles.link, { color: colors.primary }]}>Back to sign in</Text>
        </Pressable> : null}
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
  secondaryAction: { alignSelf: 'flex-end', paddingVertical: 10 },
  resetHint: { fontSize: 13, lineHeight: 19, marginTop: 12 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 25 },
  footerText: { fontSize: 13 },
  link: { fontSize: 13, fontWeight: '800' },
  errorText: { color: '#B42318', fontSize: 12, lineHeight: 18, marginTop: 12 },
});