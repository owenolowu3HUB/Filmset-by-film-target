import React, { useState, useCallback, useRef, useEffect } from 'react';
import { VideoIcon, SpinnerIcon, UploadIcon, ExportIcon } from './icons';
import { generateVideo } from '../services/geminiService';

// The global declaration for `window.aistudio` is now centralized in `types.ts` to prevent conflicts.

type Mode = 'text' | 'frame';
type Resolution = '720p' | '1080p';

interface FrameSource {
    file: File;
    base64: string;
    dataUrl: string;
}

const loadingMessages = [
    "Warming up the digital cameras...",
    "Choreographing the pixels...",
    "Rendering cinematic brilliance...",
    "This can take a few minutes, good things come to those who wait...",
    "Applying special effects...",
    "Mixing the audio... (just kidding, it's silent!)",
    "Finalizing the director's cut...",
    "Almost there, the previews are looking great..."
];

const cropImageToLandscape = (file: File): Promise<FrameSource> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl); // Clean up the object URL

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                return reject(new Error('Could not get canvas context.'));
            }
            
            const targetAspectRatio = 16 / 9;

            // Set a reasonable output resolution for the frames
            canvas.width = 1280;
            canvas.height = 720;

            const imgWidth = img.naturalWidth;
            const imgHeight = img.naturalHeight;
            const imgAspectRatio = imgWidth / imgHeight;

            let sourceX = 0;
            let sourceY = 0;
            let sourceWidth = imgWidth;
            let sourceHeight = imgHeight;
            
            // If image is wider than target, crop sides
            if (imgAspectRatio > targetAspectRatio) {
                sourceWidth = imgHeight * targetAspectRatio;
                sourceX = (imgWidth - sourceWidth) / 2;
            } 
            // If image is taller than target, crop top/bottom
            else if (imgAspectRatio < targetAspectRatio) {
                sourceHeight = imgWidth / targetAspectRatio;
                sourceY = (imgHeight - sourceHeight) / 2;
            }

            // Draw the cropped image onto the canvas
            ctx.drawImage(
                img,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                0, // destinationX
                0, // destinationY
                canvas.width, // destinationWidth
                canvas.height // destinationHeight
            );

            const dataUrl = canvas.toDataURL(file.type, 0.9); // Use original mime type, quality 0.9
            const base64 = dataUrl.split(',')[1];

            resolve({ file, base64, dataUrl });
        };

        img.onerror = (err) => {
            URL.revokeObjectURL(objectUrl);
            reject(err);
        };
        
        img.src = objectUrl;
    });
};

