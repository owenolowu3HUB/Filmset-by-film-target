import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Stage1Result, Stage2Result, Stage3Result, Department, ShotIdea, SceneOverview, CharacterDesign, FullScene, AIPrompterResult } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- UTILS ---

/**
 * Retries an async operation with exponential backoff if a rate limit or transient error occurs.
 */
const retryWithBackoff = async <T>(
    operation: () => Promise<T>,
    retries: number = 4,
    delay: number = 2000,
    factor: number = 2
): Promise<T> => {
    try {
        return await operation();
    } catch (error: any) {
        const errorMessage = error.message || '';
        // Check for error.error.code or error.status if available
        const code = error.status || error.error?.code || error.response?.status;
        const statusText = error.statusText || error.error?.status || error.response?.statusText || '';

        const isRateLimit = errorMessage.includes('429') ||
                            errorMessage.includes('RESOURCE_EXHAUSTED') ||
                            code === 429;
        
        const isServerOverload = errorMessage.includes('503') ||
                                 errorMessage.includes('UNAVAILABLE') ||
                                 errorMessage.includes('overloaded') ||
                                 errorMessage.includes('500') ||
                                 errorMessage.includes('Internal Server Error') ||
                                 code === 503 ||
                                 code === 500 ||
                                 statusText.includes('Internal Server Error');
        
        if (retries > 0 && (isRateLimit || isServerOverload)) {
            console.warn(`API Error (${isRateLimit ? 'Rate Limit' : 'Server Overload/Internal Error'}). Retrying in ${delay}ms... (Attempts left: ${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryWithBackoff(operation, retries - 1, delay * factor, factor);
        }
        throw error;
    }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// --- SCHEMAS ---

const stage1Schema = {
  type: Type.OBJECT,
  properties: {
    page_count: { type: Type.INTEGER, description: "The total page count of the script. If it's a concept, estimate it." },
    logline: { type: Type.STRING, description: "A one-sentence summary of the story." },
    acts: {
      type: Type.ARRAY,
      description: "Breakdown of the story into three acts.",
      items: {
        type: Type.OBJECT,
        properties: {
          act_number: { type: Type.INTEGER },
          title: { type: Type.STRING, description: "e.g., Act I: The Setup" },
          scene_breakdown: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                scene_number: { type: Type.INTEGER },
                setting: { type: Type.STRING, description: "e.g., INT. COFFEE SHOP - DAY" },
                summary: { type: Type.STRING, description: "A brief summary of the scene's events." },
              },
              required: ["scene_number", "setting", "summary"]
            }
          }
        },
        required: ["act_number", "title", "scene_breakdown"]
      }
    },
    characters: {
      type: Type.ARRAY,
      description: "A comprehensive list of all characters, including those with dialogue and those only mentioned in descriptions.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING, description: "A brief description of the character." },
          screen_presence: { type: Type.STRING, description: "Indicates if the character is 'on-screen' (will be seen) or 'off-screen' (e.g., voice-over only)." }
        },
        required: ["name", "description", "screen_presence"]
      }
    },
    synopsis: { 
        type: Type.OBJECT,
        description: "Both a brief and an extended synopsis of the story.",
        properties: {
            brief: { type: Type.STRING, description: "An intelligently and intriguingly summarized 3-paragraph synopsis." },
            extended: { type: Type.STRING, description: "A full, progressive synopsis that tells the complete story from beginning to end." }
        },
        required: ["brief", "extended"]
    },
    integrity_check: {
      type: Type.OBJECT,
      properties: {
        issues_found: { type: Type.BOOLEAN },
        details: { type: Type.STRING, description: "Details on any narrative deviations or potential plot holes. If it's a concept, identify areas that need further development." }
      },
      required: ["issues_found", "details"]
    }
  },
  required: ["page_count", "logline", "acts", "characters", "synopsis", "integrity_check"]
};

const stage2Schema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "A suitable title for the story." },
        author: { type: Type.STRING, description: "The author of the script, or 'Concept Expansion' if it's an idea." },
        genre: { type: Type.STRING },
        tone: { type: Type.STRING, description: "A few keywords describing the tone (e.g., 'Dark, Humorous, Suspenseful')." },
        tone_and_mood_details: { type: Type.STRING, description: "A detailed paragraph elaborating on the film's overall feeling, emotional atmosphere, and mood. Describe how the tone will be conveyed through visuals, sound, and pacing." },
        logline: { type: Type.STRING },
        world_and_setting: { type: Type.STRING, description: "A description of the world and primary settings." },
        character_profiles: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    screen_presence: { type: Type.STRING, description: "Indicates if the character is 'on-screen' (will be seen) or 'off-screen' (e.g., voice-over only)." },
                    arc: { type: Type.STRING, description: "The character's developmental arc." },
                    motivation: { type: Type.STRING, description: "The character's primary motivation." }
                },
                required: ["name", "description", "screen_presence", "arc", "motivation"]
            }
        },
        treatment: { type: Type.STRING, description: "A 1-2 page plot treatment." },
        themes_and_motifs: {
            type: Type.ARRAY,
            description: "A list of identified themes and motifs, each with a prominence score.",
            items: {
                type: Type.OBJECT,
                properties: {
                    theme: { type: Type.STRING },
                    prominence: { type: Type.NUMBER, description: "A score from 1 (minor) to 10 (central) indicating the theme's importance and recurrence." }
                },
                required: ["theme", "prominence"]
            }
        },
        comparable_titles: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A minimum of 3 and up to 5 comparable film or TV titles." },
        target_audience: { type: Type.STRING },
        visual_style_suggestion: { type: Type.STRING, description: "Suggestions for cinematography and visual style." },
        final_rating: {
            type: Type.OBJECT,
            properties: {
                score: { type: Type.NUMBER, description: "A rating on a 10-point scale for its potential as a concept." },
                justification: { type: Type.STRING, description: "Justification for the given score." }
            },
            required: ["score", "justification"]
        },
        completion_checklist: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A checklist of all the categories successfully generated for the pitch deck."
        }
    },
    required: ["title", "author", "genre", "tone", "tone_and_mood_details", "logline", "world_and_setting", "character_profiles", "treatment", "themes_and_motifs", "comparable_titles", "target_audience", "visual_style_suggestion", "final_rating", "completion_checklist"]
};

const departmentEnum = Object.values(Department);

const stage3Schema = {
    type: Type.OBJECT,
    properties: {
        scene_breakdown: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    scene_number: { type: Type.INTEGER },
                    page_number: { type: Type.STRING },
                    location: { type: Type.STRING },
                    time_of_day: { type: Type.STRING, enum: ['DAY', 'NIGHT', 'DUSK', 'DAWN'] },
                    estimated_length_eighths: { type: Type.NUMBER, description: "Estimated script length in eighths of a page." },
                    summary: { type: Type.STRING },
                },
                required: ["scene_number", "page_number", "location", "time_of_day", "estimated_length_eighths", "summary"]
            }
        },
        character_breakdown: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    role_type: { type: Type.STRING, enum: ['Speaking', 'Extra'] },
                    scene_appearances: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                },
                required: ["name", "role_type", "scene_appearances"]
            }
        },
        location_breakdown: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    location: { type: Type.STRING },
                    scenes: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                    is_unique: { type: Type.BOOLEAN },
                },
                required: ["location", "scenes", "is_unique"]
            }
        },
        props_and_set_dressing: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    department: { type: Type.STRING, enum: departmentEnum },
                },
                required: ["name", "description", "department"]
            }
        },
        wardrobe_and_makeup: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    department: { type: Type.STRING, enum: departmentEnum },
                },
                required: ["name", "description", "department"]
            }
        },
        special_requirements: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    department: { type: Type.STRING, enum: departmentEnum },
                },
                required: ["name", "description", "department"]
            }
        },
        scheduling_suggestions: {
            type: Type.OBJECT,
            properties: {
                total_shooting_days: { type: Type.INTEGER, description: "The total estimated number of shooting days." },
                shooting_schedule: {
                    type: Type.ARRAY,
                    description: "A detailed day-by-day shooting schedule.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            day: { type: Type.INTEGER },
                            scenes: { type: Type.STRING, description: "Comma-separated list of scene numbers to be shot." },
                            location: { type: Type.STRING, description: "Primary location for the day's shoot." },
                            notes: { type: Type.STRING, description: "Key notes for the day, e.g., actors involved, special requirements." },
                        },
                        required: ["day", "scenes", "location", "notes"]
                    }
                },
                scene_grouping_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                cast_scheduling_highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
                day_night_balance: { type: Type.STRING },
                complexity_flags: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["total_shooting_days", "shooting_schedule", "scene_grouping_suggestions", "cast_scheduling_highlights", "day_night_balance", "complexity_flags"]
        },
        departmental_notes: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    department: { type: Type.STRING, enum: departmentEnum },
                    notes: { type: Type.STRING },
                },
                required: ["department", "notes"]
            }
        },
        risk_assessment: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
        }
    },
    required: ["scene_breakdown", "character_breakdown", "location_breakdown", "props_and_set_dressing", "wardrobe_and_makeup", "special_requirements", "scheduling_suggestions", "departmental_notes", "risk_assessment"]
};

const sceneExtractionSchema = {
    type: Type.ARRAY,
    description: "An array of all scenes from the script.",
    items: {
        type: Type.OBJECT,
        properties: {
            scene_number: { type: Type.INTEGER, description: "The sequential number of the scene, starting from 1." },
            heading: { type: Type.STRING, description: "The full scene heading (e.g., 'INT. COFFEE SHOP - DAY')." },
            content: { type: Type.STRING, description: "The complete text content of the scene, from the heading to the beginning of the next scene heading. This includes all action lines, character names, dialogue, and parentheticals." }
        },
        required: ["scene_number", "heading", "content"]
    }
};

const shotIdeaSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            shot_number: { type: Type.INTEGER, description: "The sequential number of the shot in the scene." },
            shot_type: { type: Type.STRING, description: "The type of shot (e.g., 'Establishing Shot', 'Medium Close-Up', 'Point of View')." },
            artistic_style: { type: Type.STRING, description: "The specific artistic style for this shot (e.g., 'Semi-realistic', 'Stylized realism', 'Dynamic cartoonish')." },
            description: { type: Type.STRING, description: "A detailed description of the action and focus within the shot." },
            composition_and_framing: { type: Type.STRING, description: "Notes on composition rules (e.g., rule of thirds), camera angle, and how characters/objects are framed." },
            lighting: { type: Type.STRING, description: "Description of the lighting style (e.g., 'High-key', 'Low-key with hard shadows', 'Naturalistic')." },
            blocking: { type: Type.STRING, description: "Description of character movement and camera movement within the shot." },
            costume_and_makeup: { type: Type.STRING, description: "Key details about costumes and makeup visible in the shot, consistent with the master character designs." },
            art_design: { type: Type.STRING, description: "Key details about the set dressing, props, and overall environment, consistent with the master scene overview." },
        },
        required: ["shot_number", "shot_type", "artistic_style", "description", "composition_and_framing", "lighting", "blocking", "costume_and_makeup", "art_design"]
    }
};

const shotListSchema = {
    type: Type.OBJECT,
    properties: {
        scene_overview: {
            type: Type.OBJECT,
            description: "A high-level overview of the scene's visual elements to ensure consistency across all shots.",
            properties: {
                setting_description: { type: Type.STRING, description: "A detailed, consistent description of the primary location/setting for the entire scene. This description will be used as the baseline for all shots." },
                lighting_mood: { type: Type.STRING, description: "The consistent, overarching lighting style and mood for the scene (e.g., 'Warm, soft, late afternoon sun', 'Cold, sterile, fluorescent lighting')." }
            },
            required: ["setting_description", "lighting_mood"]
        },
        character_designs: {
            type: Type.ARRAY,
            description: "Consistent design descriptions for the main characters appearing in the scene. These designs must be maintained across all shots.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "Character's name as it appears in the script." },
                    description: { type: Type.STRING, description: "A brief physical description of the character (age, build, key features)." },
                    costume: { type: Type.STRING, description: "A detailed description of the character's complete costume for this scene." }
                },
                required: ["name", "description", "costume"]
            }
        },
        shots: shotIdeaSchema
    },
    required: ["scene_overview", "character_designs", "shots"]
};

// AI Prompter Schema
const aiPrompterSchema = {
    type: Type.OBJECT,
    properties: {
        scene_analysis: {
            type: Type.OBJECT,
            properties: {
                characters: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            dna_reference: { type: Type.STRING, description: "The 'Master DNA String' for the character." },
                            current_state: { type: Type.STRING }
                        },
                        required: ["name", "dna_reference", "current_state"]
                    }
                },
                objects: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            design: { type: Type.STRING },
                            condition: { type: Type.STRING },
                            location: { type: Type.STRING },
                            usage: { type: Type.STRING }
                        },
                        required: ["name", "design", "condition", "location", "usage"]
                    }
                },
                environment: {
                    type: Type.OBJECT,
                    properties: {
                        location: { type: Type.STRING },
                        dna_reference: { type: Type.STRING, description: "The Location DNA String." },
                        conditions: { type: Type.STRING }
                    },
                    required: ["location", "dna_reference", "conditions"]
                },
                narrative_beats: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            },
            required: ["characters", "objects", "environment", "narrative_beats"]
        },
        generated_shots: {
            type: Type.OBJECT,
            properties: {
                shots: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            shot_number: { type: Type.INTEGER },
                            shot_header: { type: Type.STRING, description: "The full shot header e.g. SHOT [N] - [SIZE] - [FOCUS]" },
                            shot_type: { type: Type.STRING },
                            image_prompt: { type: Type.STRING, description: "The generated /imagine prompt following the CinemaSynth format." },
                            video_prompt: { type: Type.STRING, description: "The generated video prompt with START, ACTION, DIALOGUE, END structure." }
                        },
                        required: ["shot_number", "shot_header", "shot_type", "image_prompt", "video_prompt"]
                    }
                },
                total_shot_count: { type: Type.INTEGER },
                estimated_duration: { type: Type.STRING }
            },
            required: ["shots", "total_shot_count", "estimated_duration"]
        }
    },
    required: ["scene_analysis", "generated_shots"]
};

const aiPrompterSystemInstructionConfig = {
  "CineSynthesis_MAX": {
    "version": "3.0",
    "system_name": "CineSynthesis MAX - Unified Temporal-Spatial Logic Engine",
    "objective": "Generate unlimited, copyright-safe cinematic assets with absolute continuity across shots",
    "global_scene_seed": 4268193570,
    
    "pre_analysis_protocols": {
        "temporal_prop_scanning": {
             "rule": "Scan the ENTIRE scene text before generating DNA.",
             "requirement": "Identify ANY prop a character uses/holds at ANY point in the scene. If they arrive with it, or it is relevant to later shots (e.g., 'pulls gun from bag'), that item MUST be included in the Master DNA immediately (e.g., 'wearing shoulder bag', 'gun in holster').",
             "rationale": "Prevents 'magical spawning' of objects in later shots. Props must exist in the visual simulation from Shot 1 if they are in the character's possession."
        }
    },

    "master_dna_registry": {
      "character_dna_template": "[AGE] [ETHNICITY] [GENDER], [SKIN_HEX], [ANATOMY], [OUTFIT_STATE], [PERSISTENT_ACCESSORIES_AND_PROPS], unique non-celebrity face",
      "structural_dna_template": "[GEOMETRY_SHAPE], [WINDOW_STYLE], [WALL_TEXTURE], [FIXED_PROP_LOCATIONS]",
      "prop_dna_template": "[MATERIAL], [SPECIFIC_DAMAGE], [LIGHTING_COLOR]",
      "inference_protocol": "If visual details are missing in the source text, you MUST infer cinematic, high-fidelity attributes (skin texture, specific clothing fabrics, precise lighting interaction) to populate the DNA string fully. Do not produce generic descriptions."
    },

    "camera_freedom_protocol": {
      "environment_lockdown": {
        "geometry_fixed": true,
        "camera_unlimited": true,
        "recompose_required": true,
        "veto_conditions": ["camera_angle_changes_but_background_identical"]
      },
      "recompose_requirements": ["parallax", "occlusion", "lighting_direction", "depth_of_field"]
    },

    "causal_sequence_engine": {
      "rules": [
        "no_result_without_action",
        "bridge_state_jumps_automatically", 
        "stimulus_response_flow",
        "complete_beats_required"
      ],
      "shot_flow_template": "Start State → Dialogue/Action → End State",
      "bridging_examples": {
        "no_seatbelt_to_seatbelt": "insert_locking_seatbelt_shot",
        "inactive_to_active_hologram": "insert_activation_shot"
      }
    },

    "unified_prompt_templates": {
      "image_prompt": {
        "template": "/imagine prompt: [SHOT_SIZE] [ANGLE]. [FULL_CHARACTER_DNA_STRING] performing [ACTION]. [STRUCTURAL_DNA_LOCK]. [ATMOSPHERE_LAYER]. [LENS]. --no celebrity, famous actors, known figures --ar 16:9 --style reference ${global_scene_seed}",
        "variables": {
          "SHOT_SIZE": ["wide_shot", "medium_shot", "close_up", "extreme_close_up", "insert_shot"],
          "ANGLE": ["eye_level", "low_angle", "high_angle", "dutch_angle", "over_shoulder", "reverse_angle"],
          "ACTION": "description of character action",
          "ATMOSPHERE_LAYER": "lighting and environmental effects",
          "LENS": "cinematic lens description"
        }
      },
      "video_prompt": {
        "template": "START: [Previous Shot Exit State]\nACTION: [Causal Movement with Timing]\nRESULT: [Environmental Change]\nDIALOGUE: '[Line]'\nEND: [Next Shot Entry Position]\nCONTINUITY: [All DNA Locks Verified]",
        "duration_default": "8_seconds"
      }
    },

    "dynamic_shot_generation": {
      "panel_structure": {
        "fields": [
          "shot_type",
          "camera_angle", 
          "subject_focus",
          "LOS_A_framing",
          "LOS_B_interaction_target",
          "motion_status",
          "anatomy_check",
          "beat_purpose"
        ]
      },
      "coverage_requirements": {
        "establishing_shot": "required_for_new_locations",
        "character_introduction": "required_when_characters_first_appear",
        "action_beats": "required_for_all_physical_actions",
        "reaction_shots": "required_for_emotional_responses",
        "insert_shots": "required_for_important_objects",
        "dialogue_coverage": "required_for_all_spoken_lines"
      },
      "auto_expansion": {
        "enabled": true,
        "minimum_shots": 8,
        "expansion_rules": ["add_recovery_shots", "add_external_views", "add_aftermath_shots"]
      }
    },

    "continuity_enforcement": {
      "mandatory_checks_per_shot": [
        "character_dna_lock",
        "structural_dna_lock", 
        "camera_freedom_recompose",
        "causal_logic_verified",
        "anatomical_reality_maintained",
        "temporal_flow_logical"
      ],
      "veto_conditions": [
        "character_appearance_inconsistent_with_dna",
        "environmental_geometry_changes_between_shots",
        "camera_angle_changes_but_background_identical",
        "result_shown_without_causal_action",
        "state_jump_without_bridging_shot",
        "anatomical_impossibility_in_movement"
      ]
    },

    "output_structure": {
      "scene_analysis": {
        "characters": [],
        "objects": [],
        "environment": {},
        "narrative_beats": []
      },
      "generated_shots": {
        "shots": [],
        "total_shot_count": 0,
        "estimated_duration": "0:00"
      }
    }
  }
};


const systemInstruction = `You are the Script Sentinel, a professional script reader and pre-production AI for studios. Your purpose is to ingest a full movie script OR a brief concept and produce a complete professional breakdown across multiple stages. You must analyze ONLY the provided text. Do NOT expand, invent, add to, or alter story details. If information required for a field is not present in the text, you must state that it is underdeveloped or make a reasonable inference based ONLY on the provided text. Adhere strictly to the requested JSON schema.
CRITICAL RULE: Within any JSON string value, you MUST escape all double-quote characters (") with a backslash (\\"). For example, a line of dialogue like "Let's go!" must be formatted as "\\"Let's go!\\" in the JSON output. This is mandatory for valid JSON structure.`;

export const analyzeStage1 = async (script: string): Promise<Stage1Result> => {
  const prompt = `
    Analyze the following movie script or story concept for Stage 1: Structural & Narrative Deconstruction. Analyze ONLY the provided text. Do NOT expand, invent, or add new story elements.

    - Estimate the page count if it's a concept, or use the actual count if it's a formatted script.
    - Provide a structural breakdown into three acts based on the provided text. If the text is too brief for a full breakdown, provide a high-level summary for each act based on the potential structure.
    - List all characters mentioned in the text, identifying each as either 'on-screen' or 'off-screen'.
    - Generate a concise logline.
    - Write TWO synopses based ONLY on the provided text: 1) A brief summary. 2) An extended synopsis.
    - Perform an integrity check. For a concept, identify areas that are underdeveloped. For a script, flag narrative deviations or plot holes.

    CONTENT TO ANALYZE:
    ---
    ${script}
    ---
  `;

  return retryWithBackoff(async () => {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: stage1Schema,
        temperature: 0.3
        },
    });
    
    const jsonText = (response.text ?? '').trim();
    if (!jsonText) {
        throw new Error("Received an empty response from the AI model for Stage 1 analysis. This might be due to safety filters or content restrictions.");
    }
    return JSON.parse(jsonText) as Stage1Result;
  });
};

export const analyzeStage2 = async (script: string, logline: string, synopsis: string): Promise<Stage2Result> => {
    const prompt = `
    Based on the following movie script or story concept, and using the provided logline and synopsis for context, perform Stage 2: Pitch Deck Creation. Analyze ONLY the provided text. Do NOT expand, invent, or add new story elements. If information is not present in the text, state that it needs to be developed.

    - Infer Title, Author, Genre, and Tone from the text. If not present, suggest plausible options based on the content. Set Author to 'N/A' if not provided.
    - Elaborate in a detailed paragraph on the film's overall Tone and Mood, describing the intended atmosphere and feeling.
    - Describe the World & Setting as depicted in the text.
    - Create Character Profiles (arcs, motivations) based ONLY on what is written.
    - Write a Treatment based on the plot provided.
    - Identify Themes & Motifs present in the text.
    - Suggest a minimum of 3 and up to 5 comparable titles. This is a strict requirement.
    - Define the likely Target Audience.
    - Suggest a Visual Style based on the content.
    - Provide a final Rating of the script/concept with justification.
    - Output a completion_checklist of all generated categories.

    CONTEXT:
    Logline: ${logline}
    Synopsis: ${synopsis}

    CONTENT TO ANALYZE:
    ---
    ${script}
    ---
  `;
  
    return retryWithBackoff(async () => {
        const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: stage2Schema,
            temperature: 0.4
        },
        });
        
        const jsonText = (response.text ?? '').trim();
        if (!jsonText) {
            throw new Error("Received an empty response from the AI model for Stage 2 analysis. This might be due to safety filters or content restrictions.");
        }
        return JSON.parse(jsonText) as Stage2Result;
    });
};

