import type { PlayableTvChannel } from '../components/LiveTvVideo';

export interface PbbFeed {
  id: string;
  name: string;
  shortName: string;
  angle: string;
  icon?: string;
  description: string;
  type: 'hls' | 'youtube' | 'custom' | 'embed';
  quality: string;
  isLive: boolean;
  badge?: string;
  url: string;
  dashUrl?: string;
  hlsUrl?: string;
  backupUrl?: string;
  channelId?: string;
  externalUrl?: string;
  isCustom?: boolean;
}

export interface PbbScheduleItem {
  title: string;
  time: string;
  days: string;
}

export interface PbbMeta {
  title: string;
  subtitle: string;
  status: string;
  updatedAt: string;
  schedule: PbbScheduleItem[];
  feeds: PbbFeed[];
}

const CUSTOM_FEEDS_KEY = 'watch2gether_custom_pbb_feeds';

export const DEFAULT_PBB_FEEDS: PbbFeed[] = [
  {
    id: 'pbb-cam-1',
    name: 'PBB Cam 1 — All Access (Living Area & Tasks)',
    shortName: 'Cam 1 (Living Room)',
    angle: 'Main House & Living Area',
    icon: '📹',
    description: 'Primary 24/7 multi-camera live CCTV feed monitoring the living area, central gathering space, and daily activities in Bahay ni Kuya.',
    type: 'embed',
    quality: '1080p HD',
    isLive: true,
    badge: 'LIVE 24/7',
    url: '/pbb-player.html?ch=all',
    dashUrl: 'https://pbbcollab.com/api/live/mpd/all.mpd?srv=s1',
    hlsUrl: 'https://pbbcollab.com/api/live/mpd/all.mpd?srv=s1',
  },
  {
    id: 'pbb-cam-2',
    name: 'PBB Cam 2 — External Den (Garden & Pool Area)',
    shortName: 'Cam 2 (Garden / Pool)',
    angle: 'Activity & Garden Area',
    icon: '🌴',
    description: 'Outdoor garden, swimming pool, workout gym, and weekly task challenge arena in Bahay ni Kuya.',
    type: 'embed',
    quality: '1080p HD',
    isLive: true,
    badge: 'LIVE 24/7',
    url: '/pbb-player.html?ch=ext',
    dashUrl: 'https://pbbcollab.com/api/live/mpd/ext.mpd?srv=s1',
    hlsUrl: 'https://pbbcollab.com/api/live/mpd/ext.mpd?srv=s1',
  },
  {
    id: 'pbb-cam-3',
    name: 'PBB Cam 3 — Dining Area & Kitchen',
    shortName: 'Cam 3 (Dining & Kitchen)',
    angle: 'Dining & Kitchen Area',
    icon: '🍽️',
    description: 'Kitchen discussions, cooking sessions, dining room talks, and secret strategy chats.',
    type: 'embed',
    quality: '1080p HD',
    isLive: true,
    badge: 'LIVE 24/7',
    url: '/pbb-player.html?ch=din',
    dashUrl: 'https://pbbcollab.com/api/live/mpd/din.mpd?srv=s1',
    hlsUrl: 'https://pbbcollab.com/api/live/mpd/din.mpd?srv=s1',
  },
  {
    id: 'pbb-cam-4',
    name: 'PBB Cam 4 — PBB Collab 3.0 Live Broadcast',
    shortName: 'Cam 4 (Live Show / Eviction)',
    angle: 'Official 24/7 Broadcast',
    icon: '🔴',
    description: 'Official 24/7 Live Broadcast, Primetime Episode, and Eviction Night stream in Bahay ni Kuya.',
    type: 'embed',
    quality: '1080p HD',
    isLive: true,
    badge: 'LIVE 24/7',
    url: '/pbb-player.html?ch=main',
    dashUrl: 'https://pbbcollab.com/api/live/mpd/main.mpd?srv=s1',
    hlsUrl: 'https://pbbcollab.com/api/live/mpd/main.mpd?srv=s1',
  },
  {
    id: 'pbb-kol-live',
    name: 'Kapamilya Online Live 24/7 (ABS-CBN Live)',
    shortName: 'Kapamilya Online Live',
    angle: 'ABS-CBN Entertainment',
    icon: '📺',
    description: 'Official 24/7 non-stop broadcast of ABS-CBN & PBB programming on YouTube.',
    type: 'youtube',
    quality: '1080p HD',
    isLive: true,
    badge: 'YOUTUBE 24/7',
    url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCstEtN0pgOmCf02EdXsGChw',
    externalUrl: 'https://www.youtube.com/@ABSCBNEntertainment/live',
  },
  {
    id: 'pbb-official-yt',
    name: 'Pinoy Big Brother Official YouTube Live',
    shortName: 'Official YouTube Live',
    angle: 'Official YouTube Channel',
    icon: '🔴',
    description: 'Official PBB YouTube stream for livestreams, onlineverse pre-shows, companion events, and eviction updates.',
    type: 'youtube',
    quality: '1080p HD',
    isLive: true,
    badge: 'YOUTUBE LIVE',
    channelId: 'UCsumo4lY8cd4v8Xt5zG3eSg',
    url: 'https://www.youtube-nocookie.com/embed/live_stream?channel=UCsumo4lY8cd4v8Xt5zG3eSg',
    externalUrl: 'https://www.youtube.com/@PBBabscbn/live',
  },
];

