
import React, { useState, useEffect, useRef } from 'react';
import { ClapperboardIcon, SpinnerIcon, UploadIcon, ClipboardCopyIcon, CheckCircleIcon, ImageIcon, ArrowDownIcon, ArrowUpIcon, ReplaceIcon, SaveIcon, TrashIcon, DownloadIcon } from './icons';
import { generateShotIdeasAndImages, generateShotIdeas } from '../services/geminiService';
import { Project, ShotIdea, SceneOverview, CharacterDesign, SavedShotList } from '../types';
import ShotIdeaImageChoiceModal from './ShotIdeaImageChoiceModal';

interface ShotIdeaStudioProps {
    project: Project | null;
    onUpdateShotIdeas: (data: ShotIdea[] | null, context?: { sceneOverview: SceneOverview; characterDesigns: CharacterDesign[]; }) => void;
    onUpdateScript: (script: string) => void;
    onUpdateConfig: (config: Project['shotIdeaStudioConfig']) => void;
    onSendToImageStudio: (prompt: string) => void;
    onUpdateSavedShotLists: (lists: SavedShotList[]) => void;
    isReadOnly: boolean;
}

const genres = [
    'Action', 'Adventure', 'Comedy', 'Crime', 'Drama', 'Fantasy', 
    'Historical', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 
    'Thriller', 'Western', 'Film Noir'
];

const artisticStyles = [
    'Cinematic Realism',
    'Film Noir',
    'Anime / Manga',
    'Studio Ghibli Style',
    'Pixar Animation Style',
    'Classic Disney Animation',
    'Lo-Fi Anime',
    'Cyberpunk / Neon-Noir',
    'Steampunk',
    'Impressionistic Painting',
    'Graphic Novel / Comic Book',
    'Black and White Sketch',
];

const races = [
    'Unspecified', 'African', 'Asian', 'Caucasian', 'Hispanic/Latin', 
    'Middle Eastern', 'Native American', 'Pacific Islander'
];

const skinTones = [
    'Unspecified', 'Very Light', 'Light', 'Medium', 'Tan', 
    'Brown', 'Dark Brown', 'Very Dark'
];

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = (reader.result as string).split(',')[1];
        resolve(result);
      };
      reader.onerror = error => reject(error);
    });
};

const generateImagePrompt = (
    shot: ShotIdea,
    sceneContext?: { sceneOverview: SceneOverview; characterDesigns: CharacterDesign[] }
): string => {
    // Unique ID for the scene to hint at consistency
    const sceneStyleRef = `STYLE_REF_${(Math.random() + 1).toString(36).substring(7)}`;

    const characterDetails = sceneContext?.characterDesigns.map(c => 
        `- ${c.name}: ${c.description} Wearing: ${c.costume}.`
    ).join('\n') || 'As described in the scene.';

    const promptParts = [
        `Cinematic film still, 16:9 aspect ratio, ${shot.artistic_style || 'realistic'} style. High detail.`,
        `Shot Type: ${shot.shot_type}.`,
        `Scene Description: ${shot.description}`,
        `---`,
        `VISUAL CONTINUITY (Style Ref: ${sceneStyleRef})`,
        `Master Setting: ${sceneContext?.sceneOverview.setting_description || 'As described in scene.'}`,
        `Master Lighting: ${sceneContext?.sceneOverview.lighting_mood || 'As described in scene.'}`,
        `Character Designs: \n${characterDetails}`,
        `---`,
        `SPECIFIC SHOT DETAILS`,
        `Composition & Framing: ${shot.composition_and_framing}`,
        `Lighting Details: ${shot.lighting}`,
        `Blocking (Character/Camera Movement): ${shot.blocking}`,
        `Focal Art/Set Dressing: ${shot.art_design}`,
        `Focal Costume/Makeup: ${shot.costume_and_makeup}`
    ];

    return promptParts.join('\n\n');
};

