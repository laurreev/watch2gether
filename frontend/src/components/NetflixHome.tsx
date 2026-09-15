import React, { useState, useEffect, useRef } from 'react';
import { searchVaporpic, getMediaDetailsAndTrailer, type VaporpicMediaItem } from '../services/vaporpic';
import HeroBanner from './HeroBanner';
import ReactPlayerModule from 'react-player';
import './NetflixHome.css';

const ReactPlayer = (ReactPlayerModule as any).default || ReactPlayerModule;

export type TabType = 'home' | 'search' | 'movies' | 'series' | 'anime' | 'kdrama';

export interface MediaItem {
  id: string;
  title: string;
  type: 'Movie' | 'Series' | 'Anime' | 'K-Drama';
  imageUrl: string;
  url?: string;
  originalUrl?: string;
  year?: string;
  overview?: string;
  vote_average?: number;
  tmdb_type?: 'movie' | 'tv';
}

interface MediaRowProps {
  title: string;
  fetchData: () => Promise<MediaItem[]>;
  onSelectItem: (item: MediaItem) => void;
}

const MediaRow: React.FC<MediaRowProps> = ({ title, fetchData, onSelectItem }) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const rowRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    let mounted = true;
    fetchData().then(data => {
      if (mounted) {
        setItems(data);
        setIsLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [fetchData]);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth * 0.8 : scrollLeft + clientWidth * 0.8;
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (isLoading) {
    return (
      <div className="netflix-row">
        <h2 className="row-title">{title}</h2>
        <div className="row-posters skeleton">
          {Array.from({ length: 8 }).map((_, i) => (
             <div key={i} className="row-poster-wrapper skeleton-poster"></div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="netflix-row">
      <h2 className="row-title">{title}</h2>
      <div className="row-container">
        <button className="row-nav left" onClick={() => scroll('left')}>&#8249;</button>
        <div className="row-posters" ref={rowRef}>
          {items.map(item => (
            <div 
              key={item.id} 
              className="row-poster-wrapper"
              onClick={() => onSelectItem(item)}
            >
              <img src={item.imageUrl} alt={item.title} className="row-poster" loading="lazy" />
              <div className="media-card-info">
                <h3 className="media-card-title">{item.title}</h3>
                <div className="media-card-meta">
                  <span className="media-card-rating">★ {item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</span>
                  {item.year && <span className="media-card-dot">· {item.year}</span>}
                  <span className="media-card-dot">· {item.type}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button className="row-nav right" onClick={() => scroll('right')}>&#8250;</button>
      </div>
    </div>
  );
};

const Top10Row: React.FC<{ onSelectItem: (item: MediaItem) => void }> = ({ onSelectItem }) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<'All' | 'Movies' | 'TV'>('All');
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const fetchTop10 = async () => {
      let res;
      if (filter === 'All') res = await searchVaporpic('', 'movie', undefined, undefined, 1);
      else if (filter === 'Movies') res = await searchVaporpic('', 'movie', undefined, undefined, 1);
      else res = await searchVaporpic('', 'tv', undefined, undefined, 1);
      
      if (mounted) {
        const type = filter === 'TV' ? 'Series' : 'Movie';
        // Note: For 'All' we should ideally combine, but we'll use trending movies as a proxy for now
        // to simplify ZXCStream behavior matching.
        setItems(res.results.slice(0, 10).map((item: VaporpicMediaItem) => ({
          id: item.id,
          title: item.title,
          type: type,
          imageUrl: item.poster_url || '',
          year: item.year,
          overview: item.overview,
          vote_average: item.vote_average,
        })));
      }
    };
    fetchTop10();
    return () => { mounted = false; };
  }, [filter]);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth * 0.8 : scrollLeft + clientWidth * 0.8;
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <div className="netflix-row top10-row-container">
      <div className="top10-header">
        <h2 className="row-title" style={{ display: 'inline-block', margin: 0, padding: 0 }}>TOP 10</h2>
        <div className="top10-filters">
          <button className={`filter-btn ${filter === 'All' ? 'active' : ''}`} onClick={() => setFilter('All')}>All</button>
          <button className={`filter-btn ${filter === 'Movies' ? 'active' : ''}`} onClick={() => setFilter('Movies')}>Movies</button>
          <button className={`filter-btn ${filter === 'TV' ? 'active' : ''}`} onClick={() => setFilter('TV')}>TV</button>
        </div>
      </div>
      <div className="row-container">
        <button className="row-nav left" onClick={() => scroll('left')}>&#8249;</button>
        <div className="row-posters" ref={rowRef}>
          {items.map((item, index) => (
            <div 
              key={item.id} 
              className="row-poster-wrapper top10-wrapper"
              onClick={() => onSelectItem(item)}
            >
              <div className="top10-number">{index + 1}</div>
              <div className="top10-card-content">
                <img src={item.imageUrl} alt={item.title} className="row-poster top10-poster" loading="lazy" />
                <div className="media-card-info">
                  <h3 className="media-card-title">{item.title}</h3>
                  <div className="media-card-meta">
                    <span className="media-card-rating">★ {item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</span>
                    {item.year && <span className="media-card-dot">· {item.year}</span>}
                    <span className="media-card-dot">· {item.type}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button className="row-nav right" onClick={() => scroll('right')}>&#8250;</button>
      </div>
    </div>
  );
};

interface NetflixHomeProps {
  activeTab: TabType;
  onWatch: (item: MediaItem) => void;
}

const PreviewModal: React.FC<{ media: MediaItem, onClose: () => void, onWatch: (media: MediaItem) => void }> = ({ media, onClose, onWatch }) => {
  const [details, setDetails] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let mounted = true;
    getMediaDetailsAndTrailer(media.id, media.type, media.tmdb_type).then(res => {
      if (mounted) setDetails(res);
    });
    return () => { mounted = false; };
  }, [media]);

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div className="preview-modal-content" onClick={e => e.stopPropagation()}>
        <button className="preview-modal-close" onClick={onClose}>×</button>
        <div className="preview-modal-hero">
          <img src={details?.backdrop_url || media.imageUrl} alt={media.title} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', zIndex: 0 }} />
          
          {details?.youtube_trailer_id ? (
            <div style={{ opacity: isPlaying ? 1 : 0, transition: 'opacity 0.5s', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
              <ReactPlayer
                url={`https://www.youtube.com/watch?v=${details.youtube_trailer_id}`}
                playing={true}
                muted={true}
                controls={false}
                loop={true}
                playsinline={true}
                width="100%"
                height="100%"
                className="preview-modal-video"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                config={{
                  youtube: {
                    playerVars: {
                      showinfo: 0,
                      rel: 0,
                      modestbranding: 1,
                      iv_load_policy: 3,
                      disablekb: 1
                    }
                  }
                }}
              />
            </div>
          ) : null}
          <div className="preview-modal-hero-vignette" style={{ zIndex: 2 }}></div>
        </div>
        <div className="preview-modal-info">
          <h2>{media.title}</h2>
          <div className="preview-modal-meta">
            {media.year && <span>{media.year}</span>}
            <span>{media.type}</span>
          </div>
          <p className="preview-modal-overview">{details?.overview || 'Loading...'}</p>
          <div className="preview-modal-actions">
            <button className="btn-netflix primary" onClick={() => onWatch(media)}>▶ Watch</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const NetflixHome: React.FC<NetflixHomeProps> = ({ activeTab, onWatch }) => {
  const [heroMedia, setHeroMedia] = useState<MediaItem[]>([]);
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [gridMedia, setGridMedia] = useState<MediaItem[]>([]);
  const [gridPage, setGridPage] = useState(1);
  const [hasMoreGrid, setHasMoreGrid] = useState(true);
  const [isGridLoading, setIsGridLoading] = useState(false);
  const isFetchingRef = useRef(false);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedRating, setSelectedRating] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Search defaults Search State
  const popularSearches = ["The End of Oak Street", "Lanterns", "Moana", "SpongeBob", "Resident Evil", "Silo", "Bleach", "Obsession", "The Gentlemen", "One Piece"];
  const [defaultHorror, setDefaultHorror] = useState<MediaItem[]>([]);
  const [defaultSciFi, setDefaultSciFi] = useState<MediaItem[]>([]);
  const [defaultDrama, setDefaultDrama] = useState<MediaItem[]>([]);
  const [defaultThriller, setDefaultThriller] = useState<MediaItem[]>([]);
  const [defaultAction, setDefaultAction] = useState<MediaItem[]>([]);
  const [defaultComedy, setDefaultComedy] = useState<MediaItem[]>([]);

  const mapResults = (results: VaporpicMediaItem[], defaultType: MediaItem['type'] = 'Movie'): MediaItem[] => {
    return results.map(item => ({
      id: item.id,
      title: item.title,
      type: item.media_type === 'movie' ? 'Movie' : 
            item.media_type === 'tv' ? 'Series' : 
            item.media_type === 'anime' ? 'Anime' : 
            item.media_type === 'kdrama' ? 'K-Drama' : defaultType,
      imageUrl: item.poster_url || 'https://via.placeholder.com/300x450/141414/ffffff?text=No+Image',
      url: item.url,
      originalUrl: item.originalUrl,
      year: item.year,
      overview: item.overview,
      vote_average: item.vote_average,
      tmdb_type: item.tmdb_type,
    }));
  };

  useEffect(() => {
    if (activeTab === 'search') {
      let mounted = true;
      const fetchDefaults = async () => {
        try {
          const [hRes, sRes, dRes, tRes, aRes, cRes] = await Promise.all([
            searchVaporpic('', 'movie', 'horror'),
            searchVaporpic('', 'movie', 'sci-fi'),
            searchVaporpic('', 'tv', 'drama'),
            searchVaporpic('', 'movie', 'thriller'),
            searchVaporpic('', 'movie', 'action'),
            searchVaporpic('', 'movie', 'comedy'),
          ]);
          if (mounted) {
            setDefaultHorror(mapResults(hRes.results, 'Movie'));
            setDefaultSciFi(mapResults(sRes.results, 'Movie'));
            setDefaultDrama(mapResults(dRes.results, 'Series'));
            setDefaultThriller(mapResults(tRes.results, 'Movie'));
            setDefaultAction(mapResults(aRes.results, 'Movie'));
            setDefaultComedy(mapResults(cRes.results, 'Movie'));
          }
        } catch(e) { console.error(e); }
      };
      if (defaultHorror.length === 0) fetchDefaults();
      return () => { mounted = false; };
    }
  }, [activeTab]);



  const fetchTrendingMovies = async () => mapResults((await searchVaporpic('', 'movie', undefined, undefined, 1)).results, 'Movie');
  const fetchTrendingTV = async () => mapResults((await searchVaporpic('', 'tv', undefined, undefined, 1)).results, 'Series');
  const fetchPopularAnime = async () => mapResults((await searchVaporpic('', 'anime', undefined, undefined, 1)).results, 'Anime');
  const fetchActionMovies = async () => mapResults((await searchVaporpic('', 'movie', 'action', undefined, 1)).results, 'Movie');
  const fetchComedies = async () => mapResults((await searchVaporpic('', 'movie', 'comedy', undefined, 1)).results, 'Movie');

  useEffect(() => {
    let mounted = true;
    
    // Fetch initial Top 10 for the Hero Carousel
    searchVaporpic('', 'movie', undefined, undefined, 1).then(res => {
      if (mounted && res && res.results) {
        const top10 = res.results.slice(0, 10).map((item: any) => ({
          id: item.id,
          title: item.title,
          type: 'Movie' as const,
          imageUrl: item.backdrop_url || item.poster_url || '',
        }));
        setHeroMedia(top10);
      }
    });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (activeTab === 'home' || activeTab === 'search') return;
    let mounted = true;
    setIsGridLoading(true);
    isFetchingRef.current = true;

    let fetchPromise: Promise<any>;
    if (activeTab === 'movies') fetchPromise = searchVaporpic('', 'movie', selectedGenre || undefined, selectedYear || undefined, gridPage, undefined, selectedRating || undefined);
    else if (activeTab === 'series') fetchPromise = searchVaporpic('', 'tv', selectedGenre || undefined, selectedYear || undefined, gridPage, undefined, selectedRating || undefined);
    else if (activeTab === 'anime') fetchPromise = searchVaporpic('', 'anime', selectedGenre || undefined, selectedYear || undefined, gridPage, undefined, selectedRating || undefined);
    else if (activeTab === 'kdrama') fetchPromise = searchVaporpic('', 'kdrama', selectedGenre || undefined, selectedYear || undefined, gridPage, undefined, selectedRating || undefined);
    else fetchPromise = Promise.resolve({ results: [], total_pages: 1 });

    fetchPromise.then(res => {
      if (mounted) {
        const typeLabel = activeTab === 'movies' ? 'Movie' : activeTab === 'series' ? 'Series' : activeTab === 'anime' ? 'Anime' : 'K-Drama';
        const mapped = mapResults(res.results, typeLabel);
        setGridMedia(prev => {
          if (gridPage === 1) return mapped;
          const existingIds = new Set(prev.map(item => item.id + item.type));
          const newItems = mapped.filter(item => !existingIds.has(item.id + item.type));
          return [...prev, ...newItems];
        });
        if (gridPage >= (res.total_pages || 1)) setHasMoreGrid(false);
        setIsGridLoading(false);
        isFetchingRef.current = false;
      }
    });

    return () => { mounted = false; };
  }, [activeTab, gridPage, selectedGenre, selectedYear, selectedRating]);

  useEffect(() => {
    setGridPage(1);
    setHasMoreGrid(true);
    setGridMedia([]);
  }, [activeTab, selectedGenre, selectedYear, selectedRating]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    setShowBackToTop(scrollTop > 400);
    if (scrollHeight - scrollTop <= clientHeight + 800 && !isFetchingRef.current && hasMoreGrid) {
      if (activeTab !== 'home' && activeTab !== 'search') {
        isFetchingRef.current = true;
        setGridPage(prev => prev + 1);
      }
    }
  };

  const scrollToTop = () => {
    const elements = document.getElementsByClassName('netflix-home');
    if (elements.length > 0) {
      elements[0].scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderBackToTop = () => (
    showBackToTop && (
      <button 
        onClick={scrollToTop}
        className="back-to-top-btn"
        aria-label="Back to top"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m18 15-6-6-6 6"/>
        </svg>
      </button>
    )
  );

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        setIsSearching(true);
        try {
          const [movieRes, tvRes, animeRes] = await Promise.all([
            searchVaporpic(searchQuery, 'movie'),
            searchVaporpic(searchQuery, 'tv'),
            searchVaporpic(searchQuery, 'anime')
          ]);
          const combined = [
            ...mapResults(movieRes.results, 'Movie'),
            ...mapResults(tvRes.results, 'Series'),
            ...mapResults(animeRes.results, 'Anime')
          ];
          setSearchResults(combined);
        } catch (e) {
          console.error(e);
        }
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const renderDetailedCard = (item: MediaItem) => (
    <div 
      key={item.id + item.type} 
      className="row-poster-wrapper"
      onClick={() => setPreviewMedia(item)}
    >
      <img src={item.imageUrl} alt={item.title} className="row-poster" loading="lazy" />
      <div className="media-card-info">
        <h3 className="media-card-title">{item.title}</h3>
        <div className="media-card-meta">
          <span className="media-card-rating">★ {item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</span>
          {item.year && <span className="media-card-dot">· {item.year}</span>}
          <span className="media-card-dot">· {item.type}</span>
        </div>
      </div>
    </div>
  );

  const renderDetailedSkeleton = (key: string) => (
    <div key={key} className="row-poster-wrapper">
      <div className="skeleton-poster" style={{ aspectRatio: '2/3', height: 'auto' }}></div>
    </div>
  );

  if (activeTab === 'search') {
    return (
      <div className="netflix-home" onScroll={handleScroll}>
        <div className="netflix-search-bar">
          <span className="search-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
          </span>
          <input 
            type="text" 
            className="search-bar-input" 
            placeholder="Search movies, series, anime..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>

        {searchQuery.trim() === '' ? (
          <div className="search-default-state">
            <h4 className="popular-searches-title">Popular searches</h4>
            <div className="popular-searches-pills">
              {popularSearches.map(term => (
                <button key={term} className="popular-pill" onClick={() => setSearchQuery(term)}>{term}</button>
              ))}
            </div>
            
            {defaultHorror.length > 0 && (
              <>
                <h3 style={{ paddingLeft: '4%', marginBottom: '16px' }}>Horror</h3>
                <div className="search-results-grid">
                  {defaultHorror.slice(0, 10).map(renderDetailedCard)}
                </div>
              </>
            )}
            {defaultSciFi.length > 0 && (
              <>
                <h3 style={{ paddingLeft: '4%', margin: '40px 0 16px 0' }}>Sci-Fi</h3>
                <div className="search-results-grid">
                  {defaultSciFi.slice(0, 10).map(renderDetailedCard)}
                </div>
              </>
            )}
            {defaultDrama.length > 0 && (
              <>
                <h3 style={{ paddingLeft: '4%', margin: '40px 0 16px 0' }}>Drama</h3>
                <div className="search-results-grid">
                  {defaultDrama.slice(0, 10).map(renderDetailedCard)}
                </div>
              </>
            )}
            {defaultAction.length > 0 && (
              <>
                <h3 style={{ paddingLeft: '4%', margin: '40px 0 16px 0' }}>Action</h3>
                <div className="search-results-grid">
                  {defaultAction.slice(0, 10).map(renderDetailedCard)}
                </div>
              </>
            )}
            {defaultThriller.length > 0 && (
              <>
                <h3 style={{ paddingLeft: '4%', margin: '40px 0 16px 0' }}>Thriller</h3>
                <div className="search-results-grid">
                  {defaultThriller.slice(0, 10).map(renderDetailedCard)}
                </div>
              </>
            )}
            {defaultComedy.length > 0 && (
              <>
                <h3 style={{ paddingLeft: '4%', margin: '40px 0 16px 0' }}>Comedy</h3>
                <div className="search-results-grid">
                  {defaultComedy.slice(0, 10).map(renderDetailedCard)}
                </div>
              </>
            )}
            <div style={{ height: '100px' }}></div>
          </div>
        ) : (
          <div className="search-results-container">
            {isSearching ? (
              <div className="search-results-grid">
                {Array.from({ length: 15 }).map((_, i) => renderDetailedSkeleton('search-skel-' + i))}
              </div>
            ) : searchResults.length > 0 ? (
              <>
                <div className="top-result-container">
                  <div className="top-result-label">Top result</div>
                  <div className="top-result-card" onClick={() => onWatch(searchResults[0])}>
                    <img src={searchResults[0].imageUrl} alt="Top Match" className="top-result-poster" />
                    <div className="top-result-info">
                      <div className="top-match-badge">Top match</div>
                      <h2 className="top-result-title">{searchResults[0].title}</h2>
                      <div className="detailed-meta" style={{ fontSize: '1rem' }}>
                        <span className="star">★</span>
                        <span>{searchResults[0].vote_average ? searchResults[0].vote_average.toFixed(1) : 'N/A'}</span>
                        {searchResults[0].year && <span>• {searchResults[0].year}</span>}
                        <span>• {searchResults[0].type}</span>
                      </div>
                      {searchResults[0].overview && (
                        <p className="top-result-overview">{searchResults[0].overview}</p>
                      )}
                      <div className="top-result-actions">
                        <button className="top-result-btn btn-details" onClick={(e) => { e.stopPropagation(); setPreviewMedia(searchResults[0]); }}>ⓘ Details</button>
                        <button className="top-result-btn btn-watchlist" onClick={(e) => { e.stopPropagation(); }}>+ Watchlist</button>
                      </div>
                    </div>
                  </div>
                </div>

                {searchResults.length > 1 && (
                  <div className="more-results-container">
                    <div className="more-results-label">
                      <div>
                        <h3>More results</h3>
                        <p>More titles matching "{searchQuery}"</p>
                      </div>
                      <div className="results-count-pill">{searchResults.length - 1} results</div>
                    </div>
                    <div className="search-results-grid">
                      {searchResults.slice(1).map(renderDetailedCard)}
                    </div>
                  </div>
                )}
                <div style={{ height: '100px' }}></div>
              </>
            ) : (
              <div style={{ color: '#888', paddingLeft: '4%' }}>No results found.</div>
            )}
          </div>
        )}
        {previewMedia && (
          <PreviewModal 
            media={previewMedia} 
            onClose={() => setPreviewMedia(null)} 
            onWatch={(m) => { setPreviewMedia(null); onWatch(m); }} 
          />
        )}
        {renderBackToTop()}
      </div>
    );
  }

  if (activeTab !== 'home') {
    return (
      <div className="netflix-home" onScroll={handleScroll}>
        <div className="search-results-container" style={{ minHeight: '100vh', paddingTop: '50px' }}>
          <div className="tab-header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '4%', paddingRight: '4%', marginBottom: '20px' }}>
            <h2 className="row-title" style={{ textTransform: 'capitalize', fontSize: '2rem', margin: 0, padding: 0 }}>
              {activeTab === 'kdrama' ? 'K-Drama' : activeTab}
            </h2>
            
            <div className="movie-filters">
                <select 
                  className="filter-dropdown"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', cursor: 'pointer', outline: 'none' }}
                  value={selectedYear} 
                  onChange={e => { setSelectedYear(e.target.value); setGridPage(1); setGridMedia([]); }}
                >
                  <option value="" style={{ color: 'black' }}>All Years</option>
                  {Array.from({ length: 30 }).map((_, i) => {
                    const year = new Date().getFullYear() - i + 2; // +2 for unreleased/upcoming
                    return <option key={year} value={year} style={{ color: 'black' }}>{year}</option>;
                  })}
                </select>
                
                <select 
                  className="filter-dropdown"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', cursor: 'pointer', outline: 'none' }}
                  value={selectedGenre} 
                  onChange={e => { setSelectedGenre(e.target.value); setGridPage(1); setGridMedia([]); }}
                >
                  <option value="" style={{ color: 'black' }}>All Genres</option>
                  {(activeTab === 'anime' 
                    ? ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Harem', 'Horror', 'Isekai', 'Josei', 'Mystery', 'Romance', 'Sci-Fi', 'Seinen', 'Shonen', 'Shojo', 'Slice of Life']
                    : ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller']
                  ).map(genre => (
                    <option key={genre} value={genre} style={{ color: 'black' }}>{genre}</option>
                  ))}
                </select>
                
                <select 
                  className="filter-dropdown"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', cursor: 'pointer', outline: 'none' }}
                  value={selectedRating} 
                  onChange={e => { setSelectedRating(e.target.value); setGridPage(1); setGridMedia([]); }}
                >
                  <option value="" style={{ color: 'black' }}>All Ratings</option>
                  <option value="9" style={{ color: 'black' }}>9+</option>
                  <option value="8" style={{ color: 'black' }}>8+</option>
                  <option value="7" style={{ color: 'black' }}>7+</option>
                  <option value="6" style={{ color: 'black' }}>6+</option>
                  <option value="5" style={{ color: 'black' }}>5+</option>
                </select>
              </div>
          </div>
          
          {isGridLoading && gridPage === 1 ? (
            <div className="search-results-grid">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={'skeleton-init-' + i} className="row-poster-wrapper">
                  <div className="skeleton-poster" style={{ aspectRatio: '2/3', height: 'auto' }}></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="search-results-grid">
              {gridMedia.map(item => (
                <div 
                  key={item.id + item.type} 
                  className="row-poster-wrapper"
                  onClick={() => setPreviewMedia(item)}
                >
                  <img src={item.imageUrl} alt={item.title} className="row-poster" loading="lazy" style={{ aspectRatio: '2/3' }} />
                  <div className="media-card-info">
                    <h3 className="media-card-title">{item.title}</h3>
                    <div className="media-card-meta">
                      <span className="media-card-rating">★ {item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}</span>
                      {item.year && <span className="media-card-dot">· {item.year}</span>}
                      <span className="media-card-dot">· {item.type}</span>
                    </div>
                  </div>
                </div>
              ))}
              {isGridLoading && gridPage > 1 && (
                Array.from({ length: 10 }).map((_, i) => (
                  <div key={'skeleton-' + i} className="row-poster-wrapper">
                    <div className="skeleton-poster" style={{ aspectRatio: '2/3', height: 'auto' }}></div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        {previewMedia && (
          <PreviewModal 
            media={previewMedia} 
            onClose={() => setPreviewMedia(null)} 
            onWatch={(m) => { setPreviewMedia(null); onWatch(m); }} 
          />
        )}
        {renderBackToTop()}
      </div>
    );
  }

  return (
    <div className="netflix-home" onScroll={handleScroll}>
      <HeroBanner mediaItems={heroMedia} onWatch={onWatch} />
      
      <div className="netflix-rows-container">
        <Top10Row onSelectItem={setPreviewMedia} />
        <MediaRow title="Trending Movies" fetchData={fetchTrendingMovies} onSelectItem={setPreviewMedia} />
        <MediaRow title="Trending Series" fetchData={fetchTrendingTV} onSelectItem={setPreviewMedia} />
        <MediaRow title="Popular Anime" fetchData={fetchPopularAnime} onSelectItem={setPreviewMedia} />
        <MediaRow title="Action Packed" fetchData={fetchActionMovies} onSelectItem={setPreviewMedia} />
        <MediaRow title="Comedies" fetchData={fetchComedies} onSelectItem={setPreviewMedia} />
      </div>

      {previewMedia && (
        <PreviewModal 
          media={previewMedia} 
          onClose={() => setPreviewMedia(null)} 
          onWatch={(m) => { setPreviewMedia(null); onWatch(m); }} 
        />
      )}
      {renderBackToTop()}
    </div>
  );
};

export default NetflixHome;
