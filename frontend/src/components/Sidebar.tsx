import React from 'react';
import './Sidebar.css';

export type TabType = 'home' | 'search' | 'movies' | 'series' | 'anime' | 'asian';

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>
);

const MoviesIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2"/>
    <path d="M7 3v18"/>
    <path d="M3 7.5h4"/>
    <path d="M3 12h18"/>
    <path d="M3 16.5h4"/>
    <path d="M17 3v18"/>
    <path d="M17 7.5h4"/>
    <path d="M17 16.5h4"/>
  </svg>
);

const SeriesIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="15" x="2" y="7" rx="2" ry="2"/>
    <polyline points="17 2 12 7 7 2"/>
  </svg>
);

const AnimeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/>
    <path d="M3 5h4"/>
  </svg>
);

const AsianIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    <path d="M2 12h20"/>
  </svg>
);

const RoomsIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  activeUsers: number;
  nickname: string;
  onOpenRooms: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, activeUsers, nickname, onOpenRooms }) => {
  const tabs = [
    { id: 'home', icon: <HomeIcon />, label: 'Home' },
    { id: 'search', icon: <SearchIcon />, label: 'Search' },
    { id: 'movies', icon: <MoviesIcon />, label: 'Movies' },
    { id: 'series', icon: <SeriesIcon />, label: 'Series' },
    { id: 'anime', icon: <AnimeIcon />, label: 'Anime' },
    { id: 'asian', icon: <AsianIcon />, label: 'Asian' },
  ];

  return (
    <aside className="sidebar-nav">
      <div className="sidebar-logo">
        <span className="icon" style={{ display: 'flex', alignItems: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 7 20 7 4 17 20 17"/>
          </svg>
        </span>
        <span className="text" style={{ color: '#e50914', fontWeight: 800 }}>WATCH2GETHER</span>
      </div>

      <nav className="sidebar-menu">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            className={`sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id as TabType)}
          >
            <span className="icon">{tab.icon}</span>
            <span className="text">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {nickname && (
          <div className="sidebar-users">
            <span className="icon" style={{ color: '#22c55e' }}>●</span>
            <span className="text">{activeUsers} Online</span>
          </div>
        )}
        <button className="sidebar-item btn-rooms" onClick={onOpenRooms}>
          <span className="icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RoomsIcon /></span>
          <span className="text">Rooms</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
