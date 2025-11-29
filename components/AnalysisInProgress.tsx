
import React, { useState, useEffect } from 'react';
import { AnalysisStatus } from '../types';
import { CheckCircleIcon, SpinnerIcon, RobotIcon, XIcon, LightbulbIcon, TrashIcon } from './icons';

interface AnalysisInProgressProps {
  status: AnalysisStatus;
  onStop: () => void;
  onResume: () => void;
  onCancel: () => void;
}

const STAGE_1_MESSAGES = [
  "Hahaha",
  "So Funny",
  "OMG",
  "What is going to happen next?",
  "I don't want it to end",
  "Hmm, very entertaining...",
  "Wow, I can't believe that happened!",
  "Aww. So sad.",
  "Very intriguing...",
  "I like the potential of this story.",
  "Analyzing character arcs...",
  "Checking for plot holes...",
  "Identifying the inciting incident...",
  "This dialogue is snappy!",
  "Cataloging characters..."
];

const STAGE_2_MESSAGES = [
  "Let's sweeten the deal.",
  "Hmm, the mood is intense.",
  "I think this actor will do great.",
  "What a logline!",
  "Calculating market potential...",
  "Defining the visual tone...",
  "Identifying comparable titles...",
  "Drafting the treatment...",
  "This genre fits perfectly.",
  "Structuring the pitch deck...",
  "Polishing the themes...",
  "Analyzing target audience demographics..."
];

const STAGE_2_VISUALS_MESSAGES = [
  "Dreaming up concept art...",
  "Casting virtual actors...",
  "Scouting locations in the digital realm...",
  "Painting the scene...",
  "Adjusting the lighting...",
  "Rendering cinematic assets...",
  "Visualizing the world...",
  "Generating character portraits...",
  "Applying the color grade...",
  "Finding the perfect movie posters..."
];

const STAGE_3_MESSAGES = [
  "Breaking down the budget...",
  "Scheduling the shoot...",
  "Listing props and wardrobe...",
  "Assessing production risks...",
  "Organizing the departments...",
  "Calculating shooting days...",
  "Optimizing the schedule...",
  "Checking day/night balance...",
  "Reviewing location requirements..."
];

