import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getAISessionId } from '@/hooks/useCostTracking';
import { toast } from 'sonner';

export interface Chat {
  id: string;
  title: string;
  selected_source_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources_used: { source_id: string; source_name: string; chunk_index: number }[];
  is_pinned: boolean;
  created_at: string;
}

export function useChat() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);

  // Fetch all chats
  const fetchChats = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setChats((data || []) as Chat[]);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch messages for a chat
  const fetchMessages = useCallback(async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as ChatMessage[]);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, []);

  // Create new chat
  const createChat = async (sourceIds?: string[]): Promise<Chat | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('chats')
        .insert({
          user_id: user.id,
          selected_source_ids: sourceIds || [],
        })
        .select()
        .single();

      if (error) throw error;

      const newChat = data as Chat;
      setChats(prev => [newChat, ...prev]);
      setCurrentChat(newChat);
      setMessages([]);
      return newChat;
    } catch (error) {
      console.error('Error creating chat:', error);
      toast.error('Failed to create chat');
      return null;
    }
  };

  // Delete chat
  const deleteChat = async (chatId: string) => {
    try {
      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId);

      if (error) throw error;

      setChats(prev => prev.filter(c => c.id !== chatId));
      if (currentChat?.id === chatId) {
        setCurrentChat(null);
        setMessages([]);
      }
      toast.success('Chat deleted');
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast.error('Failed to delete chat');
    }
  };

  // Update chat sources
  const updateChatSources = async (chatId: string, sourceIds: string[]) => {
    try {
      const { error } = await supabase
        .from('chats')
        .update({ selected_source_ids: sourceIds })
        .eq('id', chatId);

      if (error) throw error;

      setChats(prev => prev.map(c => 
        c.id === chatId ? { ...c, selected_source_ids: sourceIds } : c
      ));
      if (currentChat?.id === chatId) {
        setCurrentChat(prev => prev ? { ...prev, selected_source_ids: sourceIds } : null);
      }
    } catch (error) {
      console.error('Error updating chat sources:', error);
    }
  };

  // Send message with streaming
  const sendMessage = async (content: string): Promise<void> => {
    if (!currentChat || !content.trim() || isStreaming) return;

    setIsStreaming(true);

    // Optimistically add user message
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      chat_id: currentChat.id,
      role: 'user',
      content: content.trim(),
      sources_used: [],
      is_pinned: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    // Prepare assistant message placeholder
    const tempAssistantId = `temp-assistant-${Date.now()}`;
    let assistantContent = '';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            chatId: currentChat.id,
            message: content.trim(),
            sourceIds: currentChat.selected_source_ids,
            sessionId: getAISessionId(),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Chat request failed');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Add placeholder for assistant message
      setMessages(prev => [...prev, {
        id: tempAssistantId,
        chat_id: currentChat.id,
        role: 'assistant',
        content: '',
        sources_used: [],
        is_pinned: false,
        created_at: new Date().toISOString(),
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;

          try {
            const json = JSON.parse(line.slice(6));
            if (json.content) {
              assistantContent += json.content;
              setMessages(prev => prev.map(m =>
                m.id === tempAssistantId
                  ? { ...m, content: assistantContent }
                  : m
              ));
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Refresh messages to get proper IDs and sources_used
      await fetchMessages(currentChat.id);
      
      // Update chat in list (title may have changed)
      await fetchChats();

    } catch (error) {
      console.error('Send message error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send message');
      // Remove optimistic messages on error
      setMessages(prev => prev.filter(m => 
        m.id !== tempUserMsg.id && m.id !== tempAssistantId
      ));
    } finally {
      setIsStreaming(false);
    }
  };

  // Toggle pin on message
  const togglePinMessage = async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ is_pinned: !message.is_pinned })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, is_pinned: !m.is_pinned } : m
      ));
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  // Select a chat
  const selectChat = async (chat: Chat) => {
    setCurrentChat(chat);
    await fetchMessages(chat.id);
  };

  // Initialize
  useEffect(() => {
    if (user) {
      fetchChats();
    }
  }, [user, fetchChats]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!currentChat) return;

    const channel = supabase
      .channel(`chat-messages-${currentChat.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${currentChat.id}`,
        },
        () => {
          // Refetch messages on any change
          fetchMessages(currentChat.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentChat, fetchMessages]);

  return {
    chats,
    currentChat,
    messages,
    isLoading,
    isStreaming,
    createChat,
    deleteChat,
    selectChat,
    sendMessage,
    togglePinMessage,
    updateChatSources,
    refetch: fetchChats,
  };
}