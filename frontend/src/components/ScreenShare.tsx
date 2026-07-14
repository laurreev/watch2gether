import React, { useEffect, useRef } from 'react';
import { useWebRTC } from '../hooks/useWebRTC.ts';

interface ScreenShareProps {
  roomId: string;
  onLeave: () => void;
}

// Helper component to render a media stream
const VideoStream: React.FC<{ stream: MediaStream; label: string; isLocal?: boolean }> = ({ stream, label, isLocal }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleFullscreen = () => {
      if (videoRef.current) {
          if (videoRef.current.requestFullscreen) {
              videoRef.current.requestFullscreen();
          }
      }
  };

  return (
    <div className="video-wrapper">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Mute local stream to prevent feedback loop
        className="video-element"
        onClick={toggleFullscreen}
        title="Click to fullscreen"
      />
      <div className="video-label">
        <div className="indicator"></div>
        {label}
      </div>
    </div>
  );
};

const ScreenShare: React.FC<ScreenShareProps> = ({ roomId, onLeave }) => {
  const { localStream, remoteStreams, startScreenShare, stopScreenShare, error } = useWebRTC(roomId);

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
            <button className="btn btn-primary" onClick={startScreenShare}>
              Start Sharing
            </button>
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