const AnalysisStep: React.FC<{ title: string; isActive: boolean; isComplete: boolean; isPaused: boolean }> = ({ title, isActive, isComplete, isPaused }) => (
    <div className={`flex items-center gap-4 p-4 rounded-lg border transition-all duration-300 ${isActive ? (isPaused ? 'bg-yellow-500/10 border-yellow-500 shadow-accent-glow' : 'bg-accent/10 border-accent shadow-accent-glow') : 'bg-bg-secondary border-border-color'}`}>
      <div className="w-6 h-6 flex-shrink-0">
        {isActive && !isPaused && <SpinnerIcon className="w-full h-full text-accent animate-spin" />}
        {isActive && isPaused && <div className="w-full h-full rounded-full border-2 border-yellow-500 border-dashed animate-pulse"></div>}
        {isComplete && <CheckCircleIcon className="w-full h-full text-green-400" />}
        {!isActive && !isComplete && <div className="w-full h-full border-2 border-border-color rounded-full"></div>}
      </div>
      <span className={`text-lg transition-colors duration-300 ${isActive ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
        {title}
        {isActive && isPaused && <span className="ml-2 text-sm text-yellow-500 font-normal">(Paused)</span>}
      </span>
    </div>
);

const AnalysisInProgress: React.FC<AnalysisInProgressProps> = ({ status, onStop, onResume, onCancel }) => {
  const [currentMessage, setCurrentMessage] = useState("");
  const [fadeKey, setFadeKey] = useState(0);

  const isPaused = status === AnalysisStatus.PAUSED;

  useEffect(() => {
    let messages: string[] = [];

    switch (status) {
      case AnalysisStatus.ANALYZING_STAGE_1:
        messages = STAGE_1_MESSAGES;
        break;
      case AnalysisStatus.ANALYZING_STAGE_2:
        messages = STAGE_2_MESSAGES;
        break;
      case AnalysisStatus.ANALYZING_STAGE_2_VISUALS:
        messages = STAGE_2_VISUALS_MESSAGES;
        break;
      case AnalysisStatus.ANALYZING_STAGE_3:
        messages = STAGE_3_MESSAGES;
        break;
      case AnalysisStatus.PAUSED:
        messages = ["Waiting for you...", "Taking a break...", "Ready when you are..."];
        break;
      default:
        messages = ["Processing..."];
    }

    // Initial message logic
    if (status === AnalysisStatus.ANALYZING_STAGE_1) {
        setCurrentMessage("I am ready for the script now.");
    } else if (status === AnalysisStatus.PAUSED) {
        setCurrentMessage("Analysis paused.");
    } else {
        // Pick a random message immediately for other stages
        setCurrentMessage(messages[Math.floor(Math.random() * messages.length)]);
    }

    if (!isPaused) {
        const interval = setInterval(() => {
          const randomMsg = messages[Math.floor(Math.random() * messages.length)];
          setCurrentMessage(randomMsg);
          setFadeKey(prev => prev + 1); // Trigger animation restart
        }, 3000); // Change message every 3 seconds
        return () => clearInterval(interval);
    }
  }, [status, isPaused]);

  return (
    <div className="text-center p-8 flex flex-col items-center gap-8 w-full max-w-2xl mx-auto">
      
      {/* Animated Thought Bubble Area */}
      <div className="relative w-full flex flex-col items-center justify-center min-h-[120px]">
        <div className="mb-4 relative">
             <div className={`absolute -inset-4 bg-accent/20 rounded-full blur-xl ${isPaused ? '' : 'animate-pulse'}`}></div>
             <RobotIcon className={`w-16 h-16 text-accent relative z-10 ${isPaused ? 'opacity-50' : ''}`} />
        </div>
        
        <div key={fadeKey} className="animate-pop-in">
            <p className="text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent-secondary drop-shadow-sm">
            "{currentMessage}"
            </p>
        </div>
      </div>

      <div className="w-full space-y-4">
        <AnalysisStep 
            title="Stage 1: Structural & Narrative Deconstruction"
            isActive={status === AnalysisStatus.ANALYZING_STAGE_1}
            isComplete={status > AnalysisStatus.ANALYZING_STAGE_1 && status !== AnalysisStatus.PAUSED}
            isPaused={isPaused}
        />
        <AnalysisStep 
            title="Stage 2: Pitch Deck Creation"
            isActive={status === AnalysisStatus.ANALYZING_STAGE_2}
            isComplete={status > AnalysisStatus.ANALYZING_STAGE_2 && status !== AnalysisStatus.PAUSED}
            isPaused={isPaused}
        />
        <AnalysisStep 
            title="Generating Visual Concepts"
            isActive={status === AnalysisStatus.ANALYZING_STAGE_2_VISUALS}
            isComplete={status > AnalysisStatus.ANALYZING_STAGE_2_VISUALS && status !== AnalysisStatus.PAUSED}
            isPaused={isPaused}
        />
         <AnalysisStep 
            title="Stage 3: Production & Scheduling"
            isActive={status === AnalysisStatus.ANALYZING_STAGE_3}
            isComplete={status > AnalysisStatus.ANALYZING_STAGE_3 && status !== AnalysisStatus.PAUSED}
            isPaused={isPaused}
        />
      </div>

      <div className="mt-4 w-full">
          {isPaused ? (
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full">
                  <button 
                    onClick={onResume}
                    className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg shadow-green-500/20 transition-all transform hover:scale-105 text-sm sm:text-base"
                  >
                      <LightbulbIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span>I'd like to continue reading if you don't mind</span>
                  </button>
                  <button 
                    onClick={onCancel}
                    className="flex-shrink-0 flex items-center justify-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg shadow-lg shadow-red-500/20 transition-all transform hover:scale-105 text-sm sm:text-base"
                  >
                      <TrashIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span>Stop completely</span>
                  </button>
              </div>
          ) : (
              <button 
                onClick={onStop}
                className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 font-semibold rounded-lg transition-colors"
              >
                  <XIcon className="w-5 h-5" />
                  <span>Stop reading</span>
              </button>
          )}
      </div>

      <style>{`
        @keyframes popIn {
          0% { opacity: 0; transform: translateY(10px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-pop-in {
          animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
    </div>
  );
};

export default AnalysisInProgress;
