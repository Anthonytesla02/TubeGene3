import React, { useEffect, useRef, useState } from 'react';
import { GeneratedVideo, VideoSegment, AspectRatio } from '../types';

interface SmartPlayerProps {
  video: GeneratedVideo;
  onReset: () => void;
}

// Helper to decode base64 string to Uint8Array
const decodeBase64 = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Helper to decode raw PCM data (16-bit, 24kHz, mono) into AudioBuffer
const decodePCM = (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): AudioBuffer => {
  // Ensure data length is even for Int16Array
  if (data.byteLength % 2 !== 0) {
    data = data.subarray(0, data.byteLength - 1);
  }

  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert PCM 16-bit to float [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

const SmartPlayer: React.FC<SmartPlayerProps> = ({ video, onReset }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Refs for audio/visual state
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<AudioBuffer[]>([]);
  const imageBitmapsRef = useRef<ImageBitmap[]>([]);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  // Animation state
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const segmentStartTimeRef = useRef<number>(0);

  // Initialize Assets
  useEffect(() => {
    const loadAssets = async () => {
      try {
        // Use standard AudioContext
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        const audioBuffers: AudioBuffer[] = [];
        const images: ImageBitmap[] = [];

        let loadedCount = 0;
        const total = video.segments.length * 2;

        const updateProgress = () => {
          loadedCount++;
          setLoadingProgress(Math.round((loadedCount / total) * 100));
        };

        for (const segment of video.segments) {
          // 1. Decode Audio (PCM)
          try {
            const bytes = decodeBase64(segment.audioData);
            // Gemini TTS returns 24kHz raw PCM mono
            const audioBuffer = decodePCM(bytes, ctx, 24000, 1);
            audioBuffers.push(audioBuffer);
          } catch (err) {
            console.error("Error decoding audio for segment", segment.id, err);
            // Fallback to silent buffer to prevent crash
            const silent = ctx.createBuffer(1, 24000, 24000); 
            audioBuffers.push(silent);
          }
          updateProgress();

          // 2. Load Image
          try {
            // Try detecting mime type or default to jpeg which is standard for Gemini Image
            const response = await fetch(`data:image/jpeg;base64,${segment.imageData}`);
            const imgBlob = await response.blob();
            const imgBitmap = await createImageBitmap(imgBlob);
            images.push(imgBitmap);
          } catch (err) {
            console.error("Error loading image for segment", segment.id, err);
            // Fallback placeholder (1x1 transparent)
            const canvas = document.createElement('canvas');
            canvas.width = 1; canvas.height = 1;
            const fallback = await createImageBitmap(canvas);
            images.push(fallback);
          }
          updateProgress();
        }

        audioBuffersRef.current = audioBuffers;
        imageBitmapsRef.current = images;
        setIsLoaded(true);
        
        // Try to auto play if context is allowed
        if (ctx.state === 'running') {
            playSegment(0);
        }
      } catch (e) {
        console.error("Fatal error loading assets", e);
      }
    };

    loadAssets();

    return () => {
      if (audioContextRef.current) {
          audioContextRef.current.close();
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [video]);

  const playSegment = (index: number) => {
    if (index >= video.segments.length) {
      setIsPlaying(false);
      return;
    }

    const ctx = audioContextRef.current;
    if (!ctx) return;

    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch(e) {}
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffersRef.current[index];
    source.connect(ctx.destination);
    
    source.onended = () => {
       // Only advance if we are still playing (not stopped manually)
       // We assume standard playback flow here
       playSegment(index + 1);
    };

    source.start();
    currentSourceRef.current = source;
    
    setCurrentSegmentIndex(index);
    segmentStartTimeRef.current = performance.now();
    setIsPlaying(true);
    
    if (!animationFrameRef.current) {
        renderLoop();
    }
  };

  const togglePlay = async () => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
        await ctx.resume();
    }

    if (isPlaying) {
      if (ctx.state === 'running') {
        await ctx.suspend();
        setIsPlaying(false);
      }
    } else {
      if (ctx.state === 'suspended') {
        await ctx.resume();
        setIsPlaying(true);
        renderLoop();
      } else {
        // If we were fully stopped/finished, restart
        if (currentSegmentIndex >= video.segments.length || (currentSegmentIndex >= video.segments.length - 1 && !currentSourceRef.current)) {
            playSegment(0);
        } else {
            setIsPlaying(true);
            renderLoop();
        }
      }
    }
  };

  const renderLoop = () => {
    if (!canvasRef.current || !containerRef.current) return;
    
    // Check if we should stop
    if (!isPlaying && audioContextRef.current?.state === 'suspended') {
        animationFrameRef.current = requestAnimationFrame(renderLoop); 
        return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle Resize
    const { clientWidth, clientHeight } = containerRef.current;
    if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
      canvas.width = clientWidth;
      canvas.height = clientHeight;
    }

    const segmentIdx = currentSegmentIndex;
    if (segmentIdx >= video.segments.length) return;

    const now = performance.now();
    const buffer = audioBuffersRef.current[segmentIdx];
    const segmentDuration = buffer ? buffer.duration * 1000 : 5000;
    
    // Calculate elapsed time. Note: This simple elapsed check drifts if paused via suspend
    // but works for continuous playback which is the primary use case.
    const elapsed = now - segmentStartTimeRef.current;
    const progress = Math.min(Math.max(elapsed / segmentDuration, 0), 1);

    // --- RENDER ---
    
    // 1. Background / Image
    const img = imageBitmapsRef.current[segmentIdx];
    if (img) {
      ctx.save();
      
      // Ken Burns Effect
      const scale = 1.0 + (progress * 0.15); // 15% zoom
      
      const imgRatio = img.width / img.height;
      const canvasRatio = canvas.width / canvas.height;
      
      let renderW, renderH, offsetX, offsetY;
      
      if (imgRatio > canvasRatio) {
        renderH = canvas.height;
        renderW = renderH * imgRatio;
        offsetX = (canvas.width - renderW) / 2;
        offsetY = 0;
      } else {
        renderW = canvas.width;
        renderH = renderW / imgRatio;
        offsetX = 0;
        offsetY = (canvas.height - renderH) / 2;
      }

      ctx.translate(canvas.width/2, canvas.height/2);
      ctx.scale(scale, scale);
      ctx.translate(-canvas.width/2, -canvas.height/2);
      
      ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
      ctx.restore();
    } else {
       ctx.fillStyle = "#111";
       ctx.fillRect(0,0, canvas.width, canvas.height);
    }

    // 2. Overlay Gradient
    const gradient = ctx.createLinearGradient(0, canvas.height * 0.5, 0, canvas.height);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.7, "rgba(0,0,0,0.6)");
    gradient.addColorStop(1, "rgba(0,0,0,0.9)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, canvas.height * 0.4, canvas.width, canvas.height * 0.6);

    // 3. Captions
    const text = video.segments[segmentIdx].text;
    
    // Responsive Font Size
    const fontSize = video.aspectRatio === AspectRatio.PORTRAIT 
        ? canvas.width * 0.08 
        : canvas.width * 0.04;
        
    ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,1)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // Word Wrap
    const words = text.split(' ');
    let line = '';
    const lines = [];
    const maxWidth = canvas.width * 0.85;
    
    for(let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    // Draw lines
    const lineHeight = fontSize * 1.3;
    const totalTextHeight = lines.length * lineHeight;
    const startY = (canvas.height * 0.8) - (totalTextHeight / 2);
    
    lines.forEach((l, i) => {
      ctx.fillText(l, canvas.width / 2, startY + (i * lineHeight));
    });

    // 4. Progress Bar
    const totalDuration = audioBuffersRef.current.reduce((acc, b) => acc + (b?.duration || 0), 0);
    const prevDuration = audioBuffersRef.current.slice(0, segmentIdx).reduce((acc, b) => acc + (b?.duration || 0), 0);
    
    // Rough estimate of total progress
    const currentProgress = (prevDuration + (elapsed/1000));
    const totalProgressPct = Math.min(currentProgress / totalDuration, 1);
    
    // Bar container
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(0, canvas.height - 6, canvas.width, 6);
    
    // Active bar
    ctx.fillStyle = "#3b82f6"; // Blue-500
    ctx.fillRect(0, canvas.height - 6, canvas.width * totalProgressPct, 6);

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    }
  };

  useEffect(() => {
     if (isPlaying) {
         renderLoop();
     } else {
         if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
     }
  }, [isPlaying, currentSegmentIndex]);


  if (!isLoaded) {
    return (
      <div className="w-full aspect-video bg-gray-900 rounded-2xl flex flex-col items-center justify-center text-white border border-gray-800 p-8">
        <div className="w-full max-w-xs h-2 bg-gray-800 rounded-full overflow-hidden mb-4 relative">
          <div className="absolute inset-0 bg-blue-500 transition-all duration-300 rounded-full" style={{ width: `${loadingProgress}%`}} />
        </div>
        <p className="animate-pulse text-sm text-gray-400 font-medium">Assembling Video... {loadingProgress}%</p>
        <p className="text-xs text-gray-600 mt-2">Decoding Audio & Compressing Images</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
       <div 
         ref={containerRef}
         className={`relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-gray-800 mx-auto ${
           video.aspectRatio === AspectRatio.PORTRAIT ? 'max-w-[400px] aspect-[9/16]' : 'aspect-video'
         }`}
       >
         <canvas ref={canvasRef} className="w-full h-full object-cover block" />
         
         {/* Play Overlay */}
         {!isPlaying && (
           <div 
             className="absolute inset-0 flex items-center justify-center bg-black/50 cursor-pointer transition-all hover:bg-black/40"
             onClick={togglePlay}
           >
             <div className="group bg-white/10 backdrop-blur-md p-6 rounded-full border border-white/20 transition-all transform hover:scale-110 hover:bg-white/20">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white fill-current" viewBox="0 0 24 24">
                 <path d="M8 5v14l11-7z" />
               </svg>
             </div>
           </div>
         )}
         
         <div className="absolute top-4 left-4 flex gap-2">
             <div className="bg-black/60 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white/90 border border-white/10 shadow-lg">
                {video.style}
             </div>
             <div className="bg-blue-600/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
                HD
             </div>
         </div>
       </div>

       <div className="flex justify-between items-center px-2">
         <button 
           onClick={onReset}
           className="text-gray-400 hover:text-white text-sm flex items-center gap-2 transition-colors px-4 py-2 rounded-lg hover:bg-white/5"
         >
           <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
           </svg>
           Create New Video
         </button>
         
         <div className="flex gap-2">
            <button 
                className="text-blue-400 hover:text-blue-300 text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-500/10 transition-colors"
                onClick={() => alert("Recording feature coming soon! For now, please use your device's screen recorder.")}
            >
            Download Video
            </button>
         </div>
       </div>
    </div>
  );
};

export default SmartPlayer;