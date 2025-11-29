
import React, { useState } from 'react';
import { Project, Stage2Result } from '../types';
import { PlusCircleIcon, StarIcon, ExportIcon, CheckCircleIcon, ClipboardListIcon, ReplaceIcon, UploadIcon, SaveIcon, DownloadIcon, VideoIcon, SpinnerIcon } from './icons';

// The global declaration for jspdf is now centralized in types.ts

interface AnalysisResultProps {
  project: Project;
  onNewProject: () => void;
  onUpdateStage2Data: (newData: Stage2Result) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportProject: () => void;
  saveState: 'idle' | 'saving' | 'saved';
  isReadOnly: boolean;
}

type ActiveTab = 'stage1' | 'stage2' | 'stage3';
type ExportFormat = 'markdown' | 'json' | 'pdf';

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

// Helper class for PDF generation
class PdfHelper {
    doc: any;
    y: number;
    pageWidth: number;
    pageHeight: number;
    margin: number;
    lineHeight: number;
    toc: { title: string, page: number }[] = [];

    constructor() {
        const { jsPDF } = window.jspdf;
        this.doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        this.margin = 15;
        this.y = this.margin;
        this.pageWidth = this.doc.internal.pageSize.getWidth() - this.margin * 2;
        this.pageHeight = this.doc.internal.pageSize.getHeight();
        this.lineHeight = 7;
    }

    checkPageBreak(requiredSpace = this.lineHeight) {
        if (this.y + requiredSpace > this.pageHeight - this.margin) {
            this.doc.addPage();
            this.y = this.margin;
        }
    }
    
    addTocEntry(title: string) {
        this.checkPageBreak(this.lineHeight * 3);
        const pageNumber = (this.doc as any).internal.getCurrentPageInfo().pageNumber;
        this.toc.push({ title, page: pageNumber });
    }

    addTitle(text: string, addToToc = false) {
        if (addToToc) {
            this.addTocEntry(text);
        }
        this.y = this.margin;
        this.checkPageBreak();
        this.doc.setFontSize(18);
        this.doc.setFont(undefined, 'bold');
        const lines = this.doc.splitTextToSize(text, this.pageWidth);
        this.doc.text(lines, this.margin, this.y);
        this.y += (lines.length * this.lineHeight) + (this.lineHeight);
        this.doc.setFont(undefined, 'normal');
    }
    
    addSubtitle(text: string, addToToc = false) {
        if (addToToc) {
            this.addTocEntry(text);
        }
        this.checkPageBreak(this.lineHeight * 2);
        this.doc.setFontSize(14);
        this.doc.setFont(undefined, 'bold');
        this.doc.text(text, this.margin, this.y);
        this.y += this.lineHeight * 1.5;
        this.doc.setFont(undefined, 'normal');
    }

    addText(text: string | string[], isItalic = false) {
        this.doc.setFontSize(10);
        this.doc.setFont(undefined, isItalic ? 'italic' : 'normal');
        const lines = this.doc.splitTextToSize(String(text), this.pageWidth);
        
        const requiredHeight = lines.length * (this.lineHeight - 2);
        const spacingAfter = this.lineHeight * 0.5;

        this.checkPageBreak(requiredHeight + spacingAfter);
        this.doc.text(lines, this.margin, this.y);
        this.y += requiredHeight + spacingAfter;
    }

    addBase64Image(base64: string, x: number, y: number, width: number, height: number) {
        try {
            const fullBase64 = `data:image/jpeg;base64,${base64}`;
            this.doc.addImage(fullBase64, 'JPEG', x, y, width, height);
        } catch (e) {
            console.error("PDF Image Error:", e);
        }
    }

    addTable(headers: string[], rows: (string|number)[][]) {
        this.checkPageBreak(20); // Check for header space
        (this.doc as any).autoTable({
            head: [headers],
            body: rows,
            startY: this.y,
            theme: 'grid',
            styles: {
                fontSize: 8,
                cellPadding: 2,
            },
            headStyles: {
                fillColor: [0, 191, 255], // accent
                textColor: [255, 255, 255],
                fontStyle: 'bold',
            }
        });
        this.y = (this.doc as any).autoTable.previous.finalY + 10;
    }

    generateToc() {
        this.doc.insertPage(2);
        this.doc.setPage(2);

        this.toc.forEach(entry => {
            if (entry.page > 1) {
                entry.page += 1;
            }
        });

        this.y = this.margin;
        this.addTitle("Table of Contents");

        this.doc.setFontSize(11);
        this.doc.setFont(undefined, 'normal');
        
        const itemYStart = this.y;
        const itemLineHeight = 8;
        
        this.toc.forEach((entry, index) => {
            const yPos = itemYStart + index * itemLineHeight;
            if (yPos > this.pageHeight - this.margin) {
                return;
            }
            this.doc.text(entry.title, this.margin, yPos);
            this.doc.text(String(entry.page), this.pageWidth + this.margin, yPos, { align: 'right' });
        });
    }

