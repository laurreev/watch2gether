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
}

/**
 * Service to interact with the Vaporpic API.
 * Structured for future implementation.
 */
export const searchVaporpic = async (query: string, type?: string, genre?: string, year?: string, signal?: AbortSignal): Promise<VaporpicSearchResponse> => {
  try {
    let url = `/api/search?q=${encodeURIComponent(query)}&type=${type || 'all'}`;
    if (genre) url += `&genre=${encodeURIComponent(genre)}`;
    if (year) url += `&year=${encodeURIComponent(year)}`;
    
    const response = await fetch(url, { signal });
    
    if (!response.ok) {
      console.error(`Error fetching search results: ${response.statusText}`);
      return { results: [] };
    }
    
    const data = await response.json();
    
    // Check if the API returned an error string
    if (data.error) {
      console.warn('Vaporpic search error:', data.error);
      return { results: [] };
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching search results:`, error);
    return { results: [] };
  }
};

export const getVaporpicStream = async (mediaId: string): Promise<string> => {
  try {
    const response = await fetch(`/api/stream?id=${encodeURIComponent(mediaId)}`);
    if (!response.ok) {
      console.error(`Error fetching stream: ${response.statusText}`);
      return '';
    }
    const data = await response.json();
    return data.url || '';
  } catch (error) {
    console.error('Error fetching stream:', error);
    return '';
  }
};

export const getVaporpicIframe = async (url: string, server?: string): Promise<string> => {
  try {
    let loc = 'US';
    try {
      const traceRes = await fetch('https://1.1.1.1/cdn-cgi/trace');
      const traceText = await traceRes.text();
      for (const line of traceText.split('\n')) {
        if (line.startsWith('loc=')) {
          loc = line.split('=')[1].trim();
          break;
        }
      }
    } catch (e) {
      console.warn('Could not fetch client loc', e);
    }

    let reqUrl = `/api/extract?url=${encodeURIComponent(url)}&loc=${loc}`;
    if (server) reqUrl += `&server=${encodeURIComponent(server)}`;
    
    const response = await fetch(reqUrl);
    if (!response.ok) {
      console.error(`Error extracting video stream: ${response.statusText}`);
      return '';
    }
    const data = await response.json();
    return data.url || '';
  } catch (error) {
    console.error('Error extracting video stream:', error);
    return '';
  }
};
