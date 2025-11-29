import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AnalyzeIcon, UploadIcon, SpinnerIcon, FolderIcon } from './icons';

interface ScriptInputProps {
  onAnalyze: (scriptText: string) => void;
  isLoading: boolean;
  error: string | null;
  script: string;
  onUpdateScript: (script: string) => void;
  isReadOnly: boolean;
}

const ScriptInput: React.FC<ScriptInputProps> = ({ onAnalyze, isLoading, error, script, onUpdateScript, isReadOnly }) => {
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file) return;

    setParseError(null);

    if (file.type === 'application/pdf') {
      setIsParsingPdf(true);
      try {
        if (!window.pdfjsLib) {
            throw new Error('PDF library is not loaded.');
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
            const pdf = await window.pdfjsLib.getDocument(typedArray).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
            }
            onUpdateScript(fullText);
          } catch(err) {
             console.error("PDF parsing error:", err);
             setParseError(err instanceof Error ? err.message : 'Could not parse PDF file.');
          } finally {
            setIsParsingPdf(false);
          }
        };
        reader.onerror = () => {
          setParseError('Failed to read the PDF file.');
          setIsParsingPdf(false);
        }
        reader.readAsArrayBuffer(file);

      } catch (err) {
        console.error("PDF library error:", err);
        setParseError(err instanceof Error ? err.message : 'Could not load PDF library.');
        setIsParsingPdf(false);
      }
    } else { // Assuming .txt or other text-based file
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        onUpdateScript(text);
      };
      reader.readAsText(file);
    }
  }, [onUpdateScript]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragEnter = (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === "application/pdf" || file.type === "text/plain")) {
      processFile(file);
    } else {
      setParseError("Invalid file type. Please drop a .txt or .pdf file.");
    }
  };
  
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onAnalyze(script);
  };

  const isDisabled = isLoading || isParsingPdf;

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-display font-bold mb-2 text-text-primary">Submit Your Script, Concept, or Idea</h2>
        <p className="text-text-secondary">
          Paste your full script, concept, or idea. The AI will perform a complete professional breakdown based strictly on the text you provide.
        </p>
      </div>
      
      {renderClickableError(error || parseError)}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="relative">
          <textarea
            value={script}
            onChange={(e) => onUpdateScript(e.target.value)}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            placeholder="Paste your full movie script or a brief concept here..."
            className={`w-full h-80 p-4 bg-bg-secondary border-2 border-dashed rounded-lg focus:ring-2 focus:ring-accent focus:border-solid focus:border-accent transition-all duration-200 resize-y text-text-primary placeholder-text-secondary ${isDragging ? 'border-accent bg-accent/10' : 'border-border-color'} ${isReadOnly ? 'cursor-default' : ''}`}
            disabled={isDisabled || isReadOnly}
            readOnly={isReadOnly}
          />
          {isDragging && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-accent/20 pointer-events-none rounded-lg">
                  <UploadIcon className="w-12 h-12 text-accent" />
                  <p className="mt-2 text-lg font-semibold text-accent">Drop file to upload</p>
              </div>
          )}
        </div>
        {!isReadOnly && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <label htmlFor="file-upload" className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-bg-secondary text-text-primary font-semibold rounded-lg transition-colors duration-200 border-2 border-border-color ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-border-color hover:border-accent/50 cursor-pointer'}`}>
              {isParsingPdf ? (
                  <>
                      <SpinnerIcon className="w-5 h-5 animate-spin text-accent" />
                      <span>Parsing PDF...</span>
                  </>
              ) : (
                  <>
                      <UploadIcon className="w-5 h-5" />
                      <span>Upload File (.txt, .pdf)</span>
                  </>
              )}
              <input ref={fileInputRef} id="file-upload" type="file" accept=".txt,.pdf" className="hidden" onChange={handleFileChange} disabled={isDisabled} />
            </label>
            <button
              type="submit"
              disabled={isDisabled || !script}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-accent to-blue-500 text-white font-bold rounded-lg shadow-lg shadow-accent/20 hover:shadow-accent-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
            >
              <AnalyzeIcon className="w-5 h-5" />
              <span>Analyze</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default ScriptInput;