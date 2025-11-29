import React, { useState, useCallback, useRef, useEffect } from 'react';
import { EyeIcon, MagicWandIcon, SparklesIcon, SpinnerIcon, UploadIcon, PlusIcon, XIcon } from './icons';
import { analyzeImage, editImage, generateImageFromText } from '../services/geminiService';
import { Project, Stage2Result, PersistedImage, ImageStudioState } from '../types';


const genres = [
    'Action', 'Adventure', 'Comedy', 'Crime', 'Drama', 'Fantasy', 
    'Historical', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 
    'Thriller', 'Western', 'Film Noir'
];

const artisticStyles = [
    'Cinematic Realism', 'Film Noir', 'Anime / Manga', 'Studio Ghibli Style',
    'Pixar Animation Style', 'Classic Disney Animation', 'Lo-Fi Anime', 'Cyberpunk / Neon-Noir',
    'Steampunk', 'Impressionistic Painting', 'Graphic Novel / Comic Book', 'Black and White Sketch',
];

const shotTypes = [
    'Establishing Shot', 'Extreme Wide Shot', 'Wide Shot', 'Full Shot', 'Medium Wide Shot', 
    'Cowboy Shot', 'Medium Shot', 'Medium Close-Up', 'Close-Up', 'Extreme Close-Up', 
    'Insert Shot', 'Dutch Angle', 'Over-the-Shoulder Shot', 'Point of View (POV)', 
    'Low-Angle Shot', 'High-Angle Shot', "Bird's-Eye View", "Worm's-Eye View"
];

const aspectRatios: { [key: string]: string } = {
    '16:9': '16:9 (Widescreen)',
    '1:1': '1:1 (Square)',
    '3:4': '3:4 (Portrait)',
    '4:3': '4:3 (Standard)',
    '9:16': '9:16 (Vertical)'
};

const races = [
    'Unspecified', 'African', 'Asian', 'Caucasian', 'Hispanic/Latin', 
    'Middle Eastern', 'Native American', 'Pacific Islander'
];

const skinTones = [
    'Unspecified', 'Very Light', 'Light', 'Medium', 'Tan', 
    'Brown', 'Dark Brown', 'Very Dark'
];


const fileToPersistedImage = (file: File): Promise<PersistedImage> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            resolve({ name: file.name, type: file.type, base64, dataUrl });
        };
        reader.onerror = error => reject(error);
    });
};

interface ImageStudioProps {
    project: Project | null;
    onUpdateStage2Data: (newData: Stage2Result) => void;
    onUpdateState: (state: ImageStudioState) => void;
    isReadOnly: boolean;
}


const ImageStudio: React.FC<ImageStudioProps> = ({ project, onUpdateStage2Data, onUpdateState, isReadOnly }) => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const characterFileInputRef = useRef<HTMLInputElement>(null);
    const locationFileInputRef = useRef<HTMLInputElement>(null);
    const characterSelectRef = useRef<HTMLSelectElement>(null);
    
    // Get state from project prop, with a fallback for a new project
    const state: ImageStudioState = project?.imageStudioState || {
        mode: 'generate',
        prompt: '',
        sourceImage: null,
        characterReferenceImage: null,
        locationReferenceImage: null,
        resultImageBase64: null,
        analysisText: null,
        isContinuation: false,
        continuationSourceImage: null,
        characterSelect: '',
        config: { genre: '', artisticStyle: '', shotType: '', location: '', characterRace: '', skinTone: '', aspectRatio: '16:9' }
    };

    const stage2Data = project?.stage2Result;
    const charactersWithPortraits = stage2Data?.character_profiles.filter(c => c.image_base64) || [];

    // Update state via the onUpdateState prop
    const updateState = (newState: Partial<ImageStudioState>) => {
        onUpdateState({ ...state, ...newState });
    };

    const handleConfigChange = (field: keyof ImageStudioState['config'], value: string) => {
        updateState({ config: { ...state.config, [field]: value } });
    };

    const handleFile = useCallback(async (file: File | null) => {
        if (!file) return;
        setError(null);
        
        try {
            const persistedImage = await fileToPersistedImage(file);
            updateState({
                sourceImage: persistedImage,
                characterReferenceImage: null,
                locationReferenceImage: null,
                resultImageBase64: null,
                analysisText: null,
                isContinuation: false,
                continuationSourceImage: null,
                mode: 'edit'
            });
        } catch (err) {
            console.error(err);
            setError('Failed to read the image file.');
        }
    }, [onUpdateState]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleFile(e.target.files?.[0] ?? null);
    };
    
    const handleCharacterSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const characterName = e.target.value;
        if (!characterName) {
            updateState({ characterReferenceImage: null });
            return;
        }

        const character = charactersWithPortraits.find(c => c.name === characterName);
        if (character && character.image_base64) {
            const persistedImage: PersistedImage = {
                name: `${character.name}_portrait.jpg`,
                type: 'image/jpeg', // Assuming jpeg from generation
                base64: character.image_base64,
                dataUrl: `data:image/jpeg;base64,${character.image_base64}`
            };
            updateState({ characterReferenceImage: persistedImage });

            if (characterFileInputRef.current) {
                characterFileInputRef.current.value = '';
            }
        }
    };

    const handleReferenceFile = useCallback(async (file: File | null, type: 'character' | 'location') => {
        if (!file) return;
        setError(null);
        try {
            const persistedImage = await fileToPersistedImage(file);
            if (type === 'character') {
                updateState({ characterReferenceImage: persistedImage });
                if (characterSelectRef.current) {
                    characterSelectRef.current.value = '';
                }
            } else {
                updateState({ locationReferenceImage: persistedImage });
            }
        } catch (err) {
            console.error(err);
            setError(`Failed to read the ${type} reference image.`);
        }
    }, [onUpdateState]);

    const handleCharacterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleReferenceFile(e.target.files?.[0] ?? null, 'character');
    };

    const handleLocationFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        handleReferenceFile(e.target.files?.[0] ?? null, 'location');
    };

    const clearCharacterReference = () => {
        updateState({ characterReferenceImage: null });
        if (characterFileInputRef.current) {
            characterFileInputRef.current.value = '';
        }
        if (characterSelectRef.current) {
            characterSelectRef.current.value = '';
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { if (isReadOnly) return; e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { if (isReadOnly) return; e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { if (isReadOnly) return; e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        if (isReadOnly) return;
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) {
            handleFile(file);
        } else {
            setError("Invalid file type. Please drop an image file.");
        }
    };

    const handleModeChange = (newMode: ImageStudioState['mode']) => {
        if (newMode !== 'generate') {
            updateState({ mode: newMode, isContinuation: false, continuationSourceImage: null, characterReferenceImage: null, locationReferenceImage: null });
        } else {
            updateState({ mode: newMode });
        }
    };

    const handleSubmit = async () => {
        if (state.mode !== 'generate' && !state.sourceImage) {
            setError('Please upload an image first for Edit or Analyze mode.');
            return;
        }
        if (!state.prompt) {
             setError('Please enter a prompt.');
            return;
        }

        setIsLoading(true);
        setError(null);
        updateState({ resultImageBase64: null, analysisText: null });

        try {
            if (state.mode === 'generate') {
                const hasReferenceImages = !!state.characterReferenceImage || !!state.locationReferenceImage;
                let newImageBase64;

                if (hasReferenceImages) {
                    newImageBase64 = await generateImageFromText(
                        state.prompt,
                        state.characterReferenceImage ? { base64: state.characterReferenceImage.base64, mimeType: state.characterReferenceImage.type } : undefined,
                        state.locationReferenceImage ? { base64: state.locationReferenceImage.base64, mimeType: state.locationReferenceImage.type } : undefined,
                    );
                    updateState({ continuationSourceImage: null, isContinuation: false, resultImageBase64: newImageBase64 });
                } else {
                    const promptParts = [state.prompt];
                    const { config } = state;

                    if (config.genre) promptParts.push(config.genre);
                    if (config.artisticStyle) promptParts.push(config.artisticStyle);
                    if (config.shotType) promptParts.push(config.shotType);
                    if (config.location) promptParts.push(`set in ${config.location}`);

                    const characterDetails = [];
                    if (config.characterRace && config.characterRace !== 'Unspecified') characterDetails.push(config.characterRace);
                    if (config.skinTone && config.skinTone !== 'Unspecified') characterDetails.push(`${config.skinTone} skin tone`);
                    if (characterDetails.length > 0) promptParts.push(`character with ${characterDetails.join(', ')}`);
                    
                    promptParts.push('cinematic lighting', 'high detail', 'film still');
                    
                    const finalPrompt = promptParts.join(', ');

                    newImageBase64 = await generateImageFromText(finalPrompt, undefined, undefined, state.config.aspectRatio);
                    updateState({ continuationSourceImage: newImageBase64, resultImageBase64: newImageBase64 });
                }
            } else if (state.mode === 'edit' && state.sourceImage) {
                const newImageBase64 = await editImage(state.sourceImage.base64, state.sourceImage.type, state.prompt);
                updateState({ resultImageBase64: newImageBase64, isContinuation: false, continuationSourceImage: null });
            } else if (state.mode === 'analyze' && state.sourceImage) {
                const analysisResult = await analyzeImage(state.sourceImage.base64, state.sourceImage.type, state.prompt);
                updateState({ analysisText: analysisResult, isContinuation: false, continuationSourceImage: null });
            }
        } catch (err) {
            console.error(err);
            let errorMessage = 'An unknown error occurred.';
            if (err instanceof Error) {
                 if (err.message.includes('429')) errorMessage = "API quota exceeded. Please check your plan and billing details.";
                 else if (err.message.includes('503')) errorMessage = "The AI model is currently experiencing high demand. Please try again.";
                 else errorMessage = err.message;
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleUseAsConceptArt = () => {
        if (!state.resultImageBase64 || !stage2Data) return;
        onUpdateStage2Data({ ...stage2Data, concept_art_base64: state.resultImageBase64 });
    };

    const handleUseForCharacter = () => {
        if (!state.resultImageBase64 || !stage2Data || !state.characterSelect) return;
        const updatedProfiles = stage2Data.character_profiles.map(p => 
            p.name === state.characterSelect ? { ...p, image_base64: state.resultImageBase64 } : p
        );
        onUpdateStage2Data({ ...stage2Data, character_profiles: updatedProfiles });
    };
    
    const handleAddToVisualStyle = () => {
        if (!state.resultImageBase64 || !stage2Data) return;
        const currentImages = stage2Data.visual_style_images_base64 || [];
        onUpdateStage2Data({
            ...stage2Data,
            visual_style_images_base64: [...currentImages, state.resultImageBase64]
        });
    };

    const renderInputArea = () => {
        if (state.mode === 'generate' && !state.sourceImage) {
            return (
                <div className="flex flex-col gap-4">
                    <textarea value={state.prompt} onChange={(e) => updateState({ prompt: e.target.value })} placeholder={'e.g., A lone detective standing on a rain-slicked city street at night, neon signs reflecting in the puddles.'} className="w-full h-24 p-4 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent" disabled={isLoading || isReadOnly} readOnly={isReadOnly} />
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="block text-sm font-medium text-text-secondary">Character/Object Reference</label>
                            
                            <select
                                ref={characterSelectRef}
                                onChange={handleCharacterSelect}
                                className="w-full p-2 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent"
                                disabled={isLoading || charactersWithPortraits.length === 0 || isReadOnly}
                                aria-label="Select Project Character"
                            >
                                <option value="">Select Project Character...</option>
                                {charactersWithPortraits.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                            </select>

                            <div className="flex items-center gap-2">
                                <hr className="flex-grow border-border-color" />
                                <span className="text-xs text-text-secondary">OR</span>
                                <hr className="flex-grow border-border-color" />
                            </div>
                            
                            <button 
                                onClick={() => characterFileInputRef.current?.click()}
                                className="w-full flex items-center justify-center gap-2 p-2 bg-bg-secondary text-text-primary font-semibold rounded-lg transition-colors duration-200 border-2 border-border-color hover:bg-border-color"
                                disabled={isLoading || isReadOnly}
                            >
                                <UploadIcon className="w-4 h-4" />
                                <span>Upload Custom</span>
                            </button>
                            <input ref={characterFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCharacterFileChange} disabled={isReadOnly} />

                            {state.characterReferenceImage && (
                                <div className="relative w-28 h-28 mt-2">
                                    <img src={state.characterReferenceImage.dataUrl} alt="Character Reference" className="rounded-lg w-full h-full object-cover" />
                                    {!isReadOnly && <button onClick={clearCharacterReference} className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-500"> <XIcon className="w-4 h-4" /> </button>}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Location & Background</label>
                            {state.locationReferenceImage ? (
                                <div className="relative w-28 h-28">
                                    <img src={state.locationReferenceImage.dataUrl} alt="Location Reference" className="rounded-lg w-full h-full object-cover" />
                                    {!isReadOnly && <button onClick={() => { updateState({ locationReferenceImage: null }); if (locationFileInputRef.current) locationFileInputRef.current.value = ''; }} className="absolute -top-2 -right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-500"><XIcon className="w-4 h-4" /></button>}
                                </div>
                            ) : (
                                <button onClick={() => locationFileInputRef.current?.click()} disabled={isReadOnly} className="flex items-center justify-center w-28 h-28 bg-bg-secondary border-2 border-dashed border-border-color rounded-lg hover:border-accent text-text-secondary hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed"><PlusIcon className="w-8 h-8"/></button>
                            )}
                            <input ref={locationFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLocationFileChange} disabled={isReadOnly} />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Genre</label>
                            <select value={state.config.genre} onChange={(e) => handleConfigChange('genre', e.target.value)} className="w-full p-2 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent" disabled={isLoading || isReadOnly}>
                                <option value="">Default</option>
                                {genres.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Artistic Style</label>
                            <select value={state.config.artisticStyle} onChange={(e) => handleConfigChange('artisticStyle', e.target.value)} className="w-full p-2 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent" disabled={isLoading || isReadOnly}>
                                <option value="">Default</option>
                                {artisticStyles.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Shot Type</label>
                            <select value={state.config.shotType} onChange={(e) => handleConfigChange('shotType', e.target.value)} className="w-full p-2 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent" disabled={isLoading || isReadOnly}>
                                <option value="">Default</option>
                                {shotTypes.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Location / Region</label>
                            <input type="text" value={state.config.location} onChange={(e) => handleConfigChange('location', e.target.value)} placeholder="e.g., Tokyo, Japan" className="w-full p-2 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent" disabled={isLoading || isReadOnly} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Character Race</label>
                            <select value={state.config.characterRace} onChange={(e) => handleConfigChange('characterRace', e.target.value)} className="w-full p-2 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent" disabled={isLoading || isReadOnly}>
                                {races.map(r => <option key={r} value={r === 'Unspecified' ? '' : r}>{r}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Character Skin Tone</label>
                            <select value={state.config.skinTone} onChange={(e) => handleConfigChange('skinTone', e.target.value)} className="w-full p-2 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent" disabled={isLoading || isReadOnly}>
                                {skinTones.map(s => <option key={s} value={s === 'Unspecified' ? '' : s}>{s}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Aspect Ratio</label>
                            <select value={state.config.aspectRatio || '16:9'} onChange={(e) => handleConfigChange('aspectRatio', e.target.value)} className="w-full p-2 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent" disabled={isLoading || !!state.characterReferenceImage || !!state.locationReferenceImage || isReadOnly}>
                                {Object.entries(aspectRatios).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                            </select>
                        </div>
                    </div>
                    {!isReadOnly && (
                        <div className="text-center text-sm text-text-secondary mt-2">
                            or <button type="button" onClick={() => fileInputRef.current?.click()} className="text-accent hover:underline font-semibold">upload an image</button> to switch to Edit mode.
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        </div>
                    )}
                </div>
            );
        }

        if (state.sourceImage) {
            return (
                <div className="relative">
                    <img src={state.sourceImage.dataUrl} alt="Source" className="rounded-lg w-full h-auto object-contain" />
                    {!isReadOnly && <button onClick={() => { updateState({ sourceImage: null, mode: 'generate' }); if (fileInputRef.current) { fileInputRef.current.value = ''; } }} className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/60 text-white text-xs font-semibold rounded-md hover:bg-black/80 transition-colors"><UploadIcon className="w-4 h-4" />Change</button>}
                </div>
            );
        }

        return (
             <div onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop} onClick={() => !isReadOnly && fileInputRef.current?.click()} className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-colors ${isDragging ? 'border-accent bg-accent/10' : 'border-border-color'} ${!isReadOnly && 'hover:border-accent cursor-pointer'}`}>
                <UploadIcon className="w-12 h-12 text-text-secondary" />
                <p className="mt-2 text-lg font-semibold text-text-primary">Drop an image to edit/analyze</p>
                <p className="text-sm text-text-secondary">or click to browse</p>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isReadOnly} />
            </div>
        );
    };

    const hasReferenceImages = !!state.characterReferenceImage || !!state.locationReferenceImage;

    return (
        <div className="flex flex-col gap-6">
            <div><h2 className="text-2xl font-display font-bold mb-2">Image Studio</h2><p className="text-text-secondary">Generate new visual concepts, edit existing images, or analyze their content.</p></div>
            {error && <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg" role="alert">{error}</div>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="flex flex-col gap-4">
                    {renderInputArea()}
                    <div className="bg-bg-secondary rounded-lg p-1 flex border border-border-color">
                        <button onClick={() => !isReadOnly && handleModeChange('generate')} disabled={isReadOnly} className={`w-1/3 px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${state.mode === 'generate' ? 'bg-accent text-bg-primary' : 'text-text-secondary hover:bg-surface'}`}><SparklesIcon className="w-5 h-5" /> Generate</button>
                        <button onClick={() => !isReadOnly && handleModeChange('edit')} disabled={isReadOnly} className={`w-1/3 px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${state.mode === 'edit' ? 'bg-accent text-bg-primary' : 'text-text-secondary hover:bg-surface'}`}><MagicWandIcon className="w-5 h-5" /> Edit</button>
                        <button onClick={() => !isReadOnly && handleModeChange('analyze')} disabled={isReadOnly} className={`w-1/3 px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${state.mode === 'analyze' ? 'bg-accent text-bg-primary' : 'text-text-secondary hover:bg-surface'}`}><EyeIcon className="w-5 h-5"/> Analyze</button>
                    </div>
                    
                    {state.mode !== 'generate' && (<textarea value={state.prompt} onChange={(e) => updateState({ prompt: e.target.value })} placeholder={state.mode === 'edit' ? 'Describe the edits you want to make...' : 'What do you want to know about this image?'} className="w-full h-24 p-4 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent" disabled={isLoading || isReadOnly} readOnly={isReadOnly}/>)}
                    
                    {state.mode === 'generate' && state.continuationSourceImage && !hasReferenceImages && (
                         <div className="flex items-center gap-2 p-2 bg-bg-secondary rounded-lg">
                            <input type="checkbox" id="continuation-checkbox" checked={state.isContinuation} onChange={(e) => updateState({ isContinuation: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" disabled={isReadOnly} />
                            <label htmlFor="continuation-checkbox" className="text-sm font-medium text-text-primary">Next Scene Continuation</label>
                        </div>
                    )}

                    <button onClick={handleSubmit} disabled={isLoading || isReadOnly || (state.mode !== 'generate' && !state.sourceImage)} className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-accent to-blue-500 text-white font-bold rounded-lg shadow-lg shadow-accent/20 hover:shadow-accent-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                        {isLoading ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : (
                            state.mode === 'generate' ? <SparklesIcon className="w-5 h-5" /> :
                            state.mode === 'edit' ? <MagicWandIcon className="w-5 h-5" /> :
                            <EyeIcon className="w-5 h-5" />
                        )}
                        <span>
                            {isLoading ? 'Processing...' :
                            state.mode === 'generate' ? 'Generate Image' :
                            state.mode === 'edit' ? 'Apply Edits' :
                            'Analyze Image'
                            }
                        </span>
                    </button>
                </div>

                <div className="flex flex-col gap-4 items-center justify-center bg-bg-secondary rounded-lg p-4 min-h-[400px] border border-border-color">
                    {isLoading && <SpinnerIcon className="w-12 h-12 text-accent animate-spin" />}
                    
                    {!isLoading && state.resultImageBase64 && (state.mode === 'edit' || state.mode === 'generate') && (
                        <>
                            <img src={`data:image/jpeg;base64,${state.resultImageBase64}`} alt="Generated" className="rounded-lg w-full h-auto object-contain" />
                            {stage2Data && !isReadOnly && (
                                <div className="w-full bg-surface p-3 mt-4 rounded-lg flex flex-col sm:flex-row items-center gap-2 border border-border-color">
                                    <button onClick={handleUseAsConceptArt} className="flex-1 text-sm bg-bg-secondary hover:bg-border-color text-text-primary font-semibold py-2 px-3 rounded-md transition-colors border border-border-color">Use as Concept Art</button>
                                    <div className="flex-1 flex gap-2 w-full sm:w-auto">
                                        <select onChange={(e) => updateState({ characterSelect: e.target.value })} value={state.characterSelect} className="flex-grow w-full p-2 text-sm bg-bg-secondary border border-border-color rounded-md">
                                            <option value="">Select Character</option>
                                            {stage2Data.character_profiles.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                        </select>
                                        <button onClick={handleUseForCharacter} disabled={!state.characterSelect} className="text-sm bg-bg-secondary hover:bg-border-color text-text-primary font-semibold py-2 px-3 rounded-md transition-colors border border-border-color disabled:opacity-50">Set</button>
                                    </div>
                                    <button onClick={handleAddToVisualStyle} className="flex-1 text-sm bg-bg-secondary hover:bg-border-color text-text-primary font-semibold py-2 px-3 rounded-md transition-colors border border-border-color">Add to Visual Style</button>
                                </div>
                            )}
                        </>
                    )}
                    
                    {!isLoading && state.analysisText && state.mode === 'analyze' && (<div className="text-text-secondary whitespace-pre-wrap w-full h-full overflow-y-auto p-4 bg-bg-primary rounded-lg">{state.analysisText}</div>)}
                    
                    {!isLoading && !state.resultImageBase64 && !state.analysisText && (<div className="text-center text-text-secondary"><p className="font-semibold text-lg">Your result will appear here.</p><p>Configure your prompt and click generate.</p></div>)}
                </div>
            </div>
        </div>
    );
};

export default ImageStudio;