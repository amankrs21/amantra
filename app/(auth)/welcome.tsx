import { useCallback, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { Redirect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { z } from 'zod';

import api from '@/services/api';
import { useAuth } from '@/hooks/use-auth';
import { useLoading } from '@/hooks/use-loading';

WebBrowser.maybeCompleteAuthSession();

const GoogleLoginResponseSchema = z.object({
    token: z.string().min(10),
    user: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
        avatarUrl: z.string().url().optional().nullable(),
    }),
    encryptionKeyConfigured: z.boolean().optional(),
});

type GoogleLoginResponse = z.infer<typeof GoogleLoginResponseSchema>;

const DISABLED_REASON = `Set EXPO_PUBLIC_GOOGLE_CLIENT_ID env vars for iOS, Android, and Web to enable Google sign-in.`;

const FALLBACK_CLIENT_ID = 'demo_client_id';
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? FALLBACK_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? FALLBACK_CLIENT_ID;
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? FALLBACK_CLIENT_ID;
const primaryClientId = Platform.select({
    ios: iosClientId,
    android: androidClientId,
    web: webClientId,
    default: webClientId,
});

const usingDemoClientIds = [primaryClientId, androidClientId, iosClientId, webClientId].every((id) => id === FALLBACK_CLIENT_ID);

export default function WelcomeScreen() {
    const { isAuthenticated, completeLogin } = useAuth();
    const { showLoading, hideLoading } = useLoading();

    const [request, response, promptAsync] = Google.useAuthRequest({
        clientId: primaryClientId,
        androidClientId,
        iosClientId,
        webClientId,
        responseType: 'id_token',
        scopes: ['profile', 'email'],
    });

    const handleGoogleResponse = useCallback(
        async (idToken: string) => {
            showLoading('Securing your vault...');
            try {
                const { data } = await api.post<GoogleLoginResponse>('/auth/google', {
                    idToken,
                });

                const parsed = GoogleLoginResponseSchema.safeParse(data);
                if (!parsed.success) {
                    throw new Error('Unexpected response from server.');
                }

                await completeLogin(parsed.data);
                Toast.show({ type: 'success', text1: `Welcome, ${parsed.data.user.name}!` });
            } catch (error) {
                console.error('Google login failed', error);
                Toast.show({
                    type: 'error',
                    text1: 'Unable to sign in',
                    text2: error instanceof Error ? error.message : 'Please try again in a moment.',
                });
            } finally {
                hideLoading();
            }
        },
        [completeLogin, hideLoading, showLoading],
    );

    useEffect(() => {
        if (response?.type === 'success' && response.authentication?.idToken) {
            handleGoogleResponse(response.authentication.idToken);
        } else if (response?.type === 'error') {
            Toast.show({ type: 'error', text1: 'Google sign-in cancelled.' });
        }
    }, [handleGoogleResponse, response]);

    if (isAuthenticated) {
        return <Redirect href="/(tabs)/home" />;
    }

    const disabled = !request || usingDemoClientIds;

    return (
        <SafeAreaView style={styles.safeArea}>
            <LinearGradient colors={["#0f172a", "#1e3a8a", "#38bdf8"]} style={styles.heroCard}>
                <View style={styles.heroIconRow}>
                    <MaterialCommunityIcons name="shield-lock" color="#fff" size={72} />
                    <MaterialCommunityIcons name="note-text" color="#facc15" size={48} />
                    <MaterialCommunityIcons name="key-variant" color="#22d3ee" size={56} />
                </View>
                <Text style={styles.heroTitle}>SecureVault</Text>
                <Text style={styles.heroSubtitle}>
                    Keep passwords and private notes safe with encryption you control.
                </Text>
            </LinearGradient>

            <View style={styles.content}>
                <Text style={styles.welcomeText}>Welcome to your personal digital fortress.</Text>
                <Text style={styles.caption}>
                    Sign in once with Google and continue seamlessly across sessions.
                </Text>

                <Pressable
                    style={[styles.googleButton, disabled && styles.disabledButton]}
                    onPress={() => promptAsync()}
                    disabled={disabled}
                >
                    <MaterialCommunityIcons name="google" size={24} color="#fff" />
                    <Text style={styles.googleLabel}>Continue with Google</Text>
                </Pressable>

                {disabled ? (
                    <Text style={styles.helper}>
                        {usingDemoClientIds
                            ? 'Google login is disabled while demo OAuth client ids are in use. Configure real OAuth client ids to enable sign-in.'
                            : DISABLED_REASON}
                    </Text>
                ) : null}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#020617',
        padding: 24,
        gap: 24,
    },
    heroCard: {
        padding: 24,
        borderRadius: 28,
        minHeight: 280,
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
    },
    heroIconRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    heroTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: '#f8fafc',
    },
    heroSubtitle: {
        fontSize: 16,
        color: 'rgba(248, 250, 252, 0.86)',
        lineHeight: 22,
    },
    content: {
        gap: 16,
    },
    welcomeText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#e2e8f0',
    },
    caption: {
        fontSize: 15,
        color: 'rgba(226, 232, 240, 0.75)',
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563eb',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 12,
        shadowColor: '#1d4ed8',
        shadowOpacity: 0.4,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 20,
        elevation: 10,
    },
    googleLabel: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fff',
    },
    helper: {
        fontSize: 12,
        color: 'rgba(226, 232, 240, 0.6)',
    },
    disabledButton: {
        backgroundColor: 'rgba(37, 99, 235, 0.4)',
    },
});
