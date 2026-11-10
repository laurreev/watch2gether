import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { buildTvProxyUrl, type TvStream } from '../services/television';
import './LiveTvVideo.css';

export interface PlayableTvChannel {
  id: string;
  name: string;
  logo?: string;
  country?: string;
  countryName?: string;
  flag?: string;
  primaryCategory?: string;
  streams: TvStream[];
}

interface LiveTvVideoProps {
  channel: PlayableTvChannel;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  onNextChannel?: () => void;
  onStatusChange?: (status: 'loading' | 'playing' | 'error') => void;
  className?: string;
}

const LiveTvVideoInner: React.FC<LiveTvVideoProps> = ({
  channel,
  autoPlay = true,
  muted = false,
  controls = true,
  onNextChannel,
  onStatusChange,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [feedIndex, setFeedIndex] = useState(0);
  const [proxyOverride, setProxyOverride] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [levels, setLevels] = useState<{ index: number; height: number; bitrate: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [retryNonce, setRetryNonce] = useState(0);

  const activeStream: TvStream | undefined = channel.streams[feedIndex] || channel.streams[0];
  const mustProxy =
    !activeStream?.url ||
    activeStream.url.startsWith('http://') ||
    Boolean(activeStream.userAgent) ||
    Boolean(activeStream.referrer);
  const useProxy = proxyOverride !== null ? proxyOverride : mustProxy;

  const updateStatus = useCallback(
    (next: 'loading' | 'playing' | 'error', msg = '') => {
      setStatus(next);
      setErrorMsg(msg);
      onStatusChange?.(next);
    },
    [onStatusChange]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeStream?.url) return;

    let cancelled = false;
    const streamUrl = useProxy ? buildTvProxyUrl(activeStream) : activeStream.url;

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute('src');
      video.load();
    };

    const handleCanPlay = () => {
      if (cancelled) return;
      updateStatus('playing');
      if (autoPlay) {
        video.play().catch(() => {
          // Autoplay with audio may be blocked by browser policy; mute & retry once
          if (!video.muted) {
            video.muted = true;
            video.play().catch(() => {});
          }
        });
      }
    };

    const handleNativeError = () => {
      if (cancelled) return;
      if (!useProxy) {
        setProxyOverride(true);
        return;
      }
      if (feedIndex + 1 < channel.streams.length) {
        setProxyOverride(null);
        setFeedIndex((prev) => prev + 1);
        return;
      }
      updateStatus('error', 'This broadcast feed is currently unreachable or geo-restricted.');
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        manifestLoadingTimeOut: 12000,
        levelLoadingTimeOut: 12000,
        fragLoadingTimeOut: 15000,
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (cancelled) return;
        const parsedLevels = (data.levels || []).map((lvl, idx) => ({
          index: idx,
          height: lvl.height || 0,
          bitrate: lvl.bitrate || 0,
        }));
        setLevels(parsedLevels);
        setCurrentLevel(-1);
        if (autoPlay) {
          video.play().catch(() => {
            if (!video.muted) {
              video.muted = true;
              video.play().catch(() => {});
            }
          });
        }
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        if (!cancelled) {
          updateStatus('playing');
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled || !data.fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (!useProxy) {
            hls.destroy();
            hlsRef.current = null;
            setProxyOverride(true);
            return;
          }
          if (feedIndex + 1 < channel.streams.length) {
            hls.destroy();
            hlsRef.current = null;
            setProxyOverride(null);
            setFeedIndex((prev) => prev + 1);
            return;
          }
          updateStatus('error', 'Broadcast stream failed to load. It may be offline or geo-blocked.');
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          if (feedIndex + 1 < channel.streams.length) {
            hls.destroy();
            hlsRef.current = null;
            setProxyOverride(null);
            setFeedIndex((prev) => prev + 1);
          } else {
            updateStatus('error', 'Unable to decode this broadcast stream.');
          }
        }
      });

      video.addEventListener('playing', handleCanPlay);
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      return () => {
        cancelled = true;
        video.removeEventListener('playing', handleCanPlay);
        cleanup();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleNativeError);
      video.src = streamUrl;
      return () => {
        cancelled = true;
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleNativeError);
        cleanup();
      };
    }

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [activeStream, useProxy, feedIndex, channel.streams.length, autoPlay, retryNonce, updateStatus]);

  const handleQualityChange = (lvlIdx: number) => {
    setCurrentLevel(lvlIdx);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = lvlIdx;
    }
  };

  const handleFeedSelect = (idx: number) => {
    updateStatus('loading');
    setProxyOverride(null);
    setFeedIndex(idx);
  };

  const handleJumpLive = () => {
    const video = videoRef.current;
    if (!video) return;
    if (hlsRef.current?.liveSyncPosition) {
      video.currentTime = hlsRef.current.liveSyncPosition;
    } else if (video.seekable.length > 0) {
      video.currentTime = video.seekable.end(video.seekable.length - 1);
    }
    video.play().catch(() => {});
  };

  return (
    <div className={`livetv-video-shell ${className}`}>
      <video
        ref={videoRef}
        className="livetv-video-el"
        controls={controls}
        playsInline
        autoPlay={autoPlay}
        muted={muted}
      />

      {status === 'loading' && (
        <div className="livetv-status-overlay">
          <div className="livetv-spinner" />
          <p className="livetv-status-title">Tuning into {channel.name}...</p>
          <span className="livetv-status-sub">
            {useProxy ? 'Routing via stream relay' : 'Connecting directly'}
            {channel.streams.length > 1 ? ` · Feed ${feedIndex + 1}/${channel.streams.length}` : ''}
          </span>
        </div>
      )}

      {status === 'error' && (
        <div className="livetv-status-overlay livetv-error-overlay">
          <div className="livetv-error-icon">📡</div>
          <p className="livetv-status-title">Signal Unavailable</p>
          <p className="livetv-status-sub">{errorMsg || 'This channel is currently offline.'}</p>
          <div className="livetv-error-actions">
            <button
              type="button"
              className="tv-btn tv-btn-primary"
              onClick={() => {
                updateStatus('loading');
                setRetryNonce((n) => n + 1);
              }}
            >
              ↻ Retry
            </button>
            {!useProxy && (
              <button
                type="button"
                className="tv-btn tv-btn-secondary"
                onClick={() => {
                  updateStatus('loading');
                  setProxyOverride(true);
                }}
              >
                Use Stream Relay
              </button>
            )}
            {channel.streams.length > 1 && (
              <button
                type="button"
                className="tv-btn tv-btn-secondary"
                onClick={() => handleFeedSelect((feedIndex + 1) % channel.streams.length)}
              >
                Try Feed {((feedIndex + 1) % channel.streams.length) + 1}
              </button>
            )}
            {onNextChannel && (
              <button type="button" className="tv-btn tv-btn-secondary" onClick={onNextChannel}>
                Next Channel →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Subtle Live / Feed / Quality bar */}
      <div className="livetv-top-hud">
        <span className={`livetv-live-pill ${status === 'playing' ? 'online' : ''}`}>
          <span className="livetv-live-dot" />
          LIVE
        </span>
        <div className="livetv-hud-controls">
          <button type="button" className="livetv-hud-btn" onClick={handleJumpLive} title="Jump to live edge">
            Go Live
          </button>
          {levels.length > 1 && (
            <select
              className="livetv-hud-select"
              value={currentLevel}
              onChange={(e) => handleQualityChange(Number(e.target.value))}
              aria-label="Stream Quality"
            >
              <option value={-1}>Auto Quality</option>
              {levels.map((lvl) => (
                <option key={lvl.index} value={lvl.index}>
                  {lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)}kbps`}
                </option>
              ))}
            </select>
          )}
          {channel.streams.length > 1 && (
            <select
              className="livetv-hud-select"
              value={feedIndex}
              onChange={(e) => handleFeedSelect(Number(e.target.value))}
              aria-label="Broadcast Feed"
            >
              {channel.streams.map((s, idx) => (
                <option key={`${s.url}-${idx}`} value={idx}>
                  Feed {idx + 1}{s.quality ? ` (${s.quality})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
};

export const LiveTvVideo: React.FC<LiveTvVideoProps> = (props) => {
  return <LiveTvVideoInner key={props.channel.id} {...props} />;
};

export default LiveTvVideo;
