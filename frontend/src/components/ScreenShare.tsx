import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWebRTC, type Resolution } from '../hooks/useWebRTC.ts';

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
  const { localStream, remoteStreams, startScreenShare, stopScreenShare, error, userCount } = useWebRTC(roomId, isOwner, onLeave);
  const [resolution, setResolution] = useState<Resolution>('max');
  const [showCursor, setShowCursor] = useState(true);

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
              </div>
            ) : (
              <button className="btn btn-danger" onClick={stopScreenShare}>
                Stop Sharing
              </button>
            )
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

        {!localStream && remoteStreams.size === 0 && (
           <div className="glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gridColumn: '1 / -1', minHeight: '400px', borderRadius: '1rem', flexDirection: 'column', gap: '1rem' }}>
               <h3 style={{ color: 'var(--text-muted)' }}>Waiting for someone to share their screen...</h3>
               <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Share the Room ID with your friends so they can join.</p>
           </div>
        )}
      </div>
    </main>
  );
};

export default ScreenShare;
