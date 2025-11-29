import React, { useRef, useState } from 'react';
import { Project, Stage2Result } from '../types';
import { ReplaceIcon, UploadIcon, StarIcon, TrashIcon } from './icons';

interface HandsOnDeckProps {
    project: Project | null;
    onUpdateStage2Data: (newData: Stage2Result) => void;
}

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

// A small, reusable control for uploading/removing background images
const BackgroundControls: React.FC<{ onUpload: (file: File) => void; onRemove?: () => void }> = ({ onUpload, onRemove }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            onUpload(e.target.files[0]);
            e.target.value = ''; // Reset input
        }
    };

    return (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity duration-300">
            <button 
                onClick={() => inputRef.current?.click()} 
                className="p-2 bg-surface/80 rounded-full text-text-secondary hover:text-accent hover:bg-surface"
                aria-label="Upload background image"
                title="Upload background image"
            >
                <UploadIcon className="w-5 h-5" />
            </button>
            {onRemove && (
                 <button 
                    onClick={onRemove} 
                    className="p-2 bg-surface/80 rounded-full text-text-secondary hover:text-red-400 hover:bg-surface"
                    aria-label="Remove background image"
                    title="Remove background image"
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            )}
            <input type="file" ref={inputRef} accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
    );
};

// A new, more powerful Slide component that handles backgrounds
const Slide: React.FC<{ 
    children: React.ReactNode; 
    className?: string; 
    backgroundImage?: string;
    onUpload: (file: File) => void;
    onRemove?: () => void;
}> = ({ children, className = '', backgroundImage, onUpload, onRemove }) => (
    <div className={`w-full aspect-video bg-bg-secondary rounded-xl shadow-lg border border-border-color/50 flex flex-col items-center justify-center p-8 sm:p-12 md:p-16 relative overflow-hidden ${className}`}>
        {backgroundImage && (
            <>
                <img 
                    src={`data:image/jpeg;base64,${backgroundImage}`}
                    alt="Slide background"
                    className="absolute inset-0 w-full h-full object-cover -z-20"
                />
                <div className="absolute inset-0 bg-bg-primary/60 backdrop-blur-sm -z-10" />
            </>
        )}
        <BackgroundControls onUpload={onUpload} onRemove={backgroundImage ? onRemove : undefined} />
        <div className="relative z-0 w-full h-full flex flex-col items-center justify-center">
            {children}
        </div>
    </div>
);


// This uploader is now only for CONTENT images (like character portraits), not backgrounds
interface ImageUploaderProps {
    onImageUpload: (base64: string) => void;
    children: React.ReactNode;
    isEmpty?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, children, isEmpty = false }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const base64 = await fileToBase64(file);
            onImageUpload(base64);
        } catch (error) {
            console.error("Failed to convert image to base64", error);
        }
    };
    
    if (isEmpty) {
        return (
            <div onClick={() => inputRef.current?.click()} className="w-full h-full bg-bg-primary border-2 border-dashed border-border-color rounded-lg flex flex-col items-center justify-center text-text-secondary hover:bg-surface hover:border-accent cursor-pointer transition-colors">
                <UploadIcon className="w-12 h-12 mb-2" />
                <span className="text-lg font-semibold text-center">Add Image</span>
                <input ref={inputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
        )
    }

    return (
        <div className="relative group w-full h-full">
            {children}
            <div onClick={() => inputRef.current?.click()} className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer rounded-lg">
                <ReplaceIcon className="w-10 h-10 mb-2" />
                <span className="font-semibold">Replace Image</span>
            </div>
            <input ref={inputRef} type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
        </div>
    );
};


const HandsOnDeck: React.FC<HandsOnDeckProps> = ({ project, onUpdateStage2Data }) => {
    
    const stage1Data = project?.stage1Result;
    const stage2Data = project?.stage2Result;

    // State for slide backgrounds. Initialize title slide with project's concept art.
    const [backgrounds, setBackgrounds] = useState<{ [key: string]: string | undefined }>({
        title: stage2Data?.concept_art_base64
    });

    if (!project || !stage1Data || !stage2Data) {
        return (
            <div className="text-center p-8 flex flex-col items-center gap-4 text-text-secondary">
                <h2 className="text-2xl font-display font-bold text-text-primary">Hands on Deck</h2>
                <p>Complete a script analysis to generate a professional pitch deck here.</p>
            </div>
        );
    }
    
    const handleBackgroundUpload = async (slideId: string, file: File) => {
        const base64 = await fileToBase64(file);
        setBackgrounds(prev => ({ ...prev, [slideId]: base64 }));

        // If it's the title slide, also update the main project data
        if (slideId === 'title') {
            onUpdateStage2Data({ ...stage2Data, concept_art_base64: base64 });
        }
    };
    
    const handleBackgroundRemove = (slideId: string) => {
        setBackgrounds(prev => {
            const newBgs = { ...prev };
            delete newBgs[slideId];
            return newBgs;
        });

        if (slideId === 'title') {
            onUpdateStage2Data({ ...stage2Data, concept_art_base64: undefined });
        }
    };

    const handleCharacterImageChange = (base64: string, characterName: string) => {
        const updatedProfiles = stage2Data.character_profiles.map(profile => 
            profile.name === characterName ? { ...profile, image_base64: base64 } : profile
        );
        onUpdateStage2Data({ ...stage2Data, character_profiles: updatedProfiles });
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-2xl font-display font-bold mb-2">Hands on Deck: Pitch Presentation</h2>
                <p className="text-text-secondary">
                    This is your generated pitch deck. Use the upload icon in the corner of any slide to add a custom background.
                </p>
            </div>
            <div className="space-y-8 max-w-5xl mx-auto">
                {/* Slide 1: Title */}
                <Slide
                    backgroundImage={backgrounds['title']}
                    onUpload={(file) => handleBackgroundUpload('title', file)}
                    onRemove={() => handleBackgroundRemove('title')}
                    className="text-center text-white p-0 items-start justify-end"
                >
                    <div className="w-full p-8 sm:p-12 md:p-16 text-left z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                        <h1 className="text-5xl md:text-7xl font-display font-bold" style={{textShadow: '2px 2px 8px rgba(0,0,0,0.7)'}}>{stage2Data.title}</h1>
                        <p className="text-xl md:text-2xl mt-2" style={{textShadow: '1px 1px 4px rgba(0,0,0,0.7)'}}>By {stage2Data.author}</p>
                    </div>
                </Slide>

                {/* Slide 2: Logline */}
                <Slide
                    backgroundImage={backgrounds['logline']}
                    onUpload={(file) => handleBackgroundUpload('logline', file)}
                    onRemove={() => handleBackgroundRemove('logline')}
                >
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-center leading-tight text-white" style={{textShadow: '2px 2px 8px rgba(0,0,0,0.7)'}}>
                        "{stage1Data.logline}"
                    </h2>
                </Slide>

                 {/* Slide 3: Synopsis */}
                <Slide
                    backgroundImage={backgrounds['synopsis']}
                    onUpload={(file) => handleBackgroundUpload('synopsis', file)}
                    onRemove={() => handleBackgroundRemove('synopsis')}
                    className="items-start text-left"
                >
                    <div className="bg-surface/50 p-6 rounded-lg">
                        <h2 className="text-3xl font-display font-bold text-accent mb-4">Synopsis</h2>
                        <p className="text-text-primary whitespace-pre-wrap text-base md:text-lg leading-relaxed">
                            {stage1Data.synopsis.brief}
                        </p>
                    </div>
                </Slide>

                {/* Slide 4+: Characters */}
                {stage2Data.character_profiles.filter(c => c.screen_presence === 'on-screen' && c.image_base64).slice(0, 4).map(char => (
                    <Slide 
                        key={char.name}
                        backgroundImage={backgrounds[`char-${char.name}`]}
                        onUpload={(file) => handleBackgroundUpload(`char-${char.name}`, file)}
                        onRemove={() => handleBackgroundRemove(`char-${char.name}`)}
                        className="flex-col md:flex-row gap-8 items-stretch text-left"
                    >
                        <div className="w-full md:w-1/3 flex-shrink-0 z-10">
                             <ImageUploader onImageUpload={(b64) => handleCharacterImageChange(b64, char.name)}>
                                <img
                                    src={`data:image/jpeg;base64,${char.image_base64}`}
                                    alt={`Portrait of ${char.name}`}
                                    className="w-full h-full object-cover rounded-lg shadow-md"
                                />
                            </ImageUploader>
                        </div>
                        <div className="flex-grow flex flex-col z-10 bg-surface/50 p-6 rounded-lg">
                             <h2 className="text-3xl font-display font-bold text-accent mb-2">{char.name}</h2>
                             <p className="text-text-secondary italic mb-4">{char.description}</p>
                             <div className="space-y-4 mt-auto">
                                <div>
                                    <h4 className="font-semibold text-text-primary mb-1">Motivation</h4>
                                    <p className="text-text-secondary text-sm">{char.motivation}</p>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-text-primary mb-1">Character Arc</h4>
                                    <p className="text-text-secondary text-sm">{char.arc}</p>
                                </div>
                             </div>
                        </div>
                    </Slide>
                ))}

                {/* Slide 5: Visual Style */}
                {stage2Data.visual_style_images_base64 && stage2Data.visual_style_images_base64.length > 0 && (
                    <Slide
                        backgroundImage={backgrounds['visual-style']}
                        onUpload={(file) => handleBackgroundUpload('visual-style', file)}
                        onRemove={() => handleBackgroundRemove('visual-style')}
                        className="items-start text-left"
                    >
                        <div className="z-10 bg-surface/50 p-6 rounded-lg w-full">
                            <h2 className="text-3xl font-display font-bold text-accent mb-4">Visual Style & Tone</h2>
                            <p className="text-text-secondary mb-6">{stage2Data.visual_style_suggestion}</p>
                             <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {stage2Data.visual_style_images_base64.map((imgBase64, index) => (
                                    <img 
                                        key={index}
                                        src={`data:image/jpeg;base64,${imgBase64}`}
                                        alt={`Visual style example ${index + 1}`}
                                        className="w-full h-auto rounded-lg shadow-md object-cover aspect-video"
                                    />
                                ))}
                            </div>
                        </div>
                    </Slide>
                )}

                {/* Slide 6: Comps */}
                {stage2Data.comparable_titles_visuals && stage2Data.comparable_titles_visuals.length > 0 && (
                     <Slide
                        backgroundImage={backgrounds['comps']}
                        onUpload={(file) => handleBackgroundUpload('comps', file)}
                        onRemove={() => handleBackgroundRemove('comps')}
                        className="items-start text-left"
                    >
                        <div className="z-10 bg-surface/50 p-6 rounded-lg w-full">
                            <h2 className="text-3xl font-display font-bold text-accent mb-4">Comparable Titles</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                {stage2Data.comparable_titles_visuals.map(comp => (
                                    <div key={comp.title} className="text-center">
                                        {comp.image_base64 ? (
                                            <img 
                                                src={`data:image/jpeg;base64,${comp.image_base64}`}
                                                alt={`Poster for ${comp.title}`}
                                                className="w-full rounded-md shadow-md object-cover aspect-[3/4] mb-2"
                                            />
                                        ) : (
                                            <div className="w-full aspect-[3/4] bg-black/20 rounded-md flex items-center justify-center mb-2">
                                                 <span className="text-xs">No Image</span>
                                            </div>
                                        )}
                                        <p className="font-semibold text-sm text-text-primary">{comp.title}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Slide>
                )}
                
                {/* Slide 7: Audience & Rating */}
                <Slide
                    backgroundImage={backgrounds['audience']}
                    onUpload={(file) => handleBackgroundUpload('audience', file)}
                    onRemove={() => handleBackgroundRemove('audience')}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full text-center z-10">
                        <div className="bg-surface/50 p-6 rounded-lg">
                            <h3 className="text-2xl font-display font-bold text-accent mb-2">Target Audience</h3>
                            <p className="text-lg text-text-primary">{stage2Data.target_audience}</p>
                        </div>
                         <div className="bg-surface/50 p-6 rounded-lg">
                            <h3 className="text-2xl font-display font-bold text-accent mb-2">Final Rating</h3>
                            <div className="flex items-center justify-center gap-4">
                                <p className="text-6xl font-bold text-accent-secondary">{stage2Data.final_rating.score.toFixed(1)}</p>
                                <div className="flex">
                                    {[...Array(10)].map((_, i) => (
                                        <StarIcon key={i} className={`w-6 h-6 ${i < Math.round(stage2Data.final_rating.score) ? 'text-accent-secondary' : 'text-border-color'}`} />
                                    ))}
                                </div>
                            </div>
                         </div>
                    </div>
                </Slide>

            </div>
        </div>
    );
};

export default HandsOnDeck;