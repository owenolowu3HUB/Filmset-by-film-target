
import React, { useState } from 'react';
import { SparklesIcon, UploadIcon, CheckCircleIcon } from './icons';

interface VisualsChoiceModalProps {
  onGenerate: (options: { poster: boolean; concept: boolean; characters: boolean }) => void;
  onSkip: () => void;
  onClose: () => void;
}

const VisualsChoiceModal: React.FC<VisualsChoiceModalProps> = ({ onGenerate, onSkip, onClose }) => {
  const [options, setOptions] = useState({
    poster: true,
    concept: true,
    characters: true,
  });

  const toggleOption = (key: keyof typeof options) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerateClick = () => {
    onGenerate(options);
  };

  const OptionRow: React.FC<{ label: string; desc: string; isChecked: boolean; onClick: () => void }> = ({ label, desc, isChecked, onClick }) => (
    <div 
        onClick={onClick}
        className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${isChecked ? 'border-accent bg-accent/5' : 'border-border-color hover:border-accent/50 bg-bg-primary'}`}
    >
        <div className="text-left">
            <h4 className={`font-bold ${isChecked ? 'text-accent' : 'text-text-primary'}`}>{label}</h4>
            <p className="text-xs text-text-secondary">{desc}</p>
        </div>
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isChecked ? 'border-accent bg-accent' : 'border-text-secondary'}`}>
            {isChecked && <CheckCircleIcon className="w-4 h-4 text-white" />}
        </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full max-w-lg rounded-xl shadow-2xl shadow-accent/20 border border-border-color p-6 flex flex-col gap-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
            <h2 className="text-2xl font-display font-bold text-accent">Generate Visual Assets</h2>
            <p className="text-text-secondary mt-2">
            Select the visual elements you want the AI to create for your pitch deck.
            </p>
        </div>

        <div className="flex flex-col gap-3">
            <OptionRow 
                label="Movie Poster" 
                desc="A high-quality, vertical movie poster (2:3 aspect ratio)." 
                isChecked={options.poster} 
                onClick={() => toggleOption('poster')} 
            />
            <OptionRow 
                label="Concept Art" 
                desc="A cinematic widescreen environmental shot (16:9 aspect ratio)." 
                isChecked={options.concept} 
                onClick={() => toggleOption('concept')} 
            />
            <OptionRow 
                label="Character Portraits" 
                desc="Portraits for the main characters (3:4 aspect ratio)." 
                isChecked={options.characters} 
                onClick={() => toggleOption('characters')} 
            />
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-2">
          <button
            onClick={onSkip}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-bg-secondary text-text-primary font-semibold rounded-lg transition-colors duration-200 hover:bg-border-color border-2 border-border-color"
          >
            <UploadIcon className="w-5 h-5" />
            <span>Skip All</span>
          </button>
          <button
            onClick={handleGenerateClick}
            disabled={!options.poster && !options.concept && !options.characters}
            className="flex-1 flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-accent to-blue-500 text-white font-bold rounded-lg shadow-lg shadow-accent/20 hover:shadow-accent-glow transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SparklesIcon className="w-5 h-5" />
            <span>Generate Selected</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VisualsChoiceModal;
