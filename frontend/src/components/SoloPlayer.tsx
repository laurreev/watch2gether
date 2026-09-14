import React, { useState, useEffect } from 'react';
import { getVaporpicIframe } from '../services/vaporpic';
import type { MediaItem } from './NetflixHome';
import './SoloPlayer.css';

interface SoloPlayerProps {
  media: MediaItem;
  episode?: number;
  season?: number;
  onBack: () => void;
}

const SoloPlayer: React.FC<SoloPlayerProps> = ({ media, episode, season, onBack }) => {
  const [server, setServer] = useState<string>('1');
  const [iframeUrl, setIframeUrl] = useState('');

  useEffect(() => {
    let mounted = true;
    setIframeUrl(''); // Clear previous when server changes
    getVaporpicIframe(media.originalUrl || media.id, server, episode?.toString(), season).then(url => {
      if (mounted) setIframeUrl(url);
    });
    return () => { mounted = false; };
  }, [media, server, episode, season]);

  return (
    <div className="solo-player-container">
      <div className="solo-player-header glass">
          <button className="btn-back-solo" onClick={onBack}>← Back</button>
          
          <div className="solo-player-title">
            <span style={{color: '#a3a3a3'}}>Playing:</span> {media.title} {episode ? `- S${season || 1} E${episode}` : ''}
          </div>

          <div className="solo-player-controls">
            <select 
              className="select-input" 
              value={server} 
              onChange={(e) => setServer(e.target.value)}
              style={{ width: 'auto', padding: '0.4rem 1rem', borderRadius: '4px', background: '#222', color: 'white', border: '1px solid #444' }}
            >
              <option value="1">ZXCServer 1</option>
              <option value="2">ZXCServer 2</option>
              <option value="vidsrc">VidSrc</option>
            </select>
          </div>
        </div>

      <div className="solo-player-video-wrapper">
        {iframeUrl ? (
          <iframe
            src={iframeUrl}
            frameBorder="0"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            className="solo-player-iframe"
          ></iframe>
        ) : (
          <div className="solo-player-loading">
            <div className="spinner"></div>
            Loading server {server}...
          </div>
        )}
      </div>
    </div>
  );
};

export default SoloPlayer;
