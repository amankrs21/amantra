import { useState } from 'react';
import {
    Modal,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { Colors } from '@/constants/theme';

export type EncryptionKeyModalProps = {
    visible: boolean;
    onClose: () => void;
    onConfirm: (key: string) => Promise<void> | void;
    caption?: string;
};

export default function EncryptionKeyModal({ visible, onClose, onConfirm, caption }: EncryptionKeyModalProps) {
    const [key, setKey] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!key.trim()) {
            return;
        }
        setIsSubmitting(true);
        try {
            await onConfirm(key.trim());
            setKey('');
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
            <SafeAreaView style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.card}>
                    <Text style={styles.title}>Enter Encryption PIN</Text>
                    <Text style={styles.subtitle}>
                        {caption ?? 'We store your PIN locally for 5 minutes to decrypt your data securely.'}
                    </Text>
                    <TextInput
                        value={key}
                        onChangeText={setKey}
                        placeholder="Enter your encryption PIN"
                        placeholderTextColor="rgba(15, 23, 42, 0.3)"
                        autoFocus
                        secureTextEntry
                        style={styles.input}
                    />
                    <View style={styles.buttonRow}>
                        <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={isSubmitting}>
                            <Text style={[styles.buttonLabel, styles.cancelLabel]}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.button, styles.confirmButton, (!key.trim() || isSubmitting) && styles.disabledButton]}
                            onPress={handleSubmit}
                            disabled={!key.trim() || isSubmitting}
                        >
                            <Text style={styles.buttonLabel}>{isSubmitting ? 'Saving…' : 'Continue'}</Text>
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
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        gap: 16,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 8,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(15, 23, 42, 0.6)',
    },
    input: {
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.1)',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#0f172a',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: 'rgba(15, 23, 42, 0.05)',
    },
    confirmButton: {
        backgroundColor: Colors.light.tint,
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    cancelLabel: {
        color: '#0f172a',
    },
    disabledButton: {
        opacity: 0.6,
    },
});
