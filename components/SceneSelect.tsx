
import React, { useState, useMemo } from 'react';
import { Project } from '../types';
import { ClapperboardIcon, SearchIcon, RobotIcon, DownloadIcon } from './icons';

interface SceneSelectProps {
  project: Project | null;
  onSendToShotIdeas: (sceneContent: string) => void;
  onSendToAIPrompter?: (sceneContent: string) => void;
}

const SceneSelect: React.FC<SceneSelectProps> = ({ project, onSendToShotIdeas, onSendToAIPrompter }) => {
  const [filter, setFilter] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const fullScenes = project?.fullScenes;
  // Use character breakdown from Stage 3 for the dropdown list
  const characters = project?.stage3Result?.character_breakdown || [];

  // Sort characters alphabetically for the dropdown
  const sortedCharacters = useMemo(() => {
      return [...characters].sort((a, b) => a.name.localeCompare(b.name));
  }, [characters]);

  const filteredScenes = useMemo(() => {
    if (!fullScenes) return [];
    
    let scenes = fullScenes;

    // 1. Filter by Character
    if (selectedCharacter) {
        // Strategy A: AI Structural Analysis (High Precision)
        const charData = project?.stage3Result?.character_breakdown.find(c => c.name === selectedCharacter);
        const aiIdentifiedScenes = charData ? charData.scene_appearances : [];

        // Strategy B: Robust Smart Text Search (High Recall)
        // 1. Clean the name: Remove parentheticals (e.g. "John (Young)" -> "John")
        const cleanName = selectedCharacter.replace(/\s*\(.*?\)\s*/g, '').trim();
        
        // 2. Split into potential search terms
        const parts = cleanName.split(/\s+/).filter(p => p.length > 1); 
        
        // 3. Filter out generic titles to avoid false positives
        const genericTitles = new Set([
            'mr', 'mrs', 'ms', 'dr', 'prof', 'sgt', 'det', 'officer', 'agent', 
            'lieutenant', 'lt', 'captain', 'capt', 'general', 'gen', 'father', 
            'sister', 'detective', 'sergeant', 'corporal', 'private', 'chief', 
            'sheriff', 'deputy', 'inspector', 'narrator', 'voice', 'un', 'the'
        ]);
        
        const meaningfulParts = parts.filter(p => !genericTitles.has(p.toLowerCase().replace('.', '')));
        
        const searchTerms = meaningfulParts.length > 0 ? meaningfulParts : [cleanName];
        if (!searchTerms.includes(cleanName)) searchTerms.push(cleanName);

        // 4. Create a robust regex
        const escapedTerms = searchTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const pattern = `(?<!\\w)(${escapedTerms.join('|')})(?!\\w)`;
        const nameRegex = new RegExp(pattern, 'i');

        scenes = scenes.filter(s => {
            const isIdentifiedByAI = aiIdentifiedScenes.includes(s.scene_number);
            const isMentioned = nameRegex.test(s.content) || nameRegex.test(s.heading);
            return isIdentifiedByAI || isMentioned;
        });
    }

    // 2. Filter by Text Search
    if (filter.trim()) {
        const lowercasedFilter = filter.toLowerCase();
        scenes = scenes.filter(scene => {
            const sceneNumberMatch = scene.scene_number.toString().includes(lowercasedFilter);
            const headingMatch = scene.heading.toLowerCase().includes(lowercasedFilter);
            const contentMatch = scene.content.toLowerCase().includes(lowercasedFilter);
            return sceneNumberMatch || headingMatch || contentMatch;
        });
    }

    return scenes;
  }, [fullScenes, filter, selectedCharacter, project?.stage3Result]);

  const handleExportScenesToPDF = () => {
      if (!window.jspdf || filteredScenes.length === 0) return;
      
      setIsExporting(true);
      
      try {
          const { jsPDF } = window.jspdf;
          // Use A4 format, Courier font for screenplay style
          const doc = new jsPDF({ unit: 'mm', format: 'a4' });
          
          doc.setFont("Courier", "normal");
          doc.setFontSize(12);

          // Standard Screenplay Margins (approximate in mm)
          // Top/Bottom: ~25mm (1 inch)
          // Left: ~38mm (1.5 inch) to allow for binding
          // Right: ~25mm (1 inch)
          const pageWidth = 210;
          const pageHeight = 297;
          const marginTop = 25;
          const marginBottom = 25;
          const marginLeft = 35; 
          const marginRight = 25;
          
          let y = marginTop;
          const lineHeight = 5; // ~12pt spacing

          // Formatting Helpers
          const checkPageBreak = (neededHeight: number) => {
              if (y + neededHeight > pageHeight - marginBottom) {
                  doc.addPage();
                  y = marginTop;
              }
          };

          const printLine = (text: string, x: number, maxWidth: number) => {
              const lines = doc.splitTextToSize(text, maxWidth);
              checkPageBreak(lines.length * lineHeight);
              doc.text(lines, x, y);
              y += lines.length * lineHeight;
          };

          // --- Title Page ---
          doc.setFont("Courier", "bold");
          doc.setFontSize(22);
          const title = project?.name || 'Untitled Project';
          const titleLines = doc.splitTextToSize(title.toUpperCase(), pageWidth - (marginLeft + marginRight));
          
          // Center title vertically roughly
          y = 100;
          doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
          y += 20;
          
          doc.setFontSize(14);
          doc.setFont("Courier", "normal");
          if (selectedCharacter) {
              doc.text(`Character Excerpt: ${selectedCharacter.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });
          } else {
              doc.text("Selected Scenes", pageWidth / 2, y, { align: 'center' });
          }
          
          doc.addPage();
          y = marginTop;
          doc.setFontSize(12);

          // --- Regex Patterns for Heuristic Parsing ---
          const SCENE_HEADING_REGEX = /^(INT\.|EXT\.|INT\/EXT\.|I\/E|EST\.)/i;
          const TRANSITION_REGEX = /(:$|TO:$)/; // Matches CUT TO:, FADE TO:
          const CHARACTER_CUE_REGEX = /^[^a-z]+$/; // All caps, no lowercase letters (allows numbers/punctuation)
          const MAX_CHAR_NAME_LENGTH = 35;

          // --- Iterate Scenes ---
          filteredScenes.forEach((scene, index) => {
              const cleanHeading = scene.heading.trim();
              
              // Print Scene Heading (Bold, Left Aligned)
              doc.setFont("Courier", "bold");
              checkPageBreak(lineHeight * 3);
              if (y > marginTop) y += lineHeight * 2; // Extra space before new scene
              
              printLine(`${scene.scene_number}. ${cleanHeading.toUpperCase()}`, marginLeft, pageWidth - marginLeft - marginRight);
              doc.setFont("Courier", "normal");
              y += lineHeight;

              // Split content into lines for parsing
              let lines = scene.content.split('\n');
              
              // Remove first line if it duplicates the heading
              if (lines.length > 0 && lines[0].trim().toUpperCase() === cleanHeading.toUpperCase()) {
                  lines.shift();
              }

              let previousType: 'heading' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition' = 'heading';

              for (let i = 0; i < lines.length; i++) {
                  const rawLine = lines[i];
                  const line = rawLine.trim();
                  
                  if (!line) {
                      y += lineHeight; // Empty line spacing
                      previousType = 'action'; // Reset context on blank lines
                      continue;
                  }

                  // --- Heuristic Classification ---
                  let type: 'heading' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition' = 'action';

                  if (SCENE_HEADING_REGEX.test(line)) {
                      type = 'heading';
                  } else if (TRANSITION_REGEX.test(line) && line === line.toUpperCase() && line.length < 40) {
                      type = 'transition';
                  } else if (line.startsWith('(') && line.endsWith(')')) {
                      type = 'parenthetical';
                  } else if (
                      CHARACTER_CUE_REGEX.test(line) && 
                      line.length < MAX_CHAR_NAME_LENGTH &&
                      !/[.!?]$/.test(line.replace(/\s*\(.*?\)$/, '')) && // Names rarely end in punctuation
                      previousType !== 'character' && 
                      previousType !== 'dialogue' &&
                      previousType !== 'parenthetical'
                  ) {
                      type = 'character';
                  } else if (
                      previousType === 'character' || 
                      previousType === 'parenthetical' || 
                      previousType === 'dialogue' // Allow multi-line dialogue
                  ) {
                      type = 'dialogue';
                  } else {
                      type = 'action';
                  }

                  // --- Rendering with Screenplay Indentation ---
                  // 1mm ~ 2.8pts. 
                  
                  if (type === 'heading') {
                      doc.setFont("Courier", "bold");
                      checkPageBreak(lineHeight * 2);
                      if (previousType !== 'heading') y += lineHeight;
                      printLine(line.toUpperCase(), marginLeft, pageWidth - marginLeft - marginRight);
                      doc.setFont("Courier", "normal");
                  } else if (type === 'character') {
                      // Character Names centered-ish: Indent ~95mm
                      checkPageBreak(lineHeight * 4); // Try to keep char with dialogue
                      const charIndent = 95; 
                      printLine(line, charIndent, 80); 
                  } else if (type === 'parenthetical') {
                      // Parentheticals: Indent ~85mm
                      const parenIndent = 85;
                      printLine(line, parenIndent, 60);
                  } else if (type === 'dialogue') {
                      // Dialogue: Indent ~65mm, Width ~90mm
                      const diagIndent = 65;
                      const diagWidth = 90;
                      printLine(line, diagIndent, diagWidth);
                  } else if (type === 'transition') {
                      // Transitions: Right aligned ~150mm
                      const transIndent = 150;
                      printLine(line, transIndent, 40);
                  } else {
                      // Action: Full width (Left Margin)
                      printLine(line, marginLeft, pageWidth - marginLeft - marginRight);
                  }

                  previousType = type;
              }

              // Divider between scenes
              if (index < filteredScenes.length - 1) {
                  y += lineHeight;
                  checkPageBreak(lineHeight);
                  doc.setDrawColor(200);
                  doc.line(marginLeft, y, pageWidth - marginRight, y);
                  doc.setDrawColor(0);
                  y += lineHeight;
              }
          });

          // Page Numbering in Header
          const pageCount = (doc as any).internal.getNumberOfPages();
          for(let i = 1; i <= pageCount; i++) {
              doc.setPage(i);
              doc.setFontSize(10);
              doc.text(`${i}.`, pageWidth - marginRight, 15, { align: 'right' });
          }

          const filename = selectedCharacter 
            ? `${project?.name}_${selectedCharacter}_Script.pdf` 
            : `${project?.name}_Scenes_Script.pdf`;
            
          doc.save(filename.replace(/\s+/g, '_'));

      } catch (err) {
          console.error("PDF Export failed:", err);
          alert("Failed to export PDF.");
      } finally {
          setIsExporting(false);
      }
  };

  if (!fullScenes || fullScenes.length === 0) {
    return (
      <div className="text-center p-8 flex flex-col items-center gap-4 text-text-secondary">
        <h2 className="text-2xl font-display font-bold text-text-primary">Scene Selector</h2>
        <p>
          To use this tool, first submit a script for analysis on the "Script Analysis" tab.
        </p>
        <p>
          Once the analysis is complete, all scenes will be listed here, ready to be sent for shot generation.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-display font-bold mb-2">Scene Select</h2>
        <p className="text-text-secondary">
          Filter scenes by character or keyword, and send them to other tools or export them.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon className="w-5 h-5 text-text-secondary" />
              </div>
              <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search scenes by content..."
                  className="w-full p-3 pl-10 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent"
                  aria-label="Search scenes"
              />
          </div>
          
          <div className="w-full md:w-64">
              <select
                  value={selectedCharacter}
                  onChange={(e) => setSelectedCharacter(e.target.value)}
                  className="w-full p-3 bg-bg-secondary border-2 border-border-color rounded-lg focus:ring-2 focus:ring-accent appearance-none"
                  aria-label="Filter by Character"
              >
                  <option value="">All Characters</option>
                  {sortedCharacters.map(char => (
                      <option key={char.name} value={char.name}>{char.name}</option>
                  ))}
              </select>
          </div>

          {selectedCharacter && (
              <button
                  onClick={handleExportScenesToPDF}
                  disabled={isExporting || filteredScenes.length === 0}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                  {isExporting ? <span className="animate-pulse">Exporting...</span> : (
                      <>
                        <DownloadIcon className="w-5 h-5" />
                        <span>Export Scenes PDF</span>
                      </>
                  )}
              </button>
          )}
      </div>

      <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>Showing {filteredScenes.length} scenes {selectedCharacter && `featuring ${selectedCharacter}`}</span>
      </div>

      <div className="space-y-6">
        {filteredScenes.length > 0 ? (
            filteredScenes.map((scene) => (
              <div key={scene.scene_number} className="bg-bg-secondary p-6 rounded-lg border border-border-color/50 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-accent/30">
                    <h3 className="text-xl font-display font-bold text-accent">
                    Scene {scene.scene_number}
                    </h3>
                    <span className="text-sm font-mono text-text-secondary bg-bg-primary px-2 py-1 rounded">
                        {scene.heading}
                    </span>
                </div>
                
                <pre className="whitespace-pre-wrap font-sans text-text-primary bg-bg-primary p-4 rounded-md max-h-80 overflow-y-auto text-sm leading-relaxed custom-scrollbar">
                  <code>{scene.content}</code>
                </pre>
                <div className="mt-4 flex flex-wrap justify-end gap-3">
                  <button
                    onClick={() => onSendToShotIdeas(scene.content)}
                    className="flex items-center gap-2 px-4 py-2 bg-accent/10 hover:bg-accent/20 border border-accent text-accent font-semibold rounded-lg transition-colors duration-200 text-sm"
                  >
                    <ClapperboardIcon className="w-4 h-4" />
                    <span>Send to Shot Idea Studio</span>
                  </button>
                  {onSendToAIPrompter && (
                      <button
                        onClick={() => onSendToAIPrompter(scene.content)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500 text-blue-400 font-semibold rounded-lg transition-colors duration-200 text-sm"
                      >
                        <RobotIcon className="w-4 h-4" />
                        <span>Send to AI Prompter</span>
                      </button>
                  )}
                </div>
              </div>
            ))
        ) : (
            <div className="text-center py-10 text-text-secondary bg-bg-secondary/50 rounded-lg border border-border-color border-dashed">
                <p>No scenes found matching your filters.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default SceneSelect;
