
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AnalysisStatus, Stage1Result, Stage2Result, Stage3Result, Project, Stage3Result as Stage3Data, ShotIdea, SceneOverview, CharacterDesign, FullScene, ImageStudioState, AIPrompterResult, SavedShotList, StoryboardData } from './types';
import { analyzeStage1, analyzeStage2, analyzeStage3, generateAllVisuals, extractScenes } from './services/geminiService';
import ScriptInput from './components/ScriptInput';
import AnalysisInProgress from './components/AnalysisInProgress';
import AnalysisResult from './components/AnalysisResult';
import ImageStudio from './components/ImageStudio';
import ScriptGenerator from './components/ScriptGenerator';
import ShotIdeaStudio from './components/ShotIdeaStudio';
import SceneSelect from './components/SceneSelect';
import AIPrompter from './components/AIPrompter';
import { FilmIcon, ImageIcon, FolderIcon, LightbulbIcon, ClapperboardIcon, ClipboardCopyIcon, ShareIcon, InboxIcon, RobotIcon } from './components/icons';
import { initDB, saveProject, getProject, getAllProjects, deleteProject } from './db';
import ProjectManager from './components/ProjectManager';
import SaveProjectModal from './components/SaveProjectModal';
import VisualsChoiceModal from './components/VisualsChoiceModal';
import ThemeToggle from './components/ThemeToggle';
import ShareModal from './components/ShareModal';
import OpenSharedProjectModal from './components/OpenSharedProjectModal';


// This function now correctly initializes all tool-specific states
const createNewProject = (): Project => ({
  name: "Untitled Project",
  script: "",
  stage1Result: null,
  stage2Result: null,
  stage3Result: null,
  storyboardData: null,
  shotIdeasList: null,
  fullScenes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  scriptGeneratorIdea: '',
  shotIdeaStudioConfig: { genre: '', location: '', characterRace: '', skinTone: '', artisticStyle: '' },
  savedShotLists: [],
  imageStudioState: {
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
  },
  storyboardSceneDescription: '',
  storyboardRequestFromShots: undefined,
  shotIdeasListContext: undefined,
  storyboardRequestContext: undefined,
  aiPrompterSceneContent: '',
  aiPrompterResult: null,
  aiPrompterCharacterRegistry: {}
});

type ActiveTool = 'script' | 'image' | 'scriptGenerator' | 'shotIdea' | 'sceneSelect' | 'aiPrompter';

const App: React.FC = () => {
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>('script');

  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isVisualsModalOpen, setIsVisualsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isOpenSharedModalOpen, setIsOpenSharedModalOpen] = useState(false);
  const [scriptToAnalyze, setScriptToAnalyze] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isReadOnlyMode, setIsReadOnlyMode] = useState(false);
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Check for saved theme in localStorage, default to 'dark'
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark';
  });
  
  // Track visual generation options
  const [visualOptions, setVisualOptions] = useState<{ poster: boolean; concept: boolean; characters: boolean } | null>(null);

  const projectForAutoSaveRef = useRef<Project | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const shouldStopRef = useRef<boolean>(false);

  useEffect(() => {
    const initialize = async () => {
        // Normal initialization
        await initDB();
        await refreshProjectList();
        setCurrentProject(createNewProject());
    };
    initialize();
  }, []);

  // Effect to apply and save the theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const refreshProjectList = useCallback(async () => {
    const allProjects = await getAllProjects();
    setProjects(allProjects);
  }, []);

  // Keep ref updated with the latest project for periodic auto-save
  useEffect(() => {
    projectForAutoSaveRef.current = currentProject;
  }, [currentProject]);
  
  // Periodic auto-save every 2 minutes
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (projectForAutoSaveRef.current?.id && !isReadOnlyMode) {
        const projectToSave = { ...projectForAutoSaveRef.current, updatedAt: new Date() };
        saveProject(projectToSave)
          .then(() => {
            refreshProjectList();
          })
          .catch(err => {
            console.error("Periodic auto-save failed:", err);
          });
      }
    }, 120000); // 2 minutes

    return () => clearInterval(autoSaveInterval);
  }, [isReadOnlyMode, refreshProjectList]);

  // Auto-save current project on change (debounced)
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    if (currentProject?.id && !isReadOnlyMode) { // Only auto-save if it's a saved project and not read-only
      debounceTimeoutRef.current = window.setTimeout(() => {
        const updatedProject = { ...currentProject, updatedAt: new Date() };
        saveProject(updatedProject);
        refreshProjectList(); // Refresh list to update timestamp
      }, 1500); // Debounce for 1.5 seconds
    }
  }, [currentProject, isReadOnlyMode, refreshProjectList]);

  
  const handleNewProject = () => {
    setCurrentProject(createNewProject());
    setStatus(AnalysisStatus.IDLE);
    setError(null);
    setActiveTool('script');
    setIsReadOnlyMode(false);
    setFileHandle(null);
    setVisualOptions(null);
    shouldStopRef.current = false; // Reset stop flag on new project
  };

  const handleAnalysis = useCallback((scriptText: string) => {
    if (!scriptText.trim()) {
      setError('Script content cannot be empty.');
      return;
    }
    setScriptToAnalyze(scriptText);
    setIsVisualsModalOpen(true);
  }, []);

  // Triggered when Stop button is clicked
  const handleStopAnalysis = useCallback(() => {
      shouldStopRef.current = true;
      setStatus(AnalysisStatus.PAUSED);
  }, []);

  // Triggered when Resume button is clicked
  const handleResumeAnalysis = useCallback(() => {
      if (!currentProject) return;
      shouldStopRef.current = false;
      // Resume by re-calling executeAnalysis.
      executeAnalysis(visualOptions, true);
  }, [currentProject, visualOptions]);

  const executeAnalysis = useCallback(async (
      options: { poster: boolean; concept: boolean; characters: boolean } | null, 
      isResuming: boolean = false
  ) => {
    setIsVisualsModalOpen(false);
    
    // If we're starting fresh, reset stop ref and store visual choice
    if (!isResuming) {
        shouldStopRef.current = false;
        setVisualOptions(options);
    }

    const scriptText = scriptToAnalyze;
    if (!scriptText.trim()) return;

    // Determine working project state
    let activeProject: Project;
    
    if (isResuming && currentProject) {
        activeProject = currentProject;
    } else {
        // Create a fresh project for analysis, preserving the script text
        activeProject = { ...createNewProject(), script: scriptText };
        setCurrentProject(activeProject);
        setFileHandle(null);
    }

    setError(null);

    // --- STAGE 1 ---
    if (!activeProject.stage1Result) {
        if (shouldStopRef.current) { setStatus(AnalysisStatus.PAUSED); return; }
        setStatus(AnalysisStatus.ANALYZING_STAGE_1);
        try {
            const result1 = await analyzeStage1(scriptText);
            activeProject = { ...activeProject, stage1Result: result1 };
            setCurrentProject(activeProject);
        } catch (err) { handleError(err); return; }
    }

    // --- STAGE 2 ---
    if (!activeProject.stage2Result) {
        if (shouldStopRef.current) { setStatus(AnalysisStatus.PAUSED); return; }
        setStatus(AnalysisStatus.ANALYZING_STAGE_2);
        try {
            const logline = activeProject.stage1Result?.logline || "";
            const synopsis = activeProject.stage1Result?.synopsis.extended || "";
            const result2 = await analyzeStage2(scriptText, logline, synopsis);
            activeProject = { ...activeProject, stage2Result: result2 };
            setCurrentProject(activeProject);
        } catch (err) { handleError(err); return; }
    }

    // --- STAGE 2 VISUALS (Optional) ---
    const needVisuals = options && (options.poster || options.concept || options.characters);
    
    if (needVisuals) {
        // Check if visuals are already generated (basic check)
        const hasSomeVisuals = activeProject.stage2Result?.concept_art_base64 || activeProject.stage2Result?.movie_poster_base64;
        
        // If resuming, we might have partial visuals, but let's assume if the result fields are missing we need to run it
        // A more robust check would see if specific requested fields are missing.
        
        if (shouldStopRef.current) { setStatus(AnalysisStatus.PAUSED); return; }
        setStatus(AnalysisStatus.ANALYZING_STAGE_2_VISUALS);
        try {
            const visuals = await generateAllVisuals(activeProject.stage2Result!, options!);
            
            const updatedResult2: Stage2Result = { ...activeProject.stage2Result! };
            if (visuals.concept_art_base64) updatedResult2.concept_art_base64 = visuals.concept_art_base64;
            if (visuals.movie_poster_base64) updatedResult2.movie_poster_base64 = visuals.movie_poster_base64;
            
            if (visuals.character_portraits.length > 0) {
                updatedResult2.character_profiles = updatedResult2.character_profiles.map(profile => {
                    const portrait = visuals.character_portraits.find(p => p.name === profile.name);
                    return portrait ? { ...profile, image_base64: portrait.image_base64 } : profile;
                });
            }
            if (visuals.comparable_titles_visuals.length > 0) updatedResult2.comparable_titles_visuals = visuals.comparable_titles_visuals;
            if (visuals.visual_style_images_base64.length > 0) updatedResult2.visual_style_images_base64 = visuals.visual_style_images_base64;
            
            activeProject = { ...activeProject, stage2Result: updatedResult2 };
            setCurrentProject(activeProject);
        } catch (err) { handleError(err); return; }
    }
    
    // --- STAGE 3 ---
    if (!activeProject.stage3Result) {
        if (shouldStopRef.current) { setStatus(AnalysisStatus.PAUSED); return; }
        setStatus(AnalysisStatus.ANALYZING_STAGE_3);
        try {
            const result3 = await analyzeStage3(scriptText);
            const fullScenes = await extractScenes(scriptText);
            activeProject = { ...activeProject, stage3Result: result3, fullScenes: fullScenes };
            setCurrentProject(activeProject);
        } catch (err) { handleError(err); return; }
    }
    
    setStatus(AnalysisStatus.COMPLETE);

  }, [scriptToAnalyze, currentProject]);

  const handleError = (err: unknown) => {
      console.error(err);
      let errorMessage = 'An unknown error occurred during analysis.';
      if (err instanceof Error) {
        if (err.message.includes('429') || err.message.includes('RESOURCE_EXHAUSTED')) {
          errorMessage = "API quota exceeded. Please check your plan and billing details. For more information, see https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your usage, visit https://ai.dev/usage?tab=rate-limit.";
        } else if (err.message.includes('503') || err.message.includes('UNAVAILABLE') || err.message.includes('overloaded')) {
          errorMessage = "The AI model is currently experiencing high demand. Please wait a few moments and try again.";
        } else {
          errorMessage = err.message;
        }
      } else if (typeof err === 'object' && err !== null) {
          const anyErr = err as any;
          if (anyErr.error) {
              if (anyErr.error.message) {
                  errorMessage = anyErr.error.message;
              } else if (anyErr.error.status) {
                   errorMessage = `API Error: ${anyErr.error.status} (${anyErr.error.code})`;
              }
          }
      }
      setError(errorMessage);
      setStatus(AnalysisStatus.ERROR);
  };
  
  // These handlers now correctly update the centralized project state
  const handleUpdateStage2Data = (newData: Stage2Result) => {
    setCurrentProject(p => p ? { ...p, stage2Result: newData } : null);
  };
  const handleUpdateShotIdeas = (shots: ShotIdea[] | null, context?: { sceneOverview: SceneOverview; characterDesigns: CharacterDesign[]; }) => {
    setCurrentProject(p => p ? { ...p, shotIdeasList: shots, shotIdeasListContext: context } : null);
  };
  const handleUpdateScript = (newScript: string) => {
    setCurrentProject(p => p ? { ...p, script: newScript } : null);
  };
  const handleUpdateScriptGeneratorIdea = (idea: string) => {
    setCurrentProject(p => p ? { ...p, scriptGeneratorIdea: idea } : null);
  };
  const handleUpdateShotIdeaConfig = (config: Project['shotIdeaStudioConfig']) => {
    setCurrentProject(p => p ? { ...p, shotIdeaStudioConfig: config } : null);
  };
  const handleUpdateImageStudioState = (state: Project['imageStudioState']) => {
    setCurrentProject(p => p ? { ...p, imageStudioState: state } : null);
  };
  const handleSendSceneToShotIdeas = (sceneContent: string) => {
    setCurrentProject(p => p ? { ...p, script: sceneContent, shotIdeasList: null } : null); // Also clear previous shot ideas
    setActiveTool('shotIdea');
  };
  const handleSendSceneToAIPrompter = (sceneContent: string) => {
      setCurrentProject(p => p ? { ...p, aiPrompterSceneContent: sceneContent, aiPrompterResult: null } : null);
      setActiveTool('aiPrompter');
  };
  const handleUpdateAIPrompterSceneContent = (content: string) => {
      setCurrentProject(p => p ? { ...p, aiPrompterSceneContent: content } : null);
  };
  const handleUpdateAIPrompterResult = (result: AIPrompterResult) => {
      setCurrentProject(p => p ? { ...p, aiPrompterResult: result } : null);
  };
  const handleUpdateAIPrompterRegistry = (registry: Record<string, string>) => {
      setCurrentProject(p => p ? { ...p, aiPrompterCharacterRegistry: registry } : null);
  };
  const handleUpdateSavedShotLists = (lists: SavedShotList[]) => {
      setCurrentProject(p => p ? { ...p, savedShotLists: lists } : null);
  };

  const handleSendPromptToImageStudio = (prompt: string) => {
    setCurrentProject(p => {
        if (!p) return null;
        const currentImageStudioState = p.imageStudioState || createNewProject().imageStudioState!;

        const newImageStudioState: ImageStudioState = {
            ...currentImageStudioState,
            prompt: prompt,
            mode: 'generate',
            resultImageBase64: null, 
            analysisText: null,
            sourceImage: null,
            characterReferenceImage: null,
            locationReferenceImage: null,
        };
        return { ...p, imageStudioState: newImageStudioState };
    });
    setActiveTool('image');
  };

  // Helper to write project data to disk
  const saveToDisk = async (handle: FileSystemFileHandle, projectData: Project) => {
      const writable = await handle.createWritable();
      const projectJson = JSON.stringify(projectData, null, 2);
      await writable.write(projectJson);
      await writable.close();
  };

  const handleSaveProject = async () => {
    if (!currentProject || saveState !== 'idle' || isReadOnlyMode) return;

    if (currentProject.id) {
        setSaveState('saving');
        try {
            const updatedProject = { ...currentProject, updatedAt: new Date() };
            
            // 1. Save to IndexedDB
            await saveProject(updatedProject);
            
            // 2. Save to File System if handle exists
            if (fileHandle) {
                // Wrap in try/catch in case permission was revoked or handle is stale
                try {
                   await saveToDisk(fileHandle, updatedProject);
                } catch (fsError) {
                   console.warn("Failed to auto-save to disk:", fsError);
                }
            }

            setCurrentProject(updatedProject);
            await refreshProjectList();

            setSaveState('saved');
            setTimeout(() => setSaveState('idle'), 2000);
        } catch (error) {
            console.error("Save error", error);
            setError("Failed to save the project.");
            setSaveState('idle');
        }
    } else {
        // It's a new project, need a name
        setIsSaveModalOpen(true);
    }
  };

  const handleConfirmSave = async (name: string) => {
    if (!currentProject) return;
    const newProject = { ...currentProject, name, updatedAt: new Date(), createdAt: new Date() };
    const newId = await saveProject(newProject);
    setCurrentProject({ ...newProject, id: newId });
    setIsSaveModalOpen(false);
    await refreshProjectList();
  };

  const handleLoadProject = async (id: number) => {
    const project = await getProject(id);
    if (project) {
      setCurrentProject(project);
      setStatus(project.stage3Result ? AnalysisStatus.COMPLETE : AnalysisStatus.IDLE);
      setActiveTool('script');
      setIsProjectManagerOpen(false);
      setIsReadOnlyMode(false);
      setFileHandle(null); // Reset file handle on load from DB
      setVisualOptions(null);
    }
  };

  const handleDeleteProject = async (id: number) => {
    await deleteProject(id);
    await refreshProjectList();
    if(currentProject?.id === id) {
      handleNewProject();
    }
  };
  
  const handleUseGeneratedScript = (scriptText: string) => {
      const newProj = {
          ...createNewProject(),
          script: scriptText,
          scriptGeneratorIdea: currentProject?.scriptGeneratorIdea || ''
      };
      setCurrentProject(newProj);
      setStatus(AnalysisStatus.IDLE);
      setError(null);
      setActiveTool('script');
      setFileHandle(null);
  };

  const handleGetShotIdeas = (scriptText: string) => {
    const newProj = {
        ...createNewProject(),
        script: scriptText,
    };
    setCurrentProject(newProj);
    setStatus(AnalysisStatus.IDLE);
    setError(null);
    setActiveTool('shotIdea');
    setFileHandle(null);
  };

  const handleExportProject = async () => {
    if (!currentProject) return;
    let success = false;

    // Use File System Access API if available
    if (window.showSaveFilePicker) {
      try {
        const safeName = (currentProject.name || 'Untitled_Project').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const handle = await window.showSaveFilePicker({
          suggestedName: `${safeName}.filmset`,
          types: [{
            description: 'FilmSet Project File',
            accept: { 'application/json': ['.filmset'] },
          }],
        });
        
        await saveToDisk(handle, currentProject);
        setFileHandle(handle); // Store the handle for future auto-saves
        alert("Project exported successfully. Future saves will update this file automatically.");
        success = true;
        
      } catch (err) {
        // If abort, ignore. If other error (like cross-origin), fall through to legacy.
        if ((err as Error).name === 'AbortError') return;
        console.warn("File System Access API failed, falling back to download:", err);
      }
    } 
    
    if (!success) {
        // Fallback to legacy download
        try {
          const projectJson = JSON.stringify(currentProject, null, 2);
          const safeName = (currentProject.name || 'Untitled_Project').replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const fileName = `${safeName}.filmset`;

          const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(projectJson);
          
          const a = document.createElement('a');
          a.href = dataUri;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (err) {
          console.error("Failed to export file:", err);
          setError("Could not export project file.");
        }
    }
  };
  
  const handleShareProject = async () => {
    if (!currentProject || !currentProject.id) {
        alert("Please save the project before sharing.");
        return;
    }
    setIsShareModalOpen(true);
  };

  // This function is now async and throws errors so ProjectManager can catch them and fallback
  const handleOpenFile = async (): Promise<void> => {
      if (window.showOpenFilePicker) {
          try {
              const [handle] = await window.showOpenFilePicker({
                  types: [{
                      description: 'FilmSet Project File',
                      accept: { 'application/json': ['.filmset'] },
                  }],
                  multiple: false
              });
              
              const file = await handle.getFile();
              const text = await file.text();
              const importedProject = JSON.parse(text) as Project;
              
              if (!importedProject || typeof importedProject.name !== 'string') {
                  throw new Error("Invalid project file format.");
              }

              // Import into DB as new/updated project
              delete importedProject.id; 
              importedProject.createdAt = new Date(importedProject.createdAt);
              importedProject.updatedAt = new Date();
              
              const newId = await saveProject(importedProject);
              await refreshProjectList();
              
              // Load it into state
              setCurrentProject({ ...importedProject, id: newId });
              setStatus(importedProject.stage3Result ? AnalysisStatus.COMPLETE : AnalysisStatus.IDLE);
              setActiveTool('script');
              setFileHandle(handle); // Enable "Save" to write back to this file
              setIsProjectManagerOpen(false);
              setIsReadOnlyMode(false);

          } catch (err) {
              // Rethrow so ProjectManager can switch to fallback input if it's an environment error
              throw err;
          }
      }
  };

  const handleImportProject = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const importedProject = JSON.parse(text) as Project;

        // Basic validation
        if (!importedProject || typeof importedProject.name !== 'string' || typeof importedProject.script !== 'string') {
          throw new Error("Invalid project file format.");
        }

        // Prepare for saving as a new project in the DB
        delete importedProject.id;
        importedProject.createdAt = new Date();
        importedProject.updatedAt = new Date();

        const newId = await saveProject(importedProject);
        await refreshProjectList();
        await handleLoadProject(newId); // Load the newly imported project
      } catch (err) {
        console.error("Failed to import project:", err);
        setError(err instanceof Error ? err.message : "Could not import project file.");
      }
    };
    reader.onerror = () => {
      setError("Failed to read the project file.");
    };
    reader.readAsText(file);
  };

  const handleLoadSharedData = async (compressedProjectData: string) => {
    try {
      if (typeof window.LZString === 'undefined') {
        throw new Error("Compression library not loaded.");
      }
      
      const sanitizedData = compressedProjectData.trim();
      const decodedString = window.LZString.decompressFromEncodedURIComponent(sanitizedData);
      
      if (decodedString) {
        const sharedProject = JSON.parse(decodedString) as Project;
        if (sharedProject && sharedProject.name && sharedProject.script) {
          setCurrentProject(sharedProject);
          setStatus(sharedProject.stage3Result ? AnalysisStatus.COMPLETE : AnalysisStatus.IDLE);
          setActiveTool('script');
          setIsReadOnlyMode(true);
          setIsOpenSharedModalOpen(false); // Close the modal on success
          setFileHandle(null);
        } else {
            throw new Error("Invalid project data structure.");
        }
      } else {
        throw new Error("Decompression failed. The shared code might be incomplete or corrupted.");
      }
    } catch (e) {
      console.error("Failed to parse shared project data:", e);
      let errorMessage = "Could not load the shared project. ";
      if (e instanceof Error) {
          errorMessage += e.message;
      }
      alert(errorMessage);
    }
  };


  const renderScriptContent = () => {
    if (!currentProject) return null;

    switch (status) {
      case AnalysisStatus.IDLE:
      case AnalysisStatus.ERROR:
        return <ScriptInput onAnalyze={handleAnalysis} isLoading={false} error={error} script={currentProject.script} onUpdateScript={handleUpdateScript} isReadOnly={isReadOnlyMode} />;
      case AnalysisStatus.ANALYZING_STAGE_1:
      case AnalysisStatus.ANALYZING_STAGE_2:
      case AnalysisStatus.ANALYZING_STAGE_2_VISUALS:
      case AnalysisStatus.ANALYZING_STAGE_3:
      case AnalysisStatus.PAUSED:
        return <AnalysisInProgress status={status} onStop={handleStopAnalysis} onResume={handleResumeAnalysis} onCancel={handleNewProject} />;
      case AnalysisStatus.COMPLETE:
        if (currentProject.stage1Result && currentProject.stage2Result && currentProject.stage3Result) {
          return <AnalysisResult 
            project={currentProject}
            onNewProject={handleNewProject} 
            onUpdateStage2Data={handleUpdateStage2Data}
            onSave={handleSaveProject}
            onSaveAs={() => setIsSaveModalOpen(true)}
            onExportProject={handleExportProject}
            saveState={saveState}
            isReadOnly={isReadOnlyMode}
          />;
        }
        handleNewProject(); // Fallback
        return null;
      default:
        return <ScriptInput onAnalyze={handleAnalysis} isLoading={false} error={error} script={currentProject.script} onUpdateScript={handleUpdateScript} isReadOnly={isReadOnlyMode} />;
    }
  };
  
  const NavButton: React.FC<{
      label: string;
      tool: ActiveTool;
      icon: React.ReactNode;
      disabled?: boolean;
    }> = ({ label, tool, icon, disabled = false }) => {
      const isActive = activeTool === tool;
      return (
        <button
          onClick={() => !disabled && setActiveTool(tool)}
          disabled={disabled}
          className={`relative flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-all duration-300 ${isActive ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-color'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-disabled={disabled}
        >
          {icon}
          {label}
          {isActive && <div className="absolute bottom-[-2px] left-0 w-full h-0.5 bg-accent shadow-accent-glow"></div>}
        </button>
      );
    };

  const isAnalysisComplete = status === AnalysisStatus.COMPLETE;

  return (
    <div className={`min-h-screen font-sans p-4 sm:p-6 lg:p-8 ${isReadOnlyMode ? 'pt-12' : ''}`}>
        {isReadOnlyMode && (
            <div className="fixed top-0 left-0 right-0 bg-accent-secondary text-bg-primary text-center p-2 z-50 font-semibold shadow-lg">
              Viewing a shared project (Read-Only)
            </div>
        )}
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            {/* Left Side: Logo & Title */}
            <div>
              <div className="flex items-center gap-4">
                <FilmIcon className="w-10 h-10 text-accent" />
                <h1 className="text-4xl sm:text-5xl font-display font-bold bg-gradient-to-r from-accent to-accent-secondary text-transparent bg-clip-text">
                  FilmSet
                </h1>
              </div>
              <p className="text-text-secondary text-lg mt-1">
                End-to-End AI Script Analysis, Visual Pre-Production & Production
              </p>
              <p className="text-text-secondary text-sm mt-0.5 font-medium">
                by film target
              </p>
            </div>
            
            {/* Right Side: Controls */}
            <div className="flex items-center gap-2 sm:gap-4 self-end sm:self-center">
              <ThemeToggle theme={theme} setTheme={setTheme} />
              <button
                onClick={handleShareProject}
                disabled={!currentProject?.id}
                title="Share Filmset"
                className="flex items-center gap-2 px-4 py-2 bg-bg-secondary hover:bg-surface border border-border-color text-text-secondary font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShareIcon className="w-5 h-5"/>
                <span className="hidden md:inline">Share</span>
              </button>
              <button
                onClick={() => setIsOpenSharedModalOpen(true)}
                title="Open Shared Filmset"
                className="flex items-center gap-2 px-4 py-2 bg-bg-secondary hover:bg-surface border border-border-color text-text-secondary font-semibold rounded-lg transition-colors duration-200"
              >
                  <InboxIcon className="w-5 h-5"/>
                  <span className="hidden md:inline">Open</span>
              </button>
              <button
                onClick={() => setIsProjectManagerOpen(true)}
                title="My Projects"
                className="flex items-center gap-2 px-4 py-2 bg-bg-secondary hover:bg-surface border border-border-color text-text-secondary font-semibold rounded-lg transition-colors duration-200"
              >
                <FolderIcon className="w-5 h-5"/>
                <span className="hidden md:inline">Projects</span>
              </button>
            </div>
          </div>
          
          <nav className="border-b border-border-color overflow-x-auto">
            <div className="-mb-px flex space-x-8" aria-label="Tabs">
               <NavButton label="Script Analysis" tool="script" icon={<FilmIcon className="w-5 h-5" />} />
               <NavButton label="Script Generator" tool="scriptGenerator" icon={<LightbulbIcon className="w-5 h-5" />} />
               <NavButton label="Scene Select" tool="sceneSelect" icon={<ClipboardCopyIcon className="w-5 h-5" />} disabled={!isAnalysisComplete} />
               <NavButton label="AI Prompter" tool="aiPrompter" icon={<RobotIcon className="w-5 h-5" />} disabled={!isAnalysisComplete} />
               <NavButton label="Shot Idea Studio" tool="shotIdea" icon={<ClapperboardIcon className="w-5 h-5" />} disabled={!isAnalysisComplete} />
               <NavButton label="Image Studio" tool="image" icon={<ImageIcon className="w-5 h-5" />} disabled={!isAnalysisComplete} />
            </div>
          </nav>
        </header>
        <main className="bg-surface rounded-xl shadow-2xl shadow-accent/10 border border-border-color/50 p-4 sm:p-8 backdrop-blur-sm">
          {activeTool === 'script' && renderScriptContent()}
          {activeTool === 'scriptGenerator' && <ScriptGenerator project={currentProject} onUseScript={handleUseGeneratedScript} onGetShotIdeas={handleGetShotIdeas} onUpdateIdea={handleUpdateScriptGeneratorIdea} onUpdateGeneratedScript={(s) => setCurrentProject(p => p ? {...p, script: s} : null)} isReadOnly={isReadOnlyMode} />}
          {activeTool === 'sceneSelect' && <SceneSelect project={currentProject} onSendToShotIdeas={handleSendSceneToShotIdeas} onSendToAIPrompter={handleSendSceneToAIPrompter} />}
          {activeTool === 'shotIdea' && <ShotIdeaStudio project={currentProject} onUpdateShotIdeas={handleUpdateShotIdeas} onUpdateScript={handleUpdateScript} onUpdateConfig={handleUpdateShotIdeaConfig} onSendToImageStudio={handleSendPromptToImageStudio} onUpdateSavedShotLists={handleUpdateSavedShotLists} isReadOnly={isReadOnlyMode} />}
          {activeTool === 'image' && <ImageStudio project={currentProject} onUpdateStage2Data={handleUpdateStage2Data} onUpdateState={handleUpdateImageStudioState} isReadOnly={isReadOnlyMode} />}
          {activeTool === 'aiPrompter' && <AIPrompter project={currentProject} onUpdateSceneContent={handleUpdateAIPrompterSceneContent} onUpdateResult={handleUpdateAIPrompterResult} onUpdateRegistry={handleUpdateAIPrompterRegistry} isReadOnly={isReadOnlyMode} />}
        </main>
        <footer className="text-center mt-8 text-text-secondary text-sm">
          <p>&copy; {new Date().getFullYear()} FilmSet. All rights reserved.</p>
        </footer>
      </div>
      {isProjectManagerOpen && (
        <ProjectManager
          projects={projects}
          onLoad={handleLoadProject}
          onDelete={handleDeleteProject}
          onClose={() => setIsProjectManagerOpen(false)}
          onImportProject={handleImportProject}
          onOpenFile={handleOpenFile}
        />
      )}
      {isSaveModalOpen && (
          <SaveProjectModal 
            onSave={handleConfirmSave}
            onClose={() => setIsSaveModalOpen(false)}
            currentName={currentProject?.name}
          />
      )}
      {isVisualsModalOpen && (
        <VisualsChoiceModal 
            onGenerate={(options) => executeAnalysis(options)}
            onSkip={() => executeAnalysis(null)}
            onClose={() => setIsVisualsModalOpen(false)}
        />
      )}
      {isShareModalOpen && currentProject && (
        <ShareModal
            project={currentProject}
            onClose={() => setIsShareModalOpen(false)}
        />
      )}
      {isOpenSharedModalOpen && (
        <OpenSharedProjectModal
            onLoad={handleLoadSharedData}
            onClose={() => setIsOpenSharedModalOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
