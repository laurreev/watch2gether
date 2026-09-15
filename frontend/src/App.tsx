import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import ScreenShare from './components/ScreenShare';
import SoloPlayer from './components/SoloPlayer';
import Sidebar from './components/Sidebar';
import type { TabType } from './components/Sidebar';
import NetflixHome from './components/NetflixHome';
import NetflixDetails from './components/NetflixDetails';
import type { MediaItem } from './components/NetflixHome';
import { getMediaDetails } from './services/vaporpic';
import './index.css';

interface PublicRoom {
  roomId: string;
  viewerCount: number;
  media: any;
}

function App() {
  const [roomId, setRoomId] = useState<string>('');
  const [inRoom, setInRoom] = useState<boolean>(false);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [joinId, setJoinId] = useState<string>('');
  const [error, setError] = useState<string>('');

  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const socketUrl = import.meta.env.PROD ? '' : 'http://localhost:3000';

  const [roomConfig, setRoomConfig] = useState<{ isPublic: boolean; password?: string }>();
  const [createPromptVisible, setCreatePromptVisible] = useState(false);
  const [createPassword, setCreatePassword] = useState('');
  const [isCreatingPublic, setIsCreatingPublic] = useState(true);


  const [view, setView] = useState<'home' | 'details' | 'player' | 'rooms' | 'solo'>('home');
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isResolvingRoute, setIsResolvingRoute] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [localPlayEp, setLocalPlayEp] = useState<number | undefined>(undefined);
  const [localPlaySeason, setLocalPlaySeason] = useState<number | undefined>(undefined);
  const [localPlaySynced, setLocalPlaySynced] = useState(false);

  const [joinPromptTarget, setJoinPromptTarget] = useState<{ id: string, isPublic: boolean } | null>(null);
  const [joinPromptPassword, setJoinPromptPassword] = useState('');

  const [nickname, setNickname] = useState(() => localStorage.getItem('watch2gether_nickname') || '');
  const [tempNickname, setTempNickname] = useState('');

  const [activeUsers, setActiveUsers] = useState<number>(0);

  // Active users count listener
  useEffect(() => {
    let uid = localStorage.getItem('watch2gether_uid');
    if (!uid) {
      uid = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('watch2gether_uid', uid);
    }

    const socket = io(socketUrl, { query: { userId: uid } });
    socket.on('active-users-count', (count: number) => {
      setActiveUsers(count);
    });
    return () => {
      socket.disconnect();
    };
  }, [socketUrl]);

  // Session auto-rejoin
  useEffect(() => {
    const savedRoom = sessionStorage.getItem('watch2gether_room');
    if (savedRoom) {
      const { id, isOwner: savedIsOwner, isPublic, password } = JSON.parse(savedRoom);

      // Ping backend to check if room is still alive
      fetch(`${socketUrl}/api/room/${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.exists || savedIsOwner) {
            const actualIsPublic = data.exists ? data.isPublic : (isPublic ?? true);
            // If we are the owner, we can recreate the room even if it was destroyed during refresh
            setRoomId(id);
            setIsOwner(savedIsOwner);
            setRoomConfig({ isPublic: actualIsPublic, password: password ?? '' });
            setInRoom(true);
            setView('player');
          } else {
            sessionStorage.removeItem('watch2gether_room');
          }
        })
        .catch(console.error);
    }
  }, []);

  // Poll public rooms
  useEffect(() => {
    if (inRoom) return;
    const fetchRooms = async () => {
      try {
        const res = await fetch(`${socketUrl}/api/rooms`);
        const data = await res.json();
        setPublicRooms(data);
      } catch (err) {
        console.error('Failed to fetch rooms', err);
      }
    };
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [inRoom, socketUrl]);

  // Handle browser back/forward navigation for tabs and deep links
  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash.replace('#', '');
      
      if (hash.startsWith('room/')) {
        const targetId = hash.split('/')[1];
        if (targetId && !inRoom) {
          // Check if the user is the owner of this room (saved in sessionStorage)
          const savedRoom = sessionStorage.getItem('watch2gether_room');
          if (savedRoom) {
            const saved = JSON.parse(savedRoom);
            if (saved.id === targetId && saved.isOwner) {
              // Owner refreshed — skip the password dialog, auto-rejoin handled by the sessionStorage effect
              setIsResolvingRoute(false);
              return;
            }
          }
          // Otherwise prompt to join (for non-owners following a link)
          setJoinPromptTarget({ id: targetId, isPublic: false });
        }
        setIsResolvingRoute(false);
      } else if (hash.startsWith('details/') || hash.startsWith('solo/')) {
        const parts = hash.split('/');
        const typeStr = decodeURIComponent(parts[1]);
        const idStr = parts[2];
        if (idStr && typeStr) {
          try {
            const data = await getMediaDetails(idStr, typeStr);
            if (data) {
              const mapped: MediaItem = {
                id: data.id,
                title: data.title,
                type: typeStr as any,
                imageUrl: data.poster_url || 'https://via.placeholder.com/300x450/141414/ffffff?text=No+Image',
                url: data.url,
                originalUrl: data.originalUrl,
                year: data.year,
                overview: data.overview,
                vote_average: data.vote_average,
              };
              setSelectedMedia(mapped);
              if (hash.startsWith('details/')) {
                setView('details');
              } else {
                setView('solo');
              }
            }
          } catch (e) {
             console.error('Failed to resolve deep link', e);
          }
        }
        setIsResolvingRoute(false);
      } else if (['home', 'search', 'movies', 'series', 'anime', 'kdrama'].includes(hash)) {
        setActiveTab(hash as TabType);
        setView('home');
        setIsResolvingRoute(false);
      } else {
        // Default
        setView('home');
        setIsResolvingRoute(false);
      }
    };
    
    handleHashChange(); // Run on mount
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [inRoom]);

  const handleLeave = (errorMsg?: string) => {
    setInRoom(false);
    setRoomId('');
    setView('home');
    window.location.hash = activeTab;
    sessionStorage.removeItem('watch2gether_room');
    if (typeof errorMsg === 'string') {
      setError(errorMsg);
    }
  };

  const handlePlayLocal = (media: MediaItem, episode?: number, season?: number) => {
    setSelectedMedia(media);
    setLocalPlayEp(episode);
    setLocalPlaySeason(season);
    setRoomId('');
    setInRoom(false);
    setView('solo');
    window.location.hash = `solo/${encodeURIComponent(media.type)}/${media.id}`;
  };

  const handleCreateRoom = (media: MediaItem, isSynced: boolean, episode?: number, season?: number) => {
    setSelectedMedia(media);
    setLocalPlayEp(episode);
    setLocalPlaySeason(season);
    setLocalPlaySynced(isSynced);
    setCreatePromptVisible(true);
  };

  const confirmCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const newRoomId = Math.random().toString(36).substring(2, 9);

    sessionStorage.setItem('watch2gether_room', JSON.stringify({
      id: newRoomId,
      isOwner: true,
      isPublic: isCreatingPublic,
      password: createPassword
    }));

    setRoomId(newRoomId);
    setIsOwner(true);
    setRoomConfig({ isPublic: isCreatingPublic, password: createPassword });
    setInRoom(true);
    setView('player');
    setCreatePromptVisible(false);
    window.location.hash = `room/${newRoomId}`;
  };

  const joinRoom = async (e?: React.FormEvent, directId?: string, isPublicClick: boolean = false) => {
    if (e) e.preventDefault();
    const targetId = directId || joinId.trim();

    if (targetId) {
      try {
        const res = await fetch(`${socketUrl}/api/room/${targetId}`);
        const data = await res.json();

        if (data.exists) {
          setError('');

          if (data.requiresPassword && !isPublicClick) {
            setJoinPromptTarget({ id: targetId, isPublic: data.isPublic });
            setJoinPromptPassword('');
            return;
          }

          finalizeJoinRoom(targetId, '', data.isPublic);
        } else {
          setError('Room does not exist. Please check the Room ID.');
        }
      } catch (err) {
        setError('Error connecting to the server.');
      }
    }
  };

  const finalizeJoinRoom = (targetId: string, attemptedPassword: string, isPublic: boolean) => {
    sessionStorage.setItem('watch2gether_room', JSON.stringify({
      id: targetId,
      isOwner: false,
      isPublic: isPublic,
      password: attemptedPassword
    }));

    setRoomId(targetId);
    setIsOwner(false);
    setRoomConfig({ isPublic: isPublic, password: attemptedPassword });
    setInRoom(true);
    setView('player');
    window.location.hash = `room/${targetId}`;
    setJoinPromptTarget(null);
  };

  if (isResolvingRoute) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#141414', color: 'white' }}>Loading...</div>;
  }

  return (
    <div className="app-container">
      {nickname && view !== 'player' && view !== 'solo' && (
        <Sidebar 
          activeTab={view === 'rooms' ? ('rooms' as any) : activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setView('home');
            window.location.hash = tab;
          }}
          activeUsers={activeUsers}
          nickname={nickname}
          onOpenRooms={() => setView('rooms')}
        />
      )}

      <div 
        className={`main-content ${nickname && view !== 'player' && view !== 'solo' ? 'with-sidebar' : ''}`}
      >
        {!nickname ? (
        <main className="join-container">
          <div className="join-card glass" style={{ maxWidth: 400, margin: '2rem auto' }}>
            <h2 className="join-title" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Choose a Nickname</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (tempNickname.trim()) {
                localStorage.setItem('watch2gether_nickname', tempNickname.trim());
                setNickname(tempNickname.trim());
              }
            }}>
              <input
                value={tempNickname}
                onChange={e => setTempNickname(e.target.value)}
                placeholder="Enter your nickname"
                required
                className="input-field"
                style={{ marginBottom: '1rem' }}
                autoFocus
              />
              <button type="submit" className="btn btn-primary" style={{ width: '100%', background: '#e50914' }}>Continue</button>
            </form>
          </div>
        </main>
      ) : view === 'home' ? (
        <NetflixHome 
          activeTab={activeTab}
          onWatch={(media) => {
            setSelectedMedia(media);
            setView('details');
            window.location.hash = `details/${encodeURIComponent(media.type)}/${media.id}`;
          }} 
        />
      ) : view === 'details' && selectedMedia ? (
        <NetflixDetails 
          media={selectedMedia} 
          onBack={() => { setView('home'); window.location.hash = activeTab; }} 
          onPlayLocal={handlePlayLocal}
          onCreateRoom={handleCreateRoom}
        />
      ) : view === 'player' ? (
        <ScreenShare
          roomId={roomId}
          isOwner={isOwner}
          onLeave={handleLeave}
          onHostMigrate={(isHost: boolean) => {
            setIsOwner(isHost);
            const saved = JSON.parse(sessionStorage.getItem('watch2gether_room') || '{}');
            sessionStorage.setItem('watch2gether_room', JSON.stringify({ ...saved, isOwner: isHost }));
          }}
          roomConfig={roomConfig}
          initialMedia={selectedMedia || undefined}
          initialEpisode={localPlayEp}
          initialSeason={localPlaySeason}
          initialSynced={localPlaySynced}
        />
      ) : view === 'solo' && selectedMedia ? (
        <SoloPlayer 
          media={selectedMedia}
          episode={localPlayEp}
          season={localPlaySeason}
          onBack={() => { setView('details'); window.location.hash = `details/${encodeURIComponent(selectedMedia.type)}/${selectedMedia.id}`; }}
        />
      ) : view === 'rooms' ? (
        <main className="join-container" style={{ paddingTop: '80px' }}>
          <div className="landing-grid">
            <div className="join-card glass">
              <button className="btn btn-secondary" onClick={() => setView('home')} style={{ marginBottom: '1rem' }}>← Back to Home</button>
              <h2 className="join-title">Create a Room</h2>
              <button
                className="btn btn-primary"
                style={{ width: '100%', background: '#e50914', marginBottom: '2rem' }}
                onClick={() => { setSelectedMedia(null); setLocalPlaySynced(false); setCreatePromptVisible(true); }}
              >
                + Create Room
              </button>

              <h2 className="join-title">Join a Room</h2>
              <form onSubmit={joinRoom} className="input-group">
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter Room ID"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ background: '#e50914' }}>
                  Join Room
                </button>
              </form>
              {error && <div style={{ color: 'var(--danger)', marginTop: '1rem' }}>{error}</div>}
            </div>

            <div className="public-rooms-card glass">
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Public Rooms</h2>
              {publicRooms.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>No public rooms active right now.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {publicRooms.map(room => (
                    <div key={room.roomId} className="public-room-item" onClick={() => joinRoom(undefined, room.roomId, true)}>
                      <div className="public-room-info">
                        <h3>Room: {room.roomId}</h3>
                        <p>
                          {room.viewerCount} {room.viewerCount === 1 ? 'Viewer' : 'Viewers'}
                          {room.media ? ` • Watching: ${room.media.title}` : ' • In Lobby'}
                        </p>
                      </div>
                      <button className="btn" style={{ background: '#e50914', color: 'white', padding: '0.4rem 1rem' }}>Join</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      ) : null}

      {/* Modals */}
      {createPromptVisible && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <form className="glass" style={{ padding: '2rem', borderRadius: '1rem', width: '100%', maxWidth: '400px' }} onSubmit={confirmCreateRoom}>
            <h2 style={{ marginTop: 0 }}>Create Room</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Room Visibility</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" checked={isCreatingPublic} onChange={() => setIsCreatingPublic(true)} />
                  Public (Listed)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="radio" checked={!isCreatingPublic} onChange={() => setIsCreatingPublic(false)} />
                  Private (Requires ID/Password)
                </label>
              </div>
            </div>
            {!isCreatingPublic && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Password (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  value={createPassword}
                  onChange={e => setCreatePassword(e.target.value)}
                  placeholder="Leave blank for no password"
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={() => setCreatePromptVisible(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create</button>
            </div>
          </form>
        </div>
      )}

      {joinPromptTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <form className="glass" style={{ padding: '2rem', borderRadius: '1rem', width: '100%', maxWidth: '400px' }} onSubmit={(e) => { e.preventDefault(); finalizeJoinRoom(joinPromptTarget.id, joinPromptPassword, joinPromptTarget.isPublic); }}>
            <h2 style={{ marginTop: 0 }}>Room Password Required</h2>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>Enter Password</label>
              <input
                type="password"
                className="input-field"
                value={joinPromptPassword}
                onChange={e => setJoinPromptPassword(e.target.value)}
                placeholder="Password"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={() => setJoinPromptTarget(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Join</button>
            </div>
          </form>
        </div>
      )}
      </div>
    </div>
  );
}

export default App;
