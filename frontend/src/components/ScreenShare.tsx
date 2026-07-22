import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWebRTC, type Resolution } from '../hooks/useWebRTC.ts';
import MediaSelector from './MediaSelector.tsx';
import ReactPlayerModule from 'react-player';
const ReactPlayer = ReactPlayerModule as any;

interface ScreenShareProps {
  roomId: string;
  isOwner: boolean;
  onLeave: () => void;
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

const ScreenShare: React.FC<ScreenShareProps> = ({ roomId, isOwner, onLeave }) => {
  const { localStream, remoteStreams, startScreenShare, stopScreenShare, error, userCount, socket } = useWebRTC(roomId, isOwner, onLeave);
  const [resolution, setResolution] = useState<Resolution>('max');
  const [showCursor, setShowCursor] = useState(true);
  const [showMediaSelector, setShowMediaSelector] = useState(false);
  const [playingMedia, setPlayingMedia] = useState<{title: string, type: string, url?: string, originalUrl?: string, episode?: number, season?: number} | null>(null);
  const [activeServer, setActiveServer] = useState('1');
  const [isExtractingServer, setIsExtractingServer] = useState(false);

  const handlePlayMedia = (item: any) => {
    setPlayingMedia(item);
    setActiveServer('1'); // Reset to default when new media plays
    setShowMediaSelector(false);
    if (isOwner && socket) {
      socket.emit('play-media', { roomId, media: { ...item, serverStr: '1' } });
    }
  };

  const handleStopMedia = () => {
    setPlayingMedia(null);
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
    alert('Room ID copied to clipboard!');
  };

  return (
    <main className="room-container">
      <div className="room-header glass">
        <div className="room-info">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Room:</h2>
          <div className="room-id-badge" onClick={handleCopyLink} title="Click to copy">
             {roomId}
          </div>
          <div className="viewer-badge">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: userCount > 0 ? '#22c55e' : 'var(--text-muted)' }}></span>
            {userCount} Viewer{userCount !== 1 ? 's' : ''}
          </div>
        </div>
        
        <div className="room-controls">
          {isOwner && (
            !localStream ? (
              <div className="share-controls">
                <label className="cursor-toggle">
                  <input type="checkbox" checked={showCursor} onChange={(e) => setShowCursor(e.target.checked)} />
                  Show Cursor
                </label>
                <select 
                  className="input-field select-field" 
                  value={resolution} 
                  onChange={(e) => setResolution(e.target.value as Resolution)}
                >
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                  <option value="1440p">1440p</option>
                  <option value="max">Max Quality (1440p)</option>
                </select>
                <button className="btn btn-primary" onClick={() => startScreenShare(resolution, showCursor)}>
                  Start Sharing
                </button>
                <button className="btn btn-secondary" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={() => setShowMediaSelector(true)}>
                  Find something to watch
                </button>
              </div>
            ) : (
              <button className="btn btn-danger" onClick={stopScreenShare}>
                Stop Sharing
              </button>
            )
          )}
          {isOwner && playingMedia && (
             <div style={{ display: 'flex', gap: '0.5rem' }}>
               <select 
                 className="input-field select-field"
                 value={activeServer}
                 onChange={(e) => handleServerChange(e.target.value)}
                 disabled={isExtractingServer}
               >
                  <option value="1">Vidsrc ME</option>
                  <option value="2">2Embed</option>
                  <option value="3">Multiembed</option>
               </select>
               <button className="btn btn-danger" onClick={handleStopMedia}>
                 Stop Playing
               </button>
             </div>
          )}
          <button className="btn btn-leave" onClick={onLeave}>
            Leave
          </button>
        </div>
      </div>

      {error && (
        <div className="glass" style={{ padding: '1rem', color: 'var(--danger)', borderRadius: '0.5rem', textAlign: 'center' }}>
          {error}
        </div>
      )}

      <div className="video-grid">
        {localStream && (
          <VideoStream stream={localStream} label="You (Sharing)" isLocal={true} />
        )}
        
        {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
          <VideoStream key={peerId} stream={stream} label={`Viewer: ${peerId.substring(0, 5)}`} isLocal={false} />
        ))}

        {!localStream && remoteStreams.size === 0 && !playingMedia && (
           <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gridColumn: '1 / -1', minHeight: '400px', borderRadius: '1rem', flexDirection: 'column', gap: '1rem' }}>
               <h3 style={{ color: 'var(--text-muted)' }}>Waiting for someone to share their screen...</h3>
               <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Share the Room ID with your friends so they can join.</p>
           </div>
        )}

        {playingMedia && (
           <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gridColumn: '1 / -1', minHeight: '600px', borderRadius: '1rem', flexDirection: 'column', gap: '1rem', background: '#000', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
                 <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)' }}>
                   <h2 style={{ color: 'white', margin: 0, fontSize: '1.2rem' }}>Playing: {playingMedia.title}{playingMedia.season ? ` - Season ${playingMedia.season}` : ''}{playingMedia.episode ? ` (Episode ${playingMedia.episode})` : ''}</h2>
                   <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{playingMedia.type}</span>
                 </div>
                 {isExtractingServer ? (
                     <div style={{ padding: '2rem', textAlign: 'center', color: 'white', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       Loading new server stream...
                     </div>
                  ) : playingMedia.url ? (
                     <div id="media-player-container" style={{ width: '100%', flex: 1, minHeight: '500px', background: '#000', position: 'relative' }}>
                       {playingMedia.url.includes('.mp4') || playingMedia.url.includes('.m3u8') ? (
                         <>
                           {/* @ts-ignore react-player types issue */}
                           <ReactPlayer
                             url={playingMedia.url}
                             width="100%"
                             height="100%"
                             controls={true}
                             playing
                             style={{ position: 'absolute', top: 0, left: 0 }}
                           />
                         </>
                       ) : (
                         <>
                           <iframe
                             src={playingMedia.url}
                             width="100%"
                             height="100%"
                             allowFullScreen
                             style={{ position: 'absolute', top: 0, left: 0, border: 'none' }}
                           />
                         </>
                       )}
                     </div>
                  ) : (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'white', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Failed to load media URL.
                    </div>
                  )}
               </div>
           </div>
        )}
      </div>

      {showMediaSelector && (
        <MediaSelector 
          onPlay={handlePlayMedia} 
          onClose={() => setShowMediaSelector(false)} 
        />
      )}
    </main>
  );
};

export default ScreenShare;
