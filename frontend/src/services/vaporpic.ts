const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

export interface VaporpicSearchResponse {
  results: VaporpicMediaItem[];
  total_pages?: number;
}

export interface VaporpicMediaItem {
  id: string;
  title: string;
  media_type: 'movie' | 'tv' | 'anime' | 'kdrama' | 'tvod';
  poster_url?: string;
  year?: string;
  url?: string;
  originalUrl?: string;
  episode?: number;
  season?: number;
  overview?: string;
  vote_average?: number;
  tmdb_type?: 'movie' | 'tv';
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

export const searchVaporpic = async (query: string, type: string, genre?: string, year?: string, page: number = 1, signal?: AbortSignal, rating?: string): Promise<VaporpicSearchResponse> => {
  try {
    if (!TMDB_API_KEY) {
      console.error("Missing TMDB API Key. Please add VITE_TMDB_API_KEY to your .env file.");
      return { results: [] };
    }

    const searchType = type === 'movie' ? 'movie' : type === 'tv' ? 'tv' : type === 'anime' ? 'tv' : type === 'kdrama' ? 'multi' : 'multi';
    const encodedQuery = encodeURIComponent(query);
    
    let url = '';
    if (query.trim() === '') {
      // If empty query, fetch trending or discover
      if (type === 'anime') {
         url = `https://api.themoviedb.org/3/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&api_key=${TMDB_API_KEY}`;
         if (year) url += `&first_air_date_year=${year}`;
      } else if (type === 'kdrama') {
         let tvUrl = `https://api.themoviedb.org/3/discover/tv?with_original_language=ko&sort_by=popularity.desc&api_key=${TMDB_API_KEY}`;
         let movieUrl = `https://api.themoviedb.org/3/discover/movie?with_original_language=ko&sort_by=popularity.desc&api_key=${TMDB_API_KEY}`;
         
         if (genre) {
            const genreIds = genreMap[genre.toLowerCase()];
            if (genreIds) {
               tvUrl += `&with_genres=${genreIds.join('|')}`;
               movieUrl += `&with_genres=${genreIds.join('|')}`;
            }
         }
         if (year) {
             tvUrl += `&first_air_date_year=${year}`;
             movieUrl += `&primary_release_year=${year}`;
         }
         if (rating) {
             tvUrl += `&vote_average.gte=${rating}`;
             movieUrl += `&vote_average.gte=${rating}`;
         }
         
         tvUrl += `&page=${page}`;
         movieUrl += `&page=${page}`;
         
         const [tvRes, movieRes] = await Promise.all([
           fetch(tvUrl, { headers: { 'accept': 'application/json' }, signal }).then(res => res.json()),
           fetch(movieUrl, { headers: { 'accept': 'application/json' }, signal }).then(res => res.json())
         ]);
         
         const tvItems = (tvRes.results || []).map((item: any) => ({ ...item, media_type: 'tv' }));
         const movieItems = (movieRes.results || []).map((item: any) => ({ ...item, media_type: 'movie' }));
         const combined = [...tvItems, ...movieItems].sort((a, b) => b.popularity - a.popularity);
         
         const mappedResults: VaporpicMediaItem[] = combined.slice(0, 20).map((item: any) => ({
            id: item.id.toString(),
            title: item.title || item.name,
            media_type: 'kdrama',
            poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
            year: item.release_date ? item.release_date.split('-')[0] : (item.first_air_date ? item.first_air_date.split('-')[0] : undefined),
            url: item.id.toString(),
            originalUrl: item.id.toString(),
            overview: item.overview,
            vote_average: item.vote_average,
            tmdb_type: item.media_type,
         }));
         
         return { results: mappedResults, total_pages: Math.max(tvRes.total_pages || 1, movieRes.total_pages || 1) };
      } else if (genre || year || rating) {
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
         if (rating) url += `&vote_average.gte=${rating}`;
      } else {
         url = `https://api.themoviedb.org/3/trending/${searchType === 'multi' ? 'all' : searchType}/day?language=en-US&api_key=${TMDB_API_KEY}`;
      }
    } else {
      url = `https://api.themoviedb.org/3/search/${searchType}?query=${encodedQuery}&include_adult=false&language=en-US&api_key=${TMDB_API_KEY}`;
      if (year && searchType === 'movie') url += `&primary_release_year=${year}`;
      if (year && searchType === 'tv') url += `&first_air_date_year=${year}`;
    }

    url += `&page=${page}`;

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
      if (type === 'kdrama') mappedMediaType = 'kdrama';
      if (mappedMediaType === 'tv') mappedMediaType = 'tvod'; // Map to expected frontend type if needed, but our UI now expects 'tv', 'asian', 'anime' etc.
      
      return {
        id: item.id.toString(),
        title: item.title || item.name,
        media_type: mappedMediaType,
        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
        year: item.release_date ? item.release_date.split('-')[0] : (item.first_air_date ? item.first_air_date.split('-')[0] : undefined),
        url: item.id.toString(),
        originalUrl: item.id.toString(),
        overview: item.overview,
        vote_average: item.vote_average,
        tmdb_type: (item.media_type === 'movie' || searchType === 'movie') ? 'movie' : 'tv',
      };
    });

    return { results: mappedResults, total_pages: data.total_pages || 1 };
  } catch (error) {
    console.error(`Error fetching search results:`, error);
    return { results: [], total_pages: 1 };
  }
};

export const getMediaDetails = async (id: string, type: string, tmdb_type?: 'movie' | 'tv'): Promise<VaporpicMediaItem | null> => {
  try {
    if (!TMDB_API_KEY) return null;
    
    // Support parsing both our frontend 'Movie'/'Series' types and native tmdb types
    const isMovie = tmdb_type === 'movie' || type.toLowerCase() === 'movie';
    const endpointType = isMovie ? 'movie' : 'tv';
    
    const response = await fetch(`https://api.themoviedb.org/3/${endpointType}/${id}?api_key=${TMDB_API_KEY}&language=en-US`, {
      headers: { 'accept': 'application/json' }
    });
    
    if (!response.ok) return null;
    const item = await response.json();
    
    let mappedMediaType: 'movie' | 'tv' | 'anime' | 'kdrama' | 'tvod' = 'tv';
    if (isMovie) mappedMediaType = 'movie';
    if (type.toLowerCase() === 'anime') mappedMediaType = 'anime';
    if (type.toLowerCase() === 'k-drama') mappedMediaType = 'kdrama';
    
    return {
        id: item.id.toString(),
        title: item.title || item.name,
        media_type: mappedMediaType,
        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
        year: item.release_date ? item.release_date.split('-')[0] : (item.first_air_date ? item.first_air_date.split('-')[0] : undefined),
        url: item.id.toString(),
        originalUrl: item.id.toString(),
        overview: item.overview,
        vote_average: item.vote_average,
    };
  } catch (err) {
    console.error('Failed to get media details', err);
    return null;
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
        if (!data.episodes) return [];
        const now = new Date();
        return data.episodes.filter((ep: any) => {
            if (!ep.air_date) return false;
            const airDate = new Date(ep.air_date);
            return airDate <= now;
        });
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
    
    // Server 1: ZXCStream (Embed) (previously 6)
    if (server === '1') {
        if (ep !== undefined && ep !== null) {
            return `https://embed.zxcstream.xyz/player/tv/${tmdbId}/${seasonNum}/${ep}`;
        }
        return `https://embed.zxcstream.xyz/player/movie/${tmdbId}`;
    }

    // Server 2: ZXCStream (ICU) (previously 7)
    if (server === '2') {
        if (ep !== undefined && ep !== null) {
            return `https://zxcstream.icu/watch/tv/${tmdbId}/${seasonNum}/${ep}`;
        }
        return `https://zxcstream.icu/watch/movie/${tmdbId}`;
    }

    // Server 3: Vidsrc (previously 1)
    if (server === '3') {
        if (ep !== undefined && ep !== null) {
            return `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${seasonNum}&episode=${ep}`;
        }
        return `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`;
    }

    // Server 4: Vidlink (Anime/HD)
    if (server === '4') {
        if (ep !== undefined && ep !== null) {
            return `https://vidlink.pro/tv/${tmdbId}/${seasonNum}/${ep}`;
        }
        return `https://vidlink.pro/movie/${tmdbId}`;
    }

    // Server 5: Videasy
    if (server === '5') {
        if (ep !== undefined && ep !== null) {
            return `https://player.videasy.to/tv/${tmdbId}/${seasonNum}/${ep}`;
        }
        return `https://player.videasy.to/movie/${tmdbId}`;
    }

    // Server 6: 2Embed (previously 2)
    if (server === '6') {
        if (ep !== undefined && ep !== null) {
            return `https://www.2embed.cc/embedtv/${tmdbId}&s=${seasonNum}&e=${ep}`;
        }
        return `https://www.2embed.cc/embed/${tmdbId}`;
    }
    
    // Server 7: Multiembed (previously 3)
    if (server === '7') {
        if (ep !== undefined && ep !== null) {
            return `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${seasonNum}&e=${ep}`;
        }
        return `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`;
    }

    // default fallback (ZXCStream)
    if (ep !== undefined && ep !== null) {
        return `https://embed.zxcstream.xyz/player/tv/${tmdbId}/${seasonNum}/${ep}`;
    }
    return `https://embed.zxcstream.xyz/player/movie/${tmdbId}`;
};

export interface MediaDetails {
  id: string;
  title: string;
  overview: string;
  backdrop_url?: string;
  poster_url?: string;
  youtube_trailer_id?: string;
  year?: string;
  genres?: string[];
  runtime?: number;
  vote_average?: number;
  type: 'movie' | 'tv';
}

export const getMediaDetailsAndTrailer = async (tmdbId: string, type: 'Movie' | 'Series' | 'Anime' | 'K-Drama' | string, tmdb_type?: 'movie' | 'tv'): Promise<MediaDetails | null> => {
  try {
    const tmdbType = tmdb_type || ((type === 'Movie' || type === 'movie') ? 'movie' : 'tv');
    if (!TMDB_API_KEY) return null;
    
    const url = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=videos`;
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const data = await res.json();
    
    let trailerId = undefined;
    if (data.videos && data.videos.results) {
      // Prioritize official trailer
      const trailer = data.videos.results.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
      if (trailer) {
          trailerId = trailer.key;
      } else {
          // fallback to any youtube video like teaser
          const anyVideo = data.videos.results.find((v: any) => v.site === 'YouTube');
          if (anyVideo) trailerId = anyVideo.key;
      }
    }
    
    return {
      id: data.id.toString(),
      title: data.title || data.name,
      overview: data.overview,
      backdrop_url: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : undefined,
      poster_url: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : undefined,
      youtube_trailer_id: trailerId,
      year: (data.release_date || data.first_air_date || '').split('-')[0],
      genres: data.genres?.map((g: any) => g.name),
      runtime: data.runtime || (data.episode_run_time && data.episode_run_time[0]),
      vote_average: data.vote_average,
      type: tmdbType
    };
  } catch (e) {
    console.error(e);
    return null;
  }
};