export const analyzeStage3 = async (script: string): Promise<Stage3Result> => {
    const prompt = `
    Based on the following movie script or story concept, perform Stage 3: Production Breakdown & Scheduling Suggestions. Analyze ONLY the provided text. Do NOT expand, invent, or add new story elements. All production details should be directly inferred from the text. If details are not available, make reasonable, high-level estimates and note them as such.

    1.  **Scene Breakdown:** List all scenes mentioned or implied in the text.
    2.  **Character Breakdown:** List all characters and their likely role types.
    3.  **Location Breakdown:** List all locations mentioned.
    4.  **Props, Wardrobe, Special Requirements:** Extract any mentioned production elements.
    5.  **Scheduling Suggestions:** Based on the complexity described, provide high-level scheduling suggestions and estimate shooting days.
    6.  **Departmental Notes:** Write brief notes for key departments based on the text.
    7.  **Risk Assessment:** Identify potential production challenges based on what's described.

    CONTENT TO ANALYZE:
    ---
    ${script}
    ---
  `;
  
    return retryWithBackoff(async () => {
        const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: stage3Schema,
            temperature: 0.3
        },
        });
        
        const jsonText = (response.text ?? '').trim();
        if (!jsonText) {
            throw new Error("Received an empty response from the AI model for Stage 3 analysis. This might be due to safety filters or content restrictions.");
        }
        return JSON.parse(jsonText) as Stage3Result;
    });
};

