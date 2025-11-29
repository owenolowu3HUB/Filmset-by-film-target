import React, { useState } from 'react';
import { LightbulbIcon, SpinnerIcon } from './icons';
import { generateScriptFromIdea } from '../services/geminiService';
import { Project } from '../types';

interface ScriptGeneratorProps {
  project: Project | null;
  onUseScript: (scriptText: string) => void;
  onGetShotIdeas: (scriptText: string) => void;
  onUpdateIdea: (idea: string) => void;
  onUpdateGeneratedScript: (script: string) => void;
  isReadOnly: boolean;
}

const ScriptGenerator: React.FC<ScriptGeneratorProps> = ({ project, onUseScript, onGetShotIdeas, onUpdateIdea, onUpdateGeneratedScript, isReadOnly }) => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [copySuccess, setCopySuccess] = useState<string>('');

    const idea = project?.scriptGeneratorIdea || '';
    const generatedScript = project?.script || '';

    const handleGenerate = async () => {
        if (!idea.trim()) {
            setError('Please enter an idea or concept.');
            return;
        }
        
        setIsLoading(true);
        setError(null);
        onUpdateGeneratedScript('');
        setCopySuccess('');

        try {
            const script = await generateScriptFromIdea(idea);
            onUpdateGeneratedScript(script);
        } catch (err) {
            console.error(err);
             let errorMessage = 'An unknown error occurred during script generation.';
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

    const handleCopyToClipboard = () => {
        if (!generatedScript) return;
        navigator.clipboard.writeText(generatedScript).then(() => {
            setCopySuccess('Copied to clipboard!');
            setTimeout(() => setCopySuccess(''), 2000);
        }, (err) => {
            console.error('Could not copy text: ', err);
            setCopySuccess('Failed to copy.');
             setTimeout(() => setCopySuccess(''), 2000);
        });
    };
    
    const handleUseForAnalysis = () => {
        if (!generatedScript) return;
        onUseScript(generatedScript);
    };

    const handleGetShotIdeasClick = () => {
        if (!generatedScript) return;
        onGetShotIdeas(generatedScript);
    }

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

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-2xl font-display font-bold mb-2">Script Idea Generator</h2>
                <p className="text-text-secondary">
                    Transform your concept into a properly formatted script scene.
                </p>
            </div>
            
            {renderClickableError(error)}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Panel */}
                <div className="flex flex-col gap-4">
                    <textarea
                        value={idea}
                        onChange={(e) => onUpdateIdea(e.target.value)}
                        placeholder={'e.g., A grizzled space marine, stranded on a hostile alien planet, discovers a mysterious, glowing artifact that seems to communicate with her through memories of her lost daughter.'}
                        className="w-full h-48 p-4 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent focus:border-accent transition-colors duration-200 resize-y"
                        disabled={isLoading || isReadOnly}
                        readOnly={isReadOnly}
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || isReadOnly}
                        className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-accent to-blue-500 text-white font-bold rounded-lg shadow-lg shadow-accent/20 hover:shadow-accent-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
                    >
                        {isLoading ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <LightbulbIcon className="w-5 h-5" />}
                        <span>{isLoading ? 'Generating...' : 'Generate Script'}</span>
                    </button>
                </div>

                {/* Output Panel */}
                <div className="flex flex-col gap-4 items-center justify-center bg-bg-secondary rounded-lg p-4 min-h-[300px] relative border border-border-color">
                    {isLoading && <SpinnerIcon className="w-12 h-12 text-accent animate-spin" />}
                    
                    {!isLoading && generatedScript && (
                        <>
                            <textarea
                                readOnly
                                value={generatedScript}
                                className="w-full h-96 p-4 bg-bg-primary font-mono text-sm border border-border-color rounded-lg resize-none"
                                aria-label="Generated Script"
                            />
                            <div className="w-full flex flex-col sm:flex-row gap-2">
                                <button onClick={handleCopyToClipboard} className="flex-1 text-sm bg-surface hover:bg-border-color text-text-primary font-semibold py-2 px-3 rounded-md transition-colors border border-border-color">
                                    {copySuccess || 'Copy to Clipboard'}
                                </button>
                                <button onClick={handleUseForAnalysis} disabled={isReadOnly} className="flex-1 text-sm bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-3 rounded-md transition-colors disabled:opacity-50">
                                    Use for Analysis
                                </button>
                                <button onClick={handleGetShotIdeasClick} disabled={isReadOnly} className="flex-1 text-sm bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-3 rounded-md transition-colors disabled:opacity-50">
                                    Get Shot Ideas
                                </button>
                            </div>
                        </>
                    )}
                    
                    {!isLoading && !generatedScript && (
                        <div className="text-center text-text-secondary">
                            <p className="font-semibold text-lg">Your generated script will appear here.</p>
                            <p>Enter your idea on the left and click "Generate Script".</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScriptGenerator;