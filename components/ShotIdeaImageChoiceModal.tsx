import React from 'react';
import { SparklesIcon, ClapperboardIcon } from './icons';

interface ShotIdeaImageChoiceModalProps {
  onGenerateWithImages: () => void;
  onGenerateWithoutImages: () => void;
  onClose: () => void;
}

const ShotIdeaImageChoiceModal: React.FC<ShotIdeaImageChoiceModalProps> = ({ onGenerateWithImages, onGenerateWithoutImages, onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full max-w-lg rounded-xl shadow-2xl shadow-accent/20 border border-border-color p-6 flex flex-col gap-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-display font-bold text-accent">Generate Visuals for Shots?</h2>
        <p className="text-text-secondary">
          Would you like the AI to generate a unique image for each shot in the list?
        </p>
        <p className="text-sm text-text-secondary">
          Generating images takes more time. You can generate text only and upload your own images later.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-4">
          <button
            onClick={onGenerateWithoutImages}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-bg-secondary text-text-primary font-semibold rounded-lg transition-colors duration-200 hover:bg-border-color border-2 border-border-color"
          >
            <ClapperboardIcon className="w-5 h-5" />
            <span>Generate Text Only</span>
          </button>
          <button
            onClick={onGenerateWithImages}
            className="flex-1 flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-accent to-blue-500 text-white font-bold rounded-lg shadow-lg shadow-accent/20 hover:shadow-accent-glow transition-all duration-300 transform hover:scale-105"
          >
            <SparklesIcon className="w-5 h-5" />
            <span>Yes, Generate with Images</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShotIdeaImageChoiceModal;
