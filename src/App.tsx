/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Play, Sparkles, Loader2, Download, Image as ImageIcon, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type AvatarOptions = {
  niche: string;
  hairColor: string;
  eyeColor: string;
  bodyType: string;
  environment: string;
  lighting: string;
  pose: string;
  aspectRatio: string;
  videoAction: string;
};

type GalleryItem = {
  id: string;
  url: string;
  options: AvatarOptions;
};

const defaultOptions: AvatarOptions = {
  niche: 'Fitness girl',
  hairColor: 'Brunette',
  eyeColor: 'Brown',
  bodyType: 'Athletic',
  environment: 'Modern Gym',
  lighting: 'Soft Studio',
  pose: 'Confident stance',
  aspectRatio: '9:16',
  videoAction: 'A gentle hair flip',
};

const ASPECT_RATIO_CLASSES: Record<string, string> = {
  '9:16': 'aspect-[9/16]',
  '1:1': 'aspect-square',
  '4:3': 'aspect-[4/3]',
};

const OPTIONS = {
  niche: ['Fitness girl', 'Emo girl', 'Cyberpunk', 'Fantasy', 'Business casual', 'Goth', 'Beach vibe'],
  hairColor: ['Blonde', 'Brunette', 'Redhead', 'Black', 'Blue', 'Pink', 'Silver'],
  eyeColor: ['Blue', 'Green', 'Brown', 'Hazel', 'Gray', 'Violet'],
  bodyType: ['Athletic', 'Slim', 'Curvy', 'Average', 'Petite'],
  environment: ['Modern Gym', 'Urban street', 'Magical forest', 'Neon club', 'Cozy living room', 'Sunny beach'],
  lighting: ['Cinematic', 'Golden hour', 'Neon', 'Soft Studio', 'Moody', 'Harsh shadows'],
  pose: ['Confident stance', 'Looking over shoulder', 'Hand on hip', 'Sitting gracefully', 'Action pose', 'Candid smile'],
  aspectRatio: ['9:16', '1:1', '4:3'],
  videoAction: ['A gentle hair flip', 'A subtle wink', 'A confident subtle sway', 'Looking directly into the camera', 'Blowing a kiss playfully'],
};