export const extractScenes = async (script: string): Promise<FullScene[]> => {
    const systemInstruction = `You are a script parsing AI. Your sole task is to read a movie script and break it down into individual scenes.
- A new scene begins with a scene heading (e.g., 'INT. LOCATION - DAY', 'EXT. STREET - NIGHT').
- The content of a scene includes its heading and all text (action, dialogue, etc.) that follows, up until the next scene heading.
- You must capture the entire text for each scene verbatim.
- Number the scenes sequentially starting from 1.
- Adhere strictly to the provided JSON schema.
CRITICAL RULE: Within the 'content' field of the JSON, you MUST escape all double-quote characters (") with a backslash (\\"). For example, a line of dialogue like "Let's go!" must be formatted as "\\"Let's go!\\" in the JSON output. This is mandatory for valid JSON structure.`;

    const prompt = `
    Parse the following script text and extract every scene into the specified JSON format.

    SCRIPT TEXT:
    ---
    ${script}
    ---
  `;

    return retryWithBackoff(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        scenes: sceneExtractionSchema
                    },
                    required: ["scenes"]
                },
                temperature: 0.0
            },
        });

        const jsonText = (response.text ?? '').trim();
        if (!jsonText) {
        throw new Error("Received an empty response from the AI model during scene extraction. The script might be empty or invalid.");
        }
        const result = JSON.parse(jsonText) as { scenes: FullScene[] };
        return result.scenes;
    });
};

const isRateLimitError = (e: unknown): boolean => {
    if (e instanceof Error) {
        return e.message.includes('429') || e.message.includes('RESOURCE_EXHAUSTED');
    }
    return false;
};

export const generateAllVisuals = async (
    pitchDeckData: Stage2Result, 
    options: { poster: boolean; concept: boolean; characters: boolean }
): Promise<{
    concept_art_base64: string;
    movie_poster_base64: string;
    character_portraits: { name: string; image_base64: string }[];
    comparable_titles_visuals: { title: string; image_base64: string }[];
    visual_style_images_base64: string[];
}> => {
    try {
        const mainCharacters = pitchDeckData.character_profiles
            .filter(c => c.screen_presence === 'on-screen')
            .slice(0, 2);

        const visualStylePrompt = `Create three distinct cinematic film stills that perfectly capture the following visual style. Each image should look like a high-resolution screen grab from a movie, focusing on color palette, lighting, composition, and mood. Do not include any text or logos. Visual Style: "${pitchDeckData.visual_style_suggestion}"`;
        
        let concept_art_base64 = '';
        let movie_poster_base64 = '';
        const character_portraits: { name: string; image_base64: string }[] = [];
        const comparable_titles_visuals: { title: string; image_base64: string }[] = [];
        let visual_style_images_base64: string[] = [];

        // --- CONCEPT ART ---
        if (options.concept) {
            const conceptArtPrompt = `Create a cinematic, high-quality piece of concept art for a movie with the following details. This should look like a digital painting suitable for a pitch deck. Do not include any text, titles, or logos.
- Title: ${pitchDeckData.title}
- Genre: ${pitchDeckData.genre}
- Tone: ${pitchDeckData.tone}
- Logline: ${pitchDeckData.logline}
- Visual Style: ${pitchDeckData.visual_style_suggestion}
- Setting: ${pitchDeckData.world_and_setting}`;
            
            try {
                await retryWithBackoff(async () => {
                    const conceptArtResponse = await ai.models.generateImages({
                        model: 'imagen-4.0-generate-001',
                        prompt: conceptArtPrompt,
                        config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '16:9' },
                    });
                    concept_art_base64 = conceptArtResponse.generatedImages?.[0]?.image.imageBytes || '';
                });
            } catch (e) {
                console.warn('Failed to generate concept art:', e);
            }
        }

        // --- MOVIE POSTER ---
        if (options.poster) {
            const posterPrompt = `A professional, high-quality official movie poster for the film "${pitchDeckData.title}". Genre: ${pitchDeckData.genre}. Logline: ${pitchDeckData.logline}. Visual Style: ${pitchDeckData.visual_style_suggestion}. The composition should be striking, cinematic, and suitable for a theatrical release. Aspect ratio 2:3.`;
            try {
                if (options.concept) await sleep(2000); // Small delay between requests
                await retryWithBackoff(async () => {
                    const posterResponse = await ai.models.generateImages({
                        model: 'imagen-4.0-generate-001',
                        prompt: posterPrompt,
                        config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '3:4' },
                    });
                    movie_poster_base64 = posterResponse.generatedImages?.[0]?.image.imageBytes || '';
                });
            } catch (e) {
                 console.warn('Failed to generate movie poster:', e);
            }
        }

        // --- CHARACTER PORTRAITS ---
        if (options.characters) {
            for (const character of mainCharacters) {
                const characterPrompt = `Create a cinematic character portrait of "${character.name}". This is for a movie pitch deck. The style should be realistic but painterly. The character should be the sole focus, with a simple, atmospheric background.
    - Character Name: ${character.name}
    - Character Description: ${character.description}
    - Movie Genre: ${pitchDeckData.genre}
    - Movie Tone: ${pitchDeckData.tone}
    - Overall Visual Style: ${pitchDeckData.visual_style_suggestion}`;
                try {
                    // Increased delay to respect RPM
                    if (character_portraits.length > 0 || options.poster || options.concept) await sleep(4000);

                    await retryWithBackoff(async () => {
                        const resp = await ai.models.generateImages({
                            model: 'imagen-4.0-generate-001',
                            prompt: characterPrompt,
                            config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '3:4' },
                        });
                        if (resp.generatedImages?.[0]?.image.imageBytes) {
                            character_portraits.push({ name: character.name, image_base64: resp.generatedImages[0].image.imageBytes });
                        }
                    });
                } catch (e) {
                    console.warn(`Failed to generate portrait for ${character.name}:`, e);
                }
            }
        }

        // --- COMPARABLE TITLES (Always attempt if visuals are requested, as they are part of deck logic usually) ---
        // We will only do this if at least one option was checked, to piggyback on the "visuals enabled" logic
        if (options.poster || options.concept || options.characters) {
             for (const title of pitchDeckData.comparable_titles.slice(0, 3)) {
                let image_base64 = '';
                try {
                    // Delay to prevent rate limits
                    if (comparable_titles_visuals.length > 0 || character_portraits.length > 0) await sleep(5000); 

                    // Try High Quality Grounded Generation
                    await retryWithBackoff(async () => {
                         const resp = await ai.models.generateContent({
                            model: 'gemini-3-pro-image-preview',
                            contents: { parts: [{ text: `Search for the official movie poster for "${title}". Generate a high-fidelity image of the poster found.` }] },
                            config: { 
                                tools: [{ googleSearch: {} }],
                                imageConfig: { aspectRatio: '3:4' }
                            },
                        });
                        
                        for (const part of resp.candidates?.[0]?.content?.parts || []) {
                            if (part.inlineData) {
                                 image_base64 = part.inlineData.data;
                                 break;
                            }
                        }
                    });
                } catch(e) {
                    console.warn(`Gemini 3 Pro failed for ${title}, falling back to Imagen:`, e);
                }

                // Fallback to Imagen if Gemini 3 failed (or didn't return image)
                if (!image_base64) {
                     try {
                        await sleep(2000);
                        await retryWithBackoff(async () => {
                            const resp = await ai.models.generateImages({
                                model: 'imagen-4.0-generate-001',
                                prompt: `Movie poster for "${title}", cinematic, high resolution`,
                                config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '3:4' },
                            });
                            image_base64 = resp.generatedImages?.[0]?.image.imageBytes || '';
                        });
                     } catch (e) {
                         console.warn(`Imagen failed for ${title}:`, e);
                     }
                }
                
                // Always push, even if image is empty, so we preserve the link in UI
                comparable_titles_visuals.push({ title, image_base64 });
            }
        }

        // --- VISUAL STYLE EXAMPLES ---
        // Same logic: if we are doing visuals, generate style frames
        if (options.concept) { // Group this with concept art for simplicity
             try {
                await sleep(4000);
                await retryWithBackoff(async () => {
                    const visualStyleImagesResponse = await ai.models.generateImages({
                        model: 'imagen-4.0-generate-001',
                        prompt: visualStylePrompt,
                        config: { numberOfImages: 3, outputMimeType: 'image/jpeg', aspectRatio: '16:9' },
                    });
                    visual_style_images_base64 = visualStyleImagesResponse.generatedImages?.map(img => img.image.imageBytes).filter(Boolean) as string[] || [];
                });
            } catch(e) {
                console.warn('Failed to generate visual style images:', e);
            }
        }

        return { concept_art_base64, movie_poster_base64, character_portraits, comparable_titles_visuals, visual_style_images_base64 };

    } catch (error) {
        console.error("Error generating visuals:", error);
        throw error; 
    }
};


export const analyzeImage = async (base64ImageData: string, mimeType: string, prompt: string): Promise<string> => {
  const fullPrompt = prompt || "Describe this image in detail.";
  return retryWithBackoff(async () => {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ inlineData: { data: base64ImageData, mimeType } }, { text: fullPrompt }] },
    });
    return response.text ?? '';
  });
};

export const editImage = async (base64ImageData: string, mimeType: string, prompt: string): Promise<string> => {
  return retryWithBackoff(async () => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
        parts: [
            {
            inlineData: {
                data: base64ImageData,
                mimeType: mimeType,
            },
            },
            {
            text: prompt,
            },
        ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
        return part.inlineData.data;
        }
    }
    throw new Error("No image was generated in the response.");
  });
};

export const generateImageFromText = async (
    prompt: string, 
    characterReferenceImage?: { base64: string; mimeType: string },
    locationReferenceImage?: { base64: string; mimeType: string },
    aspectRatio: string = '16:9'
): Promise<string> => {
    return retryWithBackoff(async () => {
        if (characterReferenceImage || locationReferenceImage) {
            const parts = [];
            let textPrompt = ``;

            if (characterReferenceImage) {
                parts.push({ inlineData: { data: characterReferenceImage.base64, mimeType: characterReferenceImage.mimeType } });
                textPrompt += `Use the character or object from the first image provided. Extract this subject and use its exact likeness. `;
            }
            if (locationReferenceImage) {
                parts.push({ inlineData: { data: locationReferenceImage.base64, mimeType: locationReferenceImage.mimeType } });
                textPrompt += `Use the location from the next image provided as the background and setting for the scene. `;
            }

            if (characterReferenceImage && locationReferenceImage) {
                textPrompt += `Place the character/object into the location, ensuring they are logically blended. `;
            }
            
            textPrompt += `Now, follow these instructions to complete the scene: ${prompt}`;

            parts.push({ text: textPrompt });

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    return part.inlineData.data;
                }
            }
            throw new Error("No image was generated in the response for the reference image prompt.");
        } else {
            // Use imagen for high-quality text-to-image generation
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: prompt,
                config: {
                    numberOfImages: 1,
                    outputMimeType: 'image/jpeg',
                    aspectRatio: aspectRatio
                },
            });

            const imageBase64 = response.generatedImages?.[0]?.image.imageBytes;
            if (!imageBase64) {
                throw new Error("Image generation failed to return an image. This could be due to safety filters. Please try a different prompt.");
            }
            return imageBase64;
        }
    });
};

export const generateStoryboardGrid = async (sceneDescription: string): Promise<string[]> => {
    const prompt = `
SYSTEM: CineSight–EnviroLock MAX (Unified Protocol, Camera Freedom Clarified)
PURPOSE: Generate a single, professional-grade storyboard image. This single image MUST be composed of four sequential panels arranged in a 2x2 grid.

Scene Focus: ${sceneDescription}

CAL (Costume Anchor Log):
- You MUST establish consistent character designs and costumes based on the Scene Focus and maintain them across all four panels.

Environment (Locked 360°):
- You MUST establish a single, consistent environment based on the Scene Focus. The architecture, props, and overall layout are locked across all four panels.
- You MUST establish a single, consistent lighting scheme and time of day.

Environment Lockdown with Camera Freedom:
- The environment is locked in design, counts, and layout once generated.  
- Camera freedom is unlimited for each panel: pan, tilt, dolly, crane, rotate, zoom, or cut to any angle.  
- Each new panel (1->2, 2->3, 3->4) MUST recompose the background logically (parallax, occlusion, horizon, depth of field, lighting direction) to reflect a new camera position or angle.  
- Veto: If the camera angle changes between panels but the background does not recompose, the entire image is a failure.

Panel Outline & Rendering Protocol (Applied to EACH panel in sequence):
- The four panels MUST represent a distinct, sequential, narrative arc: 1. Setup (top-left), 2. Escalation (top-right), 3. Climax (bottom-left), 4. Resolution/Aftermath (bottom-right).
- Each panel MUST pass the full Rendering Protocol:
  1. Continuity Check: Verify costumes, props, environment design, counts, and layout remain consistent with established logs.
  2. Camera Freedom: Recompose the background via horizon, parallax, occlusion, lighting direction, and DoF based on the new camera angle for each panel.
  3. LOS–A (Framing): Enforce standard cinematic framing rules (Wide, Close, etc.) appropriate for the action in each panel. Maintain orientation persistence (180-degree rule).
  4. LOS–B (Interaction): Ensure characters' gaze and posture are anatomically aligned to their targets or points of focus.
  5. Motion Analysis: If movement occurs between panels, the background shift must logically reflect it.
  6. Anatomy Validation: Confirm natural and consistent character anatomy and biomechanics across all panels.
  7. Beat Validation: Each panel must clearly serve its part in the 4-beat narrative arc (setup, escalation, climax, resolution).

Final Grid Generation Rules:
1. Single Image Output: You must generate only ONE image.
2. 2x2 Grid Layout: The single image must contain four panels arranged in a 2x2 grid with a thin border.
3. Panel Numbers: Include a small, clear number (1, 2, 3, 4) in the top-left corner of each respective panel.
4. No Text/Overlays: Other than the panel numbers, do not add any text.

Final Instruction: Generate one single 16:9 image containing four distinct, sequential, and visually cohesive storyboard panels based on the Scene Focus and all rules above.
`;

    return retryWithBackoff(async () => {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '16:9'
            },
        });

        const image = response.generatedImages?.[0]?.image.imageBytes;
        if (!image) {
            throw new Error("Storyboard generation failed to return an image.");
        }
        return [image];
    });
};


export const generateScriptFromIdea = async (idea: string): Promise<string> => {
  const systemInstruction = `You are a creative and professional screenwriter. Your task is to take a user's story idea and generate a short, compelling script scene (approximately 1-3 pages). The script must be formatted using standard industry conventions:
- Scene headings (INT./EXT. LOCATION - DAY/NIGHT) are in all caps.
- Character names are centered and in all caps before their dialogue.
- Dialogue is indented beneath the character name.
- Parentheticals are in parentheses and indented.
- Action lines (scene description) are written in the present tense.
- Do not include page numbers, "CONTINUED", or any other production notes. Focus purely on the content of the scene.
- The output must be only the formatted script text, with no extra explanations, titles, or commentary.`;

  const prompt = `Based on the following idea, write a short script scene.

  IDEA:
  ---
  ${idea}
  ---
  `;

  return retryWithBackoff(async () => {
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: {
        systemInstruction: systemInstruction,
        temperature: 0.7
        },
    });
    
    return (response.text ?? '').trim();
  });
};

interface ShotGenerationConfig {
    genre?: string;
    location?: string;
    characterRace?: string;
    skinTone?: string;
    artisticStyle?: string;
}

const _generateImageForShot = async (
    shot: ShotIdea, 
    scriptScene: string, 
    config: ShotGenerationConfig,
    sceneOverview: SceneOverview,
    characterDesigns: CharacterDesign[]
): Promise<string> => {
    
    const cal_log = characterDesigns.map(c => 
        `- ${c.name}: ${c.costume}`
    ).join('\n');
    
    const imagePrompt = `
SYSTEM: CineSight–EnviroLock MAX (Unified Protocol, Camera Freedom Clarified)

Scene Focus: ${scriptScene}

CAL (Costume Anchor Log):
${cal_log.length > 0 ? cal_log : '- No specific characters defined.'}

Environment (Locked 360°):
- Description: ${sceneOverview.setting_description}
- Lighting & Time: ${sceneOverview.lighting_mood}
- Tags (Secret): Internal tags for locations, objects, camera anchors, character coordinates are active.

Environment Lockdown with Camera Freedom:
- The environment is locked in design, counts, and layout once generated.  
- Camera freedom is unlimited: pan, tilt, dolly, crane, rotate, zoom, or cut to any angle.  
- Each new shot must recompose the background logically (parallax, occlusion, horizon, depth of field, lighting direction).  
- Important: Locking the environment does not restrict the camera. The two are independent.  
- Veto: If the camera angle changes but the background does not recompose, veto and regenerate.

Panel Outline:
- Panel ${shot.shot_number} – [Shot Type: ${shot.shot_type} | Camera Angle: ${shot.composition_and_framing} | Subject Focus: ${shot.description} | LOS–A (Framing): Follow shot type | LOS–B (Interaction Target): Based on action | Motion Status: ${shot.blocking} | Anatomy Check: Enforced | Beat Purpose: To visually represent this moment in the script]

Rendering Protocol (Per Panel):
1. Continuity Check: Verify costumes, props, environment design, counts, and layout remain consistent with CAL and Environment logs.
2. Camera Freedom: Recompose via horizon, parallax, occlusion, lighting direction, DoF based on the shot type.
3. LOS–A (Framing): Enforce Wide/Close/OTS rules; maintain orientation persistence.
4. LOS–B (Interaction): Ensure gaze + posture are anatomically aligned to direct target; ensure species realism; back-to-camera compliance.
5. Motion Analysis: Adjust perspective and visible elements based on implied travel distance and direction from the Motion Status.
6. Anatomy Validation: Confirm species-specific anatomy and natural biomechanics.
7. Framing Enforcement: Ensure 16:9 aspect ratio.
8. Beat Validation: Panel must serve a narrative beat from the Scene Focus (e.g. setup, interaction, reaction).
9. Frame Veto Protocol: If any rule fails → veto and regenerate until compliant.

Final Instruction: Generate a single high-quality, photorealistic 16:9 image for this specific panel outlined above. Adhere strictly to all protocols. Do not include any text, logos, or borders.
`;

    // Internal call to ai.models.generateContent using Gemini 3 Pro (Nano Banana Pro)
    // as it adheres better to detailed shot instructions and complex prompt engineering.
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: imagePrompt }] },
        config: {
            imageConfig: {
                aspectRatio: '16:9',
                imageSize: '1K'
            },
        },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }
    throw new Error(`Image generation for shot ${shot.shot_number} failed. The prompt may have been blocked or no image was returned.`);
}

export const generateShotIdeas = async (
    scriptScene: string,
    config: ShotGenerationConfig,
): Promise<{ shots: ShotIdea[], context: { sceneOverview: SceneOverview, characterDesigns: CharacterDesign[] } }> => {
    const systemInstruction = `You are a professional Director of Photography and Cinematographer AI. Your task is to create a complete visual blueprint for a script scene.
**CRITICAL INSTRUCTIONS:**
1.  **MAINTAIN CONTINUITY:** You MUST first establish consistent scene-level descriptions for the setting and characters. These descriptions will serve as the single source of truth for all shots.
2.  **ADHERE TO SCRIPT:** You MUST NOT alter, add to, or contradict the narrative, actions, or dialogue in the script. Your suggestions are purely visual.
3.  **BE DETAILED:** Generate a professional shot list with detailed cinematic guidance for each shot.
4.  **FOLLOW SCHEMA:** Adhere strictly to the JSON schema.
**CRITICAL RULE:** Within any JSON string value (like descriptions), you MUST escape all double-quote characters (") with a backslash (\\"). This is mandatory for valid JSON structure.

**Process:**
1.  **Scene Overview:** Describe the scene's primary location and overarching lighting mood. This must remain consistent.
2.  **Character Designs:** For each character, provide a consistent physical and costume description for the entire scene.
3.  **Shot List:** Break down the scene into individual shots. For each shot, specify camera work, composition, blocking, etc. The 'art_design' and 'costume_and_makeup' for each shot MUST be consistent with the master descriptions you created in steps 1 and 2, only adding minor details specific to that shot's action (e.g., 'costume is now slightly disheveled').`;
    
    let prompt = `
    Analyze the following script scene and generate a comprehensive visual blueprint, including a scene overview, character designs, and a shot list.
    `;
    if (config.genre) {
        prompt += `\nThe scene should be shot in the style of the **${config.genre}** genre. All creative choices, especially lighting, art design, and composition, must reflect this.\n`;
    }
    if (config.location) {
        prompt += `\nThe scene is set in **${config.location}**. Ensure the art design, costumes, and overall environment feel authentic to this region.\n`;
    }
    if (config.artisticStyle) {
        prompt += `\nThe overall artistic style for the entire scene must be **${config.artisticStyle}**. All generated shots must adhere to this style. For the 'artistic_style' field in each shot, you MUST use the exact string "${config.artisticStyle}". Do not alter or vary it.\n`;
    }
    prompt += `
    SCRIPT SCENE:
    ---
    ${scriptScene}
    ---
    `;

    return retryWithBackoff(async () => {
        const textResponse = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: shotListSchema,
                temperature: 0.5
            },
        });

        const jsonText = (textResponse.text ?? '').trim();
        if (!jsonText) {
        throw new Error("Received an empty response from the AI model when generating shot ideas. This might be due to safety filters or content restrictions.");
        }
        const result = JSON.parse(jsonText) as {
            scene_overview: SceneOverview;
            character_designs: CharacterDesign[];
            shots: ShotIdea[];
        };
        
        return { 
            shots: result.shots, 
            context: { 
                sceneOverview: result.scene_overview, 
                characterDesigns: result.character_designs 
            } 
        };
    });
};

export const generateShotIdeasAndImages = async (
    scriptScene: string,
    config: ShotGenerationConfig,
): Promise<{ shots: ShotIdea[], context: { sceneOverview: SceneOverview, characterDesigns: CharacterDesign[] } }> => {
    // 1. Get the structured shot list data from the text model
    const { shots: shotIdeasWithoutImages, context } = await generateShotIdeas(scriptScene, config);

    const shotIdeasWithImages: ShotIdea[] = [];

    // 2. Generate an image for each shot idea SEQUENTIALLY to avoid rate limits
    for (const shot of shotIdeasWithoutImages) {
        try {
            // Increased delay to 3000ms to be polite to the API rate limiter
            if (shotIdeasWithImages.length > 0) await sleep(3000);

            // _generateImageForShot calls generateImages, so we wrap that call in retryWithBackoff
            const imageBase64 = await retryWithBackoff(() => 
                _generateImageForShot(shot, scriptScene, config, context.sceneOverview, context.characterDesigns)
            );
            shotIdeasWithImages.push({ ...shot, image_base64: imageBase64 });
        } catch (e) {
            console.warn(`Failed to generate image for shot ${shot.shot_number}:`, e);
            // If generation fails (even after retries), return the shot without an image.
            shotIdeasWithImages.push(shot);
        }
    }

    return { 
        shots: shotIdeasWithImages, 
        context: context 
    };
};

export const generateStoryboardFromShots = async (
    shots: ShotIdea[], 
    scriptScene: string, 
    config: ShotGenerationConfig,
    context: { sceneOverview: SceneOverview, characterDesigns: CharacterDesign[] }
): Promise<string[]> => {
    
    const images: string[] = [];

    // Execute Sequentially
    for (const shot of shots) {
        try {
             if (images.length > 0) await sleep(3000);

             const imageBase64 = await retryWithBackoff(() => 
                _generateImageForShot(shot, scriptScene, config, context.sceneOverview, context.characterDesigns)
             );
             images.push(imageBase64);
        } catch (e) {
            console.warn(`Failed to storyboard panel for shot ${shot.shot_number}:`, e);
            // Push an empty string placeholder if generation fails, to maintain index alignment if needed, 
            // though the UI currently just maps existing images.
             images.push('');
        }
    }

    return images;
};

// --- AI PROMPTER ---
export const generateAIPrompts = async (
    sceneText: string, 
    existingRegistry?: Record<string, string>, 
    useContinuity: boolean = false,
    visualContext?: { sceneOverview: SceneOverview; characterDesigns: CharacterDesign[] }
): Promise<AIPrompterResult> => {
    const aiPrompterSystemInstructionConfig = {
      "CineSynthesis_MAX": {
        "version": "3.0",
        "system_name": "CineSynthesis MAX - Unified Temporal-Spatial Logic Engine",
        "objective": "Generate unlimited, copyright-safe cinematic assets with absolute continuity across shots",
        "global_scene_seed": 4268193570,
        
        "pre_analysis_protocols": {
            "temporal_prop_scanning": {
                 "rule": "Scan the ENTIRE scene text before generating DNA.",
                 "requirement": "Identify ANY prop a character uses/holds at ANY point in the scene. If they arrive with it, or it is relevant to later shots (e.g., 'pulls gun from bag'), that item MUST be included in the Master DNA immediately (e.g., 'wearing shoulder bag', 'gun in holster').",
                 "rationale": "Prevents 'magical spawning' of objects in later shots. Props must exist in the visual simulation from Shot 1 if they are in the character's possession."
            }
        },

        "master_dna_registry": {
          "character_dna_template": "[AGE] [ETHNICITY] [GENDER], [SKIN_HEX], [ANATOMY], [OUTFIT_STATE], [PERSISTENT_ACCESSORIES_AND_PROPS], unique non-celebrity face",
          "structural_dna_template": "[GEOMETRY_SHAPE], [WINDOW_STYLE], [WALL_TEXTURE], [FIXED_PROP_LOCATIONS]",
          "prop_dna_template": "[MATERIAL], [SPECIFIC_DAMAGE], [LIGHTING_COLOR]",
          "inference_protocol": "If visual details are missing in the source text, you MUST infer cinematic, high-fidelity attributes (skin texture, specific clothing fabrics, precise lighting interaction) to populate the DNA string fully. Do not produce generic descriptions."
        },

        "camera_freedom_protocol": {
          "environment_lockdown": {
            "geometry_fixed": true,
            "camera_unlimited": true,
            "recompose_required": true,
            "veto_conditions": ["camera_angle_changes_but_background_identical"]
          },
          "recompose_requirements": ["parallax", "occlusion", "lighting_direction", "depth_of_field"]
        },

        "causal_sequence_engine": {
          "rules": [
            "no_result_without_action",
            "bridge_state_jumps_automatically", 
            "stimulus_response_flow",
            "complete_beats_required"
          ],
          "shot_flow_template": "Start State → Dialogue/Action → End State",
          "bridging_examples": {
            "no_seatbelt_to_seatbelt": "insert_locking_seatbelt_shot",
            "inactive_to_active_hologram": "insert_activation_shot"
          }
        },

        "unified_prompt_templates": {
          "image_prompt": {
            "template": "/imagine prompt: [SHOT_SIZE] [ANGLE]. [FULL_CHARACTER_DNA_STRING] performing [ACTION]. [STRUCTURAL_DNA_LOCK]. [ATMOSPHERE_LAYER]. [LENS]. --no celebrity, famous actors, known figures --ar 16:9 --style reference ${global_scene_seed}",
            "variables": {
              "SHOT_SIZE": ["wide_shot", "medium_shot", "close_up", "extreme_close_up", "insert_shot"],
              "ANGLE": ["eye_level", "low_angle", "high_angle", "dutch_angle", "over_shoulder", "reverse_angle"],
              "ACTION": "description of character action",
              "ATMOSPHERE_LAYER": "lighting and environmental effects",
              "LENS": "cinematic lens description"
            }
          },
          "video_prompt": {
            "template": "START: [Previous Shot Exit State]\nACTION: [Causal Movement with Timing]\nRESULT: [Environmental Change]\nDIALOGUE: '[Line]'\nEND: [Next Shot Entry Position]\nCONTINUITY: [All DNA Locks Verified]",
            "duration_default": "8_seconds"
          }
        },

        "dynamic_shot_generation": {
          "panel_structure": {
            "fields": [
              "shot_type",
              "camera_angle", 
              "subject_focus",
              "LOS_A_framing",
              "LOS_B_interaction_target",
              "motion_status",
              "anatomy_check",
              "beat_purpose"
            ]
          },
          "coverage_requirements": {
            "establishing_shot": "required_for_new_locations",
            "character_introduction": "required_when_characters_first_appear",
            "action_beats": "required_for_all_physical_actions",
            "reaction_shots": "required_for_emotional_responses",
            "insert_shots": "required_for_important_objects",
            "dialogue_coverage": "required_for_all_spoken_lines"
          },
          "auto_expansion": {
            "enabled": true,
            "minimum_shots": 8,
            "expansion_rules": ["add_recovery_shots", "add_external_views", "add_aftermath_shots"]
          }
        },

        "continuity_enforcement": {
          "mandatory_checks_per_shot": [
            "character_dna_lock",
            "structural_dna_lock", 
            "camera_freedom_recompose",
            "causal_logic_verified",
            "anatomical_reality_maintained",
            "temporal_flow_logical"
          ],
          "veto_conditions": [
            "character_appearance_inconsistent_with_dna",
            "environmental_geometry_changes_between_shots",
            "camera_angle_changes_but_background_identical",
            "result_shown_without_causal_action",
            "state_jump_without_bridging_shot",
            "anatomical_impossibility_in_movement"
          ]
        },

        "output_structure": {
          "scene_analysis": {
            "characters": [],
            "objects": [],
            "environment": {},
            "narrative_beats": []
          },
          "generated_shots": {
            "shots": [],
            "total_shot_count": 0,
            "estimated_duration": "0:00"
          }
        }
      }
    };
    
    // We convert the config object to a string for the system prompt.
    const systemPromptString = JSON.stringify(aiPrompterSystemInstructionConfig, null, 2);

    let prompt = `
    Analyze the following scene and generate consistent image and video prompts according to the CineSynthesis MAX 3.0 configuration.

    CRITICAL INSTRUCTION FOR DNA GENERATION & PROP SCANNING:
    1. Perform a 'Global Prop Scan': Read the ENTIRE scene text first. Identify any object a character interacts with, holds, or carries at ANY point in the scene.
    2. Future-Proofing: If a character pulls a gun, phone, or bag in line 50, they must be wearing or holding that item (e.g., in a holster, slung over shoulder, or in hand) from Shot 1, unless the script explicitly states they picked it up mid-scene.
    3. DNA Injection: Add these props to the [PERSISTENT_ACCESSORIES_AND_PROPS] section of the Master DNA string.
    4. Inference: If the text is sparse, infer high-fidelity attributes to populate the DNA string fully.
    `;

    if (visualContext) {
        prompt += `
    VISUAL CONSISTENCY PROTOCOL (PRIORITY LEVEL: HIGH):
    The following visual blueprints were established in the 'Shot Idea Studio'.
    CHECK: Does the scene below take place in this location? Do these characters appear?
    ACTION: If yes, you MUST override any inferred DNA with these specific descriptions to maintain project consistency.
    
    LOCKED LOCATION DATA:
    Setting: ${visualContext.sceneOverview.setting_description}
    Lighting Mood: ${visualContext.sceneOverview.lighting_mood}

    LOCKED CHARACTER DATA:
    ${visualContext.characterDesigns.map(c => `NAME: ${c.name}\n   VISUALS: ${c.description}\n   COSTUME: ${c.costume}`).join('\n')}
    `;
    }

    if (useContinuity && existingRegistry && Object.keys(existingRegistry).length > 0) {
        prompt += `
    CONTINUITY PROTOCOL ACTIVE:
    The following characters have established Master DNA from previous scenes. You MUST PRIORITIZE and REUSE the physical attributes from these strings for any character with a matching name (case-insensitive).
    
    EXISTING CHARACTER REGISTRY:
    ${JSON.stringify(existingRegistry, null, 2)}

    INSTRUCTIONS FOR EXISTING CHARACTERS:
    1. MATCH: Identify if a character in the new scene matches a name in the Registry.
    2. LOCK PHYSICALS: You MUST keep the physical description (Age, Ethnicity, Face, Body, Skin) EXACTLY as provided in the registry.
    3. DYNAMIC WARDROBE & PROPS: You MAY update the [OUTFIT] and [PERSISTENT_ACCESSORIES_AND_PROPS] portions ONLY if the new scene explicitly implies a change or requires new props (based on the Prop Scan).
    4. OUTPUT: The final visual_string must be the merged result of Locked Physicals + Contextual Outfit/Props.
        `;
    }

    prompt += `
    SCENE:
    ---
    ${sceneText}
    ---
    `;

    return retryWithBackoff(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: {
                systemInstruction: systemPromptString,
                responseMimeType: "application/json",
                responseSchema: aiPrompterSchema,
                temperature: 0.7 
            }
        });

        const jsonText = (response.text ?? '').trim();
        if (!jsonText) {
             throw new Error("Received an empty response from the AI model when generating prompts.");
        }
        return JSON.parse(jsonText) as AIPrompterResult;
    });
}


interface GenerateVideoParams {
  prompt: string;
  resolution: '720p' | '1080p';
  firstFrame?: { base64: string; mimeType: string };
  lastFrame?: { base64: string; mimeType: string };
}

export const generateVideo = async (params: GenerateVideoParams): Promise<string> => {
  try {
    // Create a new instance for video generation to ensure the latest key is used.
    const localAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const request: any = {
      model: 'veo-3.1-fast-generate-preview',
      prompt: params.prompt,
      config: {
        numberOfVideos: 1,
        resolution: params.resolution,
        aspectRatio: '16:9',
      }
    };

    if (params.firstFrame) {
      request.image = {
        imageBytes: params.firstFrame.base64,
        mimeType: params.firstFrame.mimeType
      };
    }
    
    if (params.lastFrame) {
      // According to docs, lastFrame is inside config
      request.config.lastFrame = {
        imageBytes: params.lastFrame.base64,
        mimeType: params.lastFrame.mimeType
      };
    }

    let operation: any = await retryWithBackoff(() => localAi.models.generateVideos(request));

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
      // Retry the polling operation if it fails (e.g. network blip)
      operation = await retryWithBackoff(() => localAi.operations.getVideosOperation({ operation: operation }));
    }

    if (operation.error) {
        throw new Error(`Video generation failed: ${operation.error.message}`);
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
      throw new Error("Video generation completed, but no download link was found.");
    }

    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!response.ok) {
        const errorText = await response.text();
        console.error("Video download failed with status:", response.status, "and message:", errorText);
        throw new Error(`Failed to download video file. Status: ${response.status}`);
    }
    const videoBlob = await response.blob();
    const videoUrl = URL.createObjectURL(videoBlob);
    
    return videoUrl;

  } catch (err) {
    if (err instanceof Error) {
        if (err.message.includes("Requested entity was not found")) {
            throw new Error("API key error: The selected project may not have billing enabled or the Veo API is not active. Please select another key or check your project settings.");
        }
    }
    throw err; // rethrow other errors
  }
};