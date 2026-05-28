import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import CouncilModal from './components/CouncilModal';
import NewConversationDialog from './components/NewConversationDialog';
import { api } from './api';
import './App.css';

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Council state
  const [councils, setCouncils] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [councilModalOpen, setCouncilModalOpen] = useState(false);
  const [newConvDialogOpen, setNewConvDialogOpen] = useState(false);

  // Load everything on mount
  useEffect(() => {
    loadConversations();
    loadCouncils();
    loadCatalog();
  }, []);

  // Load conversation details when selected
  useEffect(() => {
    if (currentConversationId) {
      loadConversation(currentConversationId);
    }
  }, [currentConversationId]);

  const loadConversations = async () => {
    try {
      const convs = await api.listConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadConversation = async (id) => {
    try {
      const conv = await api.getConversation(id);
      setCurrentConversation(conv);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const loadCouncils = async () => {
    try {
      const data = await api.listCouncils();
      setCouncils(data);
    } catch (error) {
      console.error('Failed to load councils:', error);
    }
  };

  const loadCatalog = async () => {
    try {
      const data = await api.getModelsCatalog();
      setCatalog(data);
    } catch (error) {
      console.error('Failed to load catalog:', error);
    }
  };

  // Open "New Conversation" dialog instead of creating immediately
  const handleNewConversation = () => {
    if (councils.length === 0) {
      // Fallback: create directly if councils not loaded yet
      createConversation(null);
    } else {
      setNewConvDialogOpen(true);
    }
  };

  const createConversation = async (councilId) => {
    try {
      const newConv = await api.createConversation(councilId);
      setConversations([
        { id: newConv.id, created_at: newConv.created_at, title: newConv.title, message_count: 0 },
        ...conversations,
      ]);
      setCurrentConversationId(newConv.id);
      setNewConvDialogOpen(false);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = (id) => {
    setCurrentConversationId(id);
  };

  // Council CRUD handlers
  const handleSaveCouncil = async (council) => {
    try {
      if (council.id && !council.id.startsWith('_new')) {
        await api.updateCouncil(council.id, {
          name: council.name,
          models: council.models,
          chairman: council.chairman,
        });
      } else {
        await api.createCouncil({
          name: council.name,
          models: council.models,
          chairman: council.chairman,
        });
      }
      await loadCouncils();
    } catch (error) {
      console.error('Failed to save council:', error);
      alert(error.message);
    }
  };

  const handleDeleteCouncil = async (councilId) => {
    try {
      await api.deleteCouncil(councilId);
      await loadCouncils();
    } catch (error) {
      console.error('Failed to delete council:', error);
    }
  };

  const handleSendMessage = async (content) => {
    if (!currentConversationId) return;

    setIsLoading(true);
    try {
      // Optimistically add user message to UI
      const userMessage = { role: 'user', content };
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      // Create a partial assistant message that will be updated progressively
      const assistantMessage = {
        role: 'assistant',
        stage1: null,
        stage2: null,
        stage3: null,
        metadata: null,
        loading: {
          stage1: false,
          stage2: false,
          stage3: false,
        },
      };

      // Add the partial assistant message
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
      }));

      // Send message with streaming
      await api.sendMessageStream(currentConversationId, content, (eventType, event) => {
        switch (eventType) {
          case 'stage1_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage1 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage1_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage1 = event.data;
              lastMsg.loading.stage1 = false;
              return { ...prev, messages };
            });
            break;

          case 'stage2_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage2 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage2_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage2 = event.data;
              lastMsg.metadata = event.metadata;
              lastMsg.loading.stage2 = false;
              return { ...prev, messages };
            });
            break;

          case 'stage3_start':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.loading.stage3 = true;
              return { ...prev, messages };
            });
            break;

          case 'stage3_complete':
            setCurrentConversation((prev) => {
              const messages = [...prev.messages];
              const lastMsg = messages[messages.length - 1];
              lastMsg.stage3 = event.data;
              lastMsg.loading.stage3 = false;
              return { ...prev, messages };
            });
            break;

          case 'title_complete':
            loadConversations();
            break;

          case 'complete':
            loadConversations();
            setIsLoading(false);
            break;

          case 'error':
            console.error('Stream error:', event.message);
            setIsLoading(false);
            break;

          default:
            console.log('Unknown event type:', eventType);
        }
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      setCurrentConversation((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, -2),
      }));
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onOpenCouncilModal={() => setCouncilModalOpen(true)}
      />
      <ChatInterface
        conversation={currentConversation}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />

      <CouncilModal
        isOpen={councilModalOpen}
        onClose={() => setCouncilModalOpen(false)}
        councils={councils}
        catalog={catalog}
        onSave={handleSaveCouncil}
        onDelete={handleDeleteCouncil}
      />

      <NewConversationDialog
        isOpen={newConvDialogOpen}
        councils={councils}
        onConfirm={createConversation}
        onCancel={() => setNewConvDialogOpen(false)}
        onOpenCouncilModal={() => {
          setNewConvDialogOpen(false);
          setCouncilModalOpen(true);
        }}
      />
    </div>
  );
}

export default App;
