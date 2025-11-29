

import React, { useState } from 'react';
import { RobotIcon, SpinnerIcon, ClipboardCopyIcon, CheckCircleIcon, EyeIcon } from './icons';
import { generateAIPrompts } from '../services/geminiService';
import { Project, AIPrompterResult } from '../types';

interface AIPrompterProps {
  project: Project | null;
  onUpdateSceneContent: (content: string) => void;
  onUpdateResult: (result: AIPrompterResult) => void;
  onUpdateRegistry: (registry: Record<string, string>) => void;
  isReadOnly: boolean;
}

const AIPrompter: React.FC<AIPrompterProps> = ({ project, onUpdateSceneContent, onUpdateResult, onUpdateRegistry, isReadOnly }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [useContinuity, setUseContinuity] = useState<boolean>(true);
  const [showRegistry, setShowRegistry] = useState<boolean>(false);

  const sceneContent = project?.aiPrompterSceneContent || '';
  const result = project?.aiPrompterResult;
  const characterRegistry = project?.aiPrompterCharacterRegistry || {};
  const registryCount = Object.keys(characterRegistry).length;
  
  // Check if Shot Idea Studio context exists
  const shotStudioContext = project?.shotIdeasListContext;
  const hasVisualContext = !!shotStudioContext;

  const handleGenerate = async () => {
    if (!sceneContent.trim()) {
      setError('Please enter a scene description.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Pass shotStudioContext to the service
      const data = await generateAIPrompts(sceneContent, characterRegistry, useContinuity, shotStudioContext);
      
      // Update Registry with new DNA found in the result
      if (useContinuity && data.scene_analysis.characters.length > 0) {
          const newRegistry = { ...characterRegistry };
          let hasUpdates = false;
          
          data.scene_analysis.characters.forEach(char => {
              if (char.name && char.dna_reference) {
                  // Simply update or add. The prompt logic handles the "merge" of physical traits vs outfit.
                  // So we trust the output DNA to be the new "Master" for this scene, which becomes the reference for the next.
                  newRegistry[char.name] = char.dna_reference;
                  hasUpdates = true;
              }
          });
          
          if (hasUpdates) {
              onUpdateRegistry(newRegistry);
          }
      }

      onUpdateResult(data);
    } catch (err) {
      console.error(err);
      let errorMessage = 'An unknown error occurred.';
      if (err instanceof Error) {
        if (err.message.includes('429')) {
            errorMessage = "API quota exceeded. Please check your plan and billing details.";
        } else if (err.message.includes('503')) {
            errorMessage = "The AI model is currently experiencing high demand. Please wait a few moments and try again.";
        } else {
            errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const renderClickableError = (text: string | null) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return (
      <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline" dangerouslySetInnerHTML={{ __html: text.replace(urlRegex, '<a href="$&" target="_blank" rel="noopener noreferrer" class="underline hover:text-red-100">$1</a>') }} />
      </div>
    );
  };

  const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = () => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <button 
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary hover:bg-surface border border-border-color rounded text-xs font-semibold text-text-secondary transition-colors"
        title="Copy to clipboard"
      >
        {copied ? <CheckCircleIcon className="w-3 h-3 text-green-400" /> : <ClipboardCopyIcon className="w-3 h-3" />}
        <span>{copied ? 'Copied' : (label || 'Copy')}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <div>
            <h2 className="text-2xl font-display font-bold mb-2">AI Prompter</h2>
            <p className="text-text-secondary">
            Generate consistent, professional image and video prompts for your scene using the "CinemaSynth 7.0" protocol.
            </p>
        </div>
        
        <div className="flex flex-col gap-2 items-end">
             {/* Registry Toggle */}
            <div className="flex items-center gap-3 bg-bg-secondary p-3 rounded-lg border border-border-color">
                <div className="flex items-center gap-2">
                    <input 
                        type="checkbox" 
                        id="continuityToggle" 
                        checked={useContinuity} 
                        onChange={(e) => setUseContinuity(e.target.checked)}
                        className="w-4 h-4 text-accent bg-bg-primary border-border-color rounded focus:ring-accent"
                        disabled={isReadOnly}
                    />
                    <label htmlFor="continuityToggle" className="text-sm font-semibold select-none cursor-pointer">
                        Same Story Continuity
                    </label>
                </div>
                <div className="h-6 w-px bg-border-color mx-2"></div>
                <button 
                    onClick={() => setShowRegistry(!showRegistry)}
                    className="text-xs font-medium text-accent hover:text-accent-secondary flex items-center gap-1"
                >
                    <EyeIcon className="w-4 h-4" />
                    {registryCount} Characters Locked
                </button>
            </div>
            
            {/* Visual Context Badge */}
            {hasVisualContext && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/30 border border-blue-500/50 rounded-lg text-xs font-semibold text-blue-300">
                    <CheckCircleIcon className="w-3 h-3" />
                    <span>Shot Studio Context Available</span>
                </div>
            )}
        </div>
      </div>
      
      {showRegistry && registryCount > 0 && (
          <div className="bg-bg-secondary p-4 rounded-lg border border-border-color animate-in fade-in slide-in-from-top-2">
              <h3 className="text-sm font-bold text-text-secondary mb-3 uppercase tracking-wider">Locked Character DNA Registry</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto custom-scrollbar">
                  {Object.entries(characterRegistry).map(([name, dna]) => (
                      <div key={name} className="bg-bg-primary p-3 rounded border border-border-color/50 text-xs">
                          <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-accent">{name}</span>
                              <CopyButton text={dna} />
                          </div>
                          <p className="text-text-secondary line-clamp-2" title={dna}>{dna}</p>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {renderClickableError(error)}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Column */}
        <div className="flex flex-col gap-4">
          <textarea
            value={sceneContent}
            onChange={(e) => onUpdateSceneContent(e.target.value)}
            placeholder={'Paste your scene description here...'}
            className="w-full h-64 p-4 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent focus:border-accent transition-colors duration-200 resize-y"
            disabled={isLoading || isReadOnly}
            readOnly={isReadOnly}
          />
          <button
            onClick={handleGenerate}
            disabled={isLoading || isReadOnly}
            className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-accent to-blue-500 text-white font-bold rounded-lg shadow-lg shadow-accent/20 hover:shadow-accent-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
          >
            {isLoading ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <RobotIcon className="w-5 h-5" />}
            <span>{isLoading ? 'Generating Prompts...' : 'Generate Prompts'}</span>
          </button>
        </div>

        {/* Output Column */}
        <div className="flex flex-col gap-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full bg-bg-secondary rounded-lg border border-border-color p-8">
              <SpinnerIcon className="w-12 h-12 text-accent animate-spin" />
              <p className="mt-4 text-lg font-semibold">Analyzing scene DNA...</p>
              {hasVisualContext && <p className="text-sm text-blue-400 mt-2">Applying Shot Studio Visuals...</p>}
              {useContinuity && registryCount > 0 && <p className="text-sm text-green-400 mt-1">Continuity Protocol Active</p>}
            </div>
          ) : result ? (
            <div className="flex flex-col gap-6 h-[800px] overflow-y-auto pr-2 custom-scrollbar">
              
              {/* Registry Section */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-accent border-b border-border-color pb-2">Master Asset Registry</h3>
                
                {/* Environment */}
                <div className="bg-bg-secondary p-4 rounded-lg border border-border-color">
                    <div className="flex justify-between items-center mb-2">
                         <h4 className="font-bold text-text-primary text-sm uppercase tracking-wide">Location DNA: {result.scene_analysis.environment.location}</h4>
                         <CopyButton text={result.scene_analysis.environment.dna_reference} label="Copy DNA" />
                    </div>
                    <div className="bg-bg-primary p-3 rounded font-mono text-xs text-text-secondary border border-border-color/30 break-all leading-relaxed">
                        {result.scene_analysis.environment.dna_reference}
                    </div>
                </div>

                {/* Characters */}
                <div className="grid grid-cols-1 gap-3">
                    {result.scene_analysis.characters.map((char, idx) => (
                        <div key={idx} className="bg-bg-secondary p-4 rounded-lg border border-border-color">
                             <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-text-primary text-sm uppercase tracking-wide">Character DNA: {char.name}</h4>
                                <CopyButton text={char.dna_reference} label="Copy DNA" />
                            </div>
                            <div className="bg-bg-primary p-3 rounded font-mono text-xs text-text-secondary border border-border-color/30 break-all leading-relaxed">
                                {char.dna_reference}
                            </div>
                        </div>
                    ))}
                </div>
              </div>

              {/* Shots Section */}
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-border-color pb-2">
                     <h3 className="text-xl font-bold text-accent">Shot List ({result.generated_shots.total_shot_count})</h3>
                     <span className="text-sm text-text-secondary">Est. Duration: {result.generated_shots.estimated_duration}</span>
                </div>

                {result.generated_shots.shots.map((shot) => (
                    <div key={shot.shot_number} className="bg-surface p-4 rounded-lg border border-border-color space-y-3">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-lg text-accent-secondary">{shot.shot_header || `SHOT ${shot.shot_number}: ${shot.shot_type}`}</h4>
                        </div>
                        
                        {/* Image Prompt */}
                        <div className="bg-bg-secondary p-3 rounded border border-border-color/50">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Image Prompt</span>
                                <CopyButton text={shot.image_prompt} />
                            </div>
                            <p className="text-xs font-mono text-text-secondary leading-relaxed whitespace-pre-wrap">{shot.image_prompt}</p>
                        </div>

                        {/* Video Prompt */}
                        <div className="bg-bg-secondary p-3 rounded border border-border-color/50">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Video Prompt</span>
                                <CopyButton text={shot.video_prompt} />
                            </div>
                            <p className="text-xs font-mono text-text-secondary leading-relaxed whitespace-pre-wrap">{shot.video_prompt}</p>
                        </div>
                    </div>
                ))}
              </div>

            </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-full bg-bg-secondary rounded-lg border border-border-color p-8 text-center text-text-secondary">
                <p className="font-semibold text-lg">Analysis & Prompts will appear here.</p>
                <p>Paste a scene description on the left and click "Generate Prompts".</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIPrompter;