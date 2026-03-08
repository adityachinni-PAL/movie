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
import { GoogleGenAI } from "@google/genai";
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
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

  // Review State
  const [activeVideoForReview, setActiveVideoForReview] = useState<Suggestion | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [videoReviews, setVideoReviews] = useState<Review[]>([]);

  useEffect(() => {
    const savedUser = localStorage.getItem('chinni_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
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
        localStorage.setItem('chinni_user', JSON.stringify(data));
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
    localStorage.removeItem('chinni_user');
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

  const fetchSuggestions = async (genre: string) => {
    setLoading(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      // Personalization context
      const historyContext = watchHistory.length > 0 
        ? `User has recently watched: ${watchHistory.slice(0, 3).map(h => h.title).join(', ')}.`
        : '';
      const prefContext = user?.preferredGenres && user.preferredGenres.length > 0
        ? `User prefers these genres: ${user.preferredGenres.join(', ')}.`
        : '';

      const filterContext = `
        Language: ${selectedLanguage}
        Actor Filter: ${actorFilter || 'None'}
        Director Filter: ${directorFilter || 'None'}
      `;

      const prompt = `I am building a movie recommendation app. The user selected the genre "${genre}". 
      ${prefContext} ${historyContext} ${filterContext}
      Please provide 3 specific search queries for YouTube to find the best, latest, and most popular full-length ${selectedLanguage} short films in this genre.
      CRITICAL: Focus ONLY on single, full-length short films. Exclude full-length feature movies, clips, teasers, trailers, promotional snippets, "Top 10" lists, "Best of" compilations, and "Table of Contents" style videos.
      If an actor or director is specified, prioritize them in the queries.
      Also provide 2 search queries for trending entertainment short films in English or Hindi.
      Return the result as a JSON array of objects, where each object has "query" (string) and "reason" (a short, 1-sentence explanation of why this is recommended based on user mood/preferences). 
      First 3 objects are ${selectedLanguage}, last 2 are English/Hindi.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const recommendationData = JSON.parse(response.text || "[]");
      const allSuggestions: Suggestion[] = [];

      // Fetch Language-specific videos (Top 3)
      for (let i = 0; i < 3; i++) {
        const item = recommendationData[i];
        const query = (item?.query || `${genre} ${selectedLanguage} short film popular`) + " \"short film\" -trailer -teaser -clip -shorts -top10 -bestof -movie";
        const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}&maxResults=1&order=${sortBy}`);
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const video: YouTubeVideo = data.items[0];
          allSuggestions.push({
            id: typeof video.id === 'string' ? video.id : video.id.videoId,
            title: video.snippet.title,
            thumbnail: video.snippet.thumbnails.high.url,
            channel: video.snippet.channelTitle,
            type: 'cinema',
            label: `${selectedLanguage} Pick`,
            reason: item?.reason || `Highly rated ${genre} content in ${selectedLanguage}.`,
            link: `https://www.youtube.com/watch?v=${typeof video.id === 'string' ? video.id : video.id.videoId}`,
            publishedAt: video.snippet.publishedAt
          });
        }
      }

      // Fetch Trending videos (Top 2)
      for (let i = 3; i < 5; i++) {
        const item = recommendationData[i];
        const query = (item?.query || `trending entertainment English Hindi short film`) + " \"short film\" -trailer -teaser -clip -shorts -top10 -bestof -movie";
        const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}&maxResults=1&order=${sortBy}`);
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const video: YouTubeVideo = data.items[0];
          allSuggestions.push({
            id: typeof video.id === 'string' ? video.id : video.id.videoId,
            title: video.snippet.title,
            thumbnail: video.snippet.thumbnails.high.url,
            channel: video.snippet.channelTitle,
            type: 'trending',
            label: 'Trending',
            reason: item?.reason || "Currently popular across the platform.",
            link: `https://www.youtube.com/watch?v=${typeof video.id === 'string' ? video.id : video.id.videoId}`,
            publishedAt: video.snippet.publishedAt
          });
        }
      }

      setSuggestions(allSuggestions);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch recommendations. Please check your API keys.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenreSelect = (genre: string) => {
    setSelectedGenre(genre);
    fetchSuggestions(genre);
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
          <span className="font-serif italic text-xl tracking-tight">Chinni</span>
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
            className="text-5xl md:text-7xl font-serif font-light tracking-tight mb-6"
          >
            What's the <span className="italic text-orange-500">mood</span> tonight?
          </motion.h1>
          
          {/* Advanced Filters */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10"
          >
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <Filter className="w-4 h-4" />
              <span>Filters:</span>
            </div>
            
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

            <input 
              type="text" 
              placeholder="Actor (e.g. Prabhas)" 
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500/50 w-40"
            />
            <input 
              type="text" 
              placeholder="Director" 
              value={directorFilter}
              onChange={(e) => setDirectorFilter(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500/50 w-40"
            />
            <div className="flex items-center gap-2 ml-auto">
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
          </motion.div>
        </header>

        {/* Genre Grid */}
        <section className="mb-16">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {GENRES.map((genre, idx) => (
              <motion.button
                key={genre}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + idx * 0.05 }}
                onClick={() => handleGenreSelect(genre)}
                className={cn(
                  "group relative p-6 rounded-2xl border transition-all duration-300 text-left overflow-hidden",
                  selectedGenre === genre 
                    ? "bg-orange-500 border-orange-400 text-black" 
                    : "bg-white/5 border-white/10 hover:border-orange-500/50 hover:bg-white/10"
                )}
              >
                <span className="relative z-10 text-lg font-medium">{genre}</span>
                <div className={cn(
                  "absolute bottom-[-20%] right-[-10%] opacity-10 transition-transform duration-500 group-hover:scale-125 group-hover:rotate-12",
                  selectedGenre === genre ? "text-black" : "text-white"
                )}>
                  <Film className="w-24 h-24" />
                </div>
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
              {/* Language-specific Picks */}
              <div>
                <div className="flex items-center gap-3 mb-8">
                  <Languages className="w-5 h-5 text-orange-500" />
                  <h2 className="text-2xl font-serif italic">{selectedLanguage} Cinema Picks</h2>
                  <div className="h-[1px] flex-1 bg-white/10" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {suggestions.filter(s => s.type === 'cinema').map((video, idx) => (
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

              {/* Trending Picks */}
              <div>
                <div className="flex items-center gap-3 mb-8">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  <h2 className="text-2xl font-serif italic">Trending Entertainment</h2>
                  <div className="h-[1px] flex-1 bg-white/10" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {suggestions.filter(s => s.type === 'trending').map((video, idx) => (
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
              <h2 className="text-3xl font-serif italic mb-2">{isLogin ? 'Welcome Back' : 'Join Chinni'}</h2>
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
                          localStorage.setItem('chinni_user', JSON.stringify(updatedUser));
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
      className="group relative flex flex-col h-full"
    >
      <a
        href={video.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onWatch}
        className="block"
      >
        <div className="relative aspect-video rounded-2xl overflow-hidden mb-4 border border-white/10 group-hover:border-orange-500/50 transition-colors">
          <img 
            src={video.thumbnail} 
            alt={video.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300">
              <Play className="w-8 h-8 text-black fill-current" />
            </div>
          </div>
          {video.label && (
            <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-orange-500 text-black text-[10px] font-bold uppercase tracking-wider">
              {video.label}
            </div>
          )}
          {stats && stats.reviewCount > 0 && (
            <div className="absolute bottom-4 right-4 px-2 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 flex items-center gap-1.5">
              <Star className="w-3 h-3 text-orange-500 fill-current" />
              <span className="text-xs font-bold">{stats.averageRating.toFixed(1)}</span>
              <span className="text-[10px] text-white/40">({stats.reviewCount})</span>
            </div>
          )}
        </div>
      </a>
      
      <div className="flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-lg font-medium line-clamp-2 group-hover:text-orange-500 transition-colors" dangerouslySetInnerHTML={{ __html: video.title }} />
          <button 
            onClick={(e) => { e.preventDefault(); onReview(); }}
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-orange-500/50 transition-colors shrink-0"
            title="Rate & Review"
          >
            <Star className="w-4 h-4 text-orange-500" />
          </button>
        </div>

        {video.reason && (
          <div className="mb-4 p-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-orange-500/60 mb-1">
              <Sparkles className="w-3 h-3" />
              Why this?
            </div>
            <p className="text-xs text-white/60 leading-relaxed italic">
              "{video.reason}"
            </p>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between text-white/40 text-sm">
          <span className="flex items-center gap-2">
            <Tv className="w-4 h-4" />
            {video.channel}
          </span>
          <span>{new Date(video.publishedAt).getFullYear()}</span>
        </div>
      </div>
    </motion.div>
  );
}
