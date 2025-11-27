import React, { useState } from 'react';
import ApiKeyModal from './components/ApiKeyModal';
import CreatorStudio from './components/CreatorStudio';
import SmartPlayer from './components/SmartPlayer';
import { GeneratedVideo, GenerationStatus, AspectRatio } from './types';
import { generateVideoWorkflow } from './services/geminiService';

const App: React.FC = () => {
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [currentVideo, setCurrentVideo] = useState<GeneratedVideo | null>(null);

  const handleGenerate = async (
    topic: string, 
    style: string, 
    aspectRatio: AspectRatio, 
  ) => {
    setStatus(GenerationStatus.PLANNING);
    setProgressMsg("Initializing...");

    try {
      const result = await generateVideoWorkflow(
        topic,
        style,
        aspectRatio,
        (msg) => setProgressMsg(msg)
      );

      setCurrentVideo(result);
      setStatus(GenerationStatus.COMPLETED);
    } catch (error) {
      console.error(error);
      setStatus(GenerationStatus.FAILED);
      setProgressMsg('Error: ' + (error as Error).message);
    }
  };

  const reset = () => {
    setCurrentVideo(null);
    setStatus(GenerationStatus.IDLE);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-100 selection:bg-blue-500 selection:text-white pb-20 font-sans">
      <ApiKeyModal />
      
      {/* Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-lg bg-[#0f172a]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-green-400 to-blue-500 h-8 w-8 rounded-lg flex items-center justify-center shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-400">
                TubeGen
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {!currentVideo ? (
          <div className="animate-fade-in-up">
             <div className="mb-10 text-center">
               <h1 className="text-5xl font-extrabold mb-4 text-white tracking-tight">
                 Idea to Video. <span className="text-blue-500">Instantly.</span>
               </h1>
               <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                 Turn any topic into an engaging, narrated video with AI-generated visuals and voiceovers. 
                 <span className="text-green-400 font-medium ml-1">100% Free workflow.</span>
               </p>
             </div>
             
             <CreatorStudio 
               status={status}
               progressMessage={progressMsg}
               onGenerate={handleGenerate}
             />
             
             {status === GenerationStatus.FAILED && (
                <div className="mt-6 p-4 bg-red-900/20 border border-red-800 rounded-xl text-red-200 text-center">
                  {progressMsg || "Generation failed. Please try again."}
                </div>
             )}
          </div>
        ) : (
          <div className="animate-fade-in">
            <SmartPlayer video={currentVideo} onReset={reset} />
          </div>
        )}

      </main>
    </div>
  );
};

export default App;