    addPageNumbers() {
        const totalPages = (this.doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            this.doc.setPage(i);
            this.doc.setFontSize(8);
            this.doc.setTextColor(150);
            
            if (i > 1) { // Do not number the cover page
                 this.doc.text(
                    `Page ${i}`,
                    this.pageWidth + this.margin,
                    this.pageHeight - 10,
                    { align: 'right' }
                );
            }
        }
    }

    save(filename: string) {
        this.doc.save(filename);
    }
}


const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-bg-secondary/50 p-6 rounded-lg mb-6 border border-border-color/50">
        <h3 className="text-2xl font-display font-bold mb-4 text-accent border-b-2 border-accent/30 pb-2">{title}</h3>
        {children}
    </div>
);

const Pill: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <span className={`text-sm font-semibold mr-2 px-2.5 py-0.5 rounded-full ${className}`}>
        {children}
    </span>
);


const AnalysisResult: React.FC<AnalysisResultProps> = ({ project, onNewProject, onUpdateStage2Data, onSave, onSaveAs, onExportProject, saveState, isReadOnly }) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('stage2');
    const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');

    const { stage1Result: stage1Data, stage2Result: stage2Data, stage3Result: stage3Data } = project;

    if (!stage1Data || !stage2Data || !stage3Data) {
        return <div>Error: Project data is incomplete.</div>;
    }
    
    const handleConceptArtChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const base64 = await fileToBase64(file);
            onUpdateStage2Data({ ...stage2Data, concept_art_base64: base64 });
        } catch (error) {
            console.error("Failed to convert concept art to base64", error);
        }
    };
    
    const handleMoviePosterChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const base64 = await fileToBase64(file);
            onUpdateStage2Data({ ...stage2Data, movie_poster_base64: base64 });
        } catch (error) {
            console.error("Failed to convert movie poster to base64", error);
        }
    };

    const handleCharacterImageChange = async (e: React.ChangeEvent<HTMLInputElement>, characterName: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const base64 = await fileToBase64(file);
            
            const updatedProfiles = stage2Data.character_profiles.map(profile => {
                if (profile.name === characterName) {
                    return { ...profile, image_base64: base64 };
                }
                return profile;
            });
    
            onUpdateStage2Data({ ...stage2Data, character_profiles: updatedProfiles });
        } catch (error) {
            console.error(`Failed to convert image for ${characterName} to base64`, error);
        }
    };

    const generateMarkdown = (): string => {
        let md = `# Script Sentinel Analysis: ${stage2Data.title}\n\n`;
        md += `## Stage 1: Deconstruction\n\n`;
        md += `**Page Count:** ${stage1Data.page_count}\n\n`;
        md += `**Logline:** ${stage1Data.logline}\n\n`;
        
        md += `## Stage 2: Pitch Deck\n\n`;
        md += `**Genre:** ${stage2Data.genre}\n\n`;
        md += `**Final Rating:** ${stage2Data.final_rating.score}/10\n\n`;

        md += `## Stage 3: Production Breakdown\n\n`;
        md += `**Total Shooting Days:** ${stage3Data.scheduling_suggestions.total_shooting_days}\n\n`;
        md += `### Scene Breakdown\n| Scene | Page | Location | Time | 1/8s |\n|---|---|---|---|---|\n`;
        stage3Data.scene_breakdown.forEach(s => {
            md += `| ${s.scene_number} | ${s.page_number} | ${s.location} | ${s.time_of_day} | ${s.estimated_length_eighths} |\n`;
        });

        return md;
    };
    
    const exportToPdf = () => {
        if (!window.jspdf) {
             console.error("jsPDF not loaded");
             alert("PDF export library not ready. Please try again in a moment.");
             return;
        }
        
        const pdf = new PdfHelper();

        if (typeof (pdf.doc as any).autoTable !== 'function') {
            console.error("jsPDF autoTable plugin not loaded");
            alert("PDF export table plugin not ready. Please try again.");
            return;
        }

        // --- PAGE 1: COVER PAGE & SUMMARY ---
        pdf.addTitle(`Script Sentinel Analysis: ${stage2Data.title}`);

        pdf.addSubtitle("Executive Summary", true);
        
        // Movie Poster or Concept Art
        const coverImage = stage2Data.movie_poster_base64 || stage2Data.concept_art_base64;
        
        if (coverImage) {
            let imgWidth, imgHeight;
            if (stage2Data.movie_poster_base64) {
                 // Portrait style
                 imgWidth = 100;
                 imgHeight = 150;
                 // Center it
                 const x = (pdf.pageWidth - imgWidth) / 2 + pdf.margin;
                 pdf.checkPageBreak(imgHeight + 5);
                 pdf.addBase64Image(coverImage, x, pdf.y, imgWidth, imgHeight);
            } else {
                 // Landscape style
                 imgHeight = pdf.pageWidth * (9 / 16);
                 pdf.checkPageBreak(imgHeight + 5);
                 pdf.addBase64Image(coverImage, pdf.margin, pdf.y, pdf.pageWidth, imgHeight);
            }
            pdf.y += imgHeight + 5;
        }
        pdf.addText(`Title: ${stage2Data.title} by ${stage2Data.author}`);
        pdf.addText(`Genre: ${stage2Data.genre} | Page Count: ${stage1Data.page_count}`);
        pdf.addText(`Logline: ${stage1Data.logline}`, true);
        pdf.y += 5;
        pdf.addText(`Final Rating: ${stage2Data.final_rating.score.toFixed(1)}/10`);
        pdf.addText(stage2Data.final_rating.justification);
        pdf.y += 10;
        
        pdf.addSubtitle("Synopsis", true);
        pdf.addText(stage1Data.synopsis.brief);

        // --- CHARACTER PROFILES PAGE ---
        pdf.doc.addPage();
        pdf.addTitle("Character Profiles", true);
        
        const addSection = (title: string, content: string, isLast: boolean = false) => {
            pdf.checkPageBreak(pdf.lineHeight * 2);
            pdf.doc.setFontSize(11);
            pdf.doc.setFont(undefined, 'bold');
            pdf.doc.text(title, pdf.margin, pdf.y);
            pdf.y += pdf.lineHeight - 2;

            pdf.doc.setFontSize(10);
            pdf.doc.setFont(undefined, 'normal');
            const contentLines = pdf.doc.splitTextToSize(content, pdf.pageWidth);
            const requiredHeight = contentLines.length * (pdf.lineHeight - 2);
            const spacingAfter = isLast ? 0 : 6;
            pdf.checkPageBreak(requiredHeight + spacingAfter);
            pdf.doc.text(contentLines, pdf.margin, pdf.y);
            pdf.y += requiredHeight + spacingAfter;
        };

        for (const char of stage2Data.character_profiles) {
            pdf.checkPageBreak(char.image_base64 ? 90 : 40);
            pdf.addSubtitle(char.name);

            if (char.image_base64) {
                const imgWidth = 50;
                const imgHeight = (imgWidth / 3) * 4;
                const originalMargin = pdf.margin;
                const originalY = pdf.y;
                
                pdf.addBase64Image(char.image_base64, pdf.margin, pdf.y, imgWidth, imgHeight);
                
                pdf.margin += imgWidth + 5;
                pdf.pageWidth -= (imgWidth + 5);

                pdf.addText(char.description, true);
                addSection("Motivation", char.motivation);
                addSection("Character Arc", char.arc, true);

                pdf.margin = originalMargin;
                pdf.pageWidth += (imgWidth + 5);
                pdf.y = Math.max(pdf.y, originalY + imgHeight + 5);

            } else {
                pdf.addText(char.description, true);
                addSection("Motivation", char.motivation);
                addSection("Character Arc", char.arc, true);
            }
            pdf.y += 10; // Consistent space between character profiles
        };
        
        // --- VISUAL DIRECTION PAGE ---
        pdf.doc.addPage();
        pdf.addTitle("Visual Direction", true);

        pdf.addSubtitle("Visual Style Suggestion");
        pdf.addText(stage2Data.visual_style_suggestion);
        pdf.y += 10;
        
        if (stage2Data.visual_style_images_base64 && stage2Data.visual_style_images_base64.length > 0) {
            pdf.addSubtitle("Visual Style Examples");
            const imagesToDisplay = stage2Data.visual_style_images_base64.slice(0, 4);
            const imgWidth = pdf.pageWidth / 2 - 2;
            const imgHeight = imgWidth * (9/16);
            const gap = 4;
            
            let startY = pdf.y;

            for (let i = 0; i < imagesToDisplay.length; i++) {
                const row = Math.floor(i / 2);
                const col = i % 2;
                
                const currentY = startY + (row * (imgHeight + gap));
                pdf.checkPageBreak(imgHeight); // Check if a new row would fit
                
                const x = pdf.margin + col * (imgWidth + gap);
                pdf.addBase64Image(imagesToDisplay[i], x, currentY, imgWidth, imgHeight);
            }

            const numRows = Math.ceil(imagesToDisplay.length / 2);
            if (numRows > 0) {
                const totalHeight = (numRows * imgHeight) + ((numRows - 1) * gap);
                pdf.y = startY + totalHeight + 10; // Update y to be below all images + a margin
            }
        }

        if(stage2Data.comparable_titles_visuals && stage2Data.comparable_titles_visuals.length > 0) {
            pdf.addSubtitle("Comparable Titles");
            const posterWidth = pdf.pageWidth / 3 - 4;
            const posterHeight = posterWidth * (4/3);
            pdf.checkPageBreak(posterHeight + 10);
            stage2Data.comparable_titles_visuals.forEach((comp, i) => {
                const x = pdf.margin + i * (posterWidth + 4);
                if (comp.image_base64) {
                    pdf.addBase64Image(comp.image_base64, x, pdf.y, posterWidth, posterHeight);
                }
                const titleLines = pdf.doc.splitTextToSize(comp.title, posterWidth);
                pdf.doc.setFontSize(8);
                pdf.doc.text(titleLines, x + posterWidth/2, pdf.y + posterHeight + 4, { align: 'center' });
            });
            pdf.y += posterHeight + 10;
        }
        
        // --- PRODUCTION BREAKDOWN PAGE ---
        pdf.doc.addPage();
        pdf.addTitle("Stage 3: Production Breakdown", true);
        
        pdf.addSubtitle("Shooting Schedule", true);
        pdf.addText(`Estimated Total Shooting Days: ${stage3Data.scheduling_suggestions.total_shooting_days}`);
        pdf.addTable(
            ['Day', 'Scenes', 'Location', 'Notes'],
            stage3Data.scheduling_suggestions.shooting_schedule.map(d => [d.day, d.scenes, d.location, d.notes])
        );

        pdf.addSubtitle("Scene Breakdown", true);
        pdf.addTable(
            ['#', 'Page', 'Location', 'Time', '1/8s'],
            stage3Data.scene_breakdown.map(s => [s.scene_number, s.page_number, s.location, s.time_of_day, s.estimated_length_eighths])
        );
        
        pdf.addSubtitle("Character Breakdown", true);
        pdf.addTable(
            ['Character', 'Role Type', 'Scene Appearances'],
            stage3Data.character_breakdown.map(c => [c.name, c.role_type, c.scene_appearances.length])
        );

        pdf.addSubtitle("Location Breakdown", true);
        pdf.addTable(
            ['Location', 'Status', 'Scene Count'],
            stage3Data.location_breakdown.map(l => [l.location, l.is_unique ? 'Unique' : 'Recurring', l.scenes.length])
        );

        const allElements = [
            ...stage3Data.props_and_set_dressing,
            ...stage3Data.wardrobe_and_makeup,
            ...stage3Data.special_requirements
        ];

        if (allElements.length > 0) {
            pdf.addSubtitle("Departmental Elements", true);
            pdf.addTable(
                ['Element', 'Department', 'Description'],
                allElements.map(e => [e.name, e.department, e.description])
            );
        }

        // --- FINALIZATION: Add TOC and Page Numbers ---
        pdf.generateToc();
        pdf.addPageNumbers();

        const filename = `${stage2Data.title.replace(/\s/g, '_')}_analysis.pdf`;
        pdf.save(filename);
    };

    const handleExportResults = () => {
        const combinedData = {
            stage1_deconstruction: stage1Data,
            stage2_pitch_deck: stage2Data,
            stage3_production: stage3Data,
        };
        const filename = `${stage2Data.title.replace(/\s/g, '_')}_analysis`;

        if (exportFormat === 'json') {
            const jsonString = JSON.stringify(combinedData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            triggerDownload(blob, `${filename}.json`);
        } else if (exportFormat === 'markdown') {
            const markdownString = generateMarkdown();
            const blob = new Blob([markdownString], { type: 'text/markdown' });
            triggerDownload(blob, `${filename}.md`);
        } else if (exportFormat === 'pdf') {
            setTimeout(() => {
                exportToPdf();
            }, 100);
        }
    };
    
    const triggerDownload = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const NavTab: React.FC<{
        label: string;
        tab: ActiveTab;
        icon?: React.ReactNode;
    }> = ({ label, tab, icon }) => {
        const isActive = activeTab === tab;
        return (
            <button
                onClick={() => setActiveTab(tab)}
                className={`relative whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg flex items-center gap-2 transition-all duration-300 ${isActive ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-color'}`}
            >
                {icon}
                {label}
                {isActive && <div className="absolute bottom-[-2px] left-0 w-full h-0.5 bg-accent shadow-accent-glow"></div>}
            </button>
        );
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-3xl font-display font-bold truncate pr-4" title={project.name}>{project.name}</h2>
                {!isReadOnly && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={onSave}
                            disabled={saveState !== 'idle'}
                            className="flex items-center justify-center gap-2 w-[110px] px-4 py-2 bg-bg-secondary hover:bg-surface border border-border-color text-text-primary font-semibold rounded-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {saveState === 'idle' && <> <SaveIcon className="w-5 h-5"/> <span>Save</span> </>}
                            {saveState === 'saving' && <> <SpinnerIcon className="w-5 h-5 animate-spin"/> <span>Saving...</span> </>}
                            {saveState === 'saved' && <> <CheckCircleIcon className="w-5 h-5 text-green-400"/> <span>Saved!</span> </>}
                        </button>
                         <button
                            onClick={onSaveAs}
                            className="px-4 py-2 bg-bg-secondary hover:bg-surface border border-border-color text-text-primary font-semibold rounded-lg transition-colors duration-200"
                        >
                            Save As...
                        </button>
                        <button
                            onClick={onNewProject}
                            className="flex items-center gap-2 px-4 py-2 bg-bg-secondary hover:bg-surface border border-border-color text-text-primary font-semibold rounded-lg transition-colors duration-200"
                        >
                            <PlusCircleIcon className="w-5 h-5"/>
                            New Project
                        </button>
                    </div>
                )}
            </div>

             <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h3 className="text-xl font-display font-semibold">Export Options</h3>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="bg-bg-secondary rounded-lg p-1 flex border border-border-color">
                         <button onClick={() => setExportFormat('markdown')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${exportFormat === 'markdown' ? 'bg-accent text-bg-primary' : 'text-text-secondary hover:bg-surface'}`}>MD</button>
                         <button onClick={() => setExportFormat('json')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${exportFormat === 'json' ? 'bg-accent text-bg-primary' : 'text-text-secondary hover:bg-surface'}`}>JSON</button>
                         <button onClick={() => setExportFormat('pdf')} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${exportFormat === 'pdf' ? 'bg-accent text-bg-primary' : 'text-text-secondary hover:bg-surface'}`}>PDF</button>
                    </div>
                     <button
                        onClick={handleExportResults}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-colors duration-200"
                    >
                        <ExportIcon className="w-5 h-5"/>
                        Export Results
                    </button>
                    <button
                        onClick={onExportProject}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors duration-200"
                    >
                        <DownloadIcon className="w-5 h-5"/>
                        Export Project File
                    </button>
                </div>
            </div>
            
            <div className="border-b border-border-color">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <NavTab tab="stage1" label="Deconstruction" />
                    <NavTab tab="stage2" label="Pitch Deck" />
                    <NavTab tab="stage3" label="Production" icon={<ClipboardListIcon className="w-5 h-5" />} />
                </nav>
            </div>

            {/* Stage 1 Content */}
            <div className={activeTab === 'stage1' ? '' : 'hidden'}>
                <Section title="Script Overview">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-bg-secondary p-4 rounded-lg">
                            <h4 className="font-bold text-text-secondary">Total Pages</h4>
                            <p className="text-3xl font-semibold text-accent">{stage1Data.page_count}</p>
                        </div>
                         <div className="bg-bg-secondary p-4 rounded-lg">
                            <h4 className="font-bold text-text-secondary">Logline</h4>
                            <p className="text-lg italic text-text-primary">{stage1Data.logline}</p>
                        </div>
                    </div>
                </Section>
                <Section title="Synopsis">
                    <h4 className="text-xl font-display font-bold mb-2 text-text-primary">Brief Synopsis</h4>
                    <p className="whitespace-pre-wrap text-text-secondary leading-relaxed mb-6">{stage1Data.synopsis.brief}</p>
                    <details className="bg-bg-secondary p-4 rounded-lg open:bg-accent/10">
                        <summary className="cursor-pointer font-semibold text-lg">View Extended Synopsis</summary>
                         <p className="whitespace-pre-wrap text-text-secondary leading-relaxed mt-4">{stage1Data.synopsis.extended}</p>
                    </details>
                </Section>
                <Section title="Structural Breakdown">
                    {stage1Data.acts.map(act => (
                        <details key={act.act_number} className="mb-4 bg-bg-secondary p-4 rounded-lg open:bg-accent/10">
                            <summary className="cursor-pointer font-semibold text-lg">{`Act ${act.act_number}: ${act.title}`}</summary>
                            <div className="mt-4 pl-4 border-l-2 border-accent/50">
                                {act.scene_breakdown.map(scene => (
                                    <div key={scene.scene_number} className="mb-3">
                                        <p className="font-bold">{scene.setting}</p>
                                        <p className="text-text-secondary">{scene.summary}</p>
                                    </div>
                                ))}
                            </div>
                        </details>
                    ))}
                </Section>
                 <Section title="Characters">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stage1Data.characters.map(char => (
                            <div key={char.name} className="bg-bg-secondary p-4 rounded-md">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="font-bold text-lg text-text-primary">{char.name}</p>
                                    <Pill className={char.screen_presence === 'on-screen' ? 'bg-green-900/50 text-green-300' : 'bg-blue-900/50 text-blue-300'}>
                                        {char.screen_presence}
                                    </Pill>
                                </div>
                                <p className="text-text-secondary">{char.description}</p>
                            </div>
                        ))}
                    </div>
                </Section>
                <Section title="Integrity Check">
                    <p className={`font-bold ${stage1Data.integrity_check.issues_found ? 'text-red-400' : 'text-green-400'}`}>
                        {stage1Data.integrity_check.issues_found ? 'Issues Found' : 'No Issues Found'}
                    </p>
                    <p className="text-text-secondary mt-2">{stage1Data.integrity_check.details}</p>
                </Section>
            </div>
            
            {/* Stage 2 Content */}
            <div className={activeTab === 'stage2' ? '' : 'hidden'}>
                
                {/* Official Movie Poster Section */}
                <Section title="Official Movie Poster">
                     {stage2Data.movie_poster_base64 ? (
                        <div className="flex justify-center">
                            <div className="relative group w-full max-w-md">
                                <img 
                                    src={`data:image/jpeg;base64,${stage2Data.movie_poster_base64}`}
                                    alt="Official Movie Poster"
                                    className="w-full h-auto rounded-lg shadow-2xl border-4 border-black"
                                />
                                {!isReadOnly && (
                                    <>
                                        <label htmlFor="movie-poster-upload" className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer rounded-lg">
                                            <ReplaceIcon className="w-10 h-10 mb-2" />
                                            <span className="font-semibold">Replace Poster</span>
                                        </label>
                                        <input id="movie-poster-upload" type="file" className="hidden" accept="image/*" onChange={handleMoviePosterChange} />
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div>
                             <label htmlFor="movie-poster-upload" className={`w-full max-w-sm mx-auto aspect-[2/3] bg-bg-primary border-2 border-dashed border-border-color rounded-lg flex flex-col items-center justify-center text-text-secondary  transition-colors ${!isReadOnly && 'hover:bg-surface hover:border-accent cursor-pointer'}`}>
                                <UploadIcon className="w-12 h-12 mb-2" />
                                <span className="text-lg font-semibold text-center">Add Movie Poster</span>
                                <span className="text-sm">Auto-adjusts to image size</span>
                            </label>
                            {!isReadOnly && <input id="movie-poster-upload" type="file" className="hidden" accept="image/*" onChange={handleMoviePosterChange} />}
                        </div>
                    )}
                </Section>

                <Section title="Concept Art">
                    {stage2Data.concept_art_base64 ? (
                        <div className="relative group">
                            <img 
                                src={`data:image/jpeg;base64,${stage2Data.concept_art_base64}`}
                                alt="Movie Concept Art"
                                className="w-full h-auto rounded-lg shadow-lg object-cover"
                            />
                            {!isReadOnly && (
                                <>
                                    <label htmlFor="concept-art-upload" className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer rounded-lg">
                                        <ReplaceIcon className="w-10 h-10 mb-2" />
                                        <span className="font-semibold">Replace Concept Art</span>
                                    </label>
                                    <input id="concept-art-upload" type="file" className="hidden" accept="image/*" onChange={handleConceptArtChange} />
                                </>
                            )}
                        </div>
                    ) : (
                        <div>
                             <label htmlFor="concept-art-upload" className={`w-full aspect-video bg-bg-primary border-2 border-dashed border-border-color rounded-lg flex flex-col items-center justify-center text-text-secondary  transition-colors ${!isReadOnly && 'hover:bg-surface hover:border-accent cursor-pointer'}`}>
                                <UploadIcon className="w-12 h-12 mb-2" />
                                <span className="text-lg font-semibold text-center">Add Concept Art</span>
                                <span className="text-sm">Recommended Aspect Ratio: 16:9</span>
                            </label>
                            {!isReadOnly && <input id="concept-art-upload" type="file" className="hidden" accept="image/*" onChange={handleConceptArtChange} />}
                        </div>
                    )}
                </Section>
                <Section title="Pitch Deck Overview">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <div><strong className="text-text-secondary">Title:</strong> {stage2Data.title}</div>
                        <div><strong className="text-text-secondary">Author:</strong> {stage2Data.author}</div>
                        <div><strong className="text-text-secondary">Genre:</strong> {stage2Data.genre}</div>
                        <div><strong className="text-text-secondary">Tone:</strong> {stage2Data.tone}</div>
                    </div>
                    <div className="mt-4">
                        <strong className="text-text-secondary block mb-1">Logline:</strong>
                        <p className="italic text-text-primary">{stage2Data.logline}</p>
                    </div>
                </Section>
                <Section title="Tone and Mood">
                    <p className="whitespace-pre-wrap text-text-secondary leading-relaxed">{stage2Data.tone_and_mood_details}</p>
                </Section>
                <Section title="Final Rating">
                    <div className="flex items-center gap-4 bg-bg-secondary p-4 rounded-lg">
                        <div className="text-5xl font-bold text-accent">{stage2Data.final_rating.score.toFixed(1)}</div>
                        <div className="flex items-center">
                            {[...Array(10)].map((_, i) => (
                                <StarIcon key={i} className={`w-6 h-6 ${i < Math.round(stage2Data.final_rating.score) ? 'text-accent-secondary' : 'text-border-color'}`} />
                            ))}
                        </div>
                    </div>
                    <p className="mt-4 text-text-secondary">{stage2Data.final_rating.justification}</p>
                </Section>
                <Section title="Character Profiles">
                     {stage2Data.character_profiles.map(char => (
                        <details key={char.name} className="mb-4 bg-bg-secondary p-4 rounded-lg open:bg-accent/10 transition-colors duration-200" open>
                            <summary className="cursor-pointer font-semibold text-lg text-text-primary flex items-center justify-between">
                                <span>{char.name}</span>
                                <Pill className={char.screen_presence === 'on-screen' ? 'bg-green-900/50 text-green-300' : 'bg-blue-900/50 text-blue-300'}>
                                        {char.screen_presence}
                                </Pill>
                            </summary>
                            <div className="mt-4 flex flex-col md:flex-row gap-6 pl-4 border-l-2 border-accent/50">
                                <div className="flex-shrink-0 w-40">
                                    {char.image_base64 ? (
                                        <div className="relative group">
                                            <img 
                                                src={`data:image/jpeg;base64,${char.image_base64}`}
                                                alt={`Portrait of ${char.name}`}
                                                className="w-40 h-auto rounded-md shadow-md object-cover aspect-[3/4]"
                                            />
                                            {!isReadOnly && (
                                                <label htmlFor={`char-img-upload-${char.name}`} className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white text-sm text-center p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer rounded-md">
                                                    <ReplaceIcon className="w-8 h-8 mb-1" />
                                                    <span>Replace Image</span>
                                                </label>
                                            )}
                                        </div>
                                    ) : (
                                        <label htmlFor={`char-img-upload-${char.name}`} className={`w-40 h-auto aspect-[3/4] bg-bg-primary border-2 border-dashed border-border-color rounded-md flex flex-col items-center justify-center text-text-secondary  transition-colors ${!isReadOnly && 'hover:bg-surface hover:border-accent cursor-pointer'}`}>
                                            <UploadIcon className="w-8 h-8 mb-2" />
                                            <span className="text-sm font-semibold text-center">Add Portrait</span>
                                        </label>
                                    )}
                                    {!isReadOnly && <input id={`char-img-upload-${char.name}`} type="file" className="hidden" accept="image/*" onChange={(e) => handleCharacterImageChange(e, char.name)} />}
                                </div>
                                <div className="space-y-4 flex-grow">
                                    <p className="text-text-secondary italic">{char.description}</p>
                                    <div>
                                        <h4 className="font-semibold text-accent mb-1">Motivation</h4>
                                        <p className="text-text-secondary">{char.motivation}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-accent mb-1">Character Arc</h4>
                                        <p className="text-text-secondary">{char.arc}</p>
                                    </div>
                                </div>
                            </div>
                        </details>
                    ))}
                </Section>
                 <Section title="Treatment">
                    <p className="whitespace-pre-wrap text-text-secondary leading-relaxed">{stage2Data.treatment}</p>
                </Section>
                 <Section title="Themes & Motifs">
                    <div className="space-y-4">
                        {stage2Data.themes_and_motifs.map((item) => (
                            <div key={item.theme} className="grid grid-cols-3 items-center gap-4">
                                <div className="col-span-1 font-semibold text-text-primary truncate pr-4">{item.theme}</div>
                                <div className="col-span-2 flex items-center gap-2">
                                    <div className="w-full bg-bg-primary rounded-full h-4">
                                        <div
                                            className="bg-gradient-to-r from-blue-500 to-accent h-4 rounded-full transition-all duration-500"
                                            style={{ width: `${item.prominence * 10}%` }}
                                            aria-valuenow={item.prominence}
                                            aria-valuemin={0}
                                            aria-valuemax={10}
                                            role="progressbar"
                                        ></div>
                                    </div>
                                    <div className="text-sm font-bold text-text-secondary w-10 text-right">{item.prominence}/10</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
                <Section title="Target Audience">
                     <p className="text-text-primary">{stage2Data.target_audience}</p>
                </Section>
                <Section title="Comparable Titles">
                    {stage2Data.comparable_titles_visuals && stage2Data.comparable_titles_visuals.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {stage2Data.comparable_titles_visuals.map(comp => (
                                <div key={comp.title} className="text-center flex flex-col">
                                    {comp.image_base64 ? (
                                        <img 
                                            src={`data:image/jpeg;base64,${comp.image_base64}`}
                                            alt={`Poster for ${comp.title}`}
                                            className="w-full rounded-md shadow-md object-cover aspect-[3/4] mb-2"
                                        />
                                    ) : (
                                        <div className="w-full aspect-[3/4] bg-bg-secondary rounded-md flex items-center justify-center border border-border-color mb-2">
                                            <span className="text-text-secondary text-xs p-2">No Poster Available</span>
                                        </div>
                                    )}
                                    <p className="font-semibold text-sm mb-1">{comp.title}</p>
                                    <a 
                                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(comp.title + ' official trailer')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center gap-1.5 mt-auto text-xs text-accent hover:text-accent-secondary transition-colors"
                                        aria-label={`Search for ${comp.title} official trailer on YouTube`}
                                    >
                                        <VideoIcon className="w-4 h-4" />
                                        <span>Watch Trailer</span>
                                    </a>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            {stage2Data.comparable_titles.map((title) => (
                                <Pill key={title} className="bg-surface text-text-primary border border-border-color">
                                    {title}
                                </Pill>
                            ))}
                        </div>
                    )}
                </Section>
                <Section title="Visual Direction">
                    <p className="mb-4 text-text-secondary">{stage2Data.visual_style_suggestion}</p>
                    {stage2Data.visual_style_images_base64 && stage2Data.visual_style_images_base64.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {stage2Data.visual_style_images_base64.map((imgBase64, index) => (
                                <img 
                                    key={index}
                                    src={`data:image/jpeg;base64,${imgBase64}`}
                                    alt={`Visual style example ${index + 1}`}
                                    className="w-full h-auto rounded-lg shadow-lg object-cover aspect-video"
                                />
                            ))}
                        </div>
                    )}
                </Section>
                <Section title="Analysis Checklist">
                    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {stage2Data.completion_checklist.map((item, index) => (
                            <li key={index} className="flex items-center gap-3 p-3 bg-bg-secondary rounded-lg">
                                <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <span className="text-text-primary">{item}</span>
                            </li>
                        ))}
                    </ul>
                </Section>
            </div>
            
            {/* Stage 3 Content */}
            <div className={activeTab === 'stage3' ? '' : 'hidden'}>
                 <Section title="Scheduling Suggestions">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-center">
                        <div className="bg-bg-secondary p-4 rounded-lg">
                            <h4 className="font-bold text-text-secondary">Total Shooting Days</h4>
                            <p className="text-2xl font-semibold text-accent">{stage3Data.scheduling_suggestions.total_shooting_days}</p>
                        </div>
                         <div className="bg-bg-secondary p-4 rounded-lg">
                            <h4 className="font-bold text-text-secondary">Day/Night Balance</h4>
                            <p className="text-2xl font-semibold text-accent">{stage3Data.scheduling_suggestions.day_night_balance}</p>
                        </div>
                    </div>
                     <div className="overflow-x-auto relative">
                        <table className="w-full text-sm text-left text-text-secondary">
                            <thead className="text-xs text-text-primary uppercase bg-bg-secondary/50">
                                <tr>
                                    <th scope="col" className="py-3 px-6">Day</th>
                                    <th scope="col" className="py-3 px-6">Scenes</th>
                                    <th scope="col" className="py-3 px-6">Location</th>
                                    <th scope="col" className="py-3 px-6">Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stage3Data.scheduling_suggestions.shooting_schedule.map(day => (
                                    <tr key={day.day} className="border-b border-border-color hover:bg-surface/50">
                                        <td className="py-4 px-6 font-bold">{day.day}</td>
                                        <td className="py-4 px-6 font-medium">{day.scenes}</td>
                                        <td className="py-4 px-6 text-text-primary">{day.location}</td>
                                        <td className="py-4 px-6">{day.notes}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 </Section>
                 <Section title="Scene Breakdown">
                    <div className="overflow-x-auto relative">
                        <table className="w-full text-sm text-left text-text-secondary">
                            <thead className="text-xs text-text-primary uppercase bg-bg-secondary/50">
                                <tr>
                                    <th scope="col" className="py-3 px-6">#</th>
                                    <th scope="col" className="py-3 px-6">Page</th>
                                    <th scope="col" className="py-3 px-6">Location</th>
                                    <th scope="col" className="py-3 px-6">Time</th>
                                    <th scope="col" className="py-3 px-6">1/8s</th>
                                    <th scope="col" className="py-3 px-6">Summary</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stage3Data.scene_breakdown.map(scene => (
                                    <tr key={scene.scene_number} className="border-b border-border-color hover:bg-surface/50">
                                        <td className="py-4 px-6 font-bold">{scene.scene_number}</td>
                                        <td className="py-4 px-6">{scene.page_number}</td>
                                        <td className="py-4 px-6 font-medium text-text-primary">{scene.location}</td>
                                        <td className="py-4 px-6">{scene.time_of_day}</td>
                                        <td className="py-4 px-6">{scene.estimated_length_eighths}</td>
                                        <td className="py-4 px-6">{scene.summary}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 </Section>
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Section title="Character Breakdown">
                         <ul className="space-y-2">
                            {stage3Data.character_breakdown.map(char => (
                                <li key={char.name} className="flex justify-between items-center bg-bg-secondary p-3 rounded-md">
                                    <span className="font-bold">{char.name}</span>
                                    <Pill className={char.role_type === 'Speaking' ? 'bg-accent/20 text-accent' : 'bg-gray-700/50 text-gray-300'}>
                                        {char.role_type} ({char.scene_appearances.length} scenes)
                                    </Pill>
                                </li>
                            ))}
                         </ul>
                    </Section>
                     <Section title="Location Breakdown">
                         <ul className="space-y-2">
                            {stage3Data.location_breakdown.map(loc => (
                                <li key={loc.location} className="flex justify-between items-center bg-bg-secondary p-3 rounded-md">
                                    <span className="font-bold">{loc.location}</span>
                                    <Pill className={loc.is_unique ? 'bg-accent-secondary/20 text-accent-secondary' : 'bg-green-900/50 text-green-300'}>
                                        {loc.is_unique ? 'Unique' : 'Recurring'} ({loc.scenes.length} scenes)
                                    </Pill>
                                </li>
                            ))}
                         </ul>
                    </Section>
                 </div>
                 <Section title="Departmental Elements">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div><h4 className="font-bold mb-2">Props & Set Dressing</h4><ul className="list-disc pl-5 space-y-1 text-sm">{stage3Data.props_and_set_dressing.map(p=><li key={p.name}>{p.name}</li>)}</ul></div>
                         <div><h4 className="font-bold mb-2">Wardrobe & Makeup</h4><ul className="list-disc pl-5 space-y-1 text-sm">{stage3Data.wardrobe_and_makeup.map(p=><li key={p.name}>{p.name}</li>)}</ul></div>
                         <div><h4 className="font-bold mb-2">Special Requirements</h4><ul className="list-disc pl-5 space-y-1 text-sm">{stage3Data.special_requirements.map(p=><li key={p.name}>{p.name}</li>)}</ul></div>
                     </div>
                 </Section>
                 <Section title="Risk Assessment">
                    <ul className="list-disc pl-5 space-y-2 text-text-secondary">
                        {stage3Data.risk_assessment.map((risk, i) => <li key={i}>{risk}</li>)}
                    </ul>
                 </Section>
            </div>
        </div>
    );
};

export default AnalysisResult;
