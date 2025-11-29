


export enum AnalysisStatus {
  IDLE,
  ANALYZING_STAGE_1,
  ANALYZING_STAGE_2,
  ANALYZING_STAGE_2_VISUALS,
  ANALYZING_STAGE_3,
  PAUSED,
  COMPLETE,
  ERROR,
}

export interface Scene {
  scene_number: number;
  setting: string;
  summary: string;
}

export interface Act {
  act_number: number;
  title: string;
  scene_breakdown: Scene[];
}

export interface Character {
    name: string;
    description: string;
    screen_presence: 'on-screen' | 'off-screen';
}

export interface Stage1Result {
  page_count: number;
  logline: string;
  acts: Act[];
  characters: Character[];
  synopsis: {
    brief: string;
    extended: string;
  };
  integrity_check: {
    issues_found: boolean;
    details: string;
  };
}

export interface CharacterProfile extends Character {
    arc: string;
    motivation: string;
    image_base64?: string;
}

export interface Theme {
    theme: string;
    prominence: number;
}

export interface Stage2Result {
    title: string;
    author: string;
    genre: string;
    tone: string;
    tone_and_mood_details: string;
    logline: string;
    world_and_setting: string;
    character_profiles: CharacterProfile[];
    treatment: string;
    themes_and_motifs: Theme[];
    comparable_titles: string[];
    comparable_titles_visuals?: { title: string; image_base64: string }[];
    target_audience: string;
    visual_style_suggestion: string;
    visual_style_images_base64?: string[];
    final_rating: {
        score: number;
        justification: string;
    };
    completion_checklist: string[];
    concept_art_base64?: string;
    movie_poster_base64?: string;
}

export enum Department {
    ART = "Art", WARDROBE = "Wardrobe", MAKEUP = "Makeup", STUNTS = "Stunts", VFX = "VFX",
    SFX = "SFX", LOCATIONS = "Locations", PROPS = "Props", TRANSPORT = "Transport",
    CAST = "Cast", OTHER = "Other",
}

export interface SceneProductionDetail {
    scene_number: number; page_number: string; location: string;
    time_of_day: 'DAY' | 'NIGHT' | 'DUSK' | 'DAWN'; estimated_length_eighths: number; summary: string;
}

export interface CharacterProductionDetail { name: string; role_type: 'Speaking' | 'Extra'; scene_appearances: number[]; }
export interface LocationProductionDetail { location: string; scenes: number[]; is_unique: boolean; }
export interface ProductionElement { name: string; description: string; department: Department; }

export interface Stage3Result {
    scene_breakdown: SceneProductionDetail[]; character_breakdown: CharacterProductionDetail[];
    location_breakdown: LocationProductionDetail[]; props_and_set_dressing: ProductionElement[];
    wardrobe_and_makeup: ProductionElement[]; special_requirements: ProductionElement[];
    scheduling_suggestions: {
        total_shooting_days: number;
        shooting_schedule: { day: number; scenes: string; location: string; notes: string; }[];
        scene_grouping_suggestions: string[]; cast_scheduling_highlights: string[];
        day_night_balance: string; complexity_flags: string[];
    };
    departmental_notes: { department: Department; notes: string; }[];
    risk_assessment: string[];
}

export interface StoryboardData { sceneDescription: string; images: string[]; shotIdeas?: ShotIdea[]; }

export interface ShotIdea {
    shot_number: number; shot_type: string; artistic_style: string; description: string;
    composition_and_framing: string; lighting: string; blocking: string;
    costume_and_makeup: string; art_design: string; image_base64?: string;
}

export interface SceneOverview { setting_description: string; lighting_mood: string; }
export interface CharacterDesign { name: string; description: string; costume: string; }

// Comprehensive state for saving tools
export interface PersistedImage {
    name: string;
    type: string;
    base64: string;
    dataUrl: string;
}

export interface ImageStudioState {
    mode: 'generate' | 'edit' | 'analyze';
    prompt: string;
    sourceImage: PersistedImage | null;
    characterReferenceImage: PersistedImage | null;
    locationReferenceImage: PersistedImage | null;
    resultImageBase64: string | null;
    analysisText: string | null;
    isContinuation: boolean;
    continuationSourceImage: string | null;
    characterSelect: string;
    config: {
        genre: string;
        artisticStyle: string;
        shotType: string;
        location: string;
        characterRace: string;
        skinTone: string;
        aspectRatio: string;
    }
}

export interface FullScene {
    scene_number: number;
    heading: string;
    content: string;
}

// AI Prompter Types
export interface AIPrompterCharacter {
    name: string;
    dna_reference: string;
    current_state: string;
}

export interface AIPrompterObject {
    name: string;
    design: string;
    condition: string;
    location: string;
    usage: string;
}

export interface AIPrompterEnvironment {
    location: string;
    dna_reference: string;
    conditions: string;
}

export interface AIPrompterShot {
    shot_number: number;
    shot_type: string;
    shot_header?: string; 
    image_prompt: string;
    video_prompt: string;
}

export interface AIPrompterResult {
    scene_analysis: {
        characters: AIPrompterCharacter[];
        objects: AIPrompterObject[];
        environment: AIPrompterEnvironment;
        narrative_beats: string[];
    };
    generated_shots: {
        shots: AIPrompterShot[];
        total_shot_count: number;
        estimated_duration: string;
    };
}

export interface SavedShotList {
  id: string;
  name: string;
  createdAt: string;
  script: string;
  config: {
    genre: string;
    location: string;
    characterRace: string;
    skinTone: string;
    artisticStyle: string;
  };
  shots: ShotIdea[];
  context: {
    sceneOverview: SceneOverview;
    characterDesigns: CharacterDesign[];
  };
}


export interface Project {
  id?: number;
  name: string;
  script: string;
  stage1Result: Stage1Result | null;
  stage2Result: Stage2Result | null;
  stage3Result: Stage3Result | null;
  storyboardData: StoryboardData | null;
  shotIdeasList: ShotIdea[] | null;
  fullScenes: FullScene[] | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Persisted state for tools
  scriptGeneratorIdea?: string;
  shotIdeaStudioConfig?: {
    genre: string; location: string; characterRace: string;
    skinTone: string; artisticStyle: string;
  };
  savedShotLists?: SavedShotList[];
  imageStudioState?: ImageStudioState;
  shotIdeasListContext?: { sceneOverview: SceneOverview; characterDesigns: CharacterDesign[]; };
  storyboardSceneDescription?: string;
  storyboardRequestFromShots?: ShotIdea[];
  storyboardRequestContext?: { sceneOverview: SceneOverview; characterDesigns: CharacterDesign[]; };
  
  // AI Prompter State
  aiPrompterSceneContent?: string;
  aiPrompterResult?: AIPrompterResult | null;
  // Key: Character Name, Value: DNA String
  aiPrompterCharacterRegistry?: Record<string, string>; 
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
    pdfjsLib: any;
    jspdf: any;
    LZString: any;
    showSaveFilePicker?: (options?: any) => Promise<FileSystemFileHandle>;
    showOpenFilePicker?: (options?: any) => Promise<FileSystemFileHandle[]>;
  }
}