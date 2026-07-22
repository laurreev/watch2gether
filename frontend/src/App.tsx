import { useState, useEffect } from 'react';
import ScreenShare from './components/ScreenShare.tsx';
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

  const [joinPromptTarget, setJoinPromptTarget] = useState<string | null>(null);
  const [joinPromptPassword, setJoinPromptPassword] = useState('');

  // Session auto-rejoin
  useEffect(() => {
    const savedRoom = sessionStorage.getItem('watch2gether_room');
    if (savedRoom) {
      const { id, isOwner: savedIsOwner, isPublic, password } = JSON.parse(savedRoom);
      
      // Ping backend to check if room is still alive
      fetch(`${socketUrl}/api/room/${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.exists) {
            setRoomId(id);
            setIsOwner(savedIsOwner);
            setRoomConfig({ isPublic: isPublic ?? true, password: password ?? '' });
            setInRoom(true);
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
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, [inRoom]);

  const startCreateRoom = () => {
    setIsCreatingPublic(true);
    setCreatePassword('');
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
    setCreatePromptVisible(false);
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
             setJoinPromptTarget(targetId);
             setJoinPromptPassword('');
             return;
          }
          
          finalizeJoinRoom(targetId, '');
        } else {
          setError('Room does not exist. Please check the Room ID.');
        }
      } catch (err) {
        setError('Error connecting to the server.');
      }
    }
  };

  const finalizeJoinRoom = (targetId: string, attemptedPassword: string) => {
    sessionStorage.setItem('watch2gether_room', JSON.stringify({
      id: targetId,
      isOwner: false,
      attemptedPassword
    }));

    setRoomId(targetId);
    setIsOwner(false);
    setInRoom(true);
    setJoinPromptTarget(null);
  };

  const handleLeave = () => {
    setInRoom(false);
    sessionStorage.removeItem('watch2gether_room');
  };

  return (
    <div className="app-container">
      <header className="header glass">
        <div className="logo">Watch2Gether</div>
      </header>

      {!inRoom ? (
        <main className="join-container">
          <div className="landing-grid">
            <div className="join-card glass">
              <h1 className="join-title">High-Fidelity Screen Share</h1>
              <p className="join-subtitle">No limits on FPS or resolution.</p>
              
              <div className="input-group">
                <button className="btn btn-primary" onClick={startCreateRoom}>
                   Create New Room
                </button>
              </div>

              <div style={{ margin: '2rem 0', color: 'var(--text-muted)' }}>— or —</div>

              <form onSubmit={joinRoom} className="input-group">
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter Room ID"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  Join Private Room
                </button>
              </form>
              {error && <div style={{ color: 'var(--danger)', marginTop: '1rem' }}>{error}</div>}
            </div>

            <div className="public-rooms-card glass">
               <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Public Rooms</h2>
               {publicRooms.length === 0 ? (
                 <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>No public rooms active right now. Create one!</p>
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
                       <button className="btn" style={{ background: 'var(--primary)', padding: '0.4rem 1rem' }}>Join</button>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>
        </main>
      ) : (
        <ScreenShare 
          roomId={roomId} 
          isOwner={isOwner} 
          onLeave={handleLeave} 
          onHostMigrate={() => setIsOwner(true)} 
          roomConfig={roomConfig}
        />
      )}

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
          <form className="glass" style={{ padding: '2rem', borderRadius: '1rem', width: '100%', maxWidth: '400px' }} onSubmit={(e) => { e.preventDefault(); finalizeJoinRoom(joinPromptTarget, joinPromptPassword); }}>
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
  );
}

export default App;