export default function App() {
  const [options, setOptions] = useState<AvatarOptions>(defaultOptions);
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [gallery, setGallery] = useState<GalleryItem[]>(() => {
    try {
      const stored = localStorage.getItem('lumina-gallery');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const updateGallery = (newItem: GalleryItem) => {
    setGallery(prev => {
      const updated = [newItem, ...prev].slice(0, 5);
      try {
        localStorage.setItem('lumina-gallery', JSON.stringify(updated));
      } catch (e) {
        console.warn("Could not save to localStorage.", e);
      }
      return updated;
    });
  };

  const buildPrompt = (opts: AvatarOptions, enhance: boolean) => {
    let basePrompt = `A hyper-realistic, photorealistic photograph of a woman showing her full characteristics. Niche/Style: ${opts.niche}. 
Hair: ${opts.hairColor}. Eyes: ${opts.eyeColor}. Body type: ${opts.bodyType}. 
Pose: ${opts.pose}. 
Environment: ${opts.environment}. 
Lighting: ${opts.lighting}.`;

    if (enhance) {
      return `${basePrompt} Masterpiece, RAW photo, ultra-detailed, intricate details, vivid colors, depth of field, sharp focus, volumetric lighting, cinematic post-processing, highly realistic skin texture, natural skin pores, perfect lighting, 8k resolution, uncropped.`;
    }

    return `${basePrompt} Highly detailed, 8k resolution, masterful cinematic composition, lifelike textures, uncropped.`;
  };

  const handleGenerateImage = async () => {
    setGeneratingImage(true);
    setImageUrl(null);
    setVideoUrl(null); // reset video
    try {
      const prompt = buildPrompt(options, enhancePrompt);
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio: options.aspectRatio }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setImageUrl(data.imageUrl);
      
      updateGallery({
        id: Date.now().toString(),
        url: data.imageUrl,
        options: { ...options }
      });
    } catch (err: any) {
      alert("Error generating image: " + err.message);
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!imageUrl) return;
    setGeneratingVideo(true);
    setVideoUrl(null);
    setVideoProgress('Starting AI video cluster...');
    
    try {
      const prompt = `Highly detailed cinematic 5 second video. The character makes a sensual move: ${options.videoAction}. Smooth motion, high quality, photorealistic, maintaining exact appearance of the provided image.`;
      
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, imageBase64: imageUrl, aspectRatio: options.aspectRatio }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { operationName } = await res.json();

      setVideoProgress('Rendering video... this typically takes 1-3 minutes. Please hold tight!');

      // Poll
      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch('/api/video-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operationName }),
          });
          const pollData = await pollRes.json();
          
          if (pollData.done) {
            clearInterval(pollInterval);
            setVideoProgress('Downloading your video...');
            await downloadVideo(operationName);
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 5000);
      
    } catch (err: any) {
      alert("Error starting video generation: " + err.message);
      setGeneratingVideo(false);
    }
  };

  const downloadVideo = async (operationName: string) => {
    try {
      const res = await fetch('/api/video-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationName }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      setVideoUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      alert("Error downloading video: " + err.message);
    } finally {
      setGeneratingVideo(false);
      setVideoProgress('');
    }
  };

  const updateOption = (key: keyof AvatarOptions, value: string) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  const handleRandomize = () => {
    const randomOptions = { ...options };
    (Object.keys(OPTIONS) as Array<keyof AvatarOptions>).forEach(key => {
      const choices = OPTIONS[key];
      const randomChoice = choices[Math.floor(Math.random() * choices.length)];
      randomOptions[key] = randomChoice;
    });
    setOptions(randomOptions);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-rose-500/30 selection:text-rose-200 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50 p-4 px-6 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-900/20">
            <Sparkles className="w-5 h-5 text-zinc-50" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Lumina</h1>
            <p className="text-xs text-zinc-400 font-medium tracking-wide uppercase">AI Character Studio</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative items-start">
        
        {/* Controls Panel */}
        <div className="lg:col-span-5 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-6 sm:p-8 backdrop-blur-sm lg:sticky top-28">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-rose-400" />
              Design Your Avatar
            </h2>
            <button
              onClick={handleRandomize}
              className="group flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 hover:text-white rounded-lg text-sm font-medium transition-colors border border-zinc-700/50"
            >
              <Shuffle className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              Randomize
            </button>
          </div>
          
          <div className="space-y-6">
            {(Object.keys(OPTIONS) as Array<keyof AvatarOptions>).map((key) => {
              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              
              return (
                <div key={key} className="space-y-2">
                  <label className="text-sm font-medium text-zinc-300">
                    {label} {key === 'videoAction' && <span className="text-rose-400/80 text-xs ml-1">(Animation)</span>}
                  </label>
                  <select
                    className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-rose-500/50 transition-all appearance-none"
                    value={options[key]}
                    onChange={(e) => updateOption(key, e.target.value)}
                  >
                    {OPTIONS[key].map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between bg-zinc-950/50 p-4 rounded-xl border border-zinc-800">
            <div>
              <p className="text-sm font-medium text-white">Enhance Prompt</p>
              <p className="text-xs text-zinc-400 mt-0.5">Automatically appends keywords for ultra-realism</p>
            </div>
            <button
              onClick={() => setEnhancePrompt(p => !p)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enhancePrompt ? 'bg-rose-500' : 'bg-zinc-700'}`}
              aria-pressed={enhancePrompt}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enhancePrompt ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="mt-8">
            <button
              onClick={handleGenerateImage}
              disabled={generatingImage || generatingVideo}
              className="w-full relative group overflow-hidden rounded-2xl bg-zinc-100 text-zinc-950 font-semibold py-4 flex items-center justify-center gap-3 transition-all hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingImage ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Visualizing...
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  Generate Static Avatar
                </>
              )}
              {/* Subtle shine effect */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
            </button>
          </div>
        </div>

        {/* Viewport / Result Panel */}
        <div className="lg:col-span-7 flex flex-col items-center">
          
          <AnimatePresence mode="wait">
            {!imageUrl && !generatingImage && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`w-full ${ASPECT_RATIO_CLASSES[options.aspectRatio] ?? 'aspect-[9/16]'} max-h-[800px] border-2 border-dashed border-zinc-800 rounded-[2.5rem] flex flex-col items-center justify-center text-zinc-500 bg-zinc-900/20 transition-all duration-300`}
              >
                <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-medium text-lg text-zinc-400">Ready to Visualize</p>
                <p className="text-sm mt-1 max-w-[250px] text-center">Tweak the settings on the left to build your unique character.</p>
              </motion.div>
            )}

            {generatingImage && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`w-full ${ASPECT_RATIO_CLASSES[options.aspectRatio] ?? 'aspect-[9/16]'} max-h-[800px] border border-zinc-800 rounded-[2.5rem] flex flex-col items-center justify-center text-rose-400 bg-zinc-900/40 relative overflow-hidden transition-all duration-300`}
              >
                {/* Ping animation backdrop */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 bg-rose-500/10 rounded-full animate-ping" />
                </div>
                <Loader2 className="w-10 h-10 animate-spin mb-4 relative z-10" />
                <p className="font-medium text-lg relative z-10 text-white shadow-sm">Synthesizing Character...</p>
                <p className="text-sm text-zinc-400 relative z-10 mt-2">Using next-gen diffusion</p>
              </motion.div>
            )}

            {imageUrl && !generatingImage && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full flex flex-col items-center gap-6"
              >
                {/* Result Frame */}
                <div className="relative group rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/50 border border-zinc-800/80 bg-zinc-950 w-full max-w-lg mx-auto">
                  
                  {videoUrl ? (
                    <video 
                      src={videoUrl} 
                      autoPlay 
                      loop 
                      playsInline 
                      controls 
                      className={`w-full ${ASPECT_RATIO_CLASSES[options.aspectRatio] ?? 'aspect-[9/16]'} object-cover transition-all duration-300`}
                    />
                  ) : (
                    <img 
                      src={imageUrl} 
                      alt="AI Generated Avatar" 
                      className={`w-full ${ASPECT_RATIO_CLASSES[options.aspectRatio] ?? 'aspect-[9/16]'} object-cover transition-all duration-300 ${generatingVideo ? 'opacity-40 blur-sm grayscale' : 'opacity-100'}`}
                    />
                  )}

                  {/* Video Loading Overlay */}
                  {generatingVideo && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-8 text-center bg-black/40 backdrop-blur-[2px]">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-900/80 border border-zinc-700/50 flex items-center justify-center mb-6 shadow-2xl">
                        <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                      </div>
                      <p className="text-white font-semibold text-lg drop-shadow-md">Bringing to life...</p>
                      <p className="text-rose-200/80 text-sm mt-3 leading-relaxed drop-shadow-md">{videoProgress}</p>
                    </div>
                  )}

                  {/* Badges Overlay */}
                  {!videoUrl && !generatingVideo && (
                    <div className="absolute top-6 right-6 flex gap-2">
                       <span className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-xs font-medium text-white border border-white/10 uppercase tracking-wider">
                         8K Render
                       </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!videoUrl && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="w-full max-w-lg space-y-4"
                  >
                    <button
                      onClick={handleGenerateVideo}
                      disabled={generatingVideo}
                      className="w-full group relative overflow-hidden rounded-2xl bg-rose-600/10 border border-rose-500/30 text-rose-50 font-semibold py-5 flex items-center justify-center gap-3 transition-all hover:bg-rose-600/20 hover:border-rose-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generatingVideo ? (
                        <Loader2 className="w-5 h-5 animate-spin text-rose-400" />
                      ) : (
                        <Play className="w-5 h-5 text-rose-400 fill-rose-400 group-hover:scale-110 transition-transform" />
                      )}
                      <span>
                        Animate: <span className="text-rose-200 font-normal">{options.videoAction}</span>
                      </span>
                    </button>

                    <a
                      href={imageUrl}
                      download={`avatar-${Date.now()}.png`}
                      aria-disabled={generatingVideo}
                      onClick={(e) => generatingVideo && e.preventDefault()}
                      className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-100 font-medium transition-colors border border-zinc-700 aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
                    >
                      <Download className="w-5 h-5 text-zinc-400" />
                      Download Static Avatar
                    </a>
                    
                    <p className="text-center text-xs text-zinc-500 mt-4 leading-relaxed">
                      Video generation uses the Veo model and takes anywhere from 1 to 4 minutes.<br/>Please do not close this window while generating.
                    </p>
                  </motion.div>
                )}
                
                {videoUrl && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-lg"
                  >
                    <a
                      href={videoUrl}
                      download={`avatar-${Date.now()}.mp4`}
                      className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors border border-zinc-700"
                    >
                      <Download className="w-5 h-5" />
                      Download Video Clip
                    </a>
                  </motion.div>
                )}

              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </main>

      {/* Gallery Section */}
      {gallery.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 border-t border-zinc-800/60 pt-12">
          <div className="flex items-center gap-2 mb-8">
            <ImageIcon className="w-5 h-5 text-rose-400" />
            <h2 className="text-xl font-semibold text-white">Recent Creations</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 lg:gap-6">
            {gallery.map((item) => (
              <button 
                key={item.id} 
                className={`group relative ${ASPECT_RATIO_CLASSES[item.options.aspectRatio] ?? 'aspect-[9/16]'} rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-left`}
                onClick={() => {
                  setOptions(item.options);
                  setImageUrl(item.url);
                  setVideoUrl(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <img 
                  src={item.url} 
                  alt="Gallery Avatar" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                  <p className="text-xs font-medium text-white truncate shadow-lg">{item.options.niche}</p>
                  <p className="text-[10px] text-zinc-300 truncate shadow-lg">{item.options.environment}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
