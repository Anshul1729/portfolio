import { useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { SourceSelector } from '@/components/chat/SourceSelector';
import { useChat } from '@/hooks/useChat';
import { Loader2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export default function ChatPage() {
  const {
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
  } = useChat();

  // Auto-create a chat if none exists
  useEffect(() => {
    if (!isLoading && chats.length === 0) {
      createChat();
    }
  }, [isLoading, chats.length, createChat]);

  // Auto-select first chat if none selected
  useEffect(() => {
    if (!currentChat && chats.length > 0) {
      selectChat(chats[0]);
    }
  }, [currentChat, chats, selectChat]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-full overflow-hidden">
        {/* Sidebar - hidden on mobile, fixed height */}
        <div className="hidden md:flex md:flex-col md:h-full">
          <ChatSidebar
            chats={chats}
            currentChat={currentChat}
            onSelectChat={selectChat}
            onNewChat={() => createChat()}
            onDeleteChat={deleteChat}
          />
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header with source selector */}
          <div className="border-b border-border p-3 flex items-center justify-between bg-card/50">
            <div className="flex-1 max-w-md">
              {currentChat && (
                <SourceSelector
                  selectedIds={currentChat.selected_source_ids || []}
                  onSelectionChange={(ids) => updateChatSources(currentChat.id, ids)}
                />
              )}
            </div>
            
            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Chat History</SheetTitle>
                  <SheetDescription>Your conversation history</SheetDescription>
                </SheetHeader>
                <ChatSidebar
                  chats={chats}
                  currentChat={currentChat}
                  onSelectChat={selectChat}
                  onNewChat={() => createChat()}
                  onDeleteChat={deleteChat}
                />
              </SheetContent>
            </Sheet>
          </div>

          {/* Messages */}
          <ChatMessages
            messages={messages}
            isStreaming={isStreaming}
            onTogglePin={togglePinMessage}
          />

          {/* Input */}
          <ChatInput
            onSend={sendMessage}
            isDisabled={isStreaming || !currentChat}
            placeholder={
              currentChat?.selected_source_ids?.length
                ? `Ask about ${currentChat.selected_source_ids.length} selected source${currentChat.selected_source_ids.length > 1 ? 's' : ''}...`
                : "Ask about your documents..."
            }
          />
        </div>
      </div>
    </DashboardLayout>
  );
}