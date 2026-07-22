import React, { useState, useEffect } from 'react';
import { searchVaporpic, type VaporpicMediaItem } from '../services/vaporpic.ts';
import './MediaSelector.css';




interface MediaItem {
  id: string;
  title: string;
  type: 'Movie' | 'TV Show' | 'Anime' | 'Asian';
  imageUrl: string;
  url?: string;
  originalUrl?: string;
  episode?: number;
  season?: number;
  year?: string;
}

// No more placeholder data, we fetch from the backend script
interface MediaSelectorProps {
  onPlay: (item: MediaItem) => void;
  onClose: () => void;
}

const MediaSelector: React.FC<MediaSelectorProps> = ({ onPlay, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Movie' | 'TV Show' | 'Anime' | 'Asian'>('All');
  const [activeGenre, setActiveGenre] = useState('All');
  const [activeYear, setActiveYear] = useState('All');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 150 && !isLoading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setResults([]);
  }, [searchQuery, activeTab, activeGenre, activeYear]);

  // Debounced search effect mapping vaporpic structure
  useEffect(() => {
    let aborted = false;
    const abortController = new AbortController();
    
    setIsLoading(true);
    
    const fetchMedia = async () => {
      try {
        // Map UI tabs to API media types
        const typeMapping: Record<string, string> = {
          'Movie': 'movie',
          'TV Show': 'tv',
          'Anime': 'anime',
          'Asian': 'asian',
          'All': ''
        };
        
        const genreParam = activeGenre !== 'All' ? activeGenre.toLowerCase() : undefined;
        const yearParam = activeYear !== 'All' ? activeYear : undefined;
        
        const response = await searchVaporpic(searchQuery, typeMapping[activeTab], genreParam, yearParam, page, abortController.signal);
        
        // Don't update state if this effect was already cleaned up (stale request)
        if (aborted) return;
        
        if (response.results && response.results.length > 0) {
          // Map API results to UI state
          const mappedResults: MediaItem[] = response.results.map((item: VaporpicMediaItem) => {
             let mappedType: 'Movie' | 'TV Show' | 'Anime' | 'Asian' = 'Movie';
             if (item.media_type === 'tv' || item.media_type === 'tvod') mappedType = 'TV Show';
             if (item.media_type === 'anime') mappedType = 'Anime';
             if (item.media_type === 'asian') mappedType = 'Asian';
             
             return {
               id: item.id,
               title: item.title,
               type: mappedType,
               imageUrl: item.poster_url || 'https://via.placeholder.com/300x450/2a2d3e/ffffff?text=No+Image',
               url: item.url,
               originalUrl: item.url,
               year: item.year
             };
          });
          setResults(prev => page === 1 ? mappedResults : [...prev, ...mappedResults]);
          setHasMore(response.results.length >= 20);
        } else {
          if (page === 1) setResults([]);
          setHasMore(false);
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
  }, [searchQuery, activeTab, activeGenre, activeYear, page]);

  const [selectedTvShow, setSelectedTvShow] = useState<MediaItem | null>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);

  useEffect(() => {
    let aborted = false;
    
    if (selectedTvShow && selectedSeason !== null) {
      setIsLoadingEpisodes(true);
      import('../services/vaporpic.ts').then(({ getEpisodesForSeason }) => {
        getEpisodesForSeason(selectedTvShow.url!, selectedSeason).then(eps => {
          if (!aborted) {
            setEpisodes(eps);
            setIsLoadingEpisodes(false);
          }
        });
      });
    }

    return () => {
      aborted = true;
    };
  }, [selectedTvShow, selectedSeason]);

  const handlePlay = async (item: MediaItem) => {
    if (!item.url) {
      alert("No URL found for this media.");
      return;
    }
    
    if (item.type === 'TV Show' || item.type === 'Anime' || item.type === 'Asian') {
       setSelectedTvShow(item);
       setIsLoadingEpisodes(true);
       try {
         const { getTvSeasons } = await import('../services/vaporpic.ts');
         const fetchedSeasons = await getTvSeasons(item.url!);
         setSeasons(fetchedSeasons);
         if (fetchedSeasons.length > 0) {
           setSelectedSeason(fetchedSeasons[0].season_number);
         } else {
           setIsLoadingEpisodes(false);
         }
       } catch(e) {
         setSeasons([]);
         setIsLoadingEpisodes(false);
       }
       return;
    }
    
    await playMedia(item);
  };

  const playMedia = async (item: MediaItem, ep?: number) => {
    setExtractingId(item.id);
    try {
      const { getVaporpicIframe } = await import('../services/vaporpic.ts');
      const m3u8Url = await getVaporpicIframe(item.url!, '1', ep?.toString(), selectedSeason || 1);
      
      if (m3u8Url) {
        onPlay({ ...item, url: m3u8Url, originalUrl: item.url, episode: ep, season: selectedSeason || undefined });
      } else {
        alert("Failed to get video stream.");
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
          <h2>{selectedTvShow ? selectedTvShow.title : "Find something to watch"}</h2>
          <button className="icon-btn close-btn" onClick={onClose}>&times;</button>
        </div>
        
        {selectedTvShow ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '2rem', overflowY: 'auto' }}>
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => { setSelectedTvShow(null); setSelectedSeason(null); setSeasons([]); setEpisodes([]); }}>← Back to search</button>
              
              {seasons.length > 0 && (
                <select 
                  className="input-field" 
                  style={{ minWidth: '150px' }}
                  value={selectedSeason || ''} 
                  onChange={e => setSelectedSeason(Number(e.target.value))}
                >
                  {seasons.map(s => (
                    <option key={s.season_number} value={s.season_number}>{s.name || `Season ${s.season_number}`}</option>
                  ))}
                </select>
              )}
            </div>
            
            {isLoadingEpisodes ? (
              <div style={{ textAlign: 'center', color: 'white', padding: '3rem' }}>Loading episodes...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                {episodes.map((ep) => (
                  <button 
                    key={ep.episode_number} 
                    className="btn btn-primary"
                    style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.25rem', textAlign: 'left', height: '100%' }}
                    onClick={() => playMedia(selectedTvShow, ep.episode_number)}
                  >
                    <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: 600 }}>Ep {ep.episode_number}</span>
                    {ep.name && !ep.name.toLowerCase().startsWith(`episode ${ep.episode_number}`) && (
                      <span style={{ fontSize: '0.95rem', color: '#fff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', width: '100%' }}>{ep.name}</span>
                    )}
                    {extractingId === selectedTvShow.id && <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)', marginTop: 'auto', paddingTop: '0.5rem' }}>Loading...</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
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
                  {['All', 'Movie', 'TV Show', 'Anime', 'Asian'].map(tab => (
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

            <div className="media-grid" onScroll={handleScroll}>
              {results.length > 0 ? (
                <>
                  {results.map(item => (
                    <div key={item.id} className="media-tile" onClick={() => handlePlay(item)}>
                      <img src={item.imageUrl} alt={item.title} className="media-tile-image" loading="lazy" />
                      <div className="media-tile-info">
                        <span className="media-tile-type">
                          {item.type}{item.year ? ` • ${item.year}` : ''}
                        </span>
                        <h3 className="media-tile-title">{item.title}</h3>
                        <div className="media-tile-play-overlay">
                          <button className="btn btn-primary play-btn">
                            {extractingId === item.id ? 'Extracting...' : (item.type === 'Movie' ? '▶ Play' : '▶ Select')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && hasMore && Array.from({ length: 5 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="media-tile skeleton-tile">
                      <div className="skeleton-image"></div>
                    </div>
                  ))}
                </>
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
          </>
        )}
      </div>
    </div>
  );
};

export default MediaSelector;
