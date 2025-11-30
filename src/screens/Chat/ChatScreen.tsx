import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image } from 'react-native';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../types/NavigationTypes';
import { chatService, ChatMessage, markMessagesAsRead } from '../../services/chatService';
import { useUserStore } from '../../store/userStore';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';

type Props = NativeStackScreenProps<AppStackParamList, 'Chat'>;

const ChatScreen = ({ route }: Props) => {
  const { rideId } = route.params;
  const user = useUserStore(state => state.user);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<any>>(null);
  const { footerBottom } = useResponsiveLayout();

  useEffect(() => {
    if (!rideId) return;
    const unsub = chatService.listenToMessages(rideId, (msgs) => {
      setMessages(msgs as ChatMessage[]);
      // scroll to end on update
      setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 100);
      // Marca como lidas sempre que a tela está aberta e recebemos atualização
      if (user?.uid) {
        markMessagesAsRead(rideId, user.uid);
      }
    });
    return () => unsub();
  }, [rideId]);

  const handleSend = async () => {
    if (!text.trim() || !user) return;
    try {
      await chatService.sendMessage(rideId, {
        senderId: user.uid,
        senderName: user.nome || '',
        senderAvatar: (user as any).avatarUrl || null,
        text: text.trim(),
      });
      setText('');
      // Marca como lidas para o remetente imediatamente
      if (user?.uid) {
        markMessagesAsRead(rideId, user.uid);
      }
    } catch (e) {
      console.error('Erro ao enviar mensagem:', e);
    }
  };

  // Marca como lidas quando o usuário abre a tela
  useEffect(() => {
    if (!rideId || !user?.uid) return;
    markMessagesAsRead(rideId, user.uid);
  }, [rideId, user?.uid]);

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === user?.uid;
    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
        {!isMe && item.senderAvatar ? (
          <Image source={{ uri: item.senderAvatar }} style={styles.avatar} />
        ) : null}
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          {!isMe && item.senderName ? <Text style={styles.senderName}>{item.senderName}</Text> : null}
          <Text style={styles.messageText}>{item.text}</Text>
          {/* timestamp if present */}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(i) => i.id || Math.random().toString()}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: footerBottom + 80 }]}
      />

      <View style={[styles.inputRow, { bottom: footerBottom }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Escreva sua mensagem..."
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Ionicons name="send" size={20} color={COLORS.whiteAreia} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.whiteAreia },
  listContent: { padding: 12 },
  inputRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', padding: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: COLORS.grayClaro },
  input: { flex: 1, borderRadius: 20, borderWidth: 1, borderColor: COLORS.grayClaro, paddingHorizontal: 12, height: 44, backgroundColor: '#fff' },
  sendButton: { marginLeft: 8, backgroundColor: COLORS.blueBahia, padding: 10, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  messageRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end' },
  myMessageRow: { justifyContent: 'flex-end' },
  otherMessageRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: 12 },
  myBubble: { backgroundColor: COLORS.success, alignSelf: 'flex-end' },
  otherBubble: { backgroundColor: COLORS.grayClaro, alignSelf: 'flex-start' },
  messageText: { color: '#000' },
  senderName: { fontWeight: '700', marginBottom: 4 },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 8 },
});

export default ChatScreen;
