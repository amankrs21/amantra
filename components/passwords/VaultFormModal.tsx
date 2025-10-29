import { useEffect, useState } from 'react';
import {
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Toast from 'react-native-toast-message';

import { Colors } from '@/constants/theme';

type VaultFormValues = {
    title: string;
    username: string;
    password: string;
};

type VaultFormModalProps = {
    visible: boolean;
    mode: 'create' | 'edit';
    initialValues?: Partial<VaultFormValues>;
    onClose: () => void;
    onSubmit: (values: VaultFormValues) => Promise<void> | void;
};

const EMPTY_VALUES: VaultFormValues = {
    title: '',
    username: '',
    password: '',
};

export default function VaultFormModal({ visible, mode, initialValues, onClose, onSubmit }: VaultFormModalProps) {
    const [formValues, setFormValues] = useState<VaultFormValues>(EMPTY_VALUES);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (visible) {
            setFormValues({
                title: initialValues?.title ?? '',
                username: initialValues?.username ?? '',
                password: initialValues?.password ?? '',
            });
        }
    }, [initialValues, visible]);

    const handleChange = (field: keyof VaultFormValues, value: string) => {
        setFormValues((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        if (!formValues.title.trim() || !formValues.username.trim() || !formValues.password.trim()) {
            Toast.show({ type: 'info', text1: 'Please fill out all fields.' });
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit({
                title: formValues.title.trim(),
                username: formValues.username.trim(),
                password: formValues.password.trim(),
            });
            onClose();
        } catch (error) {
            console.error('Vault form submission failed', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.card}>
                    <Text style={styles.title}>{mode === 'create' ? 'Add Password' : 'Update Password'}</Text>
                    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                        <View style={styles.field}>
                            <Text style={styles.label}>Title</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Github"
                                placeholderTextColor="rgba(15, 23, 42, 0.35)"
                                value={formValues.title}
                                onChangeText={(value) => handleChange('title', value)}
                            />
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.label}>Username / Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter username"
                                placeholderTextColor="rgba(15, 23, 42, 0.35)"
                                value={formValues.username}
                                autoCapitalize="none"
                                onChangeText={(value) => handleChange('username', value)}
                            />
                        </View>
                        <View style={styles.field}>
                            <Text style={styles.label}>Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter password"
                                placeholderTextColor="rgba(15, 23, 42, 0.35)"
                                value={formValues.password}
                                secureTextEntry
                                onChangeText={(value) => handleChange('password', value)}
                            />
                        </View>
                    </ScrollView>
                    <View style={styles.buttonRow}>
                        <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={isSubmitting}>
                            <Text style={[styles.buttonLabel, styles.cancelLabel]}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.button, styles.submitButton, isSubmitting && styles.disabledButton]}
                            onPress={handleSubmit}
                            disabled={isSubmitting}
                        >
                            <Text style={styles.buttonLabel}>{isSubmitting ? 'Saving…' : mode === 'create' ? 'Add Password' : 'Save Changes'}</Text>
                        </Pressable>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 23, 0.65)',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        maxHeight: '90%',
        gap: 16,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
    },
    form: {
        gap: 16,
    },
    field: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(15, 23, 42, 0.7)',
    },
    input: {
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.12)',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#0f172a',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: 'rgba(15, 23, 42, 0.08)',
    },
    submitButton: {
        backgroundColor: Colors.light.tint,
    },
    disabledButton: {
        opacity: 0.6,
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    cancelLabel: {
        color: '#0f172a',
    },
});
