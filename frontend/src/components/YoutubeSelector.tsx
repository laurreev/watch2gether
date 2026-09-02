import React, { useState, useEffect } from 'react';
import './MediaSelector.css';

interface YouTubeItem {
  id: string;
  title: string;
  type: 'YouTube';
  imageUrl: string;
  url: string;
  author: string;
  timestamp: string;
}

interface YoutubeSelectorProps {
  onPlay: (item: YouTubeItem) => void;
  onClose: () => void;
}

const API_BASE_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:3000');

const YoutubeSelector: React.FC<YoutubeSelectorProps> = ({ onPlay, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<YouTubeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  
  const randomQueries = [
    "top music videos", "funny cats compilation", "lofi hip hop radio",
    "gordon ramsay cooking", "mrbeast", "movie trailers", 
    "gaming highlights", "tech reviews", "stand up comedy", "nature documentary"
  ];
  
  // The default query picked once on mount
  const [defaultQuery] = useState(() => randomQueries[Math.floor(Math.random() * randomQueries.length)]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const [pageToken, setPageToken] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Reset pagination when search query changes
  useEffect(() => {
    setPageToken(null);
    setNextPageToken(null);
    setHasMore(true);
    setResults([]);
  }, [searchQuery]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 150 && !isLoading && hasMore && nextPageToken) {
      setPageToken(nextPageToken);
    }
  };

  useEffect(() => {
    let aborted = false;
    const abortController = new AbortController();
    
    const fetchYouTube = async () => {
      const actualQuery = searchQuery.trim() || defaultQuery;
      setIsLoading(true);
      
      try {
        let url = `${API_BASE_URL}/api/yt/search?q=${encodeURIComponent(actualQuery)}`;
        if (pageToken) {
          url += `&pageToken=${encodeURIComponent(pageToken)}`;
        }
        
        const response = await fetch(url, { signal: abortController.signal });
        
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Search failed (server error)');
        }
        
        const data = await response.json();
        if (aborted) return;
        
        const mappedResults: YouTubeItem[] = data.results.map((v: any) => ({
           id: v.videoId,
           title: v.title,
           type: 'YouTube',
           imageUrl: v.thumbnail,
           url: `https://www.youtube.com/watch?v=${v.videoId}`,
           author: v.author?.name || 'Unknown',
           timestamp: v.timestamp || 'Unknown Date'
        }));
        
        setResults(prev => pageToken ? [...prev, ...mappedResults] : mappedResults);
        setNextPageToken(data.nextPageToken || null);
        setHasMore(!!data.nextPageToken);
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        if (!aborted) {
          console.error(error);
          showNotification(error.message || "Failed to search YouTube");
        }
      } finally {
        if (!aborted) setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchYouTube();
    }, 800);

    return () => {
      aborted = true;
      abortController.abort();
      clearTimeout(timeoutId);
    };
  }, [searchQuery, pageToken, defaultQuery]);

  return (
    <div className="media-selector-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="media-selector-modal glass" onClick={e => e.stopPropagation()} style={{ background: 'rgba(20, 20, 20, 0.95)' }}>
        {notification && (
          <div style={{ position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(239, 68, 68, 0.9)', color: 'white', padding: '0.5rem 1rem', borderRadius: '2rem', zIndex: 1000, boxShadow: '0 4px 15px rgba(0,0,0,0.5)', fontWeight: 600, animation: 'fadeIn 0.3s ease-out' }}>
            {notification}
          </div>
        )}
        <div className="media-selector-header" style={{ borderBottomColor: 'rgba(255,0,0,0.3)' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <span style={{ color: '#ff0000' }}>▶</span> Watch on YouTube
          </h2>
          <button className="icon-btn close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '2rem', overflowY: 'hidden' }}>
            <div className="media-selector-controls" style={{ padding: 0, marginBottom: '2rem' }}>
              <div className="search-bar-container">
                <input 
                  type="text" 
                  className="input-field search-input" 
                  placeholder="Search YouTube..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,0,0,0.3)' }}
                  autoFocus
                />
                <button className="btn btn-primary search-btn" style={{ background: '#ef4444' }}>Search</button>
              </div>
            </div>

            <div className="media-grid" style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }} onScroll={handleScroll}>
              {results.length > 0 ? (
                <>
                  {results.map(item => (
                    <div key={item.id} className="media-tile" onClick={() => onPlay(item)}>
                      <img src={item.imageUrl} alt={item.title} className="media-tile-image" loading="lazy" style={{ aspectRatio: '16/9', objectFit: 'cover' }} />
                      <div className="media-tile-info">
                        <span className="media-tile-type" style={{ color: '#ef4444' }}>
                          YouTube • {item.timestamp}
                        </span>
                        <h3 className="media-tile-title">{item.title}</h3>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.2rem' }}>{item.author}</div>
                        <div className="media-tile-play-overlay">
                          <button className="btn btn-primary play-btn" style={{ background: '#ef4444' }}>
                            ▶ Play
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && hasMore && Array.from({ length: 4 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="media-tile skeleton-tile">
                      <div className="skeleton-image" style={{ aspectRatio: '16/9' }}></div>
                    </div>
                  ))}
                </>
              ) : isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="media-tile skeleton-tile">
                    <div className="skeleton-image" style={{ aspectRatio: '16/9' }}></div>
                  </div>
                ))
              ) : (
                <div className="no-results" style={{ gridColumn: '1 / -1', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
                   <span style={{ fontSize: '3rem', marginBottom: '1rem', color: 'rgba(239, 68, 68, 0.5)' }}>▶</span>
                   <p>No results found. Try a different search.</p>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default YoutubeSelector;
