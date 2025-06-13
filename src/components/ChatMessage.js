import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

const ChatMessage = ({ message, index, onDelete, onEdit, onEditStateChange }) => {
  const { role, content, responseTime } = message;
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  
  // Determine message class based on role
  const messageClass = role === 'user' ? 'user-message' : 'assistant-message';
  
  // Format role for display
  const displayRole = role === 'user' ? 'You' : 'Assistant';
  
  // Format response time for display
  const formattedResponseTime = responseTime ? `${responseTime}s` : '';

  // Remove <think> tags and their content
  const processedContent = content.replace(/<think>.*?<\/think>/gs, '');

  const handleEdit = () => {
    if (role === 'user') {
      setIsEditing(true);
      if (onEditStateChange) {
        onEditStateChange(true);
      }
    }
  };

  const handleSaveEdit = () => {
    if (editedContent.trim() !== '') {
      onEdit(index, editedContent);
      setIsEditing(false);
      if (onEditStateChange) {
        onEditStateChange(false);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditedContent(content);
    setIsEditing(false);
    if (onEditStateChange) {
      onEditStateChange(false);
    }
  };

  return (
    <div className={`message ${messageClass}`}>
      <div className="message-content">
        <div className="message-header">
          <div className="message-info">
            <div className="message-role">{displayRole}</div>
            {role === 'assistant' && responseTime && (
              <div className="response-time">{formattedResponseTime}</div>
            )}
          </div>
          <div className="message-actions">
            {role === 'user' && !isEditing && (
              <button 
                className="edit-message-btn" 
                onClick={handleEdit}
                aria-label="Edit message"
              >
                <span>✎</span>
              </button>
            )}
            {onDelete && !isEditing && (
              <button 
                className="delete-message-btn" 
                onClick={() => onDelete(index)}
                aria-label="Delete message"
              >
                <span>×</span>
              </button>
            )}
          </div>
        </div>
        
        {isEditing ? (
          <div className="edit-message-container">
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="edit-message-textarea"
              autoFocus
            />
            <div className="edit-message-actions">
              <button onClick={handleSaveEdit} className="save-edit-btn">Save & Regenerate</button>
              <button onClick={handleCancelEdit} className="cancel-edit-btn">Cancel</button>
            </div>
          </div>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={atomDark}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
              a({ node, children, href, ...props }) {
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                    {children}
                  </a>
                );
              },
            }}
          >
            {processedContent}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;