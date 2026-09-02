import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWebRTC, type Resolution } from '../hooks/useWebRTC.ts';
import MediaSelector from './MediaSelector.tsx';
import YoutubeSelector from './YoutubeSelector.tsx';
import ReactPlayerModule from 'react-player';
const ReactPlayer = (ReactPlayerModule as any).default || ReactPlayerModule;

interface ScreenShareProps {
  roomId: string;
  isOwner: boolean;
  onLeave: (msg?: string) => void;
  onHostMigrate: (isHost: boolean) => void;
  roomConfig?: { isPublic: boolean; password?: string };
}

// Helper component to render a media stream
const VideoStream: React.FC<{ stream: MediaStream | null; label: string; isLocal: boolean }> = ({ stream, label, isLocal }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(isLocal || false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name === 'NotAllowedError') {
             setNeedsGesture(true);
          }
        });
      }
    }
  }, [stream]);

  const handleGesturePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setNeedsGesture(false);
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const handleInteraction = useCallback(() => {
    setShowControls(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Fix for iOS Safari pausing video during fullscreen transitions
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      if (video.paused) {
        video.play().catch(e => console.log('Autoplay prevented', e));
      }
    };

    video.addEventListener('pause', handlePlay);
    video.addEventListener('webkitbeginfullscreen', handlePlay);
    video.addEventListener('webkitendfullscreen', handlePlay);
    video.addEventListener('fullscreenchange', handlePlay);

    return () => {
      video.removeEventListener('pause', handlePlay);
      video.removeEventListener('webkitbeginfullscreen', handlePlay);
      video.removeEventListener('webkitendfullscreen', handlePlay);
      video.removeEventListener('fullscreenchange', handlePlay);
    };
  }, []);

  const toggleFullscreen = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Target the wrapper div, not the video element itself, so controls stay visible
      const wrapper = videoRef.current?.closest('.video-wrapper');
      if (wrapper) {
          if (document.fullscreenElement === wrapper) {
             document.exitFullscreen?.();
          } else if (wrapper.requestFullscreen) {
              wrapper.requestFullscreen();
          } else if ((wrapper as any).webkitRequestFullscreen) {
              // Fallback for older WebKit (like some iOS Safari setups if enabled)
              (wrapper as any).webkitRequestFullscreen();
          } else if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
              // Ultimate fallback for iOS Safari which only allows fullscreen on <video> tags
              (videoRef.current as any).webkitEnterFullscreen();
          }
      }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      const newVolume = parseFloat(e.target.value);
      setVolume(newVolume);
      if (newVolume > 0 && isMuted && !isLocal) {
          setIsMuted(false);
      }
      handleInteraction();
  };

  const toggleMute = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isLocal) return; // Prevent unmuting local stream
      setIsMuted(!isMuted);
      handleInteraction();
  };

  return (
    <div 
      className="video-wrapper" style={{ display: stream ? 'block' : 'none' }}
      onMouseMove={handleInteraction}
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="video-element"
      />
      
      {needsGesture && (
        <div 
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', zIndex: 10, cursor: 'pointer' }}
          onClick={handleGesturePlay}
        >
          <button className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.2rem', borderRadius: '2rem' }}>
            ▶ Tap to Play Stream
          </button>
        </div>
      )}

      <div className={`video-controls-overlay ${showControls || isLocal ? 'visible' : ''}`}>
        <div className="video-label">
          <div className="indicator"></div>
          {label}
        </div>
        
        <div className="video-actions">
          {!isLocal && (
            <div className="volume-control" onClick={(e) => e.stopPropagation()}>
              <button className="icon-btn" onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
                {isMuted || volume === 0 ? '🔇' : '🔊'}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                value={isMuted ? 0 : volume} 
                onChange={handleVolumeChange}
                className="volume-slider"
              />
            </div>
          )}
          <button className="icon-btn" onClick={toggleFullscreen} title="Full Screen">
             ⛶
          </button>
        </div>
      </div>
    </div>
  );
};

const ScreenShare: React.FC<ScreenShareProps> = ({ roomId, isOwner, onLeave, onHostMigrate, roomConfig }) => {
  const { localStream, remoteStreams, startScreenShare, stopScreenShare, error, userCount, usersList, socket } = useWebRTC(roomId, isOwner, roomConfig, onLeave);
  const [resolution, setResolution] = useState<Resolution>('max');
  const [showCursor, setShowCursor] = useState(true);
  const [showMediaSelector, setShowMediaSelector] = useState<'local' | 'share' | false>(false);
  const [playingMedia, setPlayingMedia] = useState<{title: string, type: string, url?: string, originalUrl?: string, episode?: number, season?: number} | null>(null);
  const [activeServer, setActiveServer] = useState('1');
  const [isExtractingServer, setIsExtractingServer] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [showViewersList, setShowViewersList] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [chatMessages, setChatMessages] = useState<{username: string, text: string, timestamp: number}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showCopyPrompt, setShowCopyPrompt] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // YouTube / ReactPlayer sync states
  const [viewerControlEnabled, setViewerControlEnabled] = useState(false);
  const [ytPlaying, setYtPlaying] = useState(true);
  const [ytVolume, setYtVolume] = useState(1);
  const [ytMuted, setYtMuted] = useState(!isOwner);
  const [ytPlaybackRate, setYtPlaybackRate] = useState(1);

  const reactPlayerRef = useRef<any>(null);
  const isSyncingRef = useRef(false);
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);

  const canControlPlayback = isOwner || viewerControlEnabled;

  const handleYtAction = (action: 'play' | 'pause' | 'seek', time?: number) => {
    if (!socket || !canControlPlayback || isSyncingRef.current) return;
    const timestamp = time !== undefined ? time : (reactPlayerRef.current?.getCurrentTime() || 0);
    socket.emit('yt-sync', { roomId, action, timestamp });
  };

  useEffect(() => {
    if (!isOwner || !socket || playingMedia?.type !== 'YouTube' || !ytPlaying) return;
    
    const interval = setInterval(() => {
       if (!isSyncingRef.current) {
          const timestamp = reactPlayerRef.current?.getCurrentTime() || 0;
          socket.emit('yt-sync', { roomId, action: 'sync', timestamp });
       }
    }, 2500);
    
    return () => clearInterval(interval);
  }, [isOwner, socket, playingMedia, ytPlaying, roomId]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (!socket) return;
    
    const handleChat = (msg: any) => setChatMessages(prev => [...prev, msg]);
    
    const handleMigrate = () => {
      setNotification("You have been promoted to Host!");
      setTimeout(() => setNotification(null), 5000);
      onHostMigrate(true);
    };
    const handleDemote = () => {
      setNotification("You are no longer the Host.");
      setTimeout(() => setNotification(null), 5000);
      onHostMigrate(false);
      stopScreenShare();
    };

    const onYtSync = (data: { action: 'play'|'pause'|'seek'|'sync', timestamp: number }) => {
      isSyncingRef.current = true;
      const current = reactPlayerRef.current?.getCurrentTime() || 0;
      
      if (data.action === 'play') {
         setYtPlaying(true);
         if (Math.abs(current - data.timestamp) > 1.5) {
            reactPlayerRef.current?.seekTo(data.timestamp, 'seconds');
            setYtPlaybackRate(1);
         }
      } else if (data.action === 'pause') {
         setYtPlaying(false);
      } else if (data.action === 'seek') {
         reactPlayerRef.current?.seekTo(data.timestamp, 'seconds');
      } else if (data.action === 'sync') {
         setYtPlaying(true);
         const diff = current - data.timestamp;
         if (Math.abs(diff) > 0.8) {
            reactPlayerRef.current?.seekTo(data.timestamp, 'seconds');
            setYtPlaybackRate(1);
         } else if (diff < -0.3) {
            setYtPlaybackRate(1.25);
         } else if (diff > 0.3) {
            setYtPlaybackRate(0.75);
         } else {
            setYtPlaybackRate(1);
         }
      }
      setTimeout(() => { isSyncingRef.current = false; }, 500);
    };
    
    const onViewerControlToggled = (enabled: boolean) => {
       setViewerControlEnabled(enabled);
    };

    socket.on('chat-message', handleChat);
    socket.on('host-migrated', handleMigrate);
    socket.on('host-demoted', handleDemote);
    socket.on('yt-sync', onYtSync);
    socket.on('viewer-control-toggled', onViewerControlToggled);

    return () => {
       socket.off('chat-message', handleChat);
       socket.off('host-migrated', handleMigrate);
       socket.off('host-demoted', handleDemote);
       socket.off('yt-sync', onYtSync);
       socket.off('viewer-control-toggled', onViewerControlToggled);
    };
  }, [socket, onHostMigrate]);

  const [isIdle, setIsIdle] = useState(false);
  const idleTimeoutRef = useRef<any>(null);

  useEffect(() => {
    let handleMouseMove: (() => void) | null = null;
    
    if (isTheaterMode) {
      document.body.classList.add('theater-active');

      handleMouseMove = () => {
        setIsIdle(false);
        if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = setTimeout(() => setIsIdle(true), 2500);
      };

      window.addEventListener('mousemove', handleMouseMove);
      handleMouseMove(); // init
    } else {
      document.body.classList.remove('theater-active');
    }
    
    const handleFullscreenChange = () => {
      // If the user presses Escape, the browser exits fullscreen.
      // We should detect this and exit Theater mode automatically.
      if (!document.fullscreenElement && isTheaterMode) {
        setIsTheaterMode(false);
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.body.classList.remove('theater-active');
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (handleMouseMove) {
         window.removeEventListener('mousemove', handleMouseMove);
      }
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [isTheaterMode]);

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;
    
    const msg = {
       roomId,
       username: localStorage.getItem('watch2gether_nickname') || 'You',
       text: chatInput.trim(),
       timestamp: Date.now()
    };
    
    // We emit to server, and the server broadcasts to all (including us)
    socket.emit('chat-message', msg);
    setChatInput('');
  };
  
  const [playerSeasons, setPlayerSeasons] = useState<any[]>([]);
  const [playerEpisodes, setPlayerEpisodes] = useState<any[]>([]);
  const [activePlayerSeason, setActivePlayerSeason] = useState<number | null>(null);

  useEffect(() => {
    let aborted = false;
    if (playingMedia && (playingMedia.type === 'TV Show' || playingMedia.type === 'Anime' || playingMedia.type === 'Asian')) {
      const tmdbId = playingMedia.originalUrl;
      import('../services/vaporpic.ts').then(({ getTvSeasons, getEpisodesForSeason }) => {
        getTvSeasons(tmdbId!).then(seasons => {
          if (!aborted) {
            setPlayerSeasons(seasons);
            const currentSeason = playingMedia.season || 1;
            setActivePlayerSeason(currentSeason);
            
            getEpisodesForSeason(tmdbId!, currentSeason).then(eps => {
              if (!aborted) setPlayerEpisodes(eps);
            });
          }
        });
      });
    } else {
      setPlayerSeasons([]);
      setPlayerEpisodes([]);
    }
    return () => { aborted = true; };
  }, [playingMedia]);

  const handlePlayerSeasonChange = (s: number) => {
    setActivePlayerSeason(s);
    if (playingMedia?.originalUrl) {
      import('../services/vaporpic.ts').then(({ getEpisodesForSeason }) => {
        getEpisodesForSeason(playingMedia.originalUrl!, s).then(eps => {
          setPlayerEpisodes(eps);
        });
      });
    }
  };

  const handlePlayMedia = (item: any) => {
    setPlayingMedia(item);
    setActiveServer('1'); // Reset to default when new media plays
    const mode = showMediaSelector;
    setShowMediaSelector(false);
    
    if (mode === 'share') {
      // In Pick and Share mode, we play it locally for the host and start WebRTC screen share.
      // We do NOT emit 'play-media', so viewers only watch via the screen share, avoiding double-audio.
      startScreenShare(resolution, showCursor);
    } else {
      // Original behavior ("Find something to watch"): broadcast the media URL to everyone
      if (isOwner && socket) {
        socket.emit('play-media', { roomId, media: { ...item, serverStr: '1' } });
      }
    }
  };

  const handleStopMedia = () => {
    setPlayingMedia(null);
    setYtPlaying(true);
    setViewerControlEnabled(false);
    if (isOwner && socket) {
      socket.emit('stop-media', roomId);
    }
  };

  const handleServerChange = async (serverStr: string) => {
    setActiveServer(serverStr);
    if (!playingMedia || !playingMedia.originalUrl) return;
    
    if (isOwner && socket) {
      socket.emit('play-media', { roomId, media: { ...playingMedia, serverStr } });
    }
    
    setIsExtractingServer(true);
    try {
      const { getVaporpicIframe } = await import('../services/vaporpic.ts');
      const newUrl = await getVaporpicIframe(playingMedia.originalUrl, serverStr, playingMedia.episode?.toString(), playingMedia.season);
      if (newUrl) {
         setPlayingMedia({ ...playingMedia, url: newUrl });
      }
    } catch (e) {
      console.error(e);
    } finally {
       setIsExtractingServer(false);
    }
  };

  // Viewer socket listener for synchronized media
  useEffect(() => {
    if (!socket || isOwner) return;

    const onPlayMedia = async (media: any) => {
      if (media.type === 'YouTube') {
         setPlayingMedia(media);
         setActiveServer(media.serverStr || '1');
         setYtPlaying(true);
         return;
      }

      // Clear the URL from the host so the viewer doesn't get an OOPS error
      const mediaWithoutUrl = { ...media, url: '' };
      setPlayingMedia(mediaWithoutUrl);
      setActiveServer(media.serverStr || '1');
      if (media.originalUrl) {
        setIsExtractingServer(true);
        try {
          const { getVaporpicIframe } = await import('../services/vaporpic.ts');
          const newUrl = await getVaporpicIframe(media.originalUrl, media.serverStr || '1', media.episode?.toString(), media.season);
          if (newUrl) {
            setPlayingMedia((prev: any) => prev ? { ...prev, url: newUrl } : null);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsExtractingServer(false);
        }
      }
    };

    const onStopMedia = () => {
      setPlayingMedia(null);
    };

    socket.on('play-media', onPlayMedia);
    socket.on('stop-media', onStopMedia);

    return () => {
      socket.off('play-media', onPlayMedia);
      socket.off('stop-media', onStopMedia);
    };
  }, [socket, isOwner]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomId);
    setShowCopyPrompt(true);
    setTimeout(() => setShowCopyPrompt(false), 2000);
  };

  return (
    <main className="room-container" style={{ padding: isTheaterMode ? '0' : '1rem', gap: isTheaterMode ? '0' : '1rem', background: isTheaterMode ? '#000' : '' }}>
      {!isTheaterMode && (
        <>
          {isOwner && (
            <div className="mobile-primary-actions hide-on-desktop" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {(!localStream && !playingMedia) && (
                <button className="btn btn-primary" onClick={() => setShowMediaSelector('local')}>
                  Find something to watch
                </button>
              )}
              {(localStream || playingMedia) && (
                <button className="btn btn-danger" onClick={() => {
                   if (localStream) stopScreenShare();
                   if (playingMedia) handleStopMedia();
                }}>
                   {localStream && playingMedia ? 'Stop Session' : localStream ? 'Stop Sharing' : 'Stop Playing'}
                </button>
              )}
            </div>
          )}
          <div className="mobile-controls-toggle hide-on-desktop" style={{ marginBottom: '1rem' }}>
            <button className="btn" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)' }} onClick={() => setShowMobileControls(!showMobileControls)}>
               {showMobileControls ? 'Hide other room controls ▲' : 'View other room controls ▼'}
            </button>
          </div>
          <div className={`room-header glass ${!showMobileControls ? 'hide-on-mobile' : ''}`} style={{ marginBottom: '1rem' }}>
          <div className="room-info">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Room:</h2>
            <div className="room-id-badge" onClick={handleCopyLink} title="Click to copy" style={{ position: 'relative' }}>
               {roomId}
               {showCopyPrompt && <div style={{ position: 'absolute', top: '-2rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(34, 197, 94, 0.9)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.8rem', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10 }}>Copied!</div>}
            </div>
            <div className="viewer-badge">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: userCount > 0 ? '#22c55e' : 'var(--text-muted)' }}></span>
              {userCount} Viewer{userCount !== 1 ? 's' : ''}
            </div>
          </div>
          
          <div className="room-controls">
            {isOwner && (!localStream && !playingMedia) && (
              <>
                <button className="btn btn-primary hide-on-mobile" onClick={() => setShowMediaSelector('local')}>
                  Find something to watch
                </button>
                <button className="btn" onClick={() => setShowMediaSelector('share')} style={{ background: '#10b981', color: 'white', display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center', padding: '0.5rem 1rem' }}>
                  <span>Pick and Share</span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 'normal', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Experimental. For PC only</span>
                </button>
                <button className="btn" style={{ background: '#ef4444', color: 'white' }} onClick={() => setShowYoutubeInput(true)}>
                  Watch on Youtube
                </button>
                <div style={{ position: 'relative' }}>
                  <button className="btn btn-secondary" onClick={() => setShowShareOptions(!showShareOptions)}>
                    Share Screen ⚙️
                  </button>
                  {showShareOptions && (
                    <div className="glass" style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '0.5rem', padding: '1rem', borderRadius: '0.5rem', zIndex: 50, display: 'flex', flexDirection: 'column', gap: '0.8rem', minWidth: '220px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                      <h4 style={{ margin: '0', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '0.9rem' }}>Share Settings</h4>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem' }}>Resolution</span>
                        <select 
                          className="input-field select-field" 
                          value={resolution} 
                          onChange={(e) => setResolution(e.target.value as Resolution)}
                          style={{ padding: '0.3rem', height: 'auto', minHeight: 0, width: '100px', fontSize: '0.85rem' }}
                        >
                          <option value="720p">720p</option>
                          <option value="1080p">1080p</option>
                          <option value="1440p">1440p</option>
                          <option value="max">Max</option>
                        </select>
                      </div>

                      <label className="cursor-toggle" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                        <input type="checkbox" checked={showCursor} onChange={(e) => setShowCursor(e.target.checked)} />
                        Show Cursor
                      </label>

                      <button className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '0.5rem' }} onClick={() => {
                        setShowShareOptions(false);
                        startScreenShare(resolution, showCursor);
                      }}>
                        Start Sharing
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            {isOwner && (localStream || playingMedia) && (
               <>
                 {playingMedia && (
                   <select 
                     className="input-field select-field"
                     value={activeServer}
                     onChange={(e) => handleServerChange(e.target.value)}
                     disabled={isExtractingServer}
                   >
                      <option value="1">Vidsrc ME</option>
                      <option value="2">2Embed</option>
                      <option value="3">Multiembed</option>
                      <option value="4">Vidlink (Anime/HD)</option>
                   </select>
                 )}
                 <button className="btn btn-danger hide-on-mobile" onClick={() => {
                   if (localStream) stopScreenShare();
                   if (playingMedia) handleStopMedia();
                 }}>
                   {localStream && playingMedia ? 'Stop Session' : localStream ? 'Stop Sharing' : 'Stop Playing'}
                 </button>
               </>
            )}
            {playingMedia && (
               <button className="btn hide-on-mobile" style={{ background: 'var(--primary)', padding: '0.3rem 0.6rem', fontSize: '0.85rem' }} onClick={() => setIsPip(!isPip)}>
                 🖼️ PiP Mode
               </button>
            )}
            <button className="btn hide-on-mobile" style={{ background: 'var(--primary)', padding: '0.3rem 0.6rem', fontSize: '0.85rem' }} onClick={() => setIsTheaterMode(true)}>
              🎭 Theater Mode
            </button>
            <a href={
               (() => {
                 const ua = navigator.userAgent.toLowerCase();
                 if (ua.includes('edg/')) return 'https://microsoftedge.microsoft.com/addons/detail/ublock-origin/odfafepnkmbhccpbejgmiehpchacaeak';
                 if (ua.includes('chrome') && !ua.includes('edg/')) return 'https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh?utm_source=ext_app_menu';
                 if (ua.includes('firefox')) return 'https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/';
                 if (ua.includes('safari') && !ua.includes('chrome') || ua.includes('iphone') || ua.includes('ipad') || ua.includes('mac os')) return 'https://apps.apple.com/us/app/ublock-origin-lite/id6745342698';
                 return 'https://ublockorigin.com/';
               })()
            } target="_blank" rel="noopener noreferrer" className="btn" style={{ background: '#8b0000', color: 'white', padding: '0.3rem 0.6rem', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', fontSize: '0.85rem' }}>
              <span style={{ fontSize: '1rem' }}>🛡️</span> Install AdBlock
            </a>
            <button className="btn btn-leave" onClick={() => onLeave()}>
              Leave
            </button>
          </div>
        </div>
        </>
      )}

      {isTheaterMode && (
         <>
           <style>{`
             .header { display: none !important; }
             .app-container { height: 100vh !important; overflow: hidden !important; }
           `}</style>
           <div 
             style={{ 
               position: 'fixed', top: 0, right: 0, width: '250px', height: '150px', zIndex: 1000,
               display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '1rem'
             }}
             onMouseEnter={() => setIsIdle(false)}
             onMouseMove={() => setIsIdle(false)}
             onMouseLeave={() => setIsIdle(true)}
           >
             <button 
               className="btn btn-primary" 
               onClick={() => setIsTheaterMode(false)}
               style={{ 
                 boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                 opacity: isIdle ? 0 : 1,
                 transition: 'opacity 0.3s ease',
                 pointerEvents: isIdle ? 'none' : 'auto'
               }}
             >
               Exit Theater Mode
             </button>
           </div>
         </>
      )}

      {notification && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(34, 197, 94, 0.9)', color: 'white', padding: '1rem 2rem', borderRadius: '2rem', zIndex: 10000, boxShadow: '0 4px 15px rgba(0,0,0,0.5)', fontWeight: 600, animation: 'fadeIn 0.3s ease-out' }}>
          {notification}
        </div>
      )}

      {error && !isTheaterMode && (
        <div className="glass" style={{ padding: '1rem', color: 'var(--danger)', borderRadius: '0.5rem', textAlign: 'center', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div className="room-content-wrapper">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: isTheaterMode ? '0' : '1rem', overflowY: 'auto', paddingRight: isTheaterMode ? '0' : '0.5rem' }}>
        {((localStream && !playingMedia) || remoteStreams.size > 0 || !playingMedia) && (
          <div className="video-grid" style={{ marginBottom: isTheaterMode ? '0' : '1rem' }}>
        {localStream && !playingMedia && (
           <VideoStream stream={localStream} label={`${localStorage.getItem('watch2gether_nickname') || 'You'} (Sharing)`} isLocal={true} />
        )}
        
        {Array.from(remoteStreams.entries()).map(([peerId, stream]) => {
           const nickname = usersList?.find(u => u.id === peerId)?.nickname || `Viewer: ${peerId.substring(0, 5)}`;
           return <VideoStream key={peerId} stream={stream} label={nickname} isLocal={false} />;
        })}

        {!localStream && remoteStreams.size === 0 && !playingMedia && (
           <div className="glass idle-placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gridColumn: '1 / -1', borderRadius: '1rem', flexDirection: 'column', gap: '1rem' }}>
               <h3 style={{ color: 'var(--text-muted)' }}>Waiting for someone to share their screen...</h3>
               <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Share the Room ID with your friends so they can join.</p>
           </div>
        )}
          </div>
        )}

        {playingMedia && (
           <div className={`glass ${isTheaterMode ? 'theater-wrapper' : 'playing-media-wrapper'}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', order: isTheaterMode ? 0 : 1, borderRadius: isTheaterMode ? '0' : '1rem', flexDirection: 'column', gap: isTheaterMode ? '0' : '1rem', background: '#000', border: isTheaterMode ? 'none' : '1px solid var(--border)' }}>
                <div style={{ width: '100%', height: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
                 {!isTheaterMode && (
                    <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)' }}>
                      <h2 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>Playing: {playingMedia.title}{playingMedia.season ? ` - Season ${playingMedia.season}` : ''}{playingMedia.episode ? ` (Episode ${playingMedia.episode})` : ''}</h2>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        {isOwner && playingMedia.type === 'YouTube' && (
                           <label className="cursor-toggle" style={{ margin: 0, background: 'rgba(255,255,255,0.1)', padding: '0.3rem 0.6rem', borderRadius: '0.5rem' }}>
                             <input type="checkbox" checked={viewerControlEnabled} onChange={(e) => {
                                setViewerControlEnabled(e.target.checked);
                                if (socket) socket.emit('toggle-viewer-control', { roomId, enabled: e.target.checked });
                             }} />
                             Allow Viewers to Control
                           </label>
                        )}
                        <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{playingMedia.type}</span>
                      </div>
                    </div>
                  )}
                 {isExtractingServer ? (
                     <div style={{ padding: '2rem', textAlign: 'center', color: 'white', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       Loading new server stream...
                     </div>
                  ) : playingMedia.url ? (
                     <div id="media-player-container" className={isTheaterMode ? 'theater-player' : 'media-player-container'} style={{ width: '100%', flex: 1, background: '#000', position: 'relative', transform: 'translateZ(0)' }}>
                       {playingMedia.type === 'YouTube' || playingMedia.url.includes('.mp4') || playingMedia.url.includes('.m3u8') ? (
                         <>
                           {/* @ts-ignore react-player types issue */}
                           <div style={{ width: '100%', height: '100%', pointerEvents: canControlPlayback ? 'auto' : 'none' }}>
                             <ReactPlayer
                               ref={reactPlayerRef}
                               url={playingMedia.url}
                               width="100%"
                               height="100%"
                               controls={canControlPlayback}
                               playing={ytPlaying}
                               volume={ytVolume}
                               muted={ytMuted}
                               playbackRate={ytPlaybackRate}
                               pip={isPip}
                               onEnablePIP={() => setIsPip(true)}
                               onDisablePIP={() => setIsPip(false)}
                               onPlay={() => { 
                                 if (canControlPlayback && !isSyncingRef.current) {
                                   setYtPlaying(true); 
                                   handleYtAction('play'); 
                                 }
                               }}
                               onPause={() => { 
                                 if (canControlPlayback && !isSyncingRef.current) {
                                   setYtPlaying(false); 
                                   handleYtAction('pause'); 
                                 }
                               }}
                               onSeek={(time: number) => {
                                 if (canControlPlayback && !isSyncingRef.current) handleYtAction('seek', time);
                               }}
                               style={{ position: 'absolute', top: 0, left: 0 }}
                             />
                           </div>
                           {!canControlPlayback && (
                             <div className="viewer-controls-overlay" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1.5rem', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', display: 'flex', justifyContent: 'flex-end', gap: '1rem', zIndex: 10, alignItems: 'center' }}>
                               {ytMuted && (
                                 <button className="btn btn-secondary" style={{ marginRight: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setYtMuted(false)}>
                                   Click to Unmute
                                 </button>
                               )}
                               <input 
                                 type="range" 
                                 min="0" max="1" step="0.05" 
                                 value={ytMuted ? 0 : ytVolume} 
                                 onChange={e => {
                                   setYtVolume(Number(e.target.value));
                                   if (Number(e.target.value) > 0) setYtMuted(false);
                                 }} 
                                 style={{ width: '100px', cursor: 'pointer' }}
                               />
                               <button className="icon-btn" onClick={() => setIsPip(!isPip)} title="Toggle Picture-in-Picture">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                     <path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z" />
                                  </svg>
                               </button>
                               <button className="icon-btn" onClick={() => {
                                 if (!document.fullscreenElement) {
                                    document.getElementById('media-player-container')?.requestFullscreen();
                                 } else {
                                    document.exitFullscreen();
                                 }
                               }} title="Toggle Fullscreen">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                               </button>
                             </div>
                           )}
                         </>
                       ) : (
                         <>
                           <iframe
                             src={playingMedia.url}
                             width="100%"
                             height="100%"
                             allowFullScreen
                             style={{ position: 'absolute', top: 0, left: 0, border: 'none', zIndex: 1 }}
                           />
                         </>
                       )}
                     </div>
                  ) : (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'white', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Failed to load media URL.
                    </div>
                  )}

                  {!isTheaterMode && playerSeasons.length > 0 && (
                    <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid var(--border)' }}>
                       <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                          <h3 style={{ margin: 0, color: 'white', fontSize: '1.1rem' }}>Episodes</h3>
                          <select 
                             className="input-field select-field"
                             value={activePlayerSeason || 1}
                             onChange={e => handlePlayerSeasonChange(Number(e.target.value))}
                             style={{ minWidth: '150px' }}
                          >
                             {playerSeasons.map(s => (
                                <option key={s.season_number} value={s.season_number}>{s.name}</option>
                             ))}
                          </select>
                       </div>
                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                          {playerEpisodes.map(ep => (
                             <div 
                               key={ep.episode_number} 
                               onClick={async () => {
                                  if (!playingMedia?.originalUrl) return;
                                  const { getVaporpicIframe } = await import('../services/vaporpic.ts');
                                  const newUrl = await getVaporpicIframe(playingMedia.originalUrl, '1', ep.episode_number.toString(), activePlayerSeason || 1);
                                  const newItem = { 
                                    ...playingMedia, 
                                    season: activePlayerSeason || 1, 
                                    episode: ep.episode_number,
                                    url: newUrl 
                                  };
                                  handlePlayMedia(newItem);
                               }}
                               style={{
                                 background: playingMedia?.season === (activePlayerSeason || 1) && playingMedia?.episode === ep.episode_number ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                 borderRadius: '0.5rem', padding: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border)',
                                 display: 'flex', flexDirection: 'column', gap: '0.5rem'
                               }}
                             >
                                {ep.still_path ? (
                                  <img src={`https://image.tmdb.org/t/p/w300${ep.still_path}`} alt={ep.name} style={{ width: '100%', borderRadius: '0.25rem', aspectRatio: '16/9', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'rgba(255,255,255,0.2)' }}>No Image</span></div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ color: 'white', fontWeight: 500, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ep.episode_number}. {ep.name || `Episode ${ep.episode_number}`}</span>
                                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{ep.air_date ? ep.air_date.split('-')[0] : ''}</span>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                  )}
               </div>
           </div>
        )}
        </div>

      {!isTheaterMode && (
          <div className="chat-panel glass">
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               Live Chat
               
               <div style={{ position: 'relative' }}>
                 <div 
                    className="badge badge-primary" 
                    style={{ cursor: 'pointer', userSelect: 'none', background: 'var(--primary)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.8rem' }}
                    onClick={() => setShowViewersList(!showViewersList)}
                 >
                   👥 Viewers: {userCount}
                 </div>
                 
                 {showViewersList && (
                   <div className="glass" style={{
                     position: 'absolute',
                     top: '100%',
                     right: 0,
                     marginTop: '0.5rem',
                     padding: '0.5rem',
                     minWidth: '200px',
                     borderRadius: '0.5rem',
                     zIndex: 50,
                     boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                   }}>
                     <h4 style={{ margin: '0 0 0.5rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '0.9rem' }}>In Room</h4>
                     {usersList && usersList.length > 0 ? (
                       <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '200px', overflowY: 'auto' }}>
                          {usersList.map(u => (
                            <li key={u.id} style={{ padding: '0.25rem 0', fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{u.nickname} {u.isHost ? '(Host)' : ''} {u.id === socket?.id ? '(You)' : ''}</span>
                              {isOwner && u.id !== socket?.id && (
                                <button 
                                  onClick={() => {
                                    if (socket) {
                                       socket.emit('pass-host', { roomId, targetId: u.id });
                                    }
                                  }}
                                  className="btn btn-primary"
                                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                >
                                  Make Host
                                </button>
                              )}
                            </li>
                          ))}
                       </ul>
                     ) : (
                       <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Only you</div>
                     )}
                   </div>
                 )}
               </div>
            </div>
            <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                   <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '0.2rem' }}>{msg.username}</div>
                   <div style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>{msg.text}</div>
                </div>
              ))}
            </div>
             <form onSubmit={sendChatMessage} style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)}
                  className="input-field" 
                  placeholder="Type a message..." 
                  style={{ flex: 1, padding: '0.5rem', minWidth: 0 }} 
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', flexShrink: 0, width: 'auto' }}>Send</button>
             </form>
          </div>
        )}
      </div>

      {showMediaSelector && (
        <MediaSelector 
          onPlay={handlePlayMedia} 
          onClose={() => setShowMediaSelector(false)} 
        />
      )}

      {showYoutubeInput && (
        <YoutubeSelector 
          onPlay={(item) => {
            handlePlayMedia(item);
            setShowYoutubeInput(false);
          }} 
          onClose={() => setShowYoutubeInput(false)} 
        />
      )}
    </main>
  );
};

export default ScreenShare;
