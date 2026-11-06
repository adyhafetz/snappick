import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Send, X, Sparkles } from 'lucide-react-native';
import { Image } from 'expo-image';
import { askSnapBot, type SnapBotMessage } from '@/lib/guidance/snapbot';
import { Button } from '@/components/ui/button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SnapBotModalProps {
  visible: boolean;
  onClose: () => void;
  itemClass?: string;
}

const DEFAULT_SUGGESTIONS = [
  'Can I recycle greasy pizza boxes?',
  'How do I safely dispose of batteries?',
  'Do plastic bottles need caps removed?',
  'What items are accepted for community pickup?',
];

let messageSeq = 0;

function createMsg(role: 'user' | 'assistant', content: string): SnapBotMessage {
  messageSeq += 1;
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return {
    id: `msg-${messageSeq}-${role}`,
    role,
    content,
    timestamp: time,
  };
}

function createInitialGreeting(itemClass: string): SnapBotMessage {
  const content = itemClass
    ? `Hi! I'm SnapBot, your AI recycling assistant. I see you have questions about ${itemClass}. Ask me anything about sorting, cleaning, or recycling rules!`
    : `Hi! I'm SnapBot, your AI recycling assistant. Ask me anything about waste sorting, recyclable materials, preparation tips, or community pickups!`;
  return createMsg('assistant', content);
}

function SnapBotModalContent({
  onClose,
  itemClass = '',
}: {
  onClose: () => void;
  itemClass?: string;
}) {
  const [messages, setMessages] = useState<SnapBotMessage[]>(() => [createInitialGreeting(itemClass)]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || loading) return;

    const userMsg = createMsg('user', query);
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const replyText = await askSnapBot(
        nextHistory.map((m) => ({ role: m.role, content: m.content })),
        itemClass
      );

      const botMsg = createMsg('assistant', replyText);
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const errorMsg = createMsg(
        'assistant',
        'SnapBot encountered a connection issue. Remember: always keep recyclables rinsed, clean, dry, and flattened!'
      );
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-black/50 justify-end">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="bg-background rounded-t-3xl max-h-[88%] min-h-[60%] flex-col overflow-hidden border-t border-border shadow-2xl"
      >
        {/* Header */}
        <View className="px-5 py-3.5 border-b border-border flex-row items-center justify-between bg-card">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 rounded-2xl bg-white items-center justify-center border border-primary/20 shadow-xs overflow-hidden">
              <Image
                source={require('../../../assets/images/snapbot-icon.svg')}
                style={{ width: 28, height: 28 }}
                contentFit="contain"
                accessibilityLabel="SnapBot"
              />
            </View>
            <View>
              <Text className="text-base font-bold text-foreground">SnapBot</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={onClose}
            className="h-10 w-10 rounded-2xl items-center justify-center bg-muted/60 active:bg-muted"
          >
            <X size={20} color="#5b7072" />
          </TouchableOpacity>
        </View>

        {/* Chat Messages */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 20 }}
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (messages.length > 1) {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }
          }}
        >
          {/* Quick Suggestion Chips inside ScrollView */}
          {messages.length <= 1 && (
            <View className="mb-2 p-3 bg-muted/40 rounded-2xl border border-border/60">
              <View className="flex-row items-center gap-1.5 mb-2">
                <Sparkles size={13} color="#19806d" />
                <Text className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Frequently Asked Questions
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {DEFAULT_SUGGESTIONS.map((suggestion, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => void handleSend(suggestion)}
                    disabled={loading}
                    className="bg-card border border-primary/30 rounded-xl px-3 py-1.5 active:bg-primary/10 flex-row items-center gap-1.5 shadow-2xs"
                  >
                    <Text className="text-xs text-foreground font-medium">{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {messages.map((item) => (
            <View
              key={item.id}
              className={`flex-row ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {item.role === 'assistant' && (
                <View className="h-7 w-7 rounded-xl bg-white items-center justify-center mr-2 mt-0.5 border border-primary/20 shadow-2xs overflow-hidden">
                  <Image
                    source={require('../../../assets/images/snapbot-icon.svg')}
                    style={{ width: 20, height: 20 }}
                    contentFit="contain"
                    accessibilityLabel="SnapBot"
                  />
                </View>
              )}

              <View
                className={`max-w-[82%] rounded-2xl p-3.5 shadow-2xs ${
                  item.role === 'user'
                    ? 'bg-primary rounded-tr-xs text-primary-foreground'
                    : 'bg-card border border-border rounded-tl-xs'
                }`}
              >
                <Text
                  className={`text-sm leading-relaxed ${
                    item.role === 'user' ? 'text-primary-foreground font-medium' : 'text-foreground'
                  }`}
                >
                  {item.content}
                </Text>
                <Text
                  className={`text-[11px] mt-1 text-right ${
                    item.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  }`}
                >
                  {item.timestamp}
                </Text>
              </View>
            </View>
          ))}

          {loading && (
            <View className="flex-row items-center gap-2 bg-card border border-border rounded-2xl px-3.5 py-2.5 self-start">
              <ActivityIndicator size="small" color="#19806d" />
              <Text className="text-xs text-muted-foreground font-medium">SnapBot is thinking…</Text>
            </View>
          )}
        </ScrollView>

        {/* Input Bar */}
        <View
          style={{ paddingBottom: Math.max(insets.bottom, 14) }}
          className="p-3.5 border-t border-border bg-card flex-row items-center gap-2"
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask a question about recycling…"
            placeholderTextColor="#94a3b8"
            multiline
            maxLength={400}
            editable={!loading}
            className="flex-1 min-h-[44px] max-h-[100px] bg-background border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground"
          />
          <Button
            size="icon"
            disabled={loading || input.trim().length === 0}
            onPress={() => void handleSend()}
            className="h-11 w-11 rounded-2xl bg-primary items-center justify-center shadow-xs"
            style={{ backgroundColor: '#19806d' }}
          >
            <Send size={18} color="#ffffff" />
          </Button>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export function SnapBotModal({ visible, onClose, itemClass = '' }: SnapBotModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {visible && <SnapBotModalContent onClose={onClose} itemClass={itemClass} />}
    </Modal>
  );
}
