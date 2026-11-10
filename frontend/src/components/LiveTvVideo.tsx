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
  pip?: boolean;
  onPipChange?: (isPip: boolean) => void;
  onNextChannel?: () => void;
  onStatusChange?: (status: 'loading' | 'playing' | 'error') => void;
  className?: string;
}

const VolumeOnIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const VolumeMutedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

const PipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="15" rx="2" />
    <rect x="11" y="10" width="8" height="6" rx="1" fill="currentColor" />
  </svg>
);

const FullscreenEnterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const FullscreenExitIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="4 14 10 14 10 20" />
    <polyline points="20 10 14 10 14 4" />
    <line x1="14" y1="10" x2="21" y2="3" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const BLOCKED_LIVE_KEYS = new Set([
  ' ',
  'k',
  'K',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'j',
  'J',
  'l',
  'L',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'MediaPlayPause',
  'MediaPause',
  'MediaRewind',
  'MediaFastForward',
  'MediaTrackPrevious',
  'MediaTrackNext',
]);

type WebkitPipVideo = HTMLVideoElement & {
  webkitSetPresentationMode?: (mode: 'inline' | 'picture-in-picture' | 'fullscreen') => void;
  webkitPresentationMode?: string;
  webkitEnterFullscreen?: () => void;
};

const LiveTvVideoInner: React.FC<LiveTvVideoProps> = ({
  channel,
  autoPlay = true,
  muted = false,
  controls = true,
  pip,
  onPipChange,
  onNextChannel,
  onStatusChange,
  className = '',
}) => {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<'loading' | 'playing' | 'error'>('loading');
  const isInternalSeekRef = useRef(false);
  const lastValidTimeRef = useRef(0);
  const lastSnapAtRef = useRef(0);
  const isHoveringControlsRef = useRef(false);
  const onPipChangeRef = useRef(onPipChange);

  useEffect(() => {
    onPipChangeRef.current = onPipChange;
  }, [onPipChange]);

  const [feedIndex, setFeedIndex] = useState(0);
  const [proxyOverride, setProxyOverride] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [levels, setLevels] = useState<{ index: number; height: number; bitrate: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [retryNonce, setRetryNonce] = useState(0);

  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState(1);
  const [isPip, setIsPip] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHud, setShowHud] = useState(true);

  const canPip =
    typeof document !== 'undefined' &&
    (Boolean(document.pictureInPictureEnabled) ||
      typeof (HTMLVideoElement.prototype as WebkitPipVideo).webkitSetPresentationMode === 'function');

  const activeStream: TvStream | undefined = channel.streams[feedIndex] || channel.streams[0];
  const mustProxy =
    !activeStream?.url ||
    activeStream.url.startsWith('http://') ||
    Boolean(activeStream.userAgent) ||
    Boolean(activeStream.referrer);
  const useProxy = proxyOverride !== null ? proxyOverride : mustProxy;

  const scheduleHideHud = useCallback(() => {
    setShowHud(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!isHoveringControlsRef.current) {
        setShowHud(false);
      }
    }, 3000);
  }, []);

  const handleControlsEnter = useCallback(() => {
    isHoveringControlsRef.current = true;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowHud(true);
  }, []);

  const handleControlsLeave = useCallback(() => {
    isHoveringControlsRef.current = false;
    scheduleHideHud();
  }, [scheduleHideHud]);

  useEffect(() => {
    hideTimerRef.current = setTimeout(() => {
      if (!isHoveringControlsRef.current) {
        setShowHud(false);
      }
    }, 3000);
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const updateStatus = useCallback(
    (next: 'loading' | 'playing' | 'error', msg = '') => {
      statusRef.current = next;
      setStatus(next);
      setErrorMsg(msg);
      onStatusChange?.(next);
    },
    [onStatusChange]
  );

  const getLiveEdge = useCallback((video: HTMLVideoElement) => {
    if (typeof hlsRef.current?.liveSyncPosition === 'number' && Number.isFinite(hlsRef.current.liveSyncPosition)) {
      return hlsRef.current.liveSyncPosition;
    }
    if (video.seekable.length > 0) {
      return video.seekable.end(video.seekable.length - 1);
    }
    return video.currentTime;
  }, []);

  const jumpToLiveEdge = useCallback(
    (video: HTMLVideoElement) => {
      const target = getLiveEdge(video);
      if (Number.isFinite(target) && Math.abs(target - video.currentTime) > 1) {
        isInternalSeekRef.current = true;
        try {
          video.currentTime = target;
          lastValidTimeRef.current = target;
        } finally {
          setTimeout(() => {
            isInternalSeekRef.current = false;
          }, 250);
        }
      }
    },
    [getLiveEdge]
  );

  // Lock down MediaSession pause/seek actions so browser media popups/keys cannot pause, rewind, or skip live TV
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const blockedActions: MediaSessionAction[] = [
      'pause',
      'seekbackward',
      'seekforward',
      'seekto',
      'previoustrack',
      'nexttrack',
    ];
    for (const action of blockedActions) {
      try {
        ms.setActionHandler(action, () => {});
      } catch {
        // unsupported action in this browser
      }
    }
    return () => {
      for (const action of blockedActions) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Track fullscreen changes (e.g. Escape key exit)
  useEffect(() => {
    const syncFullscreen = () => {
      const el = shellRef.current;
      const fsEl = document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement;
      setIsFullscreen(Boolean(el && fsEl === el));
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  // Sync optional external pip prop (e.g., ScreenShare header "PiP Mode" button)
  useEffect(() => {
    if (pip === undefined) return;
    const video = videoRef.current as WebkitPipVideo | null;
    if (!video) return;

    if (pip) {
      if (document.pictureInPictureElement !== video && typeof video.requestPictureInPicture === 'function') {
        video.requestPictureInPicture().catch(() => {
          onPipChangeRef.current?.(false);
        });
      } else if (video.webkitPresentationMode !== 'picture-in-picture' && typeof video.webkitSetPresentationMode === 'function') {
        try {
          video.webkitSetPresentationMode('picture-in-picture');
        } catch {
          onPipChangeRef.current?.(false);
        }
      }
    } else {
      if (document.pictureInPictureElement === video && typeof document.exitPictureInPicture === 'function') {
        document.exitPictureInPicture().catch(() => {});
      } else if (video.webkitPresentationMode === 'picture-in-picture' && typeof video.webkitSetPresentationMode === 'function') {
        try {
          video.webkitSetPresentationMode('inline');
        } catch {
          // ignore
        }
      }
    }
  }, [pip]);

  // Keep stream playing continuously, sync volume/PiP, and block user rewind/skip
  useEffect(() => {
    const video = videoRef.current as WebkitPipVideo | null;
    if (!video) return;

    const handlePause = () => {
      // Auto-resume if system/PiP close/fullscreen transition paused live broadcast while page is visible
      if (autoPlay && statusRef.current === 'playing' && !document.hidden) {
        video.play().catch(() => {});
      }
    };
    const handleVolumeChange = () => {
      setIsMuted(video.muted);
      setVolume(video.volume);
    };
    const handleEnterPip = () => {
      setIsPip(true);
      onPipChangeRef.current?.(true);
    };
    const handleLeavePip = () => {
      setIsPip(false);
      onPipChangeRef.current?.(false);
      // Closing PiP pauses the video element in Chromium; keep live TV running seamlessly
      if (autoPlay && statusRef.current === 'playing' && !document.hidden) {
        jumpToLiveEdge(video);
        video.play().catch(() => {});
      }
    };
    const handleWebkitPresentation = () => {
      const active = video.webkitPresentationMode === 'picture-in-picture';
      setIsPip(active);
      onPipChangeRef.current?.(active);
      if (autoPlay && statusRef.current === 'playing' && !document.hidden && video.paused) {
        video.play().catch(() => {});
      }
    };
    const handleVisibilityChange = () => {
      // If user closed PiP from another tab and returns to Live TV, resume live playback
      if (!document.hidden && autoPlay && statusRef.current === 'playing' && video.paused) {
        jumpToLiveEdge(video);
        video.play().catch(() => {});
      }
    };
    const handleTimeUpdate = () => {
      if (!video.seeking && statusRef.current === 'playing') {
        lastValidTimeRef.current = video.currentTime;
      }
    };
    const handleSeeking = () => {
      if (isInternalSeekRef.current || statusRef.current !== 'playing') return;
      const now = Date.now();
      if (now - lastSnapAtRef.current < 500) return;

      const liveEdge = getLiveEdge(video);
      const jumpedBackwardBehindLive = liveEdge - video.currentTime > 6 && video.currentTime < lastValidTimeRef.current - 1.5;
      const jumpedForwardPastLive =
        Math.abs(video.currentTime - lastValidTimeRef.current) > 2.5 && Math.abs(video.currentTime - liveEdge) > 2;

      if (jumpedBackwardBehindLive || jumpedForwardPastLive) {
        lastSnapAtRef.current = now;
        const safeTarget = Number.isFinite(liveEdge) ? liveEdge : lastValidTimeRef.current;
        isInternalSeekRef.current = true;
        video.currentTime = safeTarget;
        lastValidTimeRef.current = safeTarget;
        setTimeout(() => {
          isInternalSeekRef.current = false;
        }, 250);
      }
    };

    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('enterpictureinpicture', handleEnterPip);
    video.addEventListener('leavepictureinpicture', handleLeavePip);
    video.addEventListener('webkitpresentationmodechanged', handleWebkitPresentation);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeking', handleSeeking);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('enterpictureinpicture', handleEnterPip);
      video.removeEventListener('leavepictureinpicture', handleLeavePip);
      video.removeEventListener('webkitpresentationmodechanged', handleWebkitPresentation);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeking', handleSeeking);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoPlay, getLiveEdge, jumpToLiveEdge]);

  // Exit PiP cleanly if unmounting while PiP is open
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (document.pictureInPictureElement === video && typeof document.exitPictureInPicture === 'function') {
        document.exitPictureInPicture().catch(() => {});
      }
    };
  }, []);

  // HLS / Native stream setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeStream?.url) return;

    let cancelled = false;
    lastValidTimeRef.current = 0;
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
      const wasLoading = statusRef.current !== 'playing';
      updateStatus('playing');
      if (wasLoading && !isHoveringControlsRef.current) {
        scheduleHideHud();
      }
      if (autoPlay) {
        video.play().catch(() => {
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
        backBufferLength: 0,
        maxBufferLength: 15,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
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
  }, [activeStream, useProxy, feedIndex, channel.streams.length, autoPlay, retryNonce, updateStatus, scheduleHideHud]);

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
    jumpToLiveEdge(video);
    video.play().catch(() => {});
    scheduleHideHud();
  };

  const handleToggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted || video.volume === 0) {
      video.muted = false;
      if (video.volume === 0) video.volume = 1;
    } else {
      video.muted = true;
    }
    scheduleHideHud();
  };

  const handleVolumeSlider = (val: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = val;
    video.muted = val === 0;
    scheduleHideHud();
  };

  const handleTogglePip = async () => {
    const video = videoRef.current as WebkitPipVideo | null;
    if (!video) return;
    try {
      if (document.pictureInPictureElement === video) {
        await document.exitPictureInPicture();
      } else if (typeof video.requestPictureInPicture === 'function') {
        await video.requestPictureInPicture();
      } else if (typeof video.webkitSetPresentationMode === 'function') {
        const nextMode = video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture';
        video.webkitSetPresentationMode(nextMode);
      }
    } catch {
      // ignore PiP errors (e.g. metadata not ready yet)
    }
    scheduleHideHud();
  };

  const handleToggleFullscreen = () => {
    const shell = shellRef.current;
    const video = videoRef.current as WebkitPipVideo | null;
    if (!shell) return;

    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const fsShell = shell as HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> };

    if (doc.fullscreenElement === shell || doc.webkitFullscreenElement === shell) {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen().catch(() => {});
      }
    } else if (fsShell.requestFullscreen) {
      fsShell.requestFullscreen().catch(() => {
        video?.webkitEnterFullscreen?.();
      });
    } else if (fsShell.webkitRequestFullscreen) {
      fsShell.webkitRequestFullscreen().catch(() => {
        video?.webkitEnterFullscreen?.();
      });
    } else if (video?.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    }
    scheduleHideHud();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (BLOCKED_LIVE_KEYS.has(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      handleToggleFullscreen();
    } else if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      handleTogglePip();
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      handleToggleMute();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleVolumeSlider(Math.min(1, Number(((videoRef.current?.volume ?? 1) + 0.1).toFixed(2))));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleVolumeSlider(Math.max(0, Number(((videoRef.current?.volume ?? 1) - 0.1).toFixed(2))));
    }
  };

  const hudVisible = showHud || status !== 'playing';

  return (
    <div
      ref={shellRef}
      className={`livetv-video-shell ${className}`}
      tabIndex={0}
      onMouseMove={scheduleHideHud}
      onTouchStart={scheduleHideHud}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        ref={videoRef}
        className="livetv-video-el"
        playsInline
        autoPlay={autoPlay}
        muted={muted}
        disableRemotePlayback
        onClick={scheduleHideHud}
        onDoubleClick={handleToggleFullscreen}
        onContextMenu={(e) => e.preventDefault()}
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

      {/* Top HUD: LIVE badge, Go Live, Quality, Feed */}
      <div
        className={`livetv-top-hud ${hudVisible ? 'visible' : ''}`}
        onMouseEnter={handleControlsEnter}
        onMouseMove={(e) => {
          e.stopPropagation();
          handleControlsEnter();
        }}
        onMouseLeave={handleControlsLeave}
      >
        <button
          type="button"
          className={`livetv-live-pill ${status === 'playing' ? 'online' : ''}`}
          onClick={handleJumpLive}
          title="Sync to live broadcast"
        >
          <span className="livetv-live-dot" />
          LIVE
        </button>

        {controls && (
          <div className="livetv-hud-controls" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="livetv-hud-btn" onClick={handleJumpLive} title="Sync to live edge">
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
        )}
      </div>

      {/* Bottom Broadcast Bar: Volume/Mute, Channel Label, PiP, Fullscreen (NO pause/play or seekbar) */}
      {controls && (
        <div
          className={`livetv-bottom-bar ${hudVisible ? 'visible' : ''}`}
          onMouseEnter={handleControlsEnter}
          onMouseMove={(e) => {
            e.stopPropagation();
            handleControlsEnter();
          }}
          onMouseLeave={handleControlsLeave}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="livetv-bar-left">
            <div className="livetv-volume-group">
              <button
                type="button"
                className="livetv-ctrl-btn"
                onClick={handleToggleMute}
                title={isMuted || volume === 0 ? 'Unmute (M)' : 'Mute (M)'}
                aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeMutedIcon /> : <VolumeOnIcon />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeSlider(Number(e.target.value))}
                className="livetv-volume-slider"
                aria-label="Volume"
              />
            </div>

            <span className="livetv-bar-channel" title={channel.name}>
              {channel.flag ? `${channel.flag} ` : ''}{channel.name}
            </span>
          </div>

          <div className="livetv-bar-right">
            {canPip && (
              <button
                type="button"
                className={`livetv-ctrl-btn livetv-pip-btn ${isPip ? 'active' : ''}`}
                onClick={handleTogglePip}
                title={isPip ? 'Exit Picture-in-Picture (P)' : 'Picture-in-Picture (P)'}
                aria-label={isPip ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
              >
                <PipIcon />
                <span className="livetv-btn-label">{isPip ? 'Exit PiP' : 'PiP'}</span>
              </button>
            )}

            <button
              type="button"
              className="livetv-ctrl-btn livetv-fullscreen-btn"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
              <span className="livetv-btn-label">
                {isFullscreen ? 'Exit' : 'Fullscreen'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const LiveTvVideo: React.FC<LiveTvVideoProps> = (props) => {
  return <LiveTvVideoInner key={props.channel.id} {...props} />;
};

export default LiveTvVideo;
