import React, { useState } from 'react';

const ModelSelector = ({ models, selectedModel, onModelChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Default to Qwen3:8b if no models are available
  const availableModels = models.length > 0 ? models : [{ name: 'Qwen3:8b' }];
  
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };
  
  const handleModelSelect = (model) => {
    onModelChange(model);
    setIsOpen(false);
  };
  
  return (
    <div className="model-selector">
      <div className="model-selector-button" onClick={toggleDropdown}>
        Model: {selectedModel}
        <span style={{ marginLeft: '8px' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </div>
      
      {isOpen && (
        <div className="model-dropdown">
          {availableModels.map((model, index) => (
            <div
              key={index}
              className={`model-option ${model.name === selectedModel ? 'selected' : ''}`}
              onClick={() => handleModelSelect(model.name)}
            >
              {model.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;