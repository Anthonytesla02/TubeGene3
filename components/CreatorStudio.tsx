import React, { useState } from 'react';
import { AspectRatio, GenerationStatus } from '../types';

interface CreatorStudioProps {
  status: GenerationStatus;
  progressMessage: string;
  onGenerate: (topic: string, style: string, ar: AspectRatio) => void;
}

const STYLES = [
  { id: 'documentary', label: 'Documentary', desc: 'Educational, calm, detailed' },
  { id: 'hype', label: 'Hype / Viral', desc: 'Fast paced, energetic, bold' },
  { id: 'cinematic', label: 'Cinematic', desc: 'Dramatic, moody, movie-like' },
  { id: 'minimalist', label: 'Minimalist', desc: 'Clean, simple, modern' },
];

const CreatorStudio: React.FC<CreatorStudioProps> = ({ status, progressMessage, onGenerate }) => {
  const [topic, setTopic] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>('hype');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.PORTRAIT);

  const handleGenerate = () => {
    if (!topic.trim()) return;
    onGenerate(topic, selectedStyle, aspectRatio);
  };

  const isGenerating = status !== GenerationStatus.IDLE && status !== GenerationStatus.COMPLETED && status !== GenerationStatus.FAILED;

  return (
    <div className="glass-panel rounded-2xl p-6 lg:p-8 shadow-xl border border-gray-700/50">
      <div className="flex flex-col gap-8">
        
        {/* Topic Input */}
        <div>
          <label className="block text-sm font-medium text-blue-300 mb-2 uppercase tracking-wider">
            Video Topic / Idea
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={isGenerating}
            placeholder="E.g., 5 mind-blowing facts about space, The history of pizza, Motivation to workout..."
            className="w-full bg-gray-900/80 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all h-28 resize-none text-lg"
          />
        </div>

        {/* Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Style Selection */}
          <div>
             <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Vibe & Style
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map(style => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  disabled={isGenerating}
                  className={`p-3 rounded-lg text-left transition-all border ${
                    selectedStyle === style.id 
                      ? 'bg-blue-600/20 border-blue-500 text-white' 
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <div className="font-medium text-sm">{style.label}</div>
                  <div className="text-xs opacity-70 mt-1">{style.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Format
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setAspectRatio(AspectRatio.PORTRAIT)}
                disabled={isGenerating}
                className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                  aspectRatio === AspectRatio.PORTRAIT 
                    ? 'bg-gray-800 border-blue-500 text-white ring-2 ring-blue-500/20' 
                    : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:bg-gray-800'
                }`}
              >
                <div className="w-6 h-10 border-2 border-current rounded mb-2"></div>
                <span className="font-medium">Shorts</span>
                <span className="text-xs opacity-60">9:16</span>
              </button>
              
              <button
                onClick={() => setAspectRatio(AspectRatio.LANDSCAPE)}
                disabled={isGenerating}
                className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
                  aspectRatio === AspectRatio.LANDSCAPE 
                    ? 'bg-gray-800 border-blue-500 text-white ring-2 ring-blue-500/20' 
                    : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:bg-gray-800'
                }`}
              >
                <div className="w-10 h-6 border-2 border-current rounded mb-2"></div>
                <span className="font-medium">YouTube</span>
                <span className="text-xs opacity-60">16:9</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-2">
          <button
            onClick={handleGenerate}
            disabled={!topic.trim() || isGenerating}
            className={`w-full py-5 rounded-xl font-bold text-xl shadow-2xl transform transition-all duration-300 relative overflow-hidden group
              ${!topic.trim() || isGenerating 
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                : 'bg-white text-black hover:scale-[1.01]'
              }`}
          >
            {isGenerating ? (
               <span className="flex items-center justify-center gap-3">
                 <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
                 {progressMessage}
               </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>✨ Generate Video</span>
              </span>
            )}
            
            {!isGenerating && topic.trim() && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/30 to-transparent -translate-x-full group-hover:animate-shimmer" />
            )}
          </button>
          
          <p className="text-center text-xs text-gray-500 mt-4">
            Generates ~5 scenes with AI Voiceover & 4K Visuals. Takes about 30-60 seconds.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CreatorStudio;