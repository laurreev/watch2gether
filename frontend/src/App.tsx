import { useState } from 'react';
import ScreenShare from './components/ScreenShare.tsx';
import './index.css';

function App() {
  const [roomId, setRoomId] = useState<string>('');
  const [inRoom, setInRoom] = useState<boolean>(false);
  const [joinId, setJoinId] = useState<string>('');
  const [error, setError] = useState<string>('');

  const createRoom = () => {
    // Generate a simple random room ID
    const newRoomId = Math.random().toString(36).substring(2, 9);
    setRoomId(newRoomId);
    setInRoom(true);
  };

  const joinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joinId.trim()) {
      try {
        const socketUrl = import.meta.env.PROD ? '' : 'http://localhost:3000';
        const res = await fetch(`${socketUrl}/api/room/${joinId.trim()}`);
        const data = await res.json();
        
        if (data.exists) {
          setError('');
          setRoomId(joinId.trim());
          setInRoom(true);
        } else {
          setError('Room does not exist. Please check the Room ID.');
        }
      } catch (err) {
        setError('Error connecting to the server.');
      }
    }
  };

  return (
    <div className="app-container">
      <header className="header glass">
        <div className="logo">Watch2Gether</div>
      </header>

      {!inRoom ? (
        <main className="join-container">
          <div className="join-card glass">
            <h1 className="join-title">High-Fidelity Screen Share</h1>
            <p className="join-subtitle">No limits on FPS or resolution.</p>
            
            <div className="input-group">
              <button className="btn btn-primary" onClick={createRoom}>
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
                Join Room
              </button>
            </form>
            {error && <div style={{ color: 'var(--danger)', marginTop: '1rem' }}>{error}</div>}
          </div>
        </main>
      ) : (
        <ScreenShare roomId={roomId} onLeave={() => setInRoom(false)} />
      )}
    </div>
  );
}

export default App;
