
import React, { useState } from 'react';

interface OpenSharedProjectModalProps {
  onLoad: (data: string) => void;
  onClose: () => void;
}

const OpenSharedProjectModal: React.FC<OpenSharedProjectModalProps> = ({ onLoad, onClose }) => {
  const [data, setData] = useState("");

  const handleLoad = () => {
    const cleanData = data.trim();
    if (cleanData) {
      onLoad(cleanData);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-surface w-full max-w-lg rounded-xl shadow-2xl shadow-accent/20 border border-border-color p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-display font-bold">Open Shared Project</h2>
        <p className="text-text-secondary">Paste the secure code shared with you.</p>
        <textarea
          value={data}
          onChange={(e) => setData(e.target.value)}
          placeholder="Paste code here..."
          className="w-full h-40 p-3 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent focus:border-accent transition-colors font-mono text-xs"
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
            onClick={handleLoad}
            disabled={!data.trim()}
            className="px-6 py-2 bg-gradient-to-r from-accent to-blue-500 text-white font-bold rounded-lg shadow-lg hover:shadow-accent-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Load Project
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpenSharedProjectModal;
