import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import ChatMessage from './components/ChatMessage';
import ModelSelector from './components/ModelSelector';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('Qwen3:8b');
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Fetch available models and chat history on component mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await axios.get('/api/models');
        if (response.data && response.data.models) {
          setModels(response.data.models);
        }
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    };

    const loadChatHistory = () => {
      const savedHistory = localStorage.getItem('chatHistory');
      if (savedHistory) {
        setChatHistory(JSON.parse(savedHistory));
      }
    };

    fetchModels();
    loadChatHistory();
  }, []);

  // Scroll to bottom of messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    } else {
      localStorage.removeItem('chatHistory');
    }
  }, [chatHistory]);

  // Create a new chat
  const createNewChat = () => {
    const newChatId = uuidv4();
    // Only set the current chat ID, but don't add to history yet
    setCurrentChatId(newChatId);
    setMessages([]);
    return newChatId; // Return the ID for use in handleSubmit
  };

  // Select a chat from history
  const selectChat = (chatId) => {
    // Prevent switching chats while loading or editing
    if (loading || isEditing) {
      return;
    }
    
    const selectedChat = chatHistory.find(chat => chat.id === chatId);
    if (selectedChat) {
      setMessages(selectedChat.messages);
      setCurrentChatId(chatId);
      setSelectedModel(selectedChat.model);
    }
  };

  // Delete a chat from history
  const deleteChat = (chatId, e) => {
    e.stopPropagation(); // Prevent triggering selectChat
    
    // Prevent deleting chats while loading or editing
    if (loading || isEditing) {
      return;
    }
    
    const updatedHistory = chatHistory.filter(chat => chat.id !== chatId);
    setChatHistory(updatedHistory);
    
    // If the current chat is deleted, create a new one or select the first available
    if (currentChatId === chatId) {
      if (updatedHistory.length > 0) {
        selectChat(updatedHistory[0].id);
      } else {
        createNewChat();
      }
    }
  };

  // Update chat title based on first user message
  const updateChatTitle = (chatId, messages) => {
    const firstUserMessage = messages.find(msg => msg.role === 'user');
    if (firstUserMessage) {
      const title = firstUserMessage.content.substring(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '');
      setChatHistory(prevHistory => 
        prevHistory.map(chat => 
          chat.id === chatId ? { ...chat, title, messages } : chat
        )
      );
    }
  };

  // Cancel the ongoing request
  const cancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Cancel any ongoing request
    cancelRequest();

    // Create a new chat if none is selected
    let chatId = currentChatId;
    if (!chatId) {
      chatId = createNewChat();
    }

    // Add user message to chat with timestamp
    const userMessage = { role: 'user', content: input, timestamp: new Date().toISOString() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    // Check if this chat exists in history
    const chatExists = chatHistory.some(chat => chat.id === chatId);
    
    if (chatExists) {
      // Update existing chat in history
      setChatHistory(prevHistory => 
        prevHistory.map(chat => 
          chat.id === chatId ? { ...chat, messages: updatedMessages } : chat
        )
      );
    } else {
      // Add new chat to history
      const newChat = {
        id: chatId,
        title: input.substring(0, 30) + (input.length > 30 ? '...' : ''),
        messages: updatedMessages,
        model: selectedModel,
        timestamp: new Date().toISOString()
      };
      setChatHistory([newChat, ...chatHistory]);
    }

    try {
      // Create a new AbortController for this request
      abortControllerRef.current = new AbortController();
      
      // Call the API with the abort signal
      const response = await axios.post('/api/chat', {
        messages: updatedMessages,
        model: selectedModel
      }, {
        signal: abortControllerRef.current.signal
      });

      // Add AI response to chat with timestamp and response time
      if (response.data && response.data.message) {
        const responseTimestamp = new Date().toISOString();
        const lastUserMessage = updatedMessages[updatedMessages.length - 1];
        
        // Calculate response time in seconds if there's a user message with timestamp
        let responseTime = null;
        if (lastUserMessage && lastUserMessage.timestamp) {
          const userTime = new Date(lastUserMessage.timestamp).getTime();
          const assistantTime = new Date(responseTimestamp).getTime();
          responseTime = ((assistantTime - userTime) / 1000).toFixed(2); // in seconds with 2 decimal places
        }
        
        // Add timestamp and response time to the assistant message
        const assistantMessage = {
          ...response.data.message,
          timestamp: responseTimestamp,
          responseTime: responseTime
        };
        
        const newMessages = [...updatedMessages, assistantMessage];
        setMessages(newMessages);
        
        // Update chat history with the AI response
        setChatHistory(prevHistory => 
          prevHistory.map(chat => 
            chat.id === chatId ? { ...chat, messages: newMessages } : chat
          )
        );
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('Request canceled:', error.message);
      } else {
        console.error('Error sending message:', error);
        
        const responseTimestamp = new Date().toISOString();
        const lastUserMessage = updatedMessages[updatedMessages.length - 1];
        
        // Calculate response time in seconds if there's a user message with timestamp
        let responseTime = null;
        if (lastUserMessage && lastUserMessage.timestamp) {
          const userTime = new Date(lastUserMessage.timestamp).getTime();
          const assistantTime = new Date(responseTimestamp).getTime();
          responseTime = ((assistantTime - userTime) / 1000).toFixed(2); // in seconds with 2 decimal places
        }
        
        // Create error message with timestamp and response time
        const errorMessage = {
          role: 'assistant',
          content: 'Sorry, there was an error processing your request. Please try again.',
          timestamp: responseTimestamp,
          responseTime: responseTime
        };
        
        const errorMessages = [...updatedMessages, errorMessage];
        setMessages(errorMessages);
        
        // Update chat history with the error message
        setChatHistory(prevHistory => 
          prevHistory.map(chat => 
            chat.id === chatId ? { ...chat, messages: errorMessages } : chat
          )
        );
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleModelChange = (model) => {
    setSelectedModel(model);
  };

  // Delete a message from the current chat
  const deleteMessage = (index) => {
    // Create a copy of the messages array without the deleted message
    const updatedMessages = [...messages.slice(0, index), ...messages.slice(index + 1)];
    setMessages(updatedMessages);
    
    // Update the current chat in the chat history
    const updatedChatHistory = chatHistory.map(chat => {
      if (chat.id === currentChatId) {
        return { ...chat, messages: updatedMessages };
      }
      return chat;
    });
    
    setChatHistory(updatedChatHistory);
    localStorage.setItem('chatHistory', JSON.stringify(updatedChatHistory));
  };
//
  // Edit a message and regenerate the response
  const editMessage = async (index, newContent) => {
    // Only allow editing user messages
    if (messages[index].role !== 'user') return;
    
    // Cancel any ongoing request
    cancelRequest();
    
    // Create a copy of the messages array with the edited message
    const editedMessage = { 
      ...messages[index], 
      content: newContent,
      timestamp: new Date().toISOString() // Update timestamp when editing
    };
    
    // Keep only messages up to and including the edited message
    const updatedMessages = [...messages.slice(0, index), editedMessage];
    setMessages(updatedMessages);
    setLoading(true);
    
    // Update the current chat in the chat history
    const updatedChatHistory = chatHistory.map(chat => {
      if (chat.id === currentChatId) {
        return { ...chat, messages: updatedMessages };
      }
      return chat;
    });
    
    setChatHistory(updatedChatHistory);
    localStorage.setItem('chatHistory', JSON.stringify(updatedChatHistory));
    
    try {
      // Create a new AbortController for this request
      abortControllerRef.current = new AbortController();
      
      // Call the API with the abort signal
      const response = await axios.post('/api/chat', {
        messages: updatedMessages,
        model: selectedModel
      }, {
        signal: abortControllerRef.current.signal
      });

      // Add AI response to chat with timestamp and response time
      if (response.data && response.data.message) {
        const responseTimestamp = new Date().toISOString();
        const lastUserMessage = updatedMessages[updatedMessages.length - 1];
        
        // Calculate response time in seconds if there's a user message with timestamp
        let responseTime = null;
        if (lastUserMessage && lastUserMessage.timestamp) {
          const userTime = new Date(lastUserMessage.timestamp).getTime();
          const assistantTime = new Date(responseTimestamp).getTime();
          responseTime = ((assistantTime - userTime) / 1000).toFixed(2); // in seconds with 2 decimal places
        }
        
        // Add timestamp and response time to the assistant message
        const assistantMessage = {
          ...response.data.message,
          timestamp: responseTimestamp,
          responseTime: responseTime
        };
        
        const newMessages = [...updatedMessages, assistantMessage];
        setMessages(newMessages);
        
        // Update chat history with the AI response
        setChatHistory(prevHistory => 
          prevHistory.map(chat => 
            chat.id === currentChatId ? { ...chat, messages: newMessages } : chat
          )
        );
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('Request canceled:', error.message);
      } else {
        console.error('Error sending message:', error);
        
        const responseTimestamp = new Date().toISOString();
        const lastUserMessage = updatedMessages[updatedMessages.length - 1];
        
        // Calculate response time in seconds if there's a user message with timestamp
        let responseTime = null;
        if (lastUserMessage && lastUserMessage.timestamp) {
          const userTime = new Date(lastUserMessage.timestamp).getTime();
          const assistantTime = new Date(responseTimestamp).getTime();
          responseTime = ((assistantTime - userTime) / 1000).toFixed(2); // in seconds with 2 decimal places
        }
        
        // Create error message with timestamp and response time
        const errorMessage = {
          role: 'assistant',
          content: 'Sorry, there was an error processing your request. Please try again.',
          timestamp: responseTimestamp,
          responseTime: responseTime
        };
        
        const errorMessages = [...updatedMessages, errorMessage];
        setMessages(errorMessages);
        
        // Update chat history with the error message
        setChatHistory(prevHistory => 
          prevHistory.map(chat => 
            chat.id === currentChatId ? { ...chat, messages: errorMessages } : chat
          )
        );
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="App">
      <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h2>Chat History</h2>
          <button className="new-chat-btn" onClick={createNewChat} disabled={loading || isEditing}>
            <span>+</span> New Chat
          </button>
        </div>
        <div className="chat-history">
          {chatHistory.length === 0 ? (
            <div className="empty-history">No chat history yet</div>
          ) : (
            chatHistory.map((chat) => (
              <div 
                key={chat.id} 
                className={`chat-item ${currentChatId === chat.id ? 'active' : ''} ${loading || isEditing ? 'disabled-chat-item' : ''}`}
                onClick={() => selectChat(chat.id)}
              >
                <div className="chat-item-title">{chat.title}</div>
                <button 
                  className="delete-chat-btn" 
                  onClick={(e) => deleteChat(chat.id, e)}
                  aria-label="Delete chat"
                  disabled={loading || isEditing}
                >
                  <span>×</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="main-content">
        <header className="App-header">
          <div className="header-left">
            <button className="sidebar-toggle" onClick={toggleSidebar}>
              ☰
            </button>
            <h1>Ollama Chat</h1>
          </div>
          <ModelSelector 
            models={models} 
            selectedModel={selectedModel} 
            onModelChange={handleModelChange} 
          />
        </header>

        <div className="chat-container">
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="welcome-message">
                <h2>Welcome to Ollama Chat!</h2>
                <p>This is a ChatGPT-like interface for your local Ollama model.</p>
                <p>Start a conversation by typing a message below.</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <ChatMessage 
                  key={index} 
                  message={message} 
                  index={index}
                  onDelete={deleteMessage}
                  onEdit={editMessage}
                  onEditStateChange={setIsEditing}
                />
              ))
            )}
            {loading && (
              <div className="message assistant-message typing-message">
                <div className="message-content">
                  <div className="typing-indicator" aria-label="Assistant is typing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <button className="cancel-button" onClick={cancelRequest}>Cancel</button>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="input-form" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message here..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
