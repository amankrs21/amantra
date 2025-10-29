import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    LayoutAnimation,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    UIManager,
    View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { z } from 'zod';

import EncryptionKeyModal from '@/components/modals/EncryptionKeyModal';
import NoteDeleteModal from '@/components/notes/NoteDeleteModal';
import NoteFormModal from '@/components/notes/NoteFormModal';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useEncryptionKey } from '@/hooks/use-encryption-key';
import { useLoading } from '@/hooks/use-loading';
import api from '@/services/api';
import { decodeKey, encodeKey } from '@/utils/crypto';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NoteSchema = z.object({
    _id: z.string(),
    title: z.string(),
    updatedAt: z.string(),
    createdAt: z.string(),
});

type Note = z.infer<typeof NoteSchema> & { content?: string };

const NoteListSchema = z.array(NoteSchema);

export default function NotesScreen() {
    const { encryptionKeyConfigured, setEncryptionKeyConfigured } = useAuth();
    const { encodedKey, setKey, isHydrated: isKeyHydrated } = useEncryptionKey();
    const { showLoading, hideLoading } = useLoading();

    const [notes, setNotes] = useState<Note[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [addVisible, setAddVisible] = useState(false);
    const [editNote, setEditNote] = useState<Note | null>(null);
    const [deleteNote, setDeleteNote] = useState<Note | null>(null);
    const [promptKey, setPromptKey] = useState(false);
    const [activeContent, setActiveContent] = useState<Record<string, string>>({});

    const filteredNotes = useMemo(() => {
        if (!searchTerm.trim()) {
            return notes;
        }
        const normalized = searchTerm.trim().toLowerCase();
        return notes.filter((note) => note.title.toLowerCase().includes(normalized));
    }, [notes, searchTerm]);

    const fetchNotes = useCallback(async () => {
        showLoading('Loading encrypted notes...');
        try {
            const { data } = await api.get('/journal/fetch');
            const parsed = NoteListSchema.safeParse(data);
            if (!parsed.success) {
                throw new Error('Unable to load notes');
            }
            setNotes(parsed.data);
        } catch (error) {
            console.error('Fetch notes failed', error);
            Toast.show({ type: 'error', text1: 'Unable to load notes.' });
        } finally {
            hideLoading();
        }
    }, [hideLoading, showLoading]);

    useEffect(() => {
        void fetchNotes();
    }, [fetchNotes]);

    const handleKeySubmit = useCallback(
        async (value: string) => {
            const candidate = value.trim();
            if (!candidate) {
                return;
            }

            try {
                showLoading('Validating key...');
                await api.post('/pin/verify', { key: encodeKey(candidate) });
                await setKey(candidate);
                await setEncryptionKeyConfigured(true);
                Toast.show({ type: 'success', text1: 'Encryption key saved.' });
                setPromptKey(false);
            } catch (error) {
                console.error('Key validation failed', error);
                Toast.show({ type: 'error', text1: 'Invalid encryption key.' });
            } finally {
                hideLoading();
            }
        },
        [hideLoading, setEncryptionKeyConfigured, setKey, showLoading],
    );

    const decryptNote = useCallback(
        async (noteId: string) => {
            if (!encodedKey) {
                setPromptKey(true);
                return;
            }

            showLoading('Decrypting note...');
            try {
                const { data } = await api.post<{ content: string } | string>(`/journal/${noteId}`, {
                    key: encodedKey,
                });
                const decrypted = typeof data === 'string' ? decodeKey(data) : data.content;
                setActiveContent((prev) => ({ ...prev, [noteId]: decrypted }));
            } catch (error) {
                console.error('Decrypt note failed', error);
                Toast.show({ type: 'error', text1: 'Unable to decrypt note.' });
            } finally {
                hideLoading();
            }
        },
        [encodedKey, hideLoading, showLoading],
    );

    const toggleExpand = useCallback(
        (note: Note) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            if (expandedId === note._id) {
                setExpandedId(null);
                return;
            }

            setExpandedId(note._id);
            if (!activeContent[note._id]) {
                void decryptNote(note._id);
            }
        },
        [activeContent, decryptNote, expandedId],
    );

    const handleAdd = useCallback(
        async ({ title, content }: { title: string; content: string }) => {
            if (!encodedKey) {
                setPromptKey(true);
                Toast.show({ type: 'info', text1: 'Enter your encryption PIN to continue.' });
                throw new Error('Encryption key required');
            }

            showLoading('Saving secure note...');
            try {
                await api.post('/journal/add', {
                    title,
                    content,
                    key: encodedKey,
                });
                Toast.show({ type: 'success', text1: 'Note saved securely.' });
                await fetchNotes();
            } catch (error) {
                console.error('Add note failed', error);
                Toast.show({ type: 'error', text1: 'Unable to add note.' });
            } finally {
                hideLoading();
            }
        },
        [encodedKey, fetchNotes, hideLoading, showLoading],
    );

    const handlePrepareEdit = useCallback(
        async (note: Note) => {
            if (!encodedKey) {
                setPromptKey(true);
                return;
            }

            showLoading('Fetching note...');
            try {
                const { data } = await api.post<{ content: string } | string>(`/journal/${note._id}`, {
                    key: encodedKey,
                });
                const decrypted = typeof data === 'string' ? decodeKey(data) : data.content;
                setEditNote({ ...note, content: decrypted });
            } catch (error) {
                console.error('Prepare edit failed', error);
                Toast.show({ type: 'error', text1: 'Unable to load note.' });
            } finally {
                hideLoading();
            }
        },
        [encodedKey, hideLoading, showLoading],
    );

    const handleUpdate = useCallback(
        async ({ title, content }: { title: string; content: string }) => {
            if (!encodedKey || !editNote) {
                setPromptKey(true);
                return;
            }

            showLoading('Updating note...');
            try {
                await api.patch('/journal/update', {
                    id: editNote._id,
                    title,
                    content,
                    key: encodedKey,
                });
                Toast.show({ type: 'success', text1: 'Note updated.' });
                setEditNote(null);
                await fetchNotes();
                setActiveContent((prev) => ({ ...prev, [editNote._id]: content }));
            } catch (error) {
                console.error('Update note failed', error);
                Toast.show({ type: 'error', text1: 'Unable to update note.' });
            } finally {
                hideLoading();
            }
        },
        [editNote, encodedKey, fetchNotes, hideLoading, showLoading],
    );

    const handleDelete = useCallback(async () => {
        if (!deleteNote) {
            return;
        }

        showLoading('Deleting note...');
        try {
            await api.delete(`/journal/delete/${deleteNote._id}`);
            Toast.show({ type: 'success', text1: 'Note deleted.' });
            setDeleteNote(null);
            await fetchNotes();
        } catch (error) {
            console.error('Delete note failed', error);
            Toast.show({ type: 'error', text1: 'Unable to delete note.' });
        } finally {
            hideLoading();
        }
    }, [deleteNote, fetchNotes, hideLoading, showLoading]);

    const renderItem = ({ item }: { item: Note }) => {
        const expanded = expandedId === item._id;
        const content = expanded ? activeContent[item._id] ?? 'Decrypting…' : undefined;
        return (
            <View style={styles.noteCard}>
                <Pressable style={styles.noteHeader} onPress={() => toggleExpand(item)}>
                    <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.noteTitle}>{item.title}</Text>
                        <Text style={styles.noteTimestamp}>Updated {new Date(item.updatedAt).toLocaleString()}</Text>
                    </View>
                    <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={24} color="#1e293b" />
                </Pressable>
                {expanded ? <Text style={styles.noteContent}>{content}</Text> : null}
                {expanded ? (
                    <View style={styles.noteActions}>
                        <Pressable style={styles.noteActionButton} onPress={() => handlePrepareEdit(item)}>
                            <MaterialCommunityIcons name="pencil" size={18} color="#2563eb" />
                            <Text style={styles.noteActionLabel}>Edit</Text>
                        </Pressable>
                        <Pressable style={styles.noteActionButton} onPress={() => setDeleteNote(item)}>
                            <MaterialCommunityIcons name="trash-can" size={18} color="#ef4444" />
                            <Text style={styles.noteActionLabel}>Delete</Text>
                        </Pressable>
                    </View>
                ) : null}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Secure Notes</Text>
                    <Text style={styles.headerSubtitle}>Private journal entries with client-side encryption.</Text>
                </View>
                <MaterialCommunityIcons name="notebook" size={36} color="#facc15" />
            </View>

            <View style={styles.searchRow}>
                <MaterialCommunityIcons name="magnify" size={20} color="rgba(15, 23, 42, 0.3)" />
                <TextInput
                    placeholder="Search notes by title"
                    placeholderTextColor="rgba(15, 23, 42, 0.3)"
                    style={styles.searchInput}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                />
                <Pressable style={styles.clearButton} onPress={() => setSearchTerm('')}>
                    <MaterialCommunityIcons name="close" size={18} color="rgba(15, 23, 42, 0.6)" />
                </Pressable>
            </View>

            <FlatList
                data={filteredNotes}
                keyExtractor={(item) => item._id}
                contentContainerStyle={filteredNotes.length === 0 ? styles.emptyList : { gap: 16, paddingBottom: 120 }}
                renderItem={renderItem}
                ListEmptyComponent={() => (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="notebook-outline" size={48} color="rgba(148, 163, 184, 0.8)" />
                        <Text style={styles.emptyTitle}>No secure notes yet</Text>
                        <Text style={styles.emptySubtitle}>Capture your thoughts with encrypted journal entries.</Text>
                    </View>
                )}
            />

            <Pressable style={styles.fab} onPress={() => setAddVisible(true)}>
                <MaterialCommunityIcons name="plus" size={26} color="#fff" />
            </Pressable>

            <NoteFormModal visible={addVisible} mode="create" onClose={() => setAddVisible(false)} onSubmit={handleAdd} />

            {editNote ? (
                <NoteFormModal
                    visible
                    mode="edit"
                    initialValues={{ title: editNote.title, content: editNote.content ?? '' }}
                    onClose={() => setEditNote(null)}
                    onSubmit={handleUpdate}
                />
            ) : null}

            {deleteNote ? (
                <NoteDeleteModal
                    visible
                    title={deleteNote.title}
                    onClose={() => setDeleteNote(null)}
                    onConfirm={handleDelete}
                />
            ) : null}

            <EncryptionKeyModal
                visible={promptKey && isKeyHydrated}
                onClose={() => setPromptKey(false)}
                onConfirm={handleKeySubmit}
                caption={encryptionKeyConfigured ? 'Re-enter your encryption PIN to reveal notes.' : 'Set your encryption PIN to unlock notes.'}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        padding: 20,
        borderRadius: 20,
        marginBottom: 20,
        gap: 18,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#f8fafc',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(226, 232, 240, 0.75)',
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#e2e8f0',
    },
    clearButton: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(226, 232, 240, 0.1)',
    },
    noteCard: {
        backgroundColor: '#e2e8f0',
        borderRadius: 20,
        padding: 18,
        gap: 12,
    },
    noteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    noteTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0f172a',
    },
    noteTimestamp: {
        fontSize: 12,
        color: 'rgba(15, 23, 42, 0.6)',
    },
    noteContent: {
        fontSize: 15,
        color: '#0f172a',
        lineHeight: 20,
    },
    noteActions: {
        flexDirection: 'row',
        gap: 12,
    },
    noteActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    noteActionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1f2937',
    },
    emptyList: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    emptyState: {
        alignItems: 'center',
        gap: 8,
        paddingTop: 48,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#e2e8f0',
    },
    emptySubtitle: {
        fontSize: 14,
        color: 'rgba(226, 232, 240, 0.6)',
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    fab: {
        position: 'absolute',
        right: 24,
        bottom: 32,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.tint,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
});
