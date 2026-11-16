import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  type PbbFeed,
  type PbbMeta,
  DEFAULT_PBB_META,
  fetchPbbMeta,
  getCustomPbbFeeds,
  saveCustomPbbFeed,
  deleteCustomPbbFeed,
  pbbFeedToPlayableChannel,
} from '../services/pbb';
import { LiveTvVideo } from './LiveTvVideo';
import './PbbStreamView.css';

interface PbbStreamViewProps {
  onWatchTogether: (channel: any) => void;
}

const PbbEyeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3.5" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

const QuadGridIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);

const SingleViewIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);

const FullscreenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const ExitFullscreenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

export const PbbStreamView: React.FC<PbbStreamViewProps> = ({ onWatchTogether }) => {
  const [meta, setMeta] = useState<PbbMeta>(DEFAULT_PBB_META);
  const [customFeeds, setCustomFeeds] = useState<PbbFeed[]>(() => getCustomPbbFeeds());
  const [activeFeedId, setActiveFeedId] = useState<string>('pbb-cam-1');
  const [isQuadView, setIsQuadView] = useState<boolean>(false);
  const [isPip, setIsPip] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // Form states for custom feed
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customAngle, setCustomAngle] = useState('Custom Angle');

  useEffect(() => {
    const controller = new AbortController();
    fetchPbbMeta(controller.signal)
      .then((data) => {
        setMeta(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const allFeeds = useMemo(() => {
    return [...customFeeds, ...meta.feeds];
  }, [customFeeds, meta.feeds]);

  const activeFeed = useMemo(() => {
    return allFeeds.find((f) => f.id === activeFeedId) || allFeeds[0] || DEFAULT_PBB_META.feeds[0];
  }, [allFeeds, activeFeedId]);

  const playableChannel = useMemo(() => {
    return pbbFeedToPlayableChannel(activeFeed);
  }, [activeFeed]);

  const handleSelectFeed = useCallback((feed: PbbFeed) => {
    setActiveFeedId(feed.id);
    setIsQuadView(false);
  }, []);

  const handleWatchFeedTogether = useCallback((feed: PbbFeed) => {
    if (feed.type === 'youtube') {
      onWatchTogether({
        id: feed.id,
        title: feed.name,
        type: 'YouTube',
        url: feed.url,
      });
    } else {
      const channel = pbbFeedToPlayableChannel(feed);
      onWatchTogether(channel);
    }
  }, [onWatchTogether]);

  const handleAddCustomFeed = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = customUrl.trim();
    if (!cleanUrl) return;

    const isYt = /youtube\.com|youtu\.be/i.test(cleanUrl);
    let finalUrl = cleanUrl;
    if (isYt && cleanUrl.includes('watch?v=')) {
      const videoId = cleanUrl.split('watch?v=')[1]?.split('&')[0];
      finalUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    }

    const newFeed: PbbFeed = {
      id: `custom-${Date.now()}`,
      name: customName.trim() || 'Custom PBB Stream',
      shortName: customAngle.trim() || 'Custom Feed',
      angle: customAngle.trim() || 'Custom Camera',
      icon: '🔗',
      description: `User-added stream URL: ${cleanUrl}`,
      type: isYt ? 'youtube' : 'hls',
      quality: 'HD',
      isLive: true,
      badge: 'CUSTOM',
      url: finalUrl,
      isCustom: true,
    };

    const updated = saveCustomPbbFeed(newFeed);
    setCustomFeeds(updated);
    setActiveFeedId(newFeed.id);
    setShowAddModal(false);
    setCustomName('');
    setCustomUrl('');
    setCustomAngle('Custom Angle');
  };

  const handleDeleteCustom = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deleteCustomPbbFeed(id);
    setCustomFeeds(updated);
    if (activeFeedId === id) {
      setActiveFeedId('pbb-cam-1');
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      stageRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // Top 4 camera feeds for Quad Multi-Cam View (always prioritize the 4 main live feeds)
  const quadCameras = useMemo(() => {
    const camIds = ['pbb-cam-1', 'pbb-cam-2', 'pbb-cam-3', 'pbb-cam-4'];
    const cams = camIds
      .map((id) => allFeeds.find((f) => f.id === id))
      .filter((f): f is PbbFeed => Boolean(f));
    return cams.length === 4 ? cams : allFeeds.slice(0, 4);
  }, [allFeeds]);

  return (
    <div className="pbb-view">
      <div className="pbb-container">
        {/* Header / Brand Banner */}
        <header className="pbb-header">
          <div className="pbb-header-left">
            <div className="pbb-eye-badge">
              <PbbEyeIcon />
            </div>
            <div className="pbb-titles">
              <div className="pbb-title-row">
                <h1 className="pbb-title">
                  <span>Pinoy Big Brother</span>
                  <span style={{ color: '#3b82f6', fontWeight: 600 }}>24/7 Live Stream</span>
                </h1>
                <span className="pbb-live-pill">
                  <span className="pbb-live-dot" />
                  Live Feeds
                </span>
              </div>
              <p className="pbb-subtitle">
                Bahay ni Kuya • All-Access Multi-Camera Feeds, Primetime, and Eviction Nights
              </p>
            </div>
          </div>

          <div className="pbb-header-actions">
            <button
              type="button"
              className={`pbb-btn ${!isQuadView ? 'pbb-btn-active' : 'pbb-btn-secondary'}`}
              onClick={() => setIsQuadView(false)}
              title="Single Camera Focus"
            >
              <SingleViewIcon />
              <span>Single Cam</span>
            </button>
            <button
              type="button"
              className={`pbb-btn ${isQuadView ? 'pbb-btn-active' : 'pbb-btn-secondary'}`}
              onClick={() => setIsQuadView(true)}
              title="Quad Multi-Cam Control Room"
            >
              <QuadGridIcon />
              <span>Quad View</span>
            </button>
            <button
              type="button"
              className="pbb-btn pbb-btn-secondary"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>
            <button
              type="button"
              className="pbb-btn pbb-btn-room"
              onClick={() => handleWatchFeedTogether(activeFeed)}
              title="Launch Watch Together Room"
            >
              <span>🍿</span>
              <span>Watch with Friends</span>
            </button>
          </div>
        </header>

        {/* Video Player Stage / Quad View */}
        <div ref={stageRef} className={`pbb-player-stage-container ${isFullscreen ? 'pbb-fullscreen-active' : ''}`}>
          {!isQuadView ? (
            <div className="pbb-player-stage">
              <div className="pbb-player-wrapper">
                {activeFeed.type === 'youtube' || activeFeed.type === 'embed' ? (
                  <iframe
                    key={activeFeed.id}
                    src={
                      activeFeed.type === 'youtube'
                        ? (activeFeed.url.includes('?') ? `${activeFeed.url}&autoplay=1` : `${activeFeed.url}?autoplay=1`)
                        : activeFeed.url
                    }
                    className="pbb-iframe-player"
                    title={activeFeed.name}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                    allowFullScreen
                  />
                ) : (
                  <LiveTvVideo
                    channel={playableChannel}
                    pip={isPip}
                    onPipChange={setIsPip}
                  />
                )}
              </div>
            </div>
          ) : (
            /* Quad Multi-Camera Grid View */
            <div className="pbb-quad-grid">
              {quadCameras.map((cam) => {
                const camChannel = pbbFeedToPlayableChannel(cam);
                const isIframe = cam.type === 'youtube' || cam.type === 'embed';
                return (
                  <div
                    key={cam.id}
                    className={`pbb-quad-cell ${activeFeedId === cam.id ? 'active' : ''}`}
                    onClick={() => handleSelectFeed(cam)}
                  >
                    <div className="pbb-quad-header">
                      <span className="pbb-quad-tag">
                        {cam.icon || '📹'} {cam.shortName}
                      </span>
                      <span className="pbb-badge pbb-badge-live">LIVE</span>
                    </div>
                    <div className="pbb-player-wrapper">
                      {isIframe ? (
                        <iframe
                          key={cam.id}
                          src={
                            cam.type === 'youtube'
                              ? (cam.url.includes('?') ? `${cam.url}&autoplay=1&mute=1` : `${cam.url}?autoplay=1&mute=1`)
                              : cam.url
                          }
                          className="pbb-iframe-player"
                          title={cam.name}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                          allowFullScreen
                        />
                      ) : (
                        <LiveTvVideo
                          channel={camChannel}
                          muted={activeFeedId !== cam.id}
                          controls={false}
                        />
                      )}
                    </div>
                    <div className="pbb-quad-overlay-click">Click to Focus Camera</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Feed Status Bar */}
        <div className="pbb-feed-bar">
          <div className="pbb-feed-info">
            <span className="pbb-feed-icon">{activeFeed.icon || '📹'}</span>
            <div>
              <h2 className="pbb-feed-name">{activeFeed.name}</h2>
              <p className="pbb-feed-desc">{activeFeed.description}</p>
            </div>
          </div>
          <div className="pbb-feed-meta">
            <span className="pbb-badge pbb-badge-live">{activeFeed.badge || 'LIVE'}</span>
            <span className="pbb-badge">{activeFeed.quality}</span>
            <span className="pbb-badge">{activeFeed.angle}</span>
          </div>
        </div>

        {/* Camera Switcher Grid */}
        <section className="pbb-switcher-section">
          <div className="pbb-section-title">
            <span>Camera Angles &amp; Feeds</span>
            <button
              type="button"
              className="pbb-btn pbb-btn-secondary"
              onClick={() => setShowAddModal(true)}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            >
              <span>+</span>
              <span>Add Custom Stream</span>
            </button>
          </div>

          <div className="pbb-cards-grid">
            {allFeeds.map((feed) => {
              const isSelected = activeFeed.id === feed.id;
              return (
                <div
                  key={feed.id}
                  className={`pbb-cam-card ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectFeed(feed)}
                >
                  <div className="pbb-cam-card-top">
                    <span className="pbb-cam-card-icon">{feed.icon || '📹'}</span>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <span className="pbb-badge pbb-badge-live">{feed.badge || 'LIVE'}</span>
                      {feed.isCustom && (
                        <button
                          type="button"
                          className="pbb-card-action-btn"
                          style={{ padding: '0.1rem 0.4rem', color: '#f87171' }}
                          onClick={(e) => handleDeleteCustom(e, feed.id)}
                          title="Remove custom feed"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="pbb-cam-card-title">{feed.shortName}</h3>
                    <p className="pbb-cam-card-desc">{feed.description}</p>
                  </div>

                  <div className="pbb-cam-card-actions">
                    <button
                      type="button"
                      className={`pbb-card-action-btn ${isSelected ? 'primary' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectFeed(feed);
                      }}
                    >
                      {isSelected ? '● Watching' : 'Switch Cam'}
                    </button>
                    <button
                      type="button"
                      className="pbb-card-action-btn room"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWatchFeedTogether(feed);
                      }}
                      title="Watch with friends in a room"
                    >
                      👥 Room
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Schedule & Information */}
        <div className="pbb-info-grid">
          <div className="pbb-info-card">
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff' }}>
              📅 Broadcast &amp; Eviction Schedule
            </h3>
            <div className="pbb-schedule-list">
              {meta.schedule.map((item, idx) => (
                <div key={`sched-${idx}`} className="pbb-schedule-row">
                  <div>
                    <div className="pbb-schedule-name">{item.title}</div>
                    <div className="pbb-schedule-days">{item.days}</div>
                  </div>
                  <div className="pbb-schedule-time">{item.time}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="pbb-info-card">
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff' }}>
              ℹ️ About PBB 24/7 Stream
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Stream continuous 24/7 live camera feeds from Bahay ni Kuya, official YouTube companion broadcasts, and daily primetime episodes on Kapamilya Channel.
            </p>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <a
                href="https://www.youtube.com/@PBBabscbn"
                target="_blank"
                rel="noopener noreferrer"
                className="pbb-btn pbb-btn-secondary"
                style={{ textAlign: 'center', justifyContent: 'center', textDecoration: 'none' }}
              >
                Official PBB YouTube Channel ↗
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Add Custom Feed Modal */}
      {showAddModal && (
        <div className="pbb-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="pbb-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="pbb-modal-title">Add Custom PBB Stream</h3>
            <form onSubmit={handleAddCustomFeed} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="pbb-input-group">
                <label className="pbb-input-label">Feed Name</label>
                <input
                  type="text"
                  className="pbb-input"
                  placeholder="e.g. Community Cam 5 — Confession Room"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  required
                />
              </div>

              <div className="pbb-input-group">
                <label className="pbb-input-label">Stream URL (HLS .m3u8 or YouTube)</label>
                <input
                  type="url"
                  className="pbb-input"
                  placeholder="https://.../stream.m3u8 or https://youtube.com/watch?v=..."
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  required
                />
              </div>

              <div className="pbb-input-group">
                <label className="pbb-input-label">Camera Angle / Label</label>
                <input
                  type="text"
                  className="pbb-input"
                  placeholder="e.g. Secret Room / Backyard"
                  value={customAngle}
                  onChange={(e) => setCustomAngle(e.target.value)}
                />
              </div>

              <div className="pbb-modal-actions">
                <button
                  type="button"
                  className="pbb-btn pbb-btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="pbb-btn"
                  style={{ background: '#3b82f6', borderColor: '#3b82f6' }}
                >
                  Add Stream
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PbbStreamView;
