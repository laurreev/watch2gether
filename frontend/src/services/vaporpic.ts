const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

export interface VaporpicSearchResponse {
  results: VaporpicMediaItem[];
}

export interface VaporpicMediaItem {
  id: string;
  title: string;
  media_type: 'movie' | 'tv' | 'anime' | 'asian' | 'tvod';
  poster_url?: string;
  year?: string;
  url?: string;
  originalUrl?: string;
  episode?: number;
  season?: number;
}

const genreMap: Record<string, number[]> = {
  'action': [28, 10759],
  'adventure': [12, 10759],
  'animation': [16],
  'biography': [36],
  'comedy': [35],
  'crime': [80],
  'documentary': [99],
  'drama': [18],
  'family': [10751],
  'fantasy': [14, 10765],
  'history': [36],
  'horror': [27],
  'music': [10402],
  'mystery': [9648],
  'romance': [10749],
  'sci-fi': [878, 10765],
  'sport': [99],
  'thriller': [53],
  'war': [10752, 10768],
  'western': [37],
};

export const searchVaporpic = async (query: string, type: string, genre?: string, year?: string, signal?: AbortSignal): Promise<VaporpicSearchResponse> => {
  try {
    if (!TMDB_API_KEY) {
      console.error("Missing TMDB API Key. Please add VITE_TMDB_API_KEY to your .env file.");
      return { results: [] };
    }

    const searchType = type === 'movie' ? 'movie' : type === 'tv' ? 'tv' : type === 'anime' ? 'tv' : type === 'asian' ? 'tv' : 'multi';
    const encodedQuery = encodeURIComponent(query);
    
    let url = '';
    if (query.trim() === '') {
      // If empty query, fetch trending or discover
      if (type === 'anime') {
         url = `https://api.themoviedb.org/3/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&api_key=${TMDB_API_KEY}`;
         if (year) url += `&first_air_date_year=${year}`;
      } else if (type === 'asian') {
         url = `https://api.themoviedb.org/3/discover/tv?with_original_language=ko|zh|th|ja&sort_by=popularity.desc&api_key=${TMDB_API_KEY}`;
         if (genre) {
            const genreIds = genreMap[genre.toLowerCase()];
            if (genreIds) url += `&with_genres=${genreIds.join('|')}`;
         }
         if (year) url += `&first_air_date_year=${year}`;
      } else if (genre || year) {
         // Use discover endpoint if filters are applied
         const discType = searchType === 'multi' ? 'movie' : searchType;
         url = `https://api.themoviedb.org/3/discover/${discType}?sort_by=popularity.desc&api_key=${TMDB_API_KEY}`;
         if (genre) {
            const genreIds = genreMap[genre.toLowerCase()];
            if (genreIds) url += `&with_genres=${genreIds.join('|')}`;
         }
         if (year) {
            if (discType === 'movie') url += `&primary_release_year=${year}`;
            else url += `&first_air_date_year=${year}`;
         }
      } else {
         url = `https://api.themoviedb.org/3/trending/${searchType === 'multi' ? 'all' : searchType}/day?language=en-US&api_key=${TMDB_API_KEY}`;
      }
    } else {
      url = `https://api.themoviedb.org/3/search/${searchType}?query=${encodedQuery}&include_adult=false&language=en-US&page=1&api_key=${TMDB_API_KEY}`;
      if (year && searchType === 'movie') url += `&primary_release_year=${year}`;
      if (year && searchType === 'tv') url += `&first_air_date_year=${year}`;
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
    let results = data.results || [];
    
    // Local genre filtering for text searches since TMDB search endpoint doesn't support with_genres
    if (query.trim() !== '' && genre) {
       const genreIds = genreMap[genre.toLowerCase()];
       if (genreIds) {
          results = results.filter((item: any) => 
            item.genre_ids && item.genre_ids.some((id: number) => genreIds.includes(id))
          );
       }
    }

    // Map TMDB results to our format
    const mappedResults: VaporpicMediaItem[] = results.map((item: any) => {
      // For multi search, media_type comes from TMDB. For discover/search specific, we force it.
      let mappedMediaType = item.media_type || searchType;
      
      // Override for our custom tabs so the UI knows how to label them
      if (type === 'anime') mappedMediaType = 'anime';
      if (type === 'asian') mappedMediaType = 'asian';
      if (mappedMediaType === 'tv') mappedMediaType = 'tvod'; // Map to expected frontend type if needed, but our UI now expects 'tv', 'asian', 'anime' etc.
      
      return {
        id: item.id.toString(),
        title: item.title || item.name,
        media_type: mappedMediaType,
        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
        year: item.release_date ? item.release_date.split('-')[0] : (item.first_air_date ? item.first_air_date.split('-')[0] : undefined),
        url: item.id.toString(),
        originalUrl: item.id.toString(),
      };
    });

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
    
    // Server 4: Vidlink (Anime/HD)
    if (server === '4') {
        if (ep !== undefined && ep !== null) {
            return `https://vidlink.pro/tv/${tmdbId}/${seasonNum}/${ep}`;
        }
        return `https://vidlink.pro/movie/${tmdbId}`;
    }

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
