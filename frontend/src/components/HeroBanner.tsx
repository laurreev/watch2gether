import React, { useEffect, useState } from 'react';
import { getMediaDetailsAndTrailer, type MediaDetails } from '../services/vaporpic.ts';
import type { MediaItem } from './NetflixHome.tsx';
import ReactPlayerModule from 'react-player';
import './HeroBanner.css';

const ReactPlayer = (ReactPlayerModule as any).default || ReactPlayerModule;

interface HeroBannerProps {
  mediaItems: MediaItem[];
  onWatch: (media: MediaItem) => void;
}

const HeroBanner: React.FC<HeroBannerProps> = ({ mediaItems, onWatch }) => {
  const [detailsMap, setDetailsMap] = useState<Record<string, MediaDetails>>({});
  const [trailerReady, setTrailerReady] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const activeMedia = mediaItems[currentIndex];

  // Reset playing state when slide changes
  useEffect(() => {
    setIsPlaying(false);
  }, [currentIndex]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (mediaItems.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % mediaItems.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [mediaItems.length]);

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

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    if (isLeftSwipe) {
      handleNext();
    }
    if (isRightSwipe) {
      handlePrev();
    }
    setTouchStart(0);
    setTouchEnd(0);
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {mediaItems.map((item, index) => {
          const isActive = index === currentIndex;
          const itemDetails = detailsMap[item.id];
          const bgImage = itemDetails?.backdrop_url || item.imageUrl;
          const displayTitle = itemDetails?.title || item.title;

          return (
            <div className="hero-slide" key={item.id} style={{ width: `${100 / mediaItems.length}%` }}>
              <div className="hero-media-container">
                <img src={bgImage} alt={displayTitle} className="hero-bg-image" style={{ position: 'absolute', zIndex: 0 }} />
                
                {isActive && trailerReady && itemDetails?.youtube_trailer_id && !isMobile ? (
                  <div style={{ opacity: isPlaying ? 1 : 0, transition: 'opacity 0.5s', position: 'absolute', width: '100%', height: '100%', zIndex: 1 }}>
                    <ReactPlayer
                      url={`https://www.youtube.com/watch?v=${itemDetails.youtube_trailer_id}`}
                      playing={true}
                      muted={true}
                      controls={false}
                      loop={true}
                      playsinline={true}
                      width="100%"
                      height="100%"
                      className="hero-video"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      config={{
                        youtube: {
                          playerVars: {
                            showinfo: 0,
                            rel: 0,
                            modestbranding: 1,
                            iv_load_policy: 3,
                            disablekb: 1
                          }
                        }
                      }}
                    />
                  </div>
                ) : null}
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
                          ★ {itemDetails.vote_average.toFixed(1)}
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
