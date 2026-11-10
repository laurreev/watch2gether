import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  detectDefaultLocalCountry,
  fetchFeaturedTvShelves,
  fetchTvChannels,
  fetchTvMeta,
  type TvChannel,
  type TvFeaturedShelves,
  type TvMeta,
} from '../services/television';
import LiveTvVideo from './LiveTvVideo';
import './TelevisionView.css';

interface TelevisionViewProps {
  onWatchTogether: (channel: TvChannel) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  all: '📺',
  cartoons: '🎨',
  wildlife: '🦁',
  sports: '⚽',
  news: '📰',
  movies: '🎬',
  documentary: '🌍',
  music: '🎵',
  entertainment: '✨',
  general: '📡',
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  'Cartoons & Kids': 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
  'Wildlife & Nature': 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
  Sports: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
  News: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  'Movies & Series': 'linear-gradient(135deg, #e50914 0%, #7f1d1d 100%)',
  'Documentary & Science': 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)',
  Music: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
  Entertainment: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
  General: 'linear-gradient(135deg, #475569 0%, #1e293b 100%)',
};

function getChannelMonogram(name: string): string {
  const words = name
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'TV';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const ChannelLogoInner: React.FC<{
  src?: string;
  name: string;
  category?: string;
  className?: string;
}> = ({ src, name, category = 'General', className = 'tv-logo-img' }) => {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        className={className}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="tv-logo-fallback"
      style={{
        background: CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.General,
      }}
    >
      {getChannelMonogram(name)}
    </div>
  );
};

export const ChannelLogo: React.FC<{
  channelId: string;
  src?: string;
  name: string;
  category?: string;
  className?: string;
}> = ({ channelId, src, name, category, className }) => (
  <ChannelLogoInner key={`${channelId}-${src || ''}`} src={src} name={name} category={category} className={className} />
);

interface ChannelShelfProps {
  title: string;
  icon: string;
  channels: TvChannel[];
  localCountry: string;
  activeChannelId?: string;
  onSelectChannel: (channel: TvChannel) => void;
  onWatchTogether: (channel: TvChannel) => void;
  onSeeAll?: () => void;
}

const ChannelShelf: React.FC<ChannelShelfProps> = ({
  title,
  icon,
  channels,
  localCountry,
  activeChannelId,
  onSelectChannel,
  onWatchTogether,
  onSeeAll,
}) => {
  const rowRef = useRef<HTMLDivElement | null>(null);

  if (!channels || channels.length === 0) return null;

  const scrollRow = (dir: 'left' | 'right') => {
    if (!rowRef.current) return;
    const { scrollLeft, clientWidth } = rowRef.current;
    rowRef.current.scrollTo({
      left: dir === 'left' ? scrollLeft - clientWidth * 0.78 : scrollLeft + clientWidth * 0.78,
      behavior: 'smooth',
    });
  };

  return (
    <section className="tv-shelf">
      <div className="tv-shelf-header">
        <h2 className="tv-shelf-title">
          <span>{icon}</span>
          <span>{title}</span>
        </h2>
        {onSeeAll && (
          <button type="button" className="tv-shelf-see-all" onClick={onSeeAll}>
            Browse all →
          </button>
        )}
      </div>

      <div className="tv-shelf-scroller">
        <button
          type="button"
          className="tv-shelf-arrow left"
          onClick={() => scrollRow('left')}
          aria-label={`Scroll ${title} left`}
        >
          ‹
        </button>

        <div className="tv-shelf-row" ref={rowRef}>
          {channels.map((ch) => {
            const isLocal = ch.country === localCountry;
            const isPlaying = activeChannelId === ch.id;
            return (
              <div
                key={ch.id}
                className={`tv-channel-card ${isPlaying ? 'playing' : ''}`}
                onClick={() => onSelectChannel(ch)}
              >
                <div className="tv-card-stage">
                  <ChannelLogo
                    channelId={ch.id}
                    src={ch.logo}
                    name={ch.name}
                    category={ch.primaryCategory}
                  />
                  <div className="tv-card-badges-top">
                    <div className="tv-badge-group">
                      <span className="tv-mini-badge live">● LIVE</span>
                      {isLocal && <span className="tv-mini-badge local">LOCAL</span>}
                    </div>
                    {ch.quality && <span className="tv-mini-badge">{ch.quality}</span>}
                  </div>
                  <div className="tv-card-hover-play">
                    <span className="tv-play-circle">▶</span>
                  </div>
                </div>

                <div className="tv-card-body">
                  <div>
                    <h3 className="tv-card-title" title={ch.name}>
                      {ch.name}
                    </h3>
                    <div className="tv-card-meta-row">
                      <span className="tv-card-country" title={ch.countryName}>
                        {ch.flag} {ch.countryName}
                      </span>
                      <span className="tv-card-cat-tag">{ch.primaryCategory}</span>
                    </div>
                  </div>
                  <div className="tv-card-footer-actions">
                    <button
                      type="button"
                      className="tv-card-action-btn watch"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectChannel(ch);
                      }}
                    >
                      ▶ Watch
                    </button>
                    <button
                      type="button"
                      className="tv-card-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onWatchTogether(ch);
                      }}
                    >
                      👥 Room
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="tv-shelf-arrow right"
          onClick={() => scrollRow('right')}
          aria-label={`Scroll ${title} right`}
        >
          ›
        </button>
      </div>
    </section>
  );
};

const TelevisionView: React.FC<TelevisionViewProps> = ({ onWatchTogether }) => {
  const viewRef = useRef<HTMLDivElement | null>(null);

  const [localCountry, setLocalCountry] = useState<string>(() => detectDefaultLocalCountry());
  const [meta, setMeta] = useState<TvMeta | null>(null);
  const [shelves, setShelves] = useState<TvFeaturedShelves | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const [scope, setScope] = useState<'all' | 'local' | 'international'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');

  const [channels, setChannels] = useState<TvChannel[]>([]);
  const [totalChannels, setTotalChannels] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isGridLoading, setIsGridLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');

  const [activeChannel, setActiveChannel] = useState<TvChannel | null>(null);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState<boolean>(false);
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);

  // Debounce search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setPage(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch metadata and featured shelves whenever localCountry changes
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchTvMeta(localCountry, controller.signal),
      fetchFeaturedTvShelves(localCountry, controller.signal),
    ])
      .then(([metaData, shelfData]) => {
        setMeta(metaData);
        setShelves(shelfData);
        setLoadError('');
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setLoadError('Unable to load Television directory. Please try again.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsInitialLoading(false);
        }
      });

    return () => controller.abort();
  }, [localCountry]);

  // Fetch paginated directory channels when filters or page change
  useEffect(() => {
    const controller = new AbortController();
    fetchTvChannels(
      {
        category: selectedCategory,
        scope,
        country: selectedCountry || undefined,
        localCountry,
        q: debouncedQuery || undefined,
        page,
        limit: 48,
      },
      controller.signal
    )
      .then((res) => {
        setChannels((prev) => {
          if (page === 1) return res.channels;
          const seen = new Set(prev.map((c) => c.id));
          const extra = res.channels.filter((c) => !seen.has(c.id));
          return [...prev, ...extra];
        });
        setTotalChannels(res.total);
        setHasMore(res.hasMore);
        setLoadError('');
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setLoadError('Failed to fetch live channels.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsGridLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedCategory, scope, selectedCountry, localCountry, debouncedQuery, page]);

  const handleSelectLocalCountry = (code: string) => {
    localStorage.setItem('watch2gether_local_country', code);
    setLocalCountry(code);
    setSelectedCountry('');
    setPage(1);
    setChannels([]);
    setIsGridLoading(true);
  };

  const handleScopeChange = (nextScope: 'all' | 'local' | 'international') => {
    setScope(nextScope);
    setSelectedCountry('');
    setPage(1);
    setChannels([]);
    setIsGridLoading(true);
  };

  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    setPage(1);
    setChannels([]);
    setIsGridLoading(true);
  };

  const handleCountryFilterChange = (countryCode: string) => {
    setSelectedCountry(countryCode);
    setScope('all');
    setPage(1);
    setChannels([]);
    setIsGridLoading(true);
  };

  const handleClearFilters = () => {
    setSelectedCategory('all');
    setScope('all');
    setSelectedCountry('');
    setSearchInput('');
    setDebouncedQuery('');
    setPage(1);
    setChannels([]);
    setIsGridLoading(true);
  };

  const handlePlayChannel = useCallback((channel: TvChannel) => {
    setActiveChannel(channel);
    viewRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Combined channel guide list for the active player EPG sidebar
  const guideChannels = useMemo(() => {
    const merged: TvChannel[] = [];
    const seen = new Set<string>();
    const pushUnique = (list?: TvChannel[]) => {
      if (!list) return;
      for (const ch of list) {
        if (!seen.has(ch.id)) {
          seen.add(ch.id);
          merged.push(ch);
        }
      }
    };
    if (activeChannel) pushUnique([activeChannel]);
    pushUnique(channels);
    if (shelves) {
      pushUnique(shelves.local);
      pushUnique(shelves.cartoons);
      pushUnique(shelves.wildlife);
      pushUnique(shelves.sports);
      pushUnique(shelves.international);
    }
    return merged.slice(0, 60);
  }, [activeChannel, channels, shelves]);

  const surfChannel = useCallback(
    (direction: 'prev' | 'next') => {
      if (!activeChannel || guideChannels.length < 2) return;
      const idx = guideChannels.findIndex((c) => c.id === activeChannel.id);
      if (idx === -1) {
        setActiveChannel(guideChannels[0]);
        return;
      }
      const nextIdx =
        direction === 'next'
          ? (idx + 1) % guideChannels.length
          : (idx - 1 + guideChannels.length) % guideChannels.length;
      setActiveChannel(guideChannels[nextIdx]);
    },
    [activeChannel, guideChannels]
  );

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    setShowBackToTop(scrollTop > 450);
    if (scrollHeight - scrollTop <= clientHeight + 650 && !isGridLoading && hasMore) {
      setIsGridLoading(true);
      setPage((prev) => prev + 1);
    }
  };

  const localCountryInfo = useMemo(() => {
    return meta?.countries.find((c) => c.code === localCountry) || {
      code: localCountry,
      name: localCountry,
      flag: '📍',
      count: meta?.localCount || 0,
    };
  }, [meta, localCountry]);

  const isDefaultBrowse =
    scope === 'all' && selectedCategory === 'all' && !selectedCountry && !debouncedQuery;

  const activeCategoryName =
    meta?.categories.find((c) => c.id === selectedCategory)?.name || 'All Channels';

  return (
    <div className="tv-view" ref={viewRef} onScroll={handleScroll}>
      <div className="tv-content-inner">
        {/* Studio Header + Scope + Local Region + Search */}
        <header className="tv-hero-header">
          <div className="tv-hero-top">
            <div className="tv-title-group">
              <div className="tv-title-row">
                <h1 className="tv-title">
                  <span>📺</span>
                  <span>Live Television</span>
                </h1>
                <span className="tv-live-badge">
                  <span className="tv-live-badge-dot" />
                  {meta ? `${meta.totalChannels.toLocaleString()} LIVE CHANNELS` : 'TUNING DIRECTORY...'}
                </span>
              </div>
              <p className="tv-subtitle">
                Stream cartoons, wildlife &amp; nature, live sports, news, and entertainment from local &amp; international broadcasters.
              </p>
            </div>

            {meta && (
              <div className="tv-region-selector">
                <span className="tv-region-label">My Local Region:</span>
                <select
                  className="tv-select"
                  value={localCountry}
                  onChange={(e) => handleSelectLocalCountry(e.target.value)}
                  aria-label="My Local Region"
                >
                  {meta.countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.count})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="tv-controls-row">
            <div className="tv-scope-pills" role="tablist" aria-label="Channel Origin">
              <button
                type="button"
                className={`tv-scope-btn ${scope === 'all' ? 'active' : ''}`}
                onClick={() => handleScopeChange('all')}
              >
                <span>📡</span>
                <span>All Channels</span>
                {meta && <span className="tv-count-pill">{meta.totalChannels.toLocaleString()}</span>}
              </button>
              <button
                type="button"
                className={`tv-scope-btn ${scope === 'local' ? 'active' : ''}`}
                onClick={() => handleScopeChange('local')}
              >
                <span>{localCountryInfo.flag}</span>
                <span>Local ({localCountryInfo.name})</span>
                {meta && <span className="tv-count-pill">{meta.localCount.toLocaleString()}</span>}
              </button>
              <button
                type="button"
                className={`tv-scope-btn ${scope === 'international' ? 'active' : ''}`}
                onClick={() => handleScopeChange('international')}
              >
                <span>🌍</span>
                <span>International</span>
                {meta && <span className="tv-count-pill">{meta.internationalCount.toLocaleString()}</span>}
              </button>
            </div>

            <div className="tv-search-filter-group">
              <div className="tv-search-box">
                <span className="tv-search-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="tv-search-input"
                  placeholder="Search channels, cartoons, sports, country..."
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setIsGridLoading(true);
                  }}
                />
                {searchInput && (
                  <button
                    type="button"
                    className="tv-search-clear"
                    onClick={() => {
                      setSearchInput('');
                      setDebouncedQuery('');
                      setPage(1);
                      setIsGridLoading(true);
                    }}
                    aria-label="Clear channel search"
                  >
                    ×
                  </button>
                )}
              </div>

              {meta && (
                <select
                  className="tv-select"
                  value={selectedCountry}
                  onChange={(e) => handleCountryFilterChange(e.target.value)}
                  aria-label="Filter by Country"
                >
                  <option value="">All Countries ({meta.countries.length})</option>
                  {meta.countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.count})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="tv-category-bar">
            {(meta?.categories || [
              { id: 'all', name: 'All Channels', count: 0 },
              { id: 'cartoons', name: 'Cartoons & Kids', count: 0 },
              { id: 'wildlife', name: 'Wildlife & Nature', count: 0 },
              { id: 'sports', name: 'Sports', count: 0 },
              { id: 'news', name: 'News', count: 0 },
              { id: 'movies', name: 'Movies & Series', count: 0 },
              { id: 'documentary', name: 'Documentary & Science', count: 0 },
              { id: 'music', name: 'Music', count: 0 },
              { id: 'entertainment', name: 'Entertainment', count: 0 },
              { id: 'general', name: 'General', count: 0 },
            ]).map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`tv-cat-pill ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => handleCategoryChange(cat.id)}
              >
                <span>{CATEGORY_ICONS[cat.id] || '📺'}</span>
                <span>{cat.name}</span>
                {cat.count > 0 && <span className="tv-count-pill">{cat.count.toLocaleString()}</span>}
              </button>
            ))}
          </div>
        </header>

        {/* Active Live TV Player + Channel Guide EPG */}
        {activeChannel && (
          <section className={`tv-player-workspace ${isPlayerExpanded ? 'expanded' : ''}`}>
            <div className="tv-player-main">
              <div className="tv-player-frame">
                <LiveTvVideo
                  channel={activeChannel}
                  onNextChannel={() => surfChannel('next')}
                />
              </div>

              <div className="tv-now-playing-bar">
                <div className="tv-now-playing-meta">
                  <div className="tv-now-logo">
                    <ChannelLogo
                      channelId={activeChannel.id}
                      src={activeChannel.logo}
                      name={activeChannel.name}
                      category={activeChannel.primaryCategory}
                    />
                  </div>
                  <div className="tv-now-text">
                    <h2 className="tv-now-title">{activeChannel.name}</h2>
                    <div className="tv-now-sub">
                      <span>
                        {activeChannel.flag} {activeChannel.countryName}
                      </span>
                      <span>•</span>
                      <span>{activeChannel.primaryCategory}</span>
                      {activeChannel.quality && (
                        <>
                          <span>•</span>
                          <span>{activeChannel.quality}</span>
                        </>
                      )}
                      {activeChannel.streams.length > 1 && (
                        <>
                          <span>•</span>
                          <span>{activeChannel.streams.length} Feeds</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="tv-now-actions">
                  <button
                    type="button"
                    className="tv-btn tv-btn-secondary"
                    onClick={() => surfChannel('prev')}
                    disabled={guideChannels.length < 2}
                  >
                    ⏮ Prev
                  </button>
                  <button
                    type="button"
                    className="tv-btn tv-btn-secondary"
                    onClick={() => surfChannel('next')}
                    disabled={guideChannels.length < 2}
                  >
                    Next ⏭
                  </button>
                  <button
                    type="button"
                    className="tv-btn tv-btn-indigo"
                    onClick={() => onWatchTogether(activeChannel)}
                  >
                    👥 Watch Together
                  </button>
                  <button
                    type="button"
                    className="tv-btn tv-btn-secondary"
                    onClick={() => setIsPlayerExpanded((v) => !v)}
                  >
                    {isPlayerExpanded ? 'Show Guide' : 'Hide Guide'}
                  </button>
                  <button
                    type="button"
                    className="tv-btn tv-btn-secondary"
                    onClick={() => setActiveChannel(null)}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>
            </div>

            {!isPlayerExpanded && (
              <aside className="tv-guide-panel" aria-label="Channel Guide">
                <div className="tv-guide-header">
                  <h3>Channel Guide</h3>
                  <span className="tv-guide-count">{guideChannels.length} channels</span>
                </div>
                <div className="tv-guide-list">
                  {guideChannels.map((ch) => {
                    const isCurrent = ch.id === activeChannel.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        className={`tv-guide-item ${isCurrent ? 'active' : ''}`}
                        onClick={() => setActiveChannel(ch)}
                      >
                        <div className="tv-guide-thumb">
                          <ChannelLogo
                            channelId={ch.id}
                            src={ch.logo}
                            name={ch.name}
                            category={ch.primaryCategory}
                          />
                        </div>
                        <div className="tv-guide-info">
                          <span className="tv-guide-name">{ch.name}</span>
                          <span className="tv-guide-meta">
                            {ch.flag} {ch.countryName} · {ch.primaryCategory}
                          </span>
                        </div>
                        {isCurrent && (
                          <span className="tv-eq-bars" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </aside>
            )}
          </section>
        )}

        {loadError && !isInitialLoading && (
          <div className="tv-empty-state">
            <p>{loadError}</p>
            <button type="button" className="tv-btn tv-btn-primary" onClick={handleClearFilters}>
              Retry
            </button>
          </div>
        )}

        {/* Featured Curated Shelves on Default Overview */}
        {isDefaultBrowse && shelves && (
          <div className="tv-shelves-stack">
            {shelves.local.length > 0 && (
              <ChannelShelf
                title={`Local Channels (${localCountryInfo.name})`}
                icon={localCountryInfo.flag}
                channels={shelves.local}
                localCountry={localCountry}
                activeChannelId={activeChannel?.id}
                onSelectChannel={handlePlayChannel}
                onWatchTogether={onWatchTogether}
                onSeeAll={() => handleScopeChange('local')}
              />
            )}
            <ChannelShelf
              title="Cartoons & Kids"
              icon="🎨"
              channels={shelves.cartoons}
              localCountry={localCountry}
              activeChannelId={activeChannel?.id}
              onSelectChannel={handlePlayChannel}
              onWatchTogether={onWatchTogether}
              onSeeAll={() => handleCategoryChange('cartoons')}
            />
            <ChannelShelf
              title="Wildlife & Nature"
              icon="🦁"
              channels={shelves.wildlife}
              localCountry={localCountry}
              activeChannelId={activeChannel?.id}
              onSelectChannel={handlePlayChannel}
              onWatchTogether={onWatchTogether}
              onSeeAll={() => handleCategoryChange('wildlife')}
            />
            <ChannelShelf
              title="Live Sports"
              icon="⚽"
              channels={shelves.sports}
              localCountry={localCountry}
              activeChannelId={activeChannel?.id}
              onSelectChannel={handlePlayChannel}
              onWatchTogether={onWatchTogether}
              onSeeAll={() => handleCategoryChange('sports')}
            />
            <ChannelShelf
              title="International Highlights"
              icon="🌍"
              channels={shelves.international}
              localCountry={localCountry}
              activeChannelId={activeChannel?.id}
              onSelectChannel={handlePlayChannel}
              onWatchTogether={onWatchTogether}
              onSeeAll={() => handleScopeChange('international')}
            />
          </div>
        )}

        {/* Full / Filtered Directory Grid */}
        <section className="tv-grid-section">
          <div className="tv-grid-header">
            <h2 className="tv-grid-title">
              <span>{CATEGORY_ICONS[selectedCategory] || '📺'}</span>
              <span>
                {selectedCountry
                  ? `${meta?.countries.find((c) => c.code === selectedCountry)?.flag || ''} ${
                      meta?.countries.find((c) => c.code === selectedCountry)?.name || selectedCountry
                    } — ${activeCategoryName}`
                  : scope === 'local'
                    ? `${localCountryInfo.flag} Local ${activeCategoryName}`
                    : scope === 'international'
                      ? `🌍 International ${activeCategoryName}`
                      : isDefaultBrowse
                        ? 'All Live Channels Directory'
                        : activeCategoryName}
              </span>
              <span className="tv-grid-count">{totalChannels.toLocaleString()} found</span>
            </h2>

            {!isDefaultBrowse && (
              <button type="button" className="tv-btn tv-btn-secondary" onClick={handleClearFilters}>
                Reset Filters
              </button>
            )}
          </div>

          {isGridLoading && page === 1 && channels.length === 0 ? (
            <div className="tv-channels-grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={`skel-${i}`} className="tv-card-skeleton">
                  <div className="tv-skel-stage" />
                  <div className="tv-skel-lines">
                    <div className="tv-skel-line" style={{ width: '72%' }} />
                    <div className="tv-skel-line" style={{ width: '48%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : channels.length === 0 ? (
            <div className="tv-empty-state">
              <div style={{ fontSize: '2.2rem' }}>📡</div>
              <p style={{ margin: 0, color: '#fff', fontWeight: 600 }}>No live channels match these filters.</p>
              <p style={{ margin: 0, fontSize: '0.88rem' }}>
                Try clearing the search query or switching between Local &amp; International channels.
              </p>
              <button type="button" className="tv-btn tv-btn-primary" onClick={handleClearFilters}>
                Show All Channels
              </button>
            </div>
          ) : (
            <>
              <div className="tv-channels-grid">
                {channels.map((ch) => {
                  const isLocal = ch.country === localCountry;
                  const isPlaying = activeChannel?.id === ch.id;
                  return (
                    <div
                      key={ch.id}
                      className={`tv-channel-card ${isPlaying ? 'playing' : ''}`}
                      onClick={() => handlePlayChannel(ch)}
                    >
                      <div className="tv-card-stage">
                        <ChannelLogo
                          channelId={ch.id}
                          src={ch.logo}
                          name={ch.name}
                          category={ch.primaryCategory}
                        />
                        <div className="tv-card-badges-top">
                          <div className="tv-badge-group">
                            <span className="tv-mini-badge live">● LIVE</span>
                            {isLocal && <span className="tv-mini-badge local">LOCAL</span>}
                          </div>
                          {ch.quality && <span className="tv-mini-badge">{ch.quality}</span>}
                        </div>
                        <div className="tv-card-hover-play">
                          <span className="tv-play-circle">▶</span>
                        </div>
                      </div>

                      <div className="tv-card-body">
                        <div>
                          <h3 className="tv-card-title" title={ch.name}>
                            {ch.name}
                          </h3>
                          <div className="tv-card-meta-row">
                            <span className="tv-card-country" title={ch.countryName}>
                              {ch.flag} {ch.countryName}
                            </span>
                            <span className="tv-card-cat-tag">{ch.primaryCategory}</span>
                          </div>
                        </div>
                        <div className="tv-card-footer-actions">
                          <button
                            type="button"
                            className="tv-card-action-btn watch"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayChannel(ch);
                            }}
                          >
                            ▶ Watch
                          </button>
                          <button
                            type="button"
                            className="tv-card-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onWatchTogether(ch);
                            }}
                          >
                            👥 Room
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasMore && (
                <div className="tv-load-more-row">
                  <button
                    type="button"
                    className="tv-btn tv-btn-secondary"
                    disabled={isGridLoading}
                    onClick={() => {
                      setIsGridLoading(true);
                      setPage((prev) => prev + 1);
                    }}
                  >
                    {isGridLoading ? 'Loading more channels...' : 'Load More Channels'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {showBackToTop && (
        <button
          type="button"
          className="tv-back-to-top"
          onClick={() => viewRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
};

interface LiveTvPickerModalProps {
  onSelectChannel: (channel: TvChannel) => void;
  onClose: () => void;
}

export const LiveTvPickerModal: React.FC<LiveTvPickerModalProps> = ({ onSelectChannel, onClose }) => {
  const [localCountry] = useState<string>(() => detectDefaultLocalCountry());
  const [scope, setScope] = useState<'all' | 'local' | 'international'>('all');
  const [category, setCategory] = useState<string>('all');
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [channels, setChannels] = useState<TvChannel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTvChannels(
      {
        category,
        scope,
        localCountry,
        q: debouncedQuery || undefined,
        page: 1,
        limit: 48,
      },
      controller.signal
    )
      .then((res) => setChannels(res.channels))
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [category, scope, localCountry, debouncedQuery]);

  const pickerCategories = [
    { id: 'all', label: '📺 All' },
    { id: 'cartoons', label: '🎨 Cartoons' },
    { id: 'wildlife', label: '🦁 Wildlife' },
    { id: 'sports', label: '⚽ Sports' },
    { id: 'news', label: '📰 News' },
    { id: 'movies', label: '🎬 Movies' },
    { id: 'documentary', label: '🌍 Documentary' },
    { id: 'music', label: '🎵 Music' },
    { id: 'entertainment', label: '✨ Entertainment' },
  ];

  return (
    <div className="tv-picker-overlay" onClick={onClose}>
      <div className="tv-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tv-picker-header">
          <h2>📺 Pick a Live TV Channel</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close Live TV Picker">
            ×
          </button>
        </div>

        <div className="tv-picker-controls">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
            <div className="tv-search-box" style={{ flex: 1, maxWidth: 'none' }}>
              <span className="tv-search-icon">🔍</span>
              <input
                type="text"
                className="tv-search-input"
                placeholder="Search Live TV channels (cartoons, wildlife, sports, local...)"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setIsLoading(true);
                }}
                autoFocus
              />
            </div>

            <div className="tv-scope-pills">
              {(['all', 'local', 'international'] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  className={`tv-scope-btn ${scope === sc ? 'active' : ''}`}
                  onClick={() => {
                    setScope(sc);
                    setIsLoading(true);
                  }}
                >
                  {sc === 'all' ? 'All' : sc === 'local' ? `Local (${localCountry})` : 'International'}
                </button>
              ))}
            </div>
          </div>

          <div className="tv-category-bar">
            {pickerCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`tv-cat-pill ${category === c.id ? 'active' : ''}`}
                onClick={() => {
                  setCategory(c.id);
                  setIsLoading(true);
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tv-picker-grid">
          {isLoading ? (
            Array.from({ length: 12 }).map((_, i) => (
              <div key={`p-skel-${i}`} className="tv-card-skeleton">
                <div className="tv-skel-stage" />
                <div className="tv-skel-lines">
                  <div className="tv-skel-line" style={{ width: '70%' }} />
                </div>
              </div>
            ))
          ) : channels.length === 0 ? (
            <div className="tv-empty-state" style={{ gridColumn: '1 / -1' }}>
              No channels found for this filter.
            </div>
          ) : (
            channels.map((ch) => (
              <div
                key={ch.id}
                className="tv-channel-card"
                onClick={() => {
                  onSelectChannel(ch);
                  onClose();
                }}
              >
                <div className="tv-card-stage">
                  <ChannelLogo
                    channelId={ch.id}
                    src={ch.logo}
                    name={ch.name}
                    category={ch.primaryCategory}
                  />
                  <div className="tv-card-badges-top">
                    <span className="tv-mini-badge live">● LIVE</span>
                    {ch.quality && <span className="tv-mini-badge">{ch.quality}</span>}
                  </div>
                  <div className="tv-card-hover-play">
                    <span className="tv-play-circle">▶</span>
                  </div>
                </div>
                <div className="tv-card-body">
                  <h3 className="tv-card-title">{ch.name}</h3>
                  <div className="tv-card-meta-row">
                    <span className="tv-card-country">
                      {ch.flag} {ch.countryName}
                    </span>
                    <span className="tv-card-cat-tag">{ch.primaryCategory}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TelevisionView;