export const DEFAULT_PBB_META: PbbMeta = {
  title: 'Pinoy Big Brother 24/7 Live Stream',
  subtitle: 'Bahay ni Kuya — All-Access Multi-Camera Feeds',
  status: 'online',
  updatedAt: new Date().toISOString(),
  schedule: [
    { title: '24/7 House Feeds', time: 'Round the Clock', days: 'Monday – Sunday' },
    { title: 'Daily Primetime Episode', time: '10:15 PM PST', days: 'Monday – Friday' },
    { title: 'Weekend Big Night & Eviction', time: '7:00 PM (Sat) / 7:15 PM (Sun)', days: 'Saturday & Sunday' },
  ],
  feeds: DEFAULT_PBB_FEEDS,
};

export async function fetchPbbMeta(signal?: AbortSignal): Promise<PbbMeta> {
  try {
    const res = await fetch('/api/pbb/feeds', { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: PbbMeta = await res.json();
    return data;
  } catch {
    return DEFAULT_PBB_META;
  }
}

export function getCustomPbbFeeds(): PbbFeed[] {
  try {
    const raw = localStorage.getItem(CUSTOM_FEEDS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCustomPbbFeed(feed: PbbFeed): PbbFeed[] {
  const current = getCustomPbbFeeds();
  const existingIdx = current.findIndex((f) => f.id === feed.id);
  let updated: PbbFeed[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = feed;
  } else {
    updated = [feed, ...current];
  }
  try {
    localStorage.setItem(CUSTOM_FEEDS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export function deleteCustomPbbFeed(id: string): PbbFeed[] {
  const current = getCustomPbbFeeds();
  const updated = current.filter((f) => f.id !== id);
  try {
    localStorage.setItem(CUSTOM_FEEDS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export function pbbFeedToPlayableChannel(feed: PbbFeed): PlayableTvChannel {
  const streams = [
    {
      url: feed.url,
      quality: feed.quality,
      label: feed.shortName,
      userAgent: null,
      referrer: null,
    },
  ];
  if (feed.backupUrl) {
    streams.push({
      url: feed.backupUrl,
      quality: feed.quality,
      label: 'Backup Feed',
      userAgent: null,
      referrer: null,
    });
  }

  return {
    id: feed.id,
    name: feed.name,
    country: 'PH',
    countryName: 'Philippines',
    flag: '🇵🇭',
    primaryCategory: 'PBB Live',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Kapamilya_Channel_2020.svg/512px-Kapamilya_Channel_2020.svg.png',
    streams,
  };
}
