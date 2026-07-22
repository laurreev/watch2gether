const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

export interface VaporpicSearchResponse {
  results: VaporpicMediaItem[];
}

export interface VaporpicMediaItem {
  id: string;
  title: string;
  media_type: 'movie' | 'tvod' | 'anime';
  poster_url?: string;
  year?: string;
  url?: string;
  originalUrl?: string;
  episode?: number;
  season?: number;
}

export const searchVaporpic = async (query: string, type?: string, _genre?: string, _year?: string, signal?: AbortSignal): Promise<VaporpicSearchResponse> => {
  try {
    if (!TMDB_API_KEY) {
      console.error("Missing TMDB API Key. Please add VITE_TMDB_API_KEY to your .env file.");
      return { results: [] };
    }

    const searchType = type === 'movie' ? 'movie' : type === 'tvod' ? 'tv' : 'multi';
    const encodedQuery = encodeURIComponent(query);
    
    let url = '';
    if (query.trim() === '') {
      // If empty query, fetch trending
      url = `https://api.themoviedb.org/3/trending/${searchType === 'multi' ? 'all' : searchType}/day?language=en-US&api_key=${TMDB_API_KEY}`;
    } else {
      url = `https://api.themoviedb.org/3/search/${searchType}?query=${encodedQuery}&include_adult=false&language=en-US&page=1&api_key=${TMDB_API_KEY}`;
    }

    const response = await fetch(url, {
      headers: {
        'accept': 'application/json'
      },
      signal
    });

    if (!response.ok) {
      console.error(`Error fetching search results: ${response.statusText}`);
      return { results: [] };
    }

    const data = await response.json();

    const mappedResults: VaporpicMediaItem[] = (data.results || []).map((item: any) => ({
      id: item.id.toString(),
      title: item.title || item.name,
      media_type: item.media_type === 'tv' || searchType === 'tv' ? 'tvod' : 'movie',
      poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
      year: item.release_date ? item.release_date.split('-')[0] : (item.first_air_date ? item.first_air_date.split('-')[0] : undefined),
      url: item.id.toString(),
      originalUrl: item.id.toString(),
    }));

    return { results: mappedResults };
  } catch (error) {
    console.error(`Error fetching search results:`, error);
    return { results: [] };
  }
};

export interface TmdbSeason {
  season_number: number;
  episode_count: number;
  name: string;
}

export const getTvSeasons = async (tmdbId: string): Promise<TmdbSeason[]> => {
    try {
        const response = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US&api_key=${TMDB_API_KEY}`, {
            headers: { 'accept': 'application/json' }
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.seasons?.filter((s: any) => s.season_number > 0) || [];
    } catch (e) {
        return [];
    }
}

export interface TmdbEpisode {
  episode_number: number;
  name: string;
  still_path?: string;
}

export const getEpisodesForSeason = async (tmdbId: string, seasonNumber: number): Promise<TmdbEpisode[]> => {
    try {
        const response = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}?language=en-US&api_key=${TMDB_API_KEY}`, {
            headers: { 'accept': 'application/json' }
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.episodes || [];
    } catch (e) {
        return [];
    }
}

export const getEpisodes = async (_tmdbId: string): Promise<number> => {
  // Keeping this for backward compatibility if needed, but getTvSeasons is better
  return 1;
};

export const getVaporpicIframe = async (url: string, server?: string, ep?: string, season?: number): Promise<string> => {
    // URL is the TMDB ID in this new architecture
    const tmdbId = url;
    const seasonNum = season || 1;
    
    // Server 3: Multiembed
    if (server === '3') {
        if (ep !== undefined && ep !== null) {
            return `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${seasonNum}&e=${ep}`;
        }
        return `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`;
    }
    
    // Server 2: 2Embed
    if (server === '2') {
        if (ep !== undefined && ep !== null) {
            return `https://www.2embed.cc/embedtv/${tmdbId}&s=${seasonNum}&e=${ep}`;
        }
        return `https://www.2embed.cc/embed/${tmdbId}`;
    }
    
    // Server 1 (Default): Vidsrc
    if (ep !== undefined && ep !== null) {
        return `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${seasonNum}&episode=${ep}`;
    }
    
    return `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`;
};
