/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Film, 
  Search, 
  TrendingUp, 
  Play, 
  ChevronRight, 
  Sparkles,
  Loader2,
  Tv,
  Languages,
  User as UserIcon,
  LogOut,
  Star,
  History,
  Settings,
  Filter,
  ArrowUpDown,
  MessageSquare,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI, Type } from "@google/genai";
import { Suggestion, YouTubeVideo, User, Review, WatchHistory } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const GENRES = [
  'Action', 'Comedy', 'Drama', 'Horror', 'Romance', 'Thriller', 'Sci-Fi', 'Animation'
];

const SORT_OPTIONS = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Latest', value: 'date' },
  { label: 'Views', value: 'viewCount' },
  { label: 'Rating', value: 'rating' }
];

const LANGUAGE_OPTIONS = [
  { label: 'Telugu', value: 'Telugu' },
  { label: 'Hindi', value: 'Hindi' },
  { label: 'English', value: 'English' },
  { label: 'Tamil', value: 'Tamil' },
  { label: 'Malayalam', value: 'Malayalam' },
  { label: 'Kannada', value: 'Kannada' },
  { label: 'Gujarati', value: 'Gujarati' },
  { label: 'Punjabi', value: 'Punjabi' },
  { label: 'Marathi', value: 'Marathi' }
];

const MOOD_TAGS = [
  'Mind-Bending', 'Heartwarming', 'Adrenaline', 'Bittersweet', 'Cozy', 'Tear-Jerker', 'Spooky', 'Inspiring'
];

const FESTIVALS = [
  "Clermont‑Ferrand International Short Film Festival",
  "Festival de Cannes Short Film Palme d’Or",
  "Palm Springs International ShortFest",
  "Aspen Shortsfest (USA)",
  "LA Shorts International Film Festival",
  "AFI FEST"
];

const WHY_PAL = [
  { title: 'AI-Powered Precision', desc: 'Our advanced algorithms filter out trailers, clips, and promotional noise to deliver only full-length cinematic experiences.' },
  { title: 'Mood-Centric Discovery', desc: 'Beyond simple keywords, PAL Theater understands the emotional resonance of your request, matching films to your exact mood.' },
  { title: 'Festival Excellence', desc: 'Direct access to award-winning content from prestigious festivals like Cannes, Clermont-Ferrand, and AFI FEST.' },
  { title: 'Curated Safety', desc: 'We maintain a strictly family-friendly environment with rigorous content filtering across all genres, including romance and drama.' },
  { title: 'Global Perspective', desc: 'We prioritize regional and independent cinema, bringing hidden gems from across the globe directly to your screen.' }
];

const GENIE_HELP = [
  "A story about a father and daughter that makes me cry but has a happy ending",
  "A mind-bending sci-fi set in a single room",
  "A heartwarming comedy about a dog in a small village",
  "A high-adrenaline thriller with a massive twist at the end",
  "A cozy romance set in the rainy season"
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedFestival, setSelectedFestival] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Auth State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Profile State
  const [showProfile, setShowProfile] = useState(false);
  const [watchHistory, setWatchHistory] = useState<WatchHistory[]>([]);

  // Filter State
  const [sortBy, setSortBy] = useState('relevance');
  const [selectedLanguage, setSelectedLanguage] = useState('Telugu');
  const [actorFilter, setActorFilter] = useState('');
  const [directorFilter, setDirectorFilter] = useState('');
  const [moodInput, setMoodInput] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [durationFilter, setDurationFilter] = useState('any');

  // Review State
  const [activeVideoForReview, setActiveVideoForReview] = useState<Suggestion | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [videoReviews, setVideoReviews] = useState<Review[]>([]);

  useEffect(() => {
    const savedUser = localStorage.getItem('pal_theater_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    // Backend health check
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (!res.ok) {
          console.error("Backend health check failed:", res.status, res.statusText);
        } else {
          const data = await res.json();
          console.log("Backend health check success:", data);
        }
      } catch (err) {
        console.error("Backend health check error:", err);
      }
    };
    checkHealth();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        localStorage.setItem('pal_theater_user', JSON.stringify(data));
        setShowAuthModal(false);
        setUsername('');
        setPassword('');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Auth failed");
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('pal_theater_user');
    setShowProfile(false);
  };

  const fetchWatchHistory = async () => {
    if (!user) return;
    const res = await fetch(`/api/user/history/${user.id}`);
    const data = await res.json();
    setWatchHistory(data);
  };

  const addToHistory = async (video: Suggestion) => {
    if (!user) return;
    await fetch('/api/user/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        videoId: video.id,
        title: video.title,
        thumbnail: video.thumbnail
      })
    });
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeVideoForReview) return;
    await fetch('/api/user/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        videoId: activeVideoForReview.id,
        rating,
        comment
      })
    });
    setActiveVideoForReview(null);
    setComment('');
    setRating(5);
  };

  const fetchReviews = async (videoId: string) => {
    const res = await fetch(`/api/user/reviews/${videoId}`);
    const data = await res.json();
    setVideoReviews(data.reviews);
  };

  const fetchSuggestions = async (genre: string | null, festival: string | null = null) => {
    setLoading(true);
    setError(null);
    // Use the passed values or the currently selected ones
    const activeGenre = genre || selectedGenre;
    const activeFestival = festival || selectedFestival;
    console.log("Starting fetchSuggestions for genre:", activeGenre, "festival:", activeFestival, "mood:", moodInput);
    
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey.trim() === "") {
        throw new Error("GEMINI_API_KEY is missing. Please add it to your Vercel Environment Variables and REDEPLOY.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Personalization context
      const historyContext = watchHistory.length > 0 
        ? `User has recently watched: ${watchHistory.slice(0, 3).map(h => h.title).join(', ')}.`
        : '';
      const prefContext = user?.preferredGenres && user.preferredGenres.length > 0
        ? `User prefers these genres: ${user.preferredGenres.join(', ')}.`
        : '';

      const filterContext = `
        Language: ${selectedLanguage}
        Genre: ${activeGenre || 'Any'}
        Festival Selection: ${activeFestival || 'Any'}
        Actor Filter: ${actorFilter || 'None'}
        Director Filter: ${directorFilter || 'None'}
        Duration Preference: ${durationFilter === 'any' ? 'Any' : durationFilter}
        User Mood/Request: ${moodInput || 'None'}
        Selected Mood Tag: ${selectedMood || 'None'}
      `;

      const prompt = `I am building a movie recommendation app. 
      ${prefContext} ${historyContext} ${filterContext}
      Please provide 8 specific search queries for YouTube to find the best, latest, and most popular full-length ${selectedLanguage} short films that match the user's mood, genre, festival selection, and preferences.
      CRITICAL: Focus ONLY on single, full-length short films. Exclude full-length feature movies, clips, teasers, trailers, promotional snippets, "Top 10" lists, "Best of" compilations, and "Table of Contents" style videos.
      If a festival is selected, prioritize films that have been screened or won awards at that specific festival.
      If an actor or director is specified, prioritize them in the queries.
      STRICT POLICY: Ensure all recommendations are family-friendly. ABSOLUTELY NO adult content, NSFW material, or sexually explicit content, even for the "Romance" genre.
      Return the result as a JSON array of objects, where each object has:
      - "query": (string) The YouTube search query.
      - "reason": (string) A short, 1-sentence explanation of why this is recommended based on user mood/preferences.
      - "summary": (string) A clean, 2-3 sentence plot summary or "what to expect" for this recommendation.
      Return exactly 8 objects for ${selectedLanguage}.`;
      
      console.log("Calling Gemini API...");
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                query: { type: Type.STRING },
                reason: { type: Type.STRING },
                summary: { type: Type.STRING }
              },
              required: ["query", "reason", "summary"]
            }
          }
        }
      });

      console.log("Gemini API Response received");
      let recommendationData: any[] = [];
      try {
        const rawText = response.text || "[]";
        // Remove markdown formatting if present
        const cleanText = rawText.replace(/```json\n?|```/g, '').trim();
        recommendationData = JSON.parse(cleanText);
      } catch (e) {
        console.error("Failed to parse Gemini response:", e, response.text);
        throw new Error("The Genie had trouble organizing its thoughts. Please try again!");
      }
      
      if (!Array.isArray(recommendationData) || recommendationData.length === 0) {
        throw new Error("The Genie couldn't find specific recommendations for this mood. Try a different request!");
      }

      const allSuggestions: Suggestion[] = [];
      let lastYouTubeError: string | null = null;

      // Fetch Language-specific videos (Top 8)
      for (let i = 0; i < recommendationData.length && i < 8; i++) {
        const item = recommendationData[i];
        // Simplify query - don't double up on "short film" and don't be too restrictive
        const baseQuery = item?.query || `${activeGenre || 'popular'} ${selectedLanguage} short film`;
        const query = baseQuery.toLowerCase().includes("short film") 
          ? baseQuery 
          : `${baseQuery} short film`;
        
        console.log(`Fetching YouTube results for query ${i+1}:`, query);
        
        try {
          const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}&maxResults=1&order=${sortBy}`);
          const data = await res.json();
          
          if (res.ok && data.items && data.items.length > 0) {
            const video: YouTubeVideo = data.items[0];
            allSuggestions.push({
              id: typeof video.id === 'string' ? video.id : video.id.videoId,
              title: video.snippet.title,
              thumbnail: video.snippet.thumbnails.high.url,
              channel: video.snippet.channelTitle,
              type: 'cinema',
              label: `${selectedLanguage} Pick`,
              reason: item?.reason || `Highly rated content in ${selectedLanguage}.`,
              summary: item?.summary || "A compelling short film exploring deep themes and storytelling.",
              link: `https://www.youtube.com/watch?v=${typeof video.id === 'string' ? video.id : video.id.videoId}`,
              publishedAt: video.snippet.publishedAt
            });
          } else if (!res.ok) {
            lastYouTubeError = data.error || res.statusText;
            console.error("YouTube query failed:", lastYouTubeError);
          }
        } catch (e) {
          console.error("YouTube fetch exception:", e);
        }
      }

      if (allSuggestions.length === 0) {
        if (lastYouTubeError) {
          throw new Error(`YouTube API Error: ${lastYouTubeError}. Please check your API key and quota.`);
        }
        throw new Error("The Genie found some ideas, but YouTube didn't have the full films available. Try adjusting your mood tags or selecting a different language!");
      }

      setSuggestions(allSuggestions);
    } catch (err: any) {
      console.error("Detailed Recommendation Error:", err);
      setError(`Error: ${err.message || "An unknown error occurred while fetching recommendations."}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenreSelect = (genre: string) => {
    const newGenre = genre === selectedGenre ? null : genre;
    setSelectedGenre(newGenre);
    fetchSuggestions(newGenre, selectedFestival);
  };

  const handleFestivalSelect = (festival: string) => {
    const newFestival = festival === selectedFestival ? null : festival;
    setSelectedFestival(newFestival);
    fetchSuggestions(selectedGenre, newFestival);
  };

  return (
    <div className="min-h-screen bg-[#0a0502] text-[#fff] font-sans selection:bg-orange-500/30">
      {/* Immersive Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-900/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900/20 blur-[120px] rounded-full animate-pulse" />
      </div>

      {/* Navigation */}
      <nav className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Film className="w-6 h-6 text-orange-500" />
          <span className="font-serif italic text-xl tracking-tight">PAL Theater</span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => { setShowProfile(true); fetchWatchHistory(); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <UserIcon className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium">{user.username}</span>
              </button>
              <button onClick={handleLogout} className="p-2 text-white/40 hover:text-white transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2 rounded-full bg-orange-500 text-black text-sm font-bold hover:bg-orange-400 transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-serif font-light tracking-tight mb-4 flex flex-wrap items-baseline gap-4"
          >
            <span>What's the <span className="italic text-orange-500">mood</span> tonight?</span>
            <span className="text-sm md:text-base font-sans font-bold text-white/20 uppercase tracking-[0.4em] border-l border-white/10 pl-4">Short Film Search</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-white/60 text-lg mb-8 max-w-2xl"
          >
            Select your preferred language and explore curated festival winners or genres.
          </motion.p>
          
          {/* Festival Grid */}
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-serif italic text-white/60">Festival Selections</h2>
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Award-winning content</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {FESTIVALS.map((festival, idx) => (
                <motion.button
                  key={festival}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleFestivalSelect(festival)}
                  className={cn(
                    "group relative p-3 rounded-xl border transition-all duration-300 text-center overflow-hidden",
                    selectedFestival === festival 
                      ? "bg-orange-500 border-orange-400 text-black" 
                      : "bg-white/5 border-white/10 hover:border-orange-500/50 hover:bg-white/10"
                  )}
                >
                  <span className="relative z-10 text-[10px] font-bold uppercase tracking-tight leading-tight block line-clamp-2">{festival}</span>
                </motion.button>
              ))}
            </div>
          </section>
          
          {/* Advanced Filters */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 mb-8"
          >
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <Filter className="w-4 h-4" />
              <span>Filters:</span>
            </div>
            
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Language</span>
              <div className="flex items-center gap-2">
                <Languages className="w-4 h-4 text-white/40" />
                <select 
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500/50"
                >
                  {LANGUAGE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Duration</span>
              <select 
                value={durationFilter}
                onChange={(e) => setDurationFilter(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500/50"
              >
                <option value="any">Any Duration</option>
                <option value="under 10 mins">Under 10 mins</option>
                <option value="10-20 mins">10-20 mins</option>
                <option value="over 20 mins">Over 20 mins</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Actor</span>
              <input 
                type="text" 
                placeholder="e.g. Prabhas" 
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500/50 w-32"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Director</span>
              <input 
                type="text" 
                placeholder="e.g. Rajamouli" 
                value={directorFilter}
                onChange={(e) => setDirectorFilter(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500/50 w-32"
              />
            </div>

            <div className="flex flex-col gap-1 ml-auto">
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Sort By</span>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-white/40" />
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500/50"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>

          {/* Genie Feature */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative mb-12"
          >
            <div className="absolute -top-3 left-6 px-2 bg-black text-orange-500 text-[10px] font-bold uppercase tracking-[0.2em] z-20">
              The PAL Genie
            </div>
            <div className="p-8 rounded-3xl bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex-1">
                  <p className="text-white/60 text-sm mb-4">
                    Describe your mood or a specific story you're looking for. The PAL Genie will find it.
                  </p>
                  <div className="flex gap-4 mb-6">
                    <div className="relative flex-1">
                      <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500" />
                      <input
                        type="text"
                        placeholder="e.g. A heartwarming story about a dog in a small village..."
                        value={moodInput}
                        onChange={(e) => setMoodInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchSuggestions(null)}
                        className="w-full bg-black/50 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-lg focus:outline-none focus:border-orange-500/50 transition-all"
                      />
                    </div>
                    <button
                      onClick={() => fetchSuggestions(null)}
                      disabled={loading || (!moodInput.trim() && !selectedMood)}
                      className="px-8 py-4 rounded-2xl bg-orange-500 text-black font-bold hover:bg-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      Ask PAL Genie
                    </button>
                  </div>

                  <div className="space-y-3">
                    <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Try these moods:</span>
                    <div className="flex flex-wrap gap-2">
                      {MOOD_TAGS.map(tag => (
                        <button
                          key={tag}
                          onClick={() => {
                            setSelectedMood(tag === selectedMood ? null : tag);
                            if (tag !== selectedMood) fetchSuggestions(null);
                          }}
                          className={cn(
                            "px-4 py-1.5 rounded-full text-xs transition-all border",
                            selectedMood === tag 
                              ? "bg-orange-500 border-orange-400 text-black font-bold" 
                              : "bg-white/5 border-white/10 text-white/60 hover:border-orange-500/50"
                          )}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-64 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold block mb-3">PAL Genie Help</span>
                  <ul className="space-y-3">
                    {GENIE_HELP.slice(0, 3).map((help, i) => (
                      <li key={i} className="text-[11px] text-white/50 leading-relaxed flex gap-2">
                        <span className="text-orange-500">•</span>
                        <span>{help}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Comparison Section */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-16 p-8 rounded-3xl bg-white/5 border border-white/10 group hover:bg-white/[0.07] transition-all duration-500"
          >
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <h3 className="text-2xl font-serif italic mb-2">Why PAL Theater?</h3>
                <p className="text-white/40 text-sm mb-6">How we beat regular YouTube search for your movie night.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {WHY_PAL.map((item, i) => (
                    <motion.div 
                      key={i}
                      whileHover={{ x: 10 }}
                      className="space-y-1"
                    >
                      <h4 className="text-orange-500 font-bold text-sm uppercase tracking-wider">{item.title}</h4>
                      <p className="text-xs text-white/60 leading-relaxed">{item.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
              <div className="w-48 h-48 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20 group-hover:scale-110 transition-transform duration-700">
                <Sparkles className="w-20 h-20 text-orange-500 opacity-20" />
              </div>
            </div>
          </motion.div>
        </header>

        {/* Genre Grid */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-serif italic text-white/60">Or pick a quick genre</h2>
            <span className="text-[10px] text-white/30 uppercase tracking-widest">Select one to refresh</span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {GENRES.map((genre, idx) => (
              <motion.button
                key={genre}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
                onClick={() => handleGenreSelect(genre)}
                className={cn(
                  "group relative p-3 rounded-xl border transition-all duration-300 text-center overflow-hidden",
                  selectedGenre === genre 
                    ? "bg-orange-500 border-orange-400 text-black" 
                    : "bg-white/5 border-white/10 hover:border-orange-500/50 hover:bg-white/10"
                )}
              >
                <span className="relative z-10 text-xs font-medium truncate block">{genre}</span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 gap-4"
            >
              <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
              <p className="text-white/40 font-mono text-sm animate-pulse">CURATING YOUR EVENING...</p>
            </motion.div>
          ) : suggestions.length > 0 ? (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-12"
            >
              {/* Cinema Picks */}
              <div>
                <div className="flex items-center gap-3 mb-8">
                  <Sparkles className="w-5 h-5 text-orange-500" />
                  <h2 className="text-2xl font-serif italic">Curated for You</h2>
                  <div className="h-[1px] flex-1 bg-white/10" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {suggestions.map((video, idx) => (
                    <VideoCard 
                      key={video.id} 
                      video={video} 
                      index={idx} 
                      onWatch={() => addToHistory(video)}
                      onReview={() => { setActiveVideoForReview(video); fetchReviews(video.id); }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          ) : error ? (
            <motion.div 
              key="error"
              className="p-8 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-center"
            >
              {error}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md p-8 rounded-3xl bg-[#151619] border border-white/10 shadow-2xl"
            >
              <h2 className="text-3xl font-serif italic mb-2">{isLogin ? 'Welcome Back' : 'Join PAL Theater'}</h2>
              <p className="text-white/40 text-sm mb-8">
                {isLogin ? 'Sign in to access your personalized picks.' : 'Create an account to save your preferences.'}
              </p>
              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-2">Username</label>
                  <input 
                    type="text" 
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-2">Password</label>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <button className="w-full py-4 rounded-xl bg-orange-500 text-black font-bold hover:bg-orange-400 transition-colors mt-4">
                  {isLogin ? 'Sign In' : 'Create Account'}
                </button>
              </form>
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="w-full text-center text-sm text-white/40 hover:text-white transition-colors mt-6"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfile(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="relative w-full max-w-2xl h-[80vh] overflow-y-auto p-8 rounded-3xl bg-[#151619] border border-white/10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-serif italic">Your Profile</h2>
                <button onClick={() => setShowProfile(false)} className="p-2 text-white/40 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-12">
                {/* Preferences */}
                <section>
                  <div className="flex items-center gap-2 mb-4 text-orange-500">
                    <Settings className="w-5 h-5" />
                    <h3 className="font-medium">Preferred Genres</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map(genre => (
                      <button
                        key={genre}
                        onClick={() => {
                          const newGenres = user?.preferredGenres.includes(genre)
                            ? user.preferredGenres.filter(g => g !== genre)
                            : [...(user?.preferredGenres || []), genre];
                          const updatedUser = { ...user!, preferredGenres: newGenres };
                          setUser(updatedUser);
                          localStorage.setItem('pal_theater_user', JSON.stringify(updatedUser));
                          fetch('/api/user/preferences', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: user?.id, genres: newGenres })
                          });
                        }}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm border transition-colors",
                          user?.preferredGenres.includes(genre)
                            ? "bg-orange-500 border-orange-400 text-black"
                            : "bg-white/5 border-white/10 text-white/60 hover:border-orange-500/50"
                        )}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                </section>

                {/* History */}
                <section>
                  <div className="flex items-center gap-2 mb-4 text-orange-500">
                    <History className="w-5 h-5" />
                    <h3 className="font-medium">Watch History</h3>
                  </div>
                  <div className="space-y-4">
                    {watchHistory.map(h => (
                      <div key={h.id} className="flex gap-4 p-3 rounded-xl bg-white/5 border border-white/10">
                        <img src={h.thumbnail} className="w-24 aspect-video object-cover rounded-lg" referrerPolicy="no-referrer" />
                        <div>
                          <h4 className="font-medium line-clamp-1">{h.title}</h4>
                          <p className="text-xs text-white/40 mt-1">Watched on {new Date(h.watched_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review Modal */}
      <AnimatePresence>
        {activeVideoForReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveVideoForReview(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-lg p-8 rounded-3xl bg-[#151619] border border-white/10 shadow-2xl"
            >
              <h2 className="text-2xl font-serif italic mb-6">Rate & Review</h2>
              <div className="flex gap-4 mb-8 p-4 rounded-2xl bg-white/5 border border-white/10">
                <img src={activeVideoForReview.thumbnail} className="w-24 aspect-video object-cover rounded-lg" referrerPolicy="no-referrer" />
                <h3 className="font-medium line-clamp-2">{activeVideoForReview.title}</h3>
              </div>

              <form onSubmit={submitReview} className="space-y-6">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-4">Your Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button 
                        key={s} 
                        type="button"
                        onClick={() => setRating(s)}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <Star className={cn("w-8 h-8", s <= rating ? "text-orange-500 fill-current" : "text-white/10")} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-white/40 mb-2">Review (Optional)</label>
                  <textarea 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full h-32 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500/50 resize-none"
                    placeholder="What did you think?"
                  />
                </div>
                <button className="w-full py-4 rounded-xl bg-orange-500 text-black font-bold hover:bg-orange-400 transition-colors">
                  Submit Review
                </button>
              </form>

              {/* Existing Reviews */}
              <div className="mt-8 pt-8 border-t border-white/5">
                <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-orange-500" />
                  Community Reviews
                </h4>
                <div className="space-y-4 max-h-40 overflow-y-auto pr-2">
                  {videoReviews.map(r => (
                    <div key={r.id} className="p-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-orange-500">{r.username}</span>
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={cn("w-2.5 h-2.5", i < r.rating ? "text-orange-500 fill-current" : "text-white/10")} />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-white/60">{r.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto px-6 py-12 border-t border-white/5 text-center">
        <p className="text-white/20 text-xs font-mono tracking-widest uppercase">
          Powered by Gemini & YouTube Data API
        </p>
      </footer>
    </div>
  );
}

function VideoCard({ video, index, onWatch, onReview }: { video: Suggestion, index: number, onWatch: () => void, onReview: () => void }) {
  const [stats, setStats] = useState<{ averageRating: number, reviewCount: number } | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const res = await fetch(`/api/user/reviews/${video.id}`);
      const data = await res.json();
      setStats(data.stats);
    };
    fetchStats();
  }, [video.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative flex flex-col h-full bg-white/5 rounded-3xl overflow-hidden border border-white/10 hover:border-orange-500/50 transition-all duration-500"
    >
      <div className="relative aspect-video overflow-hidden">
        <img 
          src={video.thumbnail} 
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="absolute top-4 left-4 flex gap-2">
          {video.label && (
            <span className="px-3 py-1 rounded-full bg-orange-500 text-black text-[10px] font-bold uppercase tracking-wider">
              {video.label}
            </span>
          )}
        </div>

        <a
          href={video.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onWatch}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        >
          <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-black scale-75 group-hover:scale-100 transition-transform duration-500 shadow-2xl shadow-orange-500/50">
            <Play className="w-8 h-8 fill-current ml-1" />
          </div>
        </a>
      </div>

      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="font-serif text-xl leading-tight group-hover:text-orange-500 transition-colors line-clamp-2" dangerouslySetInnerHTML={{ __html: video.title }} />
        </div>
        
        <p className="text-white/40 text-sm mb-4 line-clamp-1">{video.channel}</p>

        {video.summary && (
          <div className="mb-6 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10">
            <span className="text-[10px] text-orange-500 uppercase tracking-widest font-bold block mb-2">Plot Summary</span>
            <p className="text-xs text-white/70 leading-relaxed">
              {video.summary}
            </p>
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {stats && (
              <>
                <div className="flex items-center gap-1 text-orange-500">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="text-sm font-bold">{stats.averageRating.toFixed(1)}</span>
                </div>
                <div className="text-white/40 text-xs">{stats.reviewCount} reviews</div>
              </>
            )}
          </div>
          
          <button 
            onClick={() => onReview()}
            className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-orange-500 transition-all"
            title="Write a review"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
