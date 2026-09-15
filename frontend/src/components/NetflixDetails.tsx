import React, { useState, useEffect } from 'react';
import { getMediaDetailsAndTrailer, getTvSeasons, getEpisodesForSeason, type MediaDetails } from '../services/vaporpic.ts';
import type { MediaItem } from './NetflixHome.tsx';
import './NetflixDetails.css';

interface NetflixDetailsProps {
  media: MediaItem;
  onBack: () => void;
  onPlayLocal: (media: MediaItem, episode?: number, season?: number) => void;
  onCreateRoom: (media: MediaItem, isSynced: boolean, episode?: number, season?: number) => void;
}

const NetflixDetails: React.FC<NetflixDetailsProps> = ({ media, onBack, onPlayLocal, onCreateRoom }) => {
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let mounted = true;
    getMediaDetailsAndTrailer(media.id, media.type, media.tmdb_type).then(data => {
      if (mounted && data) setDetails(data);
    });

    const isMovie = media.tmdb_type === 'movie' || media.type === 'Movie';
    
    if (!isMovie) {
      getTvSeasons(media.id).then(fetchedSeasons => {
        if (mounted && fetchedSeasons.length > 0) {
          setSeasons(fetchedSeasons);
          setSelectedSeason(fetchedSeasons[0].season_number);
        }
      }).catch(console.error);
    }
    return () => { mounted = false; };
  }, [media]);

  useEffect(() => {
    let mounted = true;
    if (selectedSeason !== null) {
      setIsLoadingEpisodes(true);
      getEpisodesForSeason(media.id, selectedSeason).then(eps => {
        if (mounted) {
          setEpisodes(eps);
          if (eps.length > 0) setSelectedEpisode(eps[0].episode_number);
          else setSelectedEpisode(null);
          setIsLoadingEpisodes(false);
        }
      }).catch(() => {
        if (mounted) setIsLoadingEpisodes(false);
      });
    }
    return () => { mounted = false; };
  }, [selectedSeason, media.id]);

  const bgImage = details?.backdrop_url || media.imageUrl;
  
  const handlePlayEp = (ep?: number) => {
    onPlayLocal(media, ep, selectedSeason || undefined);
  };

  const handleCreateRoom = (type: 'synced' | 'unsynced', ep?: number) => {
    onCreateRoom(media, type === 'synced', ep, selectedSeason || undefined);
  };

  const isMovie = media.tmdb_type === 'movie' || media.type === 'Movie';

  return (
    <div className="netflix-details">
      <button className="btn-back" onClick={onBack}>← Back</button>
      
      <div className="details-hero movie-hero">
        <div className="details-hero-bg">
          {details?.youtube_trailer_id ? (
            <iframe
              className="details-hero-video"
              src={`https://www.youtube.com/embed/${details.youtube_trailer_id}?autoplay=1&mute=0&controls=0&showinfo=0&rel=0&loop=1&playlist=${details.youtube_trailer_id}&modestbranding=1`}
              frameBorder="0"
              allow="autoplay; encrypted-media"
              allowFullScreen
            ></iframe>
          ) : (
            <img src={bgImage} alt={media.title} />
          )}
          <div className="details-vignette-bottom"></div>
        </div>

        <div className="details-hero-content">
          <h1 className="details-title">{details?.title || media.title}</h1>
          <div className="details-meta">
            {details?.year && <span>{details.year}</span>}
            {details?.vote_average && <span className="meta-rating">★ {details.vote_average.toFixed(1)}</span>}
            {details?.runtime && <span>{details.runtime}m</span>}
            <span className="meta-type">{media.type}</span>
          </div>
          {details?.genres && (
            <div className="details-genres">
              {details.genres.join(' • ')}
            </div>
          )}
          {details?.overview && (
            <p className="details-overview">{details.overview}</p>
          )}

          <div className="hero-actions-container">
            {isMovie ? (
              <div className="details-actions">
                <button className="btn-zxc btn-play" onClick={() => handlePlayEp()}>
                  ▶ Play
                </button>
                <button className="btn-zxc btn-add" onClick={() => onCreateRoom(media, false)}>
                  👥 Create Room (Unsynced)
                </button>
                <button className="btn-zxc btn-add" onClick={() => onCreateRoom(media, true)}>
                  🔗 Create Room (Synced)
                </button>
              </div>
            ) : (
              <>
                <div className="episode-selectors">
                  {seasons.length > 0 && (
                    <select 
                      className="season-select" 
                      value={selectedSeason || ''} 
                      onChange={e => setSelectedSeason(Number(e.target.value))}
                    >
                      {seasons.map(s => (
                        <option key={s.season_number} value={s.season_number}>{s.name || `Season ${s.season_number}`}</option>
                      ))}
                    </select>
                  )}
                  {episodes.length > 0 && !isLoadingEpisodes && (
                    <select 
                      className="season-select episode-select" 
                      value={selectedEpisode || ''} 
                      onChange={e => setSelectedEpisode(Number(e.target.value))}
                    >
                      {episodes.map(ep => (
                        <option key={ep.episode_number} value={ep.episode_number}>
                          {isMobile ? `Episode ${ep.episode_number}` : `Ep ${ep.episode_number} - ${ep.name}`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                
                {isLoadingEpisodes ? (
                  <div className="loading-episodes" style={{ color: '#aaa', fontSize: '0.9rem' }}>Loading episodes...</div>
                ) : (
                  selectedEpisode !== null && (
                    <div className="details-actions">
                      <button className="btn-zxc btn-play" onClick={() => handlePlayEp(selectedEpisode)}>
                        ▶ Play
                      </button>
                      <button className="btn-zxc btn-add" onClick={() => handleCreateRoom('unsynced', selectedEpisode)}>
                        👥 Unsynced
                      </button>
                      <button className="btn-zxc btn-add" onClick={() => handleCreateRoom('synced', selectedEpisode)}>
                        🔗 Synced
                      </button>
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetflixDetails;
