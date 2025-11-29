import React, { useState } from 'react';

interface SaveProjectModalProps {
  onSave: (name: string) => void;
  onClose: () => void;
  currentName?: string;
}

const SaveProjectModal: React.FC<SaveProjectModalProps> = ({ onSave, onClose, currentName }) => {
  const [name, setName] = useState(currentName && currentName !== "Untitled Project" ? currentName : "");

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-surface w-full max-w-md rounded-xl shadow-2xl shadow-accent/20 border border-border-color p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-display font-bold">Save Project</h2>
        <p className="text-text-secondary">Enter a name for your project.</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Sci-Fi Thriller"
          className="w-full p-3 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
          autoFocus
        />
        <div className="flex justify-end gap-3 mt-2">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-bg-secondary text-text-primary font-semibold rounded-lg transition-colors duration-200 hover:bg-border-color border border-border-color"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-6 py-2 bg-gradient-to-r from-accent to-blue-500 text-white font-bold rounded-lg shadow-lg hover:shadow-accent-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveProjectModal;