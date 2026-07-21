import React, { useState, useEffect } from 'react';
import { searchVaporpic, type VaporpicMediaItem } from '../services/vaporpic.ts';
import './MediaSelector.css';




interface MediaItem {
  id: string;
  title: string;
  type: 'Movie' | 'TV Show' | 'Anime';
  imageUrl: string;
  url?: string;
  originalUrl?: string;
}

// No more placeholder data, we fetch from the backend script
interface MediaSelectorProps {
  onPlay: (item: MediaItem) => void;
  onClose: () => void;
}

const MediaSelector: React.FC<MediaSelectorProps> = ({ onPlay, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Movie' | 'TV Show' | 'Anime'>('All');
  const [activeGenre, setActiveGenre] = useState('All');
  const [activeYear, setActiveYear] = useState('All');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [extractingId, setExtractingId] = useState<string | null>(null);

  // Debounced search effect mapping vaporpic structure
  useEffect(() => {
    let aborted = false;
    const abortController = new AbortController();
    
    setIsLoading(true);
    setResults([]);
    
    const fetchMedia = async () => {
      try {
        // Map UI tabs to API media types
        const typeMapping: Record<string, string> = {
          'Movie': 'movie',
          'TV Show': 'tvod',
          'Anime': 'anime',
          'All': ''
        };
        
        const genreParam = activeGenre !== 'All' ? activeGenre.toLowerCase() : undefined;
        const yearParam = activeYear !== 'All' ? activeYear : undefined;
        
        const response = await searchVaporpic(searchQuery, typeMapping[activeTab], genreParam, yearParam, abortController.signal);
        
        // Don't update state if this effect was already cleaned up (stale request)
        if (aborted) return;
        
        if (response.results && response.results.length > 0) {
          // Map API results to UI state
          const mappedResults: MediaItem[] = response.results.map((item: VaporpicMediaItem) => {
             let mappedType: 'Movie' | 'TV Show' | 'Anime' = 'Movie';
             if (item.media_type === 'tvod') mappedType = 'TV Show';
             if (item.media_type === 'anime') mappedType = 'Anime';
             
             return {
               id: item.id,
               title: item.title,
               type: mappedType,
               imageUrl: item.poster_url || 'https://via.placeholder.com/300x450/2a2d3e/ffffff?text=No+Image',
               url: item.url,
               originalUrl: item.url
             };
          });
          setResults(mappedResults);
        } else {
          setResults([]);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('Search fetch aborted');
        } else if (!aborted) {
          console.error('Failed to fetch media:', error);
        }
      } finally {
        if (!aborted) {
          setIsLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(() => {
      fetchMedia();
    }, 1000); // Increased debounce to 1000ms to reduce backend spam

    return () => {
      aborted = true;
      abortController.abort();
      clearTimeout(timeoutId);
    };
  }, [searchQuery, activeTab, activeGenre, activeYear]);

  const handlePlay = async (item: MediaItem) => {
    if (!item.url) {
      alert("No URL found for this media.");
      return;
    }
    
    setExtractingId(item.id);
    try {
      const { getVaporpicIframe } = await import('../services/vaporpic.ts');
      const m3u8Url = await getVaporpicIframe(item.url, '1');
      
      if (m3u8Url) {
        onPlay({ ...item, url: m3u8Url, originalUrl: item.url });
      } else {
        alert("Failed to extract video stream. Fmovies might be blocking the request.");
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred during extraction.");
    } finally {
      setExtractingId(null);
    }
  };

  return (
    <div className="media-selector-overlay" onClick={onClose}>
      <div className="media-selector-modal glass" onClick={e => e.stopPropagation()}>
        <div className="media-selector-header">
          <h2>Find something to watch</h2>
          <button className="icon-btn close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="media-selector-controls">
          <div className="search-bar-container">
            <input 
              type="text" 
              className="input-field search-input" 
              placeholder="Search for movies, TV shows, anime..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <button className="btn btn-primary search-btn">Search</button>
          </div>
          
          <div className="media-filters">
            <div className="media-tabs">
              {['All', 'Movie', 'TV Show', 'Anime'].map(tab => (
                <button 
                  key={tab} 
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab as any)}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            <div className="dropdown-filters">
              <select 
                className="input-field filter-dropdown" 
                value={activeGenre} 
                onChange={e => setActiveGenre(e.target.value)}
              >
                <option value="All">All Genres</option>
                <option value="Action">Action</option>
                <option value="Adventure">Adventure</option>
                <option value="Animation">Animation</option>
                <option value="Biography">Biography</option>
                <option value="Comedy">Comedy</option>
                <option value="Crime">Crime</option>
                <option value="Documentary">Documentary</option>
                <option value="Drama">Drama</option>
                <option value="Family">Family</option>
                <option value="Fantasy">Fantasy</option>
                <option value="History">History</option>
                <option value="Horror">Horror</option>
                <option value="Music">Music</option>
                <option value="Mystery">Mystery</option>
                <option value="Romance">Romance</option>
                <option value="Sci-Fi">Sci-Fi</option>
                <option value="Sport">Sport</option>
                <option value="Thriller">Thriller</option>
                <option value="War">War</option>
                <option value="Western">Western</option>
              </select>
              
              <select 
                className="input-field filter-dropdown" 
                value={activeYear} 
                onChange={e => setActiveYear(e.target.value)}
              >
                <option value="All">All Years</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
                <option value="2021">2021</option>
                <option value="2020">2020</option>
                <option value="2019">2019 and older</option>
              </select>
            </div>
          </div>
        </div>

        <div className="media-grid">
          {results.length > 0 ? (
            results.map(item => (
              <div key={item.id} className="media-tile" onClick={() => handlePlay(item)}>
                <img src={item.imageUrl} alt={item.title} className="media-tile-image" />
                <div className="media-tile-info">
                  <span className="media-tile-type">{item.type}</span>
                  <h3 className="media-tile-title">{item.title}</h3>
                  <div className="media-tile-play-overlay">
                    <button className="btn btn-primary play-btn">
                      {extractingId === item.id ? 'Extracting...' : '▶ Play'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="media-tile skeleton-tile">
                <div className="skeleton-image"></div>
              </div>
            ))
          ) : (
            <div className="no-results">No media found.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaSelector;