const CollapsiblePrompt: React.FC<{
    shot: ShotIdea;
    context?: { sceneOverview: SceneOverview; characterDesigns: CharacterDesign[] };
    onSendToImageStudio: (prompt: string) => void;
    isReadOnly: boolean;
}> = ({ shot, context, onSendToImageStudio, isReadOnly }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const imagePrompt = generateImagePrompt(shot, context);

    const handleCopy = () => {
        navigator.clipboard.writeText(imagePrompt);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
        <div className="mt-4 pt-4 border-t border-border-color/50">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex justify-between items-center w-full text-left font-semibold text-text-primary hover:text-accent transition-colors"
                aria-expanded={isOpen}
            >
                <span>Image Generation Prompt</span>
                {isOpen ? <ArrowUpIcon className="w-5 h-5" /> : <ArrowDownIcon className="w-5 h-5" />}
            </button>
            {isOpen && (
                <div className="mt-3 flex flex-col gap-3">
                    <textarea
                        readOnly
                        value={imagePrompt}
                        className="w-full h-48 p-3 bg-bg-primary font-mono text-xs border border-border-color rounded-lg resize-y"
                        aria-label="Image Generation Prompt"
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                        <button
                            onClick={handleCopy}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-bg-secondary hover:bg-surface border border-border-color text-text-primary font-semibold rounded-lg transition-colors"
                        >
                            {copySuccess ? <CheckCircleIcon className="w-5 h-5 text-green-400" /> : <ClipboardCopyIcon className="w-5 h-5" />}
                            <span>{copySuccess ? 'Copied!' : 'Copy Prompt'}</span>
                        </button>
                        <button
                            onClick={() => onSendToImageStudio(imagePrompt)}
                            disabled={isReadOnly}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-accent/10 hover:bg-accent/20 border border-accent text-accent font-semibold rounded-lg transition-colors disabled:opacity-50"
                        >
                            <ImageIcon className="w-5 h-5" />
                            <span>Send to Image Studio</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};


const ShotIdeaStudio: React.FC<ShotIdeaStudioProps> = ({ project, onUpdateShotIdeas, onUpdateScript, onUpdateConfig, onSendToImageStudio, onUpdateSavedShotLists, isReadOnly }) => {
    const [script, setScript] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isImageChoiceModalOpen, setIsImageChoiceModalOpen] = useState(false);
    
    // Saving state
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [newSaveName, setNewSaveName] = useState('');
    const [selectedListId, setSelectedListId] = useState('');

    const imageUploadInputRef = useRef<HTMLInputElement>(null);
    const [uploadTargetShot, setUploadTargetShot] = useState<number | null>(null);

    const config = project?.shotIdeaStudioConfig || { genre: '', location: '', characterRace: '', skinTone: '', artisticStyle: '' };
    const savedLists = project?.savedShotLists || [];

    useEffect(() => {
        setScript(project?.script || '');
    }, [project]);

    const handleConfigChange = (field: keyof typeof config, value: string) => {
        if (onUpdateConfig) {
            onUpdateConfig({ ...config, [field]: value });
        }
    };
    
    const handleGenerate = async () => {
        if (!script.trim()) {
            setError('Please enter a script scene.');
            return;
        }
        setIsImageChoiceModalOpen(true);
    };

    const executeGeneration = async (withImages: boolean) => {
        setIsImageChoiceModalOpen(false);
        setIsLoading(true);
        setError(null);
        onUpdateShotIdeas(null); // Clear previous results
        setSelectedListId(''); // Reset selection when generating fresh

        try {
            if (withImages) {
                const { shots, context } = await generateShotIdeasAndImages(script, config);
                onUpdateShotIdeas(shots, context);
            } else {
                const { shots, context } = await generateShotIdeas(script, config);
                onUpdateShotIdeas(shots, context);
            }
        } catch (err) {
            console.error(err);
            let errorMessage = 'An unknown error occurred during shot generation.';
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
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUploadForShot = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || uploadTargetShot === null || !project?.shotIdeasList) return;

        try {
            const base64 = await fileToBase64(file);
            const updatedShots = project.shotIdeasList.map(shot => {
                if (shot.shot_number === uploadTargetShot) {
                    return { ...shot, image_base64: base64 };
                }
                return shot;
            });
            onUpdateShotIdeas(updatedShots, project.shotIdeasListContext);
        } catch (err) {
            console.error("Image upload failed", err);
            setError("Failed to upload image.");
        } finally {
            setUploadTargetShot(null);
            if (imageUploadInputRef.current) {
                imageUploadInputRef.current.value = ''; // Reset input
            }
        }
    };

    const triggerImageUpload = (shotNumber: number) => {
        setUploadTargetShot(shotNumber);
        imageUploadInputRef.current?.click();
    };
    
    const handleDownloadImage = (base64: string, filename: string) => {
        const link = document.createElement('a');
        link.href = `data:image/jpeg;base64,${base64}`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSaveList = () => {
        if (!project?.shotIdeasList || !project.shotIdeasListContext) return;
        const newShotList: SavedShotList = {
            id: Date.now().toString(),
            name: newSaveName.trim() || `Shot List ${new Date().toLocaleDateString()}`,
            createdAt: new Date().toISOString(),
            script: script,
            config: config,
            shots: project.shotIdeasList,
            context: project.shotIdeasListContext
        };

        const updatedLists = [...savedLists, newShotList];
        onUpdateSavedShotLists(updatedLists);
        setIsSaveModalOpen(false);
        setNewSaveName('');
        setSelectedListId(newShotList.id);
    };

    const handleLoadList = (listId: string) => {
        const listToLoad = savedLists.find(list => list.id === listId);
        if (listToLoad) {
            setSelectedListId(listId);
            onUpdateScript(listToLoad.script);
            setScript(listToLoad.script);
            onUpdateConfig(listToLoad.config);
            onUpdateShotIdeas(listToLoad.shots, listToLoad.context);
        } else {
            setSelectedListId('');
        }
    };

    const handleDeleteList = (e: React.MouseEvent, listId: string) => {
        e.stopPropagation();
        if(window.confirm("Are you sure you want to delete this saved shot list?")) {
            const updatedLists = savedLists.filter(list => list.id !== listId);
            onUpdateSavedShotLists(updatedLists);
            if (selectedListId === listId) {
                setSelectedListId('');
                onUpdateShotIdeas(null);
            }
        }
    }


    const renderClickableError = (text: string | null) => {
        if (!text) return null;
        const urlRegex = /(https?:\/\/[^\s.,;?!()"'<>[\]{}]+)/g;
        const parts = text.split(urlRegex);
    
        return (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">
              {parts.map((part, index) => {
                if (part.match(urlRegex)) {
                  let linkText = 'Learn More';
                  if (part.includes('rate-limits')) linkText = 'About Rate Limits';
                  else if (part.includes('usage')) linkText = 'Monitor Usage';
                  else if (part.includes('billing')) linkText = 'Billing Information';
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

    const ShotDetail: React.FC<{ label: string; content: string }> = ({ label, content }) => (
        <div>
            <h4 className="font-semibold text-accent mb-1">{label}</h4>
            <p className="text-text-secondary text-sm">{content}</p>
        </div>
    );

    return (
        <div className="flex flex-col gap-6">
             <input
                type="file"
                ref={imageUploadInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUploadForShot}
                disabled={isReadOnly}
            />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-display font-bold mb-2">Shot Idea Studio</h2>
                    <p className="text-text-secondary">
                        Generate a professional, visualized shot list from a script scene.
                    </p>
                </div>
                {!isReadOnly && savedLists.length > 0 && (
                    <div className="w-full sm:w-auto">
                        <select
                            value={selectedListId}
                            onChange={(e) => handleLoadList(e.target.value)}
                            className="w-full p-2 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent text-sm"
                        >
                            <option value="">Load a saved shot list...</option>
                            {savedLists.map(list => (
                                <option key={list.id} value={list.id}>{list.name}</option>
                            ))}
                        </select>
                         {selectedListId && (
                            <div className="mt-1 text-right">
                                <button 
                                    onClick={(e) => handleDeleteList(e, selectedListId)}
                                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 justify-end w-full"
                                >
                                    <TrashIcon className="w-3 h-3" /> Delete Selected List
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {renderClickableError(error)}
            
            <div className="flex flex-col gap-4">
                 <textarea
                    value={script}
                    onChange={(e) => {
                        setScript(e.target.value);
                        onUpdateScript(e.target.value);
                    }}
                    placeholder={'Paste a script scene here...'}
                    className="w-full h-48 p-4 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent focus:border-accent transition-colors duration-200 resize-y"
                    disabled={isLoading || isReadOnly}
                    readOnly={isReadOnly}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div>
                        <label htmlFor="genre-select" className="block text-sm font-medium text-text-secondary mb-1">Genre</label>
                        <select
                            id="genre-select"
                            value={config.genre}
                            onChange={(e) => handleConfigChange('genre', e.target.value)}
                            className="w-full p-2 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent"
                            disabled={isLoading || isReadOnly}
                        >
                            <option value="">Select a genre...</option>
                            {genres.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="style-select" className="block text-sm font-medium text-text-secondary mb-1">Artistic Style</label>
                        <select
                            id="style-select"
                            value={config.artisticStyle}
                            onChange={(e) => handleConfigChange('artisticStyle', e.target.value)}
                            className="w-full p-2 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent"
                            disabled={isLoading || isReadOnly}
                        >
                            <option value="">Default (AI choice)</option>
                            {artisticStyles.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="location-input" className="block text-sm font-medium text-text-secondary mb-1">Location / Region</label>
                        <input
                            id="location-input"
                            type="text"
                            value={config.location}
                            onChange={(e) => handleConfigChange('location', e.target.value)}
                            placeholder="e.g., Tokyo, Japan"
                            className="w-full p-2 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent"
                            disabled={isLoading || isReadOnly}
                        />
                    </div>
                     <div>
                        <label htmlFor="race-select" className="block text-sm font-medium text-text-secondary mb-1">Character Race (Optional)</label>
                        <select
                            id="race-select"
                            value={config.characterRace}
                            onChange={(e) => handleConfigChange('characterRace', e.target.value)}
                            className="w-full p-2 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent"
                            disabled={isLoading || isReadOnly}
                        >
                            {races.map(r => <option key={r} value={r === 'Unspecified' ? '' : r}>{r}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="skin-tone-select" className="block text-sm font-medium text-text-secondary mb-1">Character Skin Tone (Optional)</label>
                        <select
                            id="skin-tone-select"
                            value={config.skinTone}
                            onChange={(e) => handleConfigChange('skinTone', e.target.value)}
                            className="w-full p-2 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent"
                            disabled={isLoading || isReadOnly}
                        >
                             {skinTones.map(s => <option key={s} value={s === 'Unspecified' ? '' : s}>{s}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-end items-center gap-4">
                    {project?.shotIdeasList && project.shotIdeasList.length > 0 && project.shotIdeasListContext && !isReadOnly && (
                        <>
                             <button
                                onClick={() => setIsSaveModalOpen(true)}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-bg-secondary text-text-primary font-semibold rounded-lg border-2 border-border-color hover:bg-border-color transition-colors"
                             >
                                <SaveIcon className="w-5 h-5" />
                                <span>Save Shot List</span>
                             </button>
                        </>
                    )}
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || isReadOnly}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-accent to-blue-500 text-white font-bold rounded-lg shadow-lg shadow-accent/20 hover:shadow-accent-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
                    >
                        {isLoading ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <ClapperboardIcon className="w-5 h-5" />}
                        <span>{isLoading ? 'Generating...' : 'Generate Shot List'}</span>
                    </button>
                </div>
            </div>

            {/* Output Panel */}
            <div className="flex flex-col gap-8 items-center justify-center bg-bg-secondary rounded-lg p-4 min-h-[400px] border border-border-color">
                {isLoading && (
                    <div className="text-center">
                        <SpinnerIcon className="w-12 h-12 text-accent animate-spin" />
                        <p className="mt-4 text-lg font-semibold">Generating cinematic ideas and visuals...</p>
                        <p className="text-text-secondary">This may take a moment.</p>
                    </div>
                )}
                
                {!isLoading && project?.shotIdeasList && project.shotIdeasList.length > 0 && (
                    <div className="w-full space-y-8">
                        {project.shotIdeasList.map((shot) => (
                            <div key={shot.shot_number} className="bg-surface p-4 sm:p-6 rounded-lg shadow-lg grid grid-cols-1 lg:grid-cols-1 gap-6 border border-border-color">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-4">
                                        <h3 className="text-xl font-display font-bold text-accent">{`Shot ${shot.shot_number}: ${shot.shot_type}`}</h3>
                                        <p className="text-text-secondary italic text-sm">{shot.description}</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <ShotDetail label="Composition & Framing" content={shot.composition_and_framing} />
                                            <ShotDetail label="Lighting" content={shot.lighting} />
                                            <ShotDetail label="Blocking" content={shot.blocking} />
                                            <ShotDetail label="Art Design" content={shot.art_design} />
                                            <ShotDetail label="Costume & Makeup" content={shot.costume_and_makeup} />
                                        </div>
                                    </div>
                                    <div>
                                        {shot.image_base64 ? (
                                            <div className="flex flex-col gap-2">
                                                <div className="relative group">
                                                    <img 
                                                        src={`data:image/jpeg;base64,${shot.image_base64}`} 
                                                        alt={`Visualization for shot ${shot.shot_number}`}
                                                        className="w-full h-auto object-contain rounded-md aspect-video"
                                                    />
                                                    {!isReadOnly && (
                                                        <div
                                                            onClick={() => triggerImageUpload(shot.shot_number)}
                                                            className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer rounded-md"
                                                            role="button"
                                                            aria-label="Replace image for this shot"
                                                        >
                                                            <ReplaceIcon className="w-10 h-10 mb-2" />
                                                            <span className="font-semibold">Replace Image</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <button 
                                                    onClick={() => handleDownloadImage(shot.image_base64!, `Shot_${shot.shot_number}_${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`)}
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-bg-secondary hover:bg-surface border border-border-color text-text-primary font-medium rounded-lg transition-colors duration-200 text-sm"
                                                    title="Save image to disk"
                                                >
                                                    <DownloadIcon className="w-4 h-4" />
                                                    <span>Save Image</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <div
                                                onClick={() => !isReadOnly && triggerImageUpload(shot.shot_number)}
                                                className={`w-full aspect-video bg-bg-primary rounded-md flex flex-col items-center justify-center text-text-secondary border-2 border-dashed border-border-color ${!isReadOnly ? 'cursor-pointer hover:border-accent hover:text-accent transition-colors' : ''}`}
                                                role={!isReadOnly ? "button" : undefined}
                                                aria-label={!isReadOnly ? "Upload image for this shot" : undefined}
                                            >
                                                <UploadIcon className="w-10 h-10 mb-2" />
                                                <p className="text-sm font-semibold">Upload Image</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="lg:col-span-2">
                                    <CollapsiblePrompt 
                                        shot={shot} 
                                        context={project.shotIdeasListContext}
                                        onSendToImageStudio={onSendToImageStudio}
                                        isReadOnly={isReadOnly}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {!isLoading && (!project?.shotIdeasList || project.shotIdeasList.length === 0) && !error && (
                    <div className="text-center text-text-secondary">
                        <p className="font-semibold text-lg">Your visualized shot list will appear here.</p>
                        <p>Paste a scene above and click Generate.</p>
                    </div>
                )}
            </div>
             {isImageChoiceModalOpen && (
                <ShotIdeaImageChoiceModal
                    onGenerateWithImages={() => executeGeneration(true)}
                    onGenerateWithoutImages={() => executeGeneration(false)}
                    onClose={() => setIsImageChoiceModalOpen(false)}
                />
            )}
            
            {/* Save List Modal */}
            {isSaveModalOpen && (
                <div 
                    className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm"
                    onClick={() => setIsSaveModalOpen(false)}
                >
                    <div 
                        className="bg-surface w-full max-w-md rounded-xl shadow-2xl border border-border-color p-6 flex flex-col gap-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-2xl font-display font-bold">Save Shot List</h2>
                        <p className="text-text-secondary">Give this shot list a name to easily find it later.</p>
                        <input
                            type="text"
                            value={newSaveName}
                            onChange={(e) => setNewSaveName(e.target.value)}
                            placeholder="e.g., Opening Scene V1"
                            className="w-full p-3 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent"
                            autoFocus
                        />
                         <div className="flex justify-end gap-3 mt-2">
                            <button 
                                onClick={() => setIsSaveModalOpen(false)}
                                className="px-6 py-2 bg-bg-secondary text-text-primary font-semibold rounded-lg transition-colors hover:bg-border-color border border-border-color"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSaveList}
                                disabled={!newSaveName.trim()}
                                className="px-6 py-2 bg-accent hover:bg-accent/80 text-bg-primary font-bold rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShotIdeaStudio;
