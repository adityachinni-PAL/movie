import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Database
let db: Database.Database;
try {
  // On Vercel, the filesystem is read-only except for /tmp
  const dbPath = process.env.VERCEL ? "/tmp/pal_theater.db" : "pal_theater.db";
  db = new Database(dbPath);
} catch (err) {
  console.error("Failed to initialize database, using in-memory:", err);
  db = new Database(":memory:");
}

// Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    preferred_genres TEXT
  );

  CREATE TABLE IF NOT EXISTS watch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    video_id TEXT,
    title TEXT,
    thumbnail TEXT,
    watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    video_id TEXT,
    rating INTEGER,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

const app = express();
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", env: process.env.NODE_ENV });
});

// Auth Routes
app.post("/api/auth/signup", (req, res) => {
  const { username, password } = req.body;
  try {
    const stmt = db.prepare("INSERT INTO users (username, password) VALUES (?, ?)");
    const result = stmt.run(username, password);
    res.json({ id: result.lastInsertRowid, username });
  } catch (err) {
    res.status(400).json({ error: "Username already exists" });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password) as any;
  if (user) {
    res.json({ id: user.id, username: user.username, preferredGenres: JSON.parse(user.preferred_genres || "[]") });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// User Preferences
app.post("/api/user/preferences", (req, res) => {
  const { userId, genres } = req.body;
  db.prepare("UPDATE users SET preferred_genres = ? WHERE id = ?").run(JSON.stringify(genres), userId);
  res.json({ success: true });
});

// Watch History
app.post("/api/user/history", (req, res) => {
  const { userId, videoId, title, thumbnail } = req.body;
  db.prepare("INSERT INTO watch_history (user_id, video_id, title, thumbnail) VALUES (?, ?, ?, ?)")
    .run(userId, videoId, title, thumbnail);
  res.json({ success: true });
});

app.get("/api/user/history/:userId", (req, res) => {
  const history = db.prepare("SELECT * FROM watch_history WHERE user_id = ? ORDER BY watched_at DESC LIMIT 20")
    .all(req.params.userId);
  res.json(history);
});

// Reviews
app.post("/api/user/reviews", (req, res) => {
  const { userId, videoId, rating, comment } = req.body;
  db.prepare("INSERT INTO reviews (user_id, video_id, rating, comment) VALUES (?, ?, ?, ?)")
    .run(userId, videoId, rating, comment);
  res.json({ success: true });
});

app.get("/api/user/reviews/:videoId", (req, res) => {
  const reviews = db.prepare(`
    SELECT r.*, u.username 
    FROM reviews r 
    JOIN users u ON r.user_id = u.id 
    WHERE r.video_id = ? 
    ORDER BY r.created_at DESC
  `).all(req.params.videoId);
  
  const stats = db.prepare(`
    SELECT AVG(rating) as averageRating, COUNT(*) as reviewCount 
    FROM reviews 
    WHERE video_id = ?
  `).get(req.params.videoId) as any;

  res.json({ reviews, stats: { 
    averageRating: stats.averageRating || 0, 
    reviewCount: stats.reviewCount || 0 
  }});
});

// YouTube API endpoint with filtering and sorting
app.get("/api/youtube/search", async (req, res) => {
  const { q, maxResults = 5, order = "relevance", publishedAfter } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    return res.status(500).json({ error: "YOUTUBE_API_KEY is missing or empty in environment variables" });
  }

  try {
    const cleanApiKey = apiKey.trim();
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      q as string
    )}&type=video&maxResults=${maxResults}&order=${order}&key=${cleanApiKey}`;
    
    if (publishedAfter) {
      url += `&publishedAfter=${publishedAfter}`;
    }

    console.log("Fetching from YouTube API...");
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      console.error("YouTube API Error Response:", data);
      const errorMessage = data.error?.message || response.statusText || "Unknown YouTube API error";
      return res.status(response.status).json({ 
        error: errorMessage,
        details: data.error
      });
    }
    
    res.json(data);
  } catch (error: any) {
    console.error("YouTube Search Exception:", error);
    res.status(500).json({ error: `Internal Server Error: ${error.message || "Failed to fetch from YouTube"}` });
  }
});

// Trending endpoint
app.get("/api/youtube/trending", async (req, res) => {
  const { regionCode = "IN", maxResults = 2 } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    return res.status(500).json({ error: "YOUTUBE_API_KEY is missing or empty in environment variables" });
  }

  try {
    const cleanApiKey = apiKey.trim();
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&chart=mostPopular&regionCode=${regionCode}&maxResults=${maxResults}&videoCategoryId=24&key=${cleanApiKey}`;
    
    console.log("Fetching trending from YouTube API...");
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      console.error("YouTube Trending API Error Response:", data);
      const errorMessage = data.error?.message || response.statusText || "Unknown YouTube Trending API error";
      return res.status(response.status).json({ 
        error: errorMessage,
        details: data.error
      });
    }
    
    res.json(data);
  } catch (error: any) {
    console.error("YouTube Trending Exception:", error);
    res.status(500).json({ error: `Internal Server Error: ${error.message || "Failed to fetch trending from YouTube"}` });
  }
});

// For local development only
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
  
  app.listen(3000, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:3000`);
  });
}

export default app;
