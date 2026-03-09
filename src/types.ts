export interface YouTubeVideo {
  id: {
    videoId: string;
  } | string;
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      high: {
        url: string;
      };
    };
    channelTitle: string;
    publishedAt: string;
  };
}

export interface Suggestion {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  type: 'cinema' | 'trending';
  label?: string;
  reason?: string;
  summary?: string;
  link: string;
  publishedAt: string;
  duration?: string;
}

export interface User {
  id: number;
  username: string;
  preferredGenres: string[];
}

export interface Review {
  id: number;
  user_id: number;
  video_id: string;
  rating: number;
  comment: string;
  username?: string;
  created_at: string;
}

export interface WatchHistory {
  id: number;
  userId: number;
  videoId: string;
  title: string;
  thumbnail: string;
  watched_at: string;
}