const VideoStudio: React.FC = () => {
    const [mode, setMode] = useState<Mode>('text');
    const [prompt, setPrompt] = useState<string>('');
    const [resolution, setResolution] = useState<Resolution>('720p');
    const [firstFrame, setFirstFrame] = useState<FrameSource | null>(null);
    const [lastFrame, setLastFrame] = useState<FrameSource | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
    const [error, setError] = useState<string | null>(null);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

    const [isKeySelected, setIsKeySelected] = useState<boolean | 'checking'>('checking');

    const firstFrameInputRef = useRef<HTMLInputElement>(null);
    const lastFrameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const checkKey = async () => {
            if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                setIsKeySelected(hasKey);
            } else {
                setIsKeySelected(false);
            }
        };
        checkKey();
    }, []);
    
    useEffect(() => {
        let interval: number;
        if (isLoading) {
            interval = window.setInterval(() => {
                setLoadingMessage(prev => {
                    const currentIndex = loadingMessages.indexOf(prev);
                    const nextIndex = (currentIndex + 1) % loadingMessages.length;
                    return loadingMessages[nextIndex];
                });
            }, 5000);
        }
        return () => clearInterval(interval);
    }, [isLoading]);

    const handleSelectKey = async () => {
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            await window.aistudio.openSelectKey();
            // Assume success and let the API call handle failure.
            setIsKeySelected(true);
        } else {
            setError("API Key selection utility is not available in this environment.");
        }
    };

    const handleFile = useCallback(async (file: File | null, frameType: 'first' | 'last') => {
        if (!file) return;
        try {
            const frameSource = await cropImageToLandscape(file);
            if (frameType === 'first') {
                setFirstFrame(frameSource);
            } else {
                setLastFrame(frameSource);
            }
        } catch (err) {
            console.error(err);
            setError(`Failed to read and crop the ${frameType} frame image.`);
        }
    }, []);

    const handleSubmit = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt.');
            return;
        }
        if (mode === 'frame' && !firstFrame) {
            setError('Please provide a first frame for Frame-to-Video generation.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedVideoUrl(null);
        setLoadingMessage(loadingMessages[0]);

        try {
            const videoUrl = await generateVideo({
                prompt,
                resolution,
                firstFrame: firstFrame ? { base64: firstFrame.base64, mimeType: firstFrame.file.type } : undefined,
                lastFrame: lastFrame ? { base64: lastFrame.base64, mimeType: lastFrame.file.type } : undefined,
            });
            setGeneratedVideoUrl(videoUrl);
        } catch (err) {
            console.error(err);
            let errorMessage = 'An unknown error occurred during video generation.';
            if (err instanceof Error) {
                if (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED')) {
                    errorMessage = "API quota exceeded. Please check your plan and billing details. For more information, see https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your usage, visit https://ai.dev/usage?tab=rate-limit.";
                } else if (err.message.includes('503') || err.message.includes('UNAVAILABLE') || err.message.includes('overloaded')) {
                    errorMessage = "The AI model is currently experiencing high demand. Please wait a few moments and try again.";
                } else if (err.message.includes('API key error')) {
                    setIsKeySelected(false);
                    errorMessage = err.message;
                } else {
                    errorMessage = err.message;
                }
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const FrameUploader: React.FC<{
        frame: FrameSource | null;
        setFrame: (file: File | null) => void;
        inputRef: React.RefObject<HTMLInputElement>;
        title: string;
    }> = ({ frame, setFrame, inputRef, title }) => (
        <div className="flex flex-col gap-2">
            <h4 className="font-semibold text-text-secondary">{title}</h4>
            {frame ? (
                <div className="relative">
                    <img src={frame.dataUrl} alt={title} className="rounded-lg w-full aspect-video object-cover" />
                    <button
                        onClick={() => { setFrame(null); if(inputRef.current) inputRef.current.value = ''; }}
                        className="absolute top-2 right-2 text-xs px-2 py-1 bg-black/60 text-white font-semibold rounded-lg hover:bg-black/80"
                    >
                        Change
                    </button>
                </div>
            ) : (
                <div
                    onClick={() => inputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors border-border-color hover:border-accent"
                >
                    <UploadIcon className="w-8 h-8 text-text-secondary mb-2" />
                    <p className="text-sm font-semibold text-text-primary">Click to upload</p>
                    <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFrame(e.target.files?.[0] ?? null)} />
                </div>
            )}
        </div>
    );
    
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

    if (isKeySelected === 'checking') {
        return <div className="flex items-center justify-center min-h-[400px]"><SpinnerIcon className="w-12 h-12 text-accent animate-spin" /></div>;
    }

    if (!isKeySelected) {
        return (
            <div className="text-center p-8 flex flex-col items-center gap-4">
                <h2 className="text-2xl font-display font-bold">API Key Required for Video Generation</h2>
                <p className="text-text-secondary max-w-lg">
                    The Video Studio uses advanced models that require you to select a Project API key.
                    Please make sure you have a project with billing enabled.
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline ml-2">Learn more about billing.</a>
                </p>
                <button
                    onClick={handleSelectKey}
                    className="mt-4 flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-accent to-blue-500 text-white font-bold rounded-lg shadow-lg shadow-accent/20 hover:shadow-accent-glow transition-all transform hover:scale-105"
                >
                    Select API Key
                </button>
                {error && <p className="mt-4 text-red-400">{error}</p>}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-2xl font-display font-bold mb-2">Video Generation Studio</h2>
                <p className="text-text-secondary">Create videos from text or images. All videos are generated in a 16:9 landscape aspect ratio.</p>
            </div>

            {renderClickableError(error)}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Panel */}
                <div className="flex flex-col gap-4">
                    <div className="bg-bg-secondary rounded-lg p-1 flex border border-border-color">
                        <button onClick={() => setMode('text')} className={`w-1/2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'text' ? 'bg-accent text-bg-primary' : 'text-text-secondary hover:bg-surface'}`}>Text-to-Video</button>
                        <button onClick={() => setMode('frame')} className={`w-1/2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'frame' ? 'bg-accent text-bg-primary' : 'text-text-secondary hover:bg-surface'}`}>Frame-to-Video</button>
                    </div>

                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={'e.g., A neon hologram of a cat driving at top speed'}
                        className="w-full h-32 p-4 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent"
                        disabled={isLoading}
                    />

                    <div className="flex flex-col gap-2">
                        <h4 className="font-semibold text-text-secondary">Resolution</h4>
                        <div className="bg-bg-secondary rounded-lg p-1 flex border border-border-color">
                            <button onClick={() => setResolution('720p')} className={`w-1/2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${resolution === '720p' ? 'bg-accent text-bg-primary' : 'text-text-secondary hover:bg-surface'}`}>720p (Faster)</button>
                            <button onClick={() => setResolution('1080p')} className={`w-1/2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${resolution === '1080p' ? 'bg-accent text-bg-primary' : 'text-text-secondary hover:bg-surface'}`}>1080p (Higher Quality)</button>
                        </div>
                    </div>

                    {mode === 'frame' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FrameUploader frame={firstFrame} setFrame={(file) => handleFile(file, 'first')} inputRef={firstFrameInputRef} title="First Frame" />
                            <FrameUploader frame={lastFrame} setFrame={(file) => handleFile(file, 'last')} inputRef={lastFrameInputRef} title="Last Frame (Optional)" />
                        </div>
                    )}
                    
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-accent to-blue-500 text-white font-bold rounded-lg shadow-lg shadow-accent/20 hover:shadow-accent-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isLoading ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <VideoIcon className="w-5 h-5" />}
                        <span>{isLoading ? 'Generating...' : 'Generate Video'}</span>
                    </button>
                </div>
                {/* Output Panel */}
                <div className="flex flex-col gap-4 items-center justify-center bg-bg-secondary rounded-lg p-4 min-h-[300px] border border-border-color">
                    {isLoading ? (
                        <div className="text-center">
                            <SpinnerIcon className="w-12 h-12 text-accent animate-spin mx-auto" />
                            <p className="mt-4 font-semibold text-lg">{loadingMessage}</p>
                            <p className="text-text-secondary">Video generation can take several minutes.</p>
                        </div>
                    ) : generatedVideoUrl ? (
                         <>
                            <video src={generatedVideoUrl} controls autoPlay loop className="w-full rounded-lg" />
                            <a
                                href={generatedVideoUrl}
                                download="generated-video.mp4"
                                className="mt-4 flex items-center justify-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg"
                            >
                                <ExportIcon className="w-5 h-5"/>
                                <span>Download Video</span>
                            </a>
                        </>
                    ) : (
                        <div className="text-center text-text-secondary">
                            <p className="font-semibold text-lg">Your video will appear here.</p>
                            <p>Configure your options on the left and click Generate.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoStudio;