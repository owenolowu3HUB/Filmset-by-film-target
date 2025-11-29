

import React, { useState, useEffect } from 'react';
import { LayoutGridIcon, SpinnerIcon, ExportIcon } from './icons';
import { generateStoryboardGrid, generateStoryboardFromShots } from '../services/geminiService';
import { Project, StoryboardData, ShotIdea, SceneOverview, CharacterDesign } from '../types';

interface StoryboardStudioProps {
    project: Project | null;
    onUpdateStoryboardData: (data: StoryboardData | null) => void;
    onUpdateSceneDescription: (desc: string) => void;
    onClearStoryboardRequest: () => void;
    isReadOnly: boolean;
}

const StoryboardStudio: React.FC<StoryboardStudioProps> = ({ project, onUpdateStoryboardData, onUpdateSceneDescription, onClearStoryboardRequest, isReadOnly }) => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const sceneDescription = project?.storyboardSceneDescription || '';
    const storyboardData = project?.storyboardData;
    const storyboardRequest = project?.storyboardRequestFromShots;

    useEffect(() => {
        const generateFromShots = async (
            shots: ShotIdea[], 
            context: { sceneOverview: SceneOverview, characterDesigns: CharacterDesign[] }, 
            config: any, 
            script: string
        ) => {
            setIsLoading(true);
            setError(null);
            onUpdateStoryboardData(null);
            try {
                const images = await generateStoryboardFromShots(shots, script, config, context);
                onUpdateStoryboardData({
                    sceneDescription: "Generated from Shot Idea Studio",
                    images,
                    shotIdeas: shots
                });
            } catch (err) {
                 handleError(err);
            } finally {
                setIsLoading(false);
                onClearStoryboardRequest();
            }
        };

        if (storyboardRequest && storyboardRequest.length > 0 && project?.storyboardRequestContext && !isReadOnly) {
            generateFromShots(storyboardRequest, project.storyboardRequestContext, project?.shotIdeaStudioConfig, project?.script || '');
        }
    }, [storyboardRequest, project?.storyboardRequestContext, project?.shotIdeaStudioConfig, project?.script, onUpdateStoryboardData, onClearStoryboardRequest, isReadOnly]);

    const handleError = (err: unknown) => {
        console.error(err);
        let errorMessage = 'An unknown error occurred during generation.';
        if (err instanceof Error) {
            if (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED')) {
                errorMessage = "API quota exceeded. Please check your plan and billing details. For more information, see https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your usage, visit https://ai.dev/usage?tab=rate-limit.";
            } else if (err.message.includes('503') || err.message.includes('UNAVAILABLE') || err.message.includes('overloaded')) {
                errorMessage = "The AI model is currently experiencing high demand. Please wait a few moments and try again.";
            } else {
                errorMessage = err.message;
            }
        }
        setError(errorMessage);
    }

    const handleGenerateGrid = async () => {
        if (!sceneDescription.trim()) {
            setError('Please enter a scene description.');
            return;
        }
        
        setIsLoading(true);
        setError(null);
        onUpdateStoryboardData(null);

        try {
            const images = await generateStoryboardGrid(sceneDescription);
            onUpdateStoryboardData({ sceneDescription, images });
        } catch (err) {
            handleError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        onUpdateSceneDescription('');
        onUpdateStoryboardData(null);
        setError(null);
    };

    const renderClickableError = (text: string | null) => {
        if (!text) return null;
        // Regex to find URLs, avoiding trailing punctuation.
        const urlRegex = /(https?:\/\/[^\s.,;?!()"'<>[\]{}]+)/g;
        const parts = text.split(urlRegex);
    
        return (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">
              {parts.map((part, index) => {
                if (part.match(urlRegex)) {
                  let linkText = 'Learn More';
                  if (part.includes('rate-limits')) {
                    linkText = 'About Rate Limits';
                  } else if (part.includes('usage')) {
                    linkText = 'Monitor Usage';
                  } else if (part.includes('billing')) {
                    linkText = 'Billing Information';
                  }
                  return (
                    <a href={part} key={index} target="_blank" rel="noopener noreferrer" className="underline hover:text-red-100 mx-1 font-semibold">
                      {linkText}
                    </a>
                  );
                }
                return part;
              })}
            </span>
          </div>
        );
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-2xl font-display font-bold mb-2">Storyboard Studio</h2>
                <p className="text-text-secondary">
                    Generate a 4-panel storyboard grid from a scene description, or receive a full shot-by-shot board from the Shot Idea Studio.
                </p>
            </div>
            
            {renderClickableError(error)}
            
            <div className="flex flex-col gap-4">
                 <textarea
                    value={sceneDescription}
                    onChange={(e) => onUpdateSceneDescription(e.target.value)}
                    placeholder={'e.g., A tense standoff in a dusty saloon. A hero faces a villain across a wooden table, hand hovering over their holster. A single ray of light cuts through the gloom.'}
                    className="w-full h-40 p-4 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent focus:border-accent transition-colors duration-200 resize-y"
                    disabled={isLoading || isReadOnly}
                    readOnly={isReadOnly}
                />
                <div className="flex justify-end items-center gap-4">
                    {storyboardData && !isReadOnly && (
                        <button
                            onClick={handleClear}
                            disabled={isLoading}
                            className="px-6 py-3 bg-bg-secondary text-text-primary font-semibold rounded-lg transition-colors duration-200 hover:bg-border-color disabled:opacity-50 border-2 border-border-color"
                        >
                            Clear
                        </button>
                    )}
                    <button
                        onClick={handleGenerateGrid}
                        disabled={isLoading || isReadOnly}
                        className="w-full sm:w-auto self-end flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-accent to-blue-500 text-white font-bold rounded-lg shadow-lg shadow-accent/20 hover:shadow-accent-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
                    >
                        {isLoading ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <LayoutGridIcon className="w-5 h-5" />}
                        <span>{isLoading ? 'Generating...' : 'Generate 4-Panel Grid'}</span>
                    </button>
                </div>
            </div>

            {/* Output Panel */}
            <div className="flex flex-col gap-4 items-center justify-center bg-bg-secondary rounded-lg p-4 min-h-[400px] border border-border-color">
                {isLoading && (
                    <div className="text-center">
                        <SpinnerIcon className="w-12 h-12 text-accent animate-spin" />
                        <p className="mt-4 font-semibold text-lg">Generating storyboard visuals...</p>
                    </div>
                )}
                
                {!isLoading && storyboardData && storyboardData.images.length > 0 && (
                    <div className="w-full">
                        {storyboardData.shotIdeas ? (
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {storyboardData.images.map((img, index) => {
                                    const shot = storyboardData.shotIdeas?.[index];
                                    if (!shot) return null;
                                    return (
                                        <div key={index} className="bg-surface rounded-lg p-4 flex flex-col gap-3 border border-border-color">
                                            <h3 className="font-bold text-accent">{`Shot ${shot.shot_number}: ${shot.shot_type}`}</h3>
                                            {img ? (
                                                <img 
                                                    src={`data:image/jpeg;base64,${img}`} 
                                                    alt={`Storyboard panel for shot ${shot.shot_number}`}
                                                    className="w-full h-auto object-contain rounded-md aspect-video"
                                                />
                                            ) : (
                                                 <div className="w-full aspect-video bg-bg-primary rounded-md flex items-center justify-center">
                                                    <p className="text-text-secondary">Image generation failed</p>
                                                </div>
                                            )}
                                            <p className="text-sm text-text-secondary italic">{shot.description}</p>
                                        </div>
                                    )
                                })}
                             </div>
                        ) : (
                             <div className="w-full">
                                <img 
                                    src={`data:image/jpeg;base64,${storyboardData.images[0]}`} 
                                    alt="Generated Storyboard Grid"
                                    className="w-full h-auto object-contain rounded-lg shadow-md"
                                />
                            </div>
                        )}
                    </div>
                )}
                
                {!isLoading && (!storyboardData || storyboardData.images.length === 0) && (
                    <div className="text-center text-text-secondary">
                        <p className="font-semibold text-lg">Your storyboard will appear here.</p>
                        <p>Describe a scene above or send a shot list from the Shot Idea Studio.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StoryboardStudio;