import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useWebRTC, type Resolution } from '../hooks/useWebRTC.ts';

interface ScreenShareProps {
  roomId: string;
  onLeave: () => void;
}

// Helper component to render a media stream
const VideoStream: React.FC<{ stream: MediaStream; label: string; isLocal?: boolean }> = ({ stream, label, isLocal }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(isLocal || false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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

  const toggleFullscreen = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (videoRef.current) {
          if (document.fullscreenElement === videoRef.current) {
             document.exitFullscreen?.();
          } else if (videoRef.current.requestFullscreen) {
              videoRef.current.requestFullscreen();
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
      className="video-wrapper"
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
      <div className={`video-controls-overlay ${showControls ? 'visible' : ''}`}>
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

const ScreenShare: React.FC<ScreenShareProps> = ({ roomId, onLeave }) => {
  const { localStream, remoteStreams, startScreenShare, stopScreenShare, error } = useWebRTC(roomId);
  const [resolution, setResolution] = useState<Resolution>('max');

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomId);
    alert('Room ID copied to clipboard!');
  };

  return (
    <main className="room-container">
      <div className="room-header glass" style={{ padding: '1rem 2rem', borderRadius: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Room:</h2>
          <div className="room-id-badge" onClick={handleCopyLink} title="Click to copy">
             {roomId}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          {!localStream ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select 
                className="input-field select-field" 
                value={resolution} 
                onChange={(e) => setResolution(e.target.value as Resolution)}
                style={{ padding: '0.75rem', paddingRight: '2rem' }}
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
                <option value="1440p">1440p</option>
                <option value="4k">4K</option>
                <option value="max">Max</option>
              </select>
              <button className="btn btn-primary" onClick={() => startScreenShare(resolution)}>
                Start Sharing
              </button>
            </div>
          ) : (
            <button className="btn btn-danger" onClick={stopScreenShare}>
              Stop Sharing
            </button>
          )}
          <button className="btn" onClick={onLeave} style={{ background: 'rgba(255,255,255,0.1)' }}>
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
          <VideoStream key={peerId} stream={stream} label={`Viewer: ${peerId.substring(0, 5)}`} />
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
