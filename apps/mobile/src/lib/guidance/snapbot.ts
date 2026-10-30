import { supabase } from '../supabase';
import { getLocalRecyclingFallback } from './snapbotCore';

export { getLocalRecyclingFallback };

export interface SnapBotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export async function askSnapBot(
  messages: { role: 'user' | 'assistant'; content: string }[],
  itemContext?: string
): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('snapbot-chat', {
      body: {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        itemContext,
      },
    });

    if (error) {
      console.warn('SnapBot Edge Function error, using local fallback:', error.message);
      return getLocalRecyclingFallback(messages[messages.length - 1]?.content || '', itemContext);
    }

    if (data && typeof data.reply === 'string') {
      return data.reply;
    }

    return getLocalRecyclingFallback(messages[messages.length - 1]?.content || '', itemContext);
  } catch (err) {
    console.warn('SnapBot network failure, using local fallback:', err);
    return getLocalRecyclingFallback(messages[messages.length - 1]?.content || '', itemContext);
  }
}
