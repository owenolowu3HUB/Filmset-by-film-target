
import React, { useState, useEffect } from 'react';
import { ClipboardCopyIcon, CheckCircleIcon, DownloadIcon, ImageIcon, FolderIcon } from './icons';
import { Project } from '../types';

interface ShareModalProps {
  project: Project;
  onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ project, onClose }) => {
  const [activeTab, setActiveTab] = useState<'code' | 'file'>('code');
  const [copyState, setCopyState] = useState<'idle' | 'generating' | 'copied'>('idle');
  const [shareCode, setShareCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'code' && !shareCode) {
        generateLiteCode();
    }
  }, [activeTab]);

  const generateLiteCode = async () => {
      setCopyState('generating');
      setError(null);
      
      // Use setTimeout to allow UI to render the loading state before heavy calculation
      setTimeout(() => {
          try {
              if (typeof window.LZString === 'undefined') {
                  throw new Error("Compression library missing.");
              }

              // Create a deep copy to strip images safely
              const liteProject = JSON.parse(JSON.stringify(project)) as Project;

              // STRIP IMAGES to ensure the code is small enough for clipboards
              if (liteProject.stage2Result) {
                  liteProject.stage2Result.concept_art_base64 = undefined;
                  liteProject.stage2Result.movie_poster_base64 = undefined;
                  liteProject.stage2Result.visual_style_images_base64 = [];
                  liteProject.stage2Result.comparable_titles_visuals?.forEach(c => c.image_base64 = '');
                  liteProject.stage2Result.character_profiles?.forEach(c => c.image_base64 = undefined);
              }
              if (liteProject.shotIdeasList) {
                  liteProject.shotIdeasList.forEach(s => s.image_base64 = undefined);
              }
              if (liteProject.storyboardData) {
                  liteProject.storyboardData.images = [];
              }
              if (liteProject.imageStudioState) {
                   liteProject.imageStudioState.resultImageBase64 = null;
                   liteProject.imageStudioState.sourceImage = null;
                   liteProject.imageStudioState.characterReferenceImage = null;
                   liteProject.imageStudioState.locationReferenceImage = null;
                   liteProject.imageStudioState.continuationSourceImage = null;
              }

              const jsonString = JSON.stringify(liteProject);
              const compressed = window.LZString.compressToEncodedURIComponent(jsonString);
              
              setShareCode(compressed);
              setCopyState('idle');

          } catch (e) {
              console.error("Compression error:", e);
              setError("Failed to generate share code.");
              setCopyState('idle');
          }
      }, 100);
  };

  const handleCopy = () => {
    if (!shareCode) return;
    navigator.clipboard.writeText(shareCode).then(() => {
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    }).catch(err => {
      console.error("Failed to copy:", err);
      alert("Failed to copy to clipboard. Please select the text manually.");
    });
  };

  const handleDownloadFile = () => {
      try {
          const jsonString = JSON.stringify(project, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const safeName = (project.name || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
          
          const a = document.createElement('a');
          a.href = url;
          a.download = `${safeName}.filmset`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (e) {
          setError("Failed to generate download file.");
      }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-surface w-full max-w-lg rounded-xl shadow-2xl shadow-accent/20 border border-border-color p-0 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-border-color bg-bg-secondary">
            <h2 className="text-xl font-display font-bold truncate pr-4" title={project.name}>Share Project</h2>
            <button onClick={onClose} className="text-text-secondary hover:text-text-primary text-2xl">&times;</button>
        </div>

        <div className="flex border-b border-border-color">
            <button 
                onClick={() => setActiveTab('code')}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'code' ? 'bg-surface text-accent border-b-2 border-accent' : 'bg-bg-secondary text-text-secondary hover:text-text-primary'}`}
            >
                Quick Share (Code)
            </button>
            <button 
                onClick={() => setActiveTab('file')}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === 'file' ? 'bg-surface text-accent border-b-2 border-accent' : 'bg-bg-secondary text-text-secondary hover:text-text-primary'}`}
            >
                Full Share (File)
            </button>
        </div>

        <div className="p-6">
            {activeTab === 'code' ? (
                <div className="flex flex-col gap-4">
                    <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg flex items-start gap-3">
                         <div className="p-1.5 bg-blue-500/20 rounded-full mt-0.5"><FolderIcon className="w-4 h-4 text-blue-400" /></div>
                         <div className="text-sm text-text-secondary">
                             <p className="font-semibold text-blue-300 mb-1">Lite Mode Active</p>
                             <p>Images are removed to ensure the code is copyable. Use "Full Share" if you need to share images.</p>
                         </div>
                    </div>

                    <div className="relative">
                        <textarea
                            value={shareCode}
                            readOnly
                            placeholder={copyState === 'generating' ? "Generating secure code..." : ""}
                            className="w-full h-32 p-3 bg-bg-secondary border border-border-color rounded-lg text-text-secondary text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-accent"
                            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        />
                         {copyState === 'generating' && (
                             <div className="absolute inset-0 bg-bg-secondary/80 flex items-center justify-center">
                                 <span className="text-accent text-sm font-semibold animate-pulse">Compressing data...</span>
                             </div>
                         )}
                    </div>

                    <button
                        onClick={handleCopy}
                        disabled={copyState === 'generating' || !shareCode}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent hover:bg-accent/80 text-white font-bold rounded-lg transition-all duration-200 shadow-lg shadow-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {copyState === 'copied' ? (
                            <>
                                <CheckCircleIcon className="w-5 h-5" />
                                <span>Copied to Clipboard!</span>
                            </>
                        ) : (
                            <>
                                <ClipboardCopyIcon className="w-5 h-5" />
                                <span>Copy Code</span>
                            </>
                        )}
                    </button>
                    {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                </div>
            ) : (
                <div className="flex flex-col gap-6 text-center py-4">
                    <div className="flex justify-center">
                         <div className="w-20 h-20 bg-bg-secondary rounded-full flex items-center justify-center border-2 border-border-color">
                             <ImageIcon className="w-10 h-10 text-accent" />
                         </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-text-primary mb-2">Share Everything</h3>
                        <p className="text-text-secondary text-sm">
                            This will download a <strong>.filmset</strong> file containing all scripts, analysis, and images. Send this file to your collaborator.
                        </p>
                    </div>
                    
                    <button
                        onClick={handleDownloadFile}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all duration-200 shadow-lg shadow-green-500/20"
                    >
                        <DownloadIcon className="w-5 h-5" />
                        <span>Download Project File</span>
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
