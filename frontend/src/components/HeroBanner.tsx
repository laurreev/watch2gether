import React, { useEffect, useState } from 'react';
import { getMediaDetailsAndTrailer, type MediaDetails } from '../services/vaporpic.ts';
import type { MediaItem } from './NetflixHome.tsx';
import './HeroBanner.css';

interface HeroBannerProps {
  mediaItems: MediaItem[];
  onWatch: (media: MediaItem) => void;
}

const HeroBanner: React.FC<HeroBannerProps> = ({ mediaItems, onWatch }) => {
  const [detailsMap, setDetailsMap] = useState<Record<string, MediaDetails>>({});
  const [trailerReady, setTrailerReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const activeMedia = mediaItems[currentIndex];

  useEffect(() => {
    let mounted = true;
    setTrailerReady(false);
    
    if (activeMedia) {
      getMediaDetailsAndTrailer(activeMedia.id, activeMedia.type).then(data => {
        if (mounted && data) {
          setDetailsMap(prev => ({ ...prev, [activeMedia.id]: data }));
          // Only start trailer after 2 seconds to ensure user is resting on this item
          setTimeout(() => {
            if (mounted) setTrailerReady(true);
          }, 2000);
        }
      });
    }
    
    return () => { mounted = false; };
  }, [activeMedia]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % mediaItems.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
  };

  if (!activeMedia) {
    return <div className="hero-banner skeleton-banner" />;
  }

  return (
    <div className="hero-banner">
      <div 
        className="hero-slider" 
        style={{ 
          transform: `translateX(-${currentIndex * (100 / mediaItems.length)}%)`,
          width: `${mediaItems.length * 100}%`
        }}
      >
        {mediaItems.map((item, index) => {
          const isActive = index === currentIndex;
          const itemDetails = detailsMap[item.id];
          const bgImage = itemDetails?.backdrop_url || item.imageUrl;
          const displayTitle = itemDetails?.title || item.title;

          return (
            <div className="hero-slide" key={item.id} style={{ width: `${100 / mediaItems.length}%` }}>
              <div className="hero-media-container">
                {isActive && trailerReady && itemDetails?.youtube_trailer_id ? (
                  <iframe
                    className="hero-video"
                    src={`https://www.youtube.com/embed/${itemDetails.youtube_trailer_id}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${itemDetails.youtube_trailer_id}&modestbranding=1`}
                    frameBorder="0"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  ></iframe>
                ) : (
                  <img src={bgImage} alt={displayTitle} className="hero-bg-image" />
                )}
              </div>

              <div className="hero-vignette-top" />
              <div className="hero-vignette-left" />
              <div className="hero-vignette-bottom" />

              <div className="hero-content">
                <h1 className="hero-title">{displayTitle}</h1>
                
                {itemDetails && (
                  <>
                    <div className="hero-meta">
                      {itemDetails.vote_average ? (
                        <span className="meta-rating">
                          {itemDetails.vote_average.toFixed(1)} <span className="meta-rating-sub">/ 10 <span className="star">★</span></span>
                        </span>
                      ) : null}
                      {itemDetails.year && <span className="meta-year">{itemDetails.year}</span>}
                      <span className="meta-type">{item.type === 'Movie' ? 'Action & Adventure' : 'Sci-Fi & Fantasy'}</span>
                    </div>
                    
                    {itemDetails.overview && (
                      <p className="hero-description">
                        {itemDetails.overview.length > 250 ? itemDetails.overview.substring(0, 250) + '...' : itemDetails.overview}
                      </p>
                    )}
                  </>
                )}

                <div className="hero-actions">
                  <button className="btn-zxc btn-play" onClick={() => onWatch(item)}>
                    <span className="icon">▶</span> Play Now
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {mediaItems.length > 1 && (
        <>
          <button className="hero-nav-btn left" onClick={handlePrev}>&#8249;</button>
          <button className="hero-nav-btn right" onClick={handleNext}>&#8250;</button>
        </>
      )}
    </div>
  );
};

export default HeroBanner;
