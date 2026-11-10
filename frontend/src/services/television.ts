export interface TvStream {
  url: string;
  quality: string;
  label: string;
  userAgent: string | null;
  referrer: string | null;
  isGeoBlocked?: boolean;
}

export interface TvChannel {
  id: string;
  name: string;
  logo: string;
  country: string;
  countryName: string;
  flag: string;
  categories: string[];
  tvGroups: string[];
  primaryCategory: string;
  quality: string;
  isCurated: boolean;
  score: number;
  streams: TvStream[];
}

export interface TvCategory {
  id: string;
  name: string;
  count: number;
}

export interface TvCountry {
  code: string;
  name: string;
  flag: string;
  count: number;
}

export interface TvMeta {
  totalChannels: number;
  localCountry: string;
  localCount: number;
  internationalCount: number;
  categories: TvCategory[];
  countries: TvCountry[];
}

export interface TvFeaturedShelves {
  local: TvChannel[];
  cartoons: TvChannel[];
  wildlife: TvChannel[];
  sports: TvChannel[];
  international: TvChannel[];
}

export interface TvChannelsResponse {
  channels: TvChannel[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

const API_BASE = '';

const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'Asia/Manila': 'PH',
  'Asia/Tokyo': 'JP',
  'Asia/Seoul': 'KR',
  'Asia/Singapore': 'SG',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Bangkok': 'TH',
  'Asia/Jakarta': 'ID',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Taipei': 'TW',
  'Asia/Hong_Kong': 'HK',
  'Asia/Kolkata': 'IN',
  'Asia/Dubai': 'AE',
  'Europe/London': 'GB',
  'Europe/Paris': 'FR',
  'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Sao_Paulo': 'BR',
  'America/Mexico_City': 'MX',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
};

export function detectDefaultLocalCountry(): string {
  const saved = localStorage.getItem('watch2gether_local_country');
  if (saved && /^[A-Z]{2,3}$/.test(saved)) return saved;

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_COUNTRY[tz]) {
      return TIMEZONE_TO_COUNTRY[tz];
    }
    if (tz && tz.startsWith('America/')) return 'US';
    if (tz && tz.startsWith('Australia/')) return 'AU';
  } catch {
    // ignore
  }

  try {
    const lang = navigator.language || '';
    if (/^(fil|tl)/i.test(lang) || /-PH$/i.test(lang)) return 'PH';
    const parts = lang.split('-');
    if (parts.length === 2 && /^[A-Za-z]{2}$/.test(parts[1])) {
      return parts[1].toUpperCase();
    }
  } catch {
    // ignore
  }

  return 'PH';
}

export function buildTvProxyUrl(stream: Pick<TvStream, 'url' | 'userAgent' | 'referrer'>): string {
  let out = `${API_BASE}/api/tv/proxy?url=${encodeURIComponent(stream.url)}`;
  if (stream.userAgent) out += `&ua=${encodeURIComponent(stream.userAgent)}`;
  if (stream.referrer) out += `&ref=${encodeURIComponent(stream.referrer)}`;
  return out;
}

export async function fetchTvMeta(localCountry: string, signal?: AbortSignal): Promise<TvMeta> {
  const res = await fetch(`${API_BASE}/api/tv/meta?localCountry=${encodeURIComponent(localCountry)}`, { signal });
  if (!res.ok) throw new Error('Failed to load TV metadata');
  return res.json();
}

export async function fetchFeaturedTvShelves(localCountry: string, signal?: AbortSignal): Promise<TvFeaturedShelves> {
  const res = await fetch(`${API_BASE}/api/tv/featured?localCountry=${encodeURIComponent(localCountry)}`, { signal });
  if (!res.ok) throw new Error('Failed to load featured channels');
  return res.json();
}

export async function fetchTvChannels(
  params: {
    category?: string;
    scope?: 'all' | 'local' | 'international';
    country?: string;
    localCountry?: string;
    q?: string;
    page?: number;
    limit?: number;
  },
  signal?: AbortSignal
): Promise<TvChannelsResponse> {
  const sp = new URLSearchParams();
  if (params.category) sp.set('category', params.category);
  if (params.scope) sp.set('scope', params.scope);
  if (params.country) sp.set('country', params.country);
  if (params.localCountry) sp.set('localCountry', params.localCountry);
  if (params.q) sp.set('q', params.q);
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/api/tv/channels?${sp.toString()}`, { signal });
  if (!res.ok) throw new Error('Failed to load TV channels');
  return res.json();
}

