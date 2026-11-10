const dns = require('dns').promises;
const net = require('net');
const { Readable } = require('stream');

const IPTV_ORG_API = 'https://iptv-org.github.io/api';
const IPHTV_PH_M3U = 'https://raw.githubusercontent.com/Harleythetech/IPHTV/refs/heads/main/ph.m3u';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const PROXY_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;

const RELIABLE_HOSTS = [
    'amagi.tv',
    'wurl.tv',
    'tubi.io',
    'tubi.video',
    'cloudfront.net',
    'akamaized.net',
    'sofast.tv',
    'ottera.tv',
    'klowdtv.com',
    'castr.net',
    'vegasplus.us',
    'getaj.net',
    'frequency.stream',
    'pluto.tv',
    'jmp2.uk',
    'mediatailor.',
    'bloomberg.com',
    'france24.com',
    'cgtn.com',
    'jstre.am'
];

const CURATED_CHANNELS = [
    // Local (PH)
    {
        id: 'PremierSports.ph',
        name: 'Premier Sports',
        country: 'PH',
        categories: ['sports'],
        tvGroups: ['sports'],
        primaryCategory: 'Sports',
        logo: 'https://i.imgur.com/BURPHzI.png',
        quality: '1080p',
        url: 'https://amg19223-amg19223c3-amgplt0351.playout.now3.amagi.tv/playlist/amg19223-amg19223c3-amgplt0351/playlist.m3u8'
    },
    {
        id: 'PremierSports2.ph',
        name: 'Premier Sports 2',
        country: 'PH',
        categories: ['sports'],
        tvGroups: ['sports'],
        primaryCategory: 'Sports',
        logo: 'https://i.imgur.com/UQeXWd2.png',
        quality: '1080p',
        url: 'https://amg19223-amg19223c4-amgplt0351.playout.now3.amagi.tv/playlist/amg19223-amg19223c4-amgplt0351/playlist.m3u8'
    },
    {
        id: 'TAPSports.ph',
        name: 'TAP Sports',
        country: 'PH',
        categories: ['sports'],
        tvGroups: ['sports'],
        primaryCategory: 'Sports',
        logo: 'https://i.imgur.com/4GmuJMD.png',
        quality: '1080p',
        url: 'https://amg19223-amg19223c2-amgplt0351.playout.now3.amagi.tv/playlist/amg19223-amg19223c2-amgplt0351/playlist.m3u8'
    },
    {
        id: 'AbanteTV.ph',
        name: 'Abante TV',
        country: 'PH',
        categories: ['news'],
        tvGroups: ['news'],
        primaryCategory: 'News',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Abante_masthead.svg',
        quality: '1080p',
        url: 'https://amg19223-amg19223c12-amgplt0352.playout.now3.amagi.tv/playlist/amg19223-amg19223c12-amgplt0352/playlist.m3u8'
    },
    {
        id: 'BilyonaryoNewsChannel.ph',
        name: 'Bilyonaryo News Channel',
        country: 'PH',
        categories: ['news', 'business'],
        tvGroups: ['news'],
        primaryCategory: 'News',
        logo: 'https://i.imgur.com/iTH9Z0j.png',
        quality: '1080p',
        url: 'https://amg19223-amg19223c11-amgplt0352.playout.now3.amagi.tv/playlist/amg19223-amg19223c11-amgplt0352/playlist.m3u8'
    },
    {
        id: 'curated:tfc-guam',
        name: 'TFC (ABS-CBN)',
        country: 'PH',
        categories: ['entertainment', 'general'],
        tvGroups: ['entertainment', 'general'],
        primaryCategory: 'Entertainment',
        logo: '',
        quality: '1080p',
        url: 'https://tfcguam-abscbn-ono.amagi.tv/index.m3u8'
    },
    {
        id: 'LivingAsiaChannel.ph',
        name: 'Living Asia Channel',
        country: 'PH',
        categories: ['travel', 'entertainment'],
        tvGroups: ['entertainment'],
        primaryCategory: 'Entertainment',
        logo: 'https://i.imgur.com/q3UToRM.png',
        quality: '1080p',
        url: 'https://cdn.vegasplus.us/vegas/lac/playlist.m3u8'
    },
    {
        id: 'MindanowNetworkTV.ph',
        name: 'Mindanow Network TV',
        country: 'PH',
        categories: ['general'],
        tvGroups: ['general'],
        primaryCategory: 'General',
        logo: 'https://i.imgur.com/xBlYirh.jpeg',
        quality: '1080p',
        url: 'https://cdn.vegasplus.us/vegas/mmn01/playlist.m3u8'
    },
    {
        id: 'CLTV36.ph',
        name: 'CLTV 36',
        country: 'PH',
        categories: ['general'],
        tvGroups: ['general'],
        primaryCategory: 'General',
        logo: 'https://i.imgur.com/2fGhl7q.png',
        quality: '720p',
        url: 'https://live.cltv36.tv:5443/LiveApp/streams/cltvlive.m3u8'
    },
    {
        id: 'HopeChannelPhilippines.ph',
        name: 'Hope Channel Philippines',
        country: 'PH',
        categories: ['general'],
        tvGroups: ['general'],
        primaryCategory: 'General',
        logo: 'https://i.imgur.com/LB2vmMt.png',
        quality: '1080p',
        url: 'https://jstre.am/live/jsl:nX5eC7gQvZb.m3u8'
    },
    {
        id: 'INCTV.ph',
        name: 'INC TV',
        country: 'PH',
        categories: ['general'],
        tvGroups: ['general'],
        primaryCategory: 'General',
        logo: 'https://i.imgur.com/iC11uWK.png',
        quality: '1080p',
        url: 'https://stream-243529.castr.net/6842a712b68c56f675d988f1/live_f5ac22b0566511f0805217b960326aaa/rewind-1800.m3u8'
    },

    // Cartoons & Kids
    {
        id: 'curated:cartoon-classics',
        name: 'Cartoon Classics',
        country: 'US',
        categories: ['animation', 'kids'],
        tvGroups: ['cartoons'],
        primaryCategory: 'Cartoons & Kids',
        logo: 'https://images-3.rakuten.tv/storage/global-live-channel/translation/artwork/3227c06e-333b-4b1b-b657-3e3ab99ebd06-width200-quality90.jpeg',
        quality: '1080p',
        url: 'https://streams2.sofast.tv/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/d5543c06-5122-49a7-9662-32187f48aa2c/manifest.m3u8'
    },
    {
        id: 'NickelodeonToons.us',
        name: 'Nickelodeon Toons',
        country: 'US',
        categories: ['animation', 'kids'],
        tvGroups: ['cartoons'],
        primaryCategory: 'Cartoons & Kids',
        logo: 'https://images.pluto.tv/channels/645951c0e94c38000802d2cb/colorLogoSVG_1767888119852.svg',
        quality: '720p',
        url: 'https://jmp2.uk/plu-645951c0e94c38000802d2cb.m3u8'
    },
    {
        id: '90sKids.us',
        name: "90's Kids",
        country: 'US',
        categories: ['animation', 'kids'],
        tvGroups: ['cartoons'],
        primaryCategory: 'Cartoons & Kids',
        logo: 'https://images.pluto.tv/channels/6452c814939a590008567a3b/colorLogoSVG_1756971210545.svg',
        quality: '720p',
        url: 'https://jmp2.uk/plu-6452c814939a590008567a3b.m3u8'
    },
    {
        id: 'curated:pluto-anime',
        name: 'Pluto TV Anime',
        country: 'US',
        categories: ['animation'],
        tvGroups: ['cartoons'],
        primaryCategory: 'Cartoons & Kids',
        logo: '',
        quality: '720p',
        url: 'https://jmp2.uk/plu-608181d420fc8500075f612a.m3u8'
    },
    {
        id: 'curated:japanim-tv',
        name: 'Japanim TV',
        country: 'FR',
        categories: ['animation'],
        tvGroups: ['cartoons'],
        primaryCategory: 'Cartoons & Kids',
        logo: '',
        quality: '1080p',
        url: 'https://foxkidstv.be:3369/stream/play.m3u8'
    },
    {
        id: '3ABNKids.us',
        name: '3ABN Kids',
        country: 'US',
        categories: ['kids'],
        tvGroups: ['cartoons'],
        primaryCategory: 'Cartoons & Kids',
        logo: 'https://i.imgur.com/z3npqO1.png',
        quality: '720p',
        url: 'https://3abn.bozztv.com/3abn2/Kids_live/smil:Kids_live.smil/playlist.m3u8'
    },

    // Wildlife & Nature
    {
        id: 'curated:wild-planet',
        name: 'Wild Planet',
        country: 'GB',
        categories: ['documentary', 'outdoor'],
        tvGroups: ['wildlife', 'documentary'],
        primaryCategory: 'Wildlife & Nature',
        logo: '',
        quality: '1080p',
        url: 'https://d1h8whhtg5u7om.cloudfront.net/WildPlanet_GB.m3u8'
    },
    {
        id: 'curated:wild-nature',
        name: 'Wild Nature',
        country: 'US',
        categories: ['documentary', 'outdoor'],
        tvGroups: ['wildlife', 'documentary'],
        primaryCategory: 'Wildlife & Nature',
        logo: '',
        quality: '1080p',
        url: 'https://dhiy0zcig7ty1.cloudfront.net/scheduler/scheduleMaster/491.m3u8'
    },
    {
        id: 'curated:brave-wilderness',
        name: 'Brave Wilderness',
        country: 'US',
        categories: ['documentary', 'outdoor'],
        tvGroups: ['wildlife', 'documentary'],
        primaryCategory: 'Wildlife & Nature',
        logo: '',
        quality: '1080p',
        url: 'https://d95zc3i1pxhs7.cloudfront.net/playlist.m3u8'
    },
    {
        id: 'WildTV.ca',
        name: 'Wild TV',
        country: 'CA',
        categories: ['outdoor'],
        tvGroups: ['wildlife'],
        primaryCategory: 'Wildlife & Nature',
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Wild_TV_logo_2020.png/960px-Wild_TV_logo_2020.png',
        quality: '720p',
        url: 'https://a-cdn.klowdtv.com/live3/wildtv_720p/playlist.m3u8'
    },
    {
        id: 'AdventureEarth.de',
        name: 'Adventure Earth',
        country: 'DE',
        categories: ['documentary'],
        tvGroups: ['wildlife', 'documentary'],
        primaryCategory: 'Wildlife & Nature',
        logo: 'https://i.imgur.com/94Pq9Io.png',
        quality: '1080p',
        url: 'https://a57e9c69976649b582a8d7604c00e69a.mediatailor.us-east-1.amazonaws.com/v1/master/44f73ba4d03e9607dcd9bebdcb8494d86964f1d8/RlaxxTV-eu_AdventureEarth/playlist.m3u8'
    },
    {
        id: 'OutdoorChannel.us',
        name: 'Outdoor Channel',
        country: 'US',
        categories: ['outdoor'],
        tvGroups: ['wildlife'],
        primaryCategory: 'Wildlife & Nature',
        logo: 'https://i.imgur.com/Kh4MWaY.png',
        quality: '1080p',
        url: 'https://cdn-apse1-prod.tsv2.amagi.tv/linear/amg00718-outdoorchannela-outdoortvnz-samsungnz/playlist.m3u8'
    },
    {
        id: 'CGTNDocumentary.cn',
        name: 'CGTN Documentary',
        country: 'CN',
        categories: ['documentary'],
        tvGroups: ['wildlife', 'documentary'],
        primaryCategory: 'Documentary & Science',
        logo: 'https://i.imgur.com/JHv0WxM.png',
        quality: '1080p',
        url: 'https://english-livebkali.cgtn.com/live/doccgtn_1.m3u8'
    },

    // Sports
    {
        id: 'beINSportsXtra.us',
        name: 'beIN SPORTS XTRA',
        country: 'US',
        categories: ['sports'],
        tvGroups: ['sports'],
        primaryCategory: 'Sports',
        logo: 'https://i.imgur.com/uJosqHh.png',
        quality: '1080p',
        url: 'https://amg01334-beinsportsllc-beinxtra-localnow-kcy6r.amagi.tv/playlist.m3u8'
    },
    {
        id: 'curated:nba-fast',
        name: 'NBA FAST Channel',
        country: 'US',
        categories: ['sports'],
        tvGroups: ['sports'],
        primaryCategory: 'Sports',
        logo: '',
        quality: '720p',
        url: 'https://live-manifest.production-public.tubi.io/live/553b8d5e-fd2a-4a61-bdfa-73b34c299d75/playlist.m3u8'
    },
    {
        id: 'curated:the-nba-channel',
        name: 'The NBA Channel',
        country: 'US',
        categories: ['sports'],
        tvGroups: ['sports'],
        primaryCategory: 'Sports',
        logo: '',
        quality: '720p',
        url: 'https://jmp2.uk/plu-6792c30abc03978b9b8bb832.m3u8'
    },
    {
        id: 'RedBullTV.at',
        name: 'Red Bull TV',
        country: 'AT',
        categories: ['sports'],
        tvGroups: ['sports'],
        primaryCategory: 'Sports',
        logo: 'https://jiotvimages.cdn.jio.com/dare_images/images/Red_Bull_TV.png',
        quality: '1080p',
        url: 'https://db34cc6127ac459db55cab5f97cd66b9.mediatailor.us-west-2.amazonaws.com/v1/master/2d2d0d97b0e548f025b2598a69b55bf30337aa0e/npp/DIF8578X02L0Q15Y96P9/hls/master.m3u8'
    },

    // International News & General
    {
        id: 'BBCNews.uk',
        name: 'BBC News',
        country: 'GB',
        categories: ['news'],
        tvGroups: ['news'],
        primaryCategory: 'News',
        logo: 'https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_BBC_NEWS/images/LOGO_HD/image.png',
        quality: '1080p',
        url: 'https://vs-hls-push-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_news_channel_hd/t=3840/v=pv14/b=5070016/main.m3u8'
    },
    {
        id: 'AlJazeera.qa',
        name: 'Al Jazeera English',
        country: 'QA',
        categories: ['news'],
        tvGroups: ['news'],
        primaryCategory: 'News',
        logo: 'https://upload.wikimedia.org/wikipedia/ms/thumb/f/f2/Aljazeera_eng.svg/500px-Aljazeera_eng.svg.png',
        quality: '1080p',
        url: 'https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8'
    },
    {
        id: 'DW.de',
        name: 'DW English',
        country: 'DE',
        categories: ['news'],
        tvGroups: ['news'],
        primaryCategory: 'News',
        logo: 'https://i.imgur.com/2CMfAlD.png',
        quality: '1080p',
        url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8'
    },
    {
        id: 'curated:france24-en',
        name: 'France 24 English',
        country: 'FR',
        categories: ['news'],
        tvGroups: ['news'],
        primaryCategory: 'News',
        logo: '',
        quality: '1080p',
        url: 'https://amg00106-amg00106c1-rakuten-uk-4654.playouts.now.amagi.tv/playlist/amg00106-france24fast-france24-rakutenuk/playlist.m3u8'
    },
    {
        id: 'ArirangTV.kr',
        name: 'Arirang TV',
        country: 'KR',
        categories: ['general', 'culture'],
        tvGroups: ['entertainment', 'general'],
        primaryCategory: 'Entertainment',
        logo: 'https://i.imgur.com/QQlKoim.png',
        quality: '720p',
        url: 'https://amdlive-ch03-ctnd-com.akamaized.net/arirang_1ch/smil:arirang_1ch.smil/playlist.m3u8'
    }
];

const CATEGORY_DEFS = [
    { id: 'all', name: 'All Channels' },
    { id: 'cartoons', name: 'Cartoons & Kids' },
    { id: 'wildlife', name: 'Wildlife & Nature' },
    { id: 'sports', name: 'Sports' },
    { id: 'adult', name: 'Adult' },
    { id: 'news', name: 'News' },
    { id: 'movies', name: 'Movies & Series' },
    { id: 'documentary', name: 'Documentary & Science' },
    { id: 'music', name: 'Music' },
    { id: 'entertainment', name: 'Entertainment' },
    { id: 'general', name: 'General' }
];

const CARTOON_REGEX = /\b(cartoons?|toons?|kids?|anime|nickelodeon|nick\s*toons|disney|beyblade|spongebob|bob\s+l'eponge|pokemon|yu-?gi-?oh|looloo|junior|boomerang|cartoonito|pogo|animax|japanim|animation|mattel|ducktv|baby\s*tv)\b/i;
const WILDLIFE_REGEX = /\b(wild(?:life|erness)?|nature(?:scape)?|animals?|safari|ocean\s+vibes|nat\s?geo|love\s+nature|earth\s+touch|evolution\s+earth|adventure\s+earth|wild\s+planet|wild\s+nature|wild\s+tv|outdoor\s+channel|aquarium|zoo|puppies|puppy|pet\s*collective|akc\s*tv|smithsonian)\b/i;
const WILDLIFE_EXCLUDE_REGEX = /\b(wild\s+west|earth:\s*final\s+conflict|wild\s*card)\b/i;
const SPORTS_REGEX = /\b(sports?|nba|nfl|mlb|nhl|fifa|soccer|football|ufc|mma|boxing|wrestling|tna|wwe|motorsport|racing|floracing|formula|f1|golf|tennis|bein|espn|red\s+bull|premier\s+sports|tap\s+sports|one\s+sports|pba|cricket|rugby|athletic)\b/i;
const ADULT_REGEX = /\b(xxx|nsfw|18\+|erotic[a]?|playboy|penthouse|hustler|brazzers|dorcel|redlight|vivid|sextury)\b/i;
const ADULT_EXCLUDE_REGEX = /\b(adult\s+swim|adult\s+animation|pop\s+adult)\b/i;
const NEWS_REGEX = /\b(news|cnn|bbc|al\s*jazeera|bloomberg|cnbc|msnbc|fox\s*news|france\s*24|dw\s+english|nhk|abante|bilyonaryo|teleradyo|euronews|sky\s*news)\b/i;
const MOVIES_REGEX = /\b(movies?|cinema|film|thrillers?|horror|action|romance|comedy|classic|western|hallmark|cine|dramas?)\b/i;
const MUSIC_REGEX = /\b(music|mtv|vh1|vevo|stingray|hiphop|hip\s*hop|pop|rock|jazz|k-?pop|karaoke)\b/i;

function classifyChannel(title, rawCategories = [], isNsfwFlag = false) {
    const cats = new Set(rawCategories.map((c) => String(c).toLowerCase()));
    const groups = new Set();

    const isAdult = Boolean(
        isNsfwFlag ||
        cats.has('xxx') ||
        (!ADULT_EXCLUDE_REGEX.test(title) && ADULT_REGEX.test(title))
    );

    if (isAdult) {
        groups.add('adult');
    }
    if (!isAdult && (cats.has('animation') || cats.has('kids') || CARTOON_REGEX.test(title))) {
        groups.add('cartoons');
    }
    if (
        !WILDLIFE_EXCLUDE_REGEX.test(title) &&
        (cats.has('outdoor') || WILDLIFE_REGEX.test(title))
    ) {
        groups.add('wildlife');
    }
    if (cats.has('sports') || SPORTS_REGEX.test(title)) {
        groups.add('sports');
    }
    if (cats.has('news') || cats.has('business') || cats.has('weather') || cats.has('legislative') || NEWS_REGEX.test(title)) {
        groups.add('news');
    }
    if (cats.has('movies') || cats.has('series') || cats.has('classic') || cats.has('comedy') || MOVIES_REGEX.test(title)) {
        groups.add('movies');
    }
    if (cats.has('documentary') || cats.has('science') || cats.has('education')) {
        groups.add('documentary');
    }
    if (cats.has('music') || MUSIC_REGEX.test(title)) {
        groups.add('music');
    }
    if (cats.has('entertainment') || cats.has('lifestyle') || cats.has('cooking') || cats.has('travel') || cats.has('culture') || cats.has('family')) {
        groups.add('entertainment');
    }
    if (groups.size === 0 || cats.has('general') || cats.has('public') || cats.has('religious')) {
        groups.add('general');
    }

    const priorityOrder = ['adult', 'cartoons', 'wildlife', 'sports', 'news', 'movies', 'documentary', 'music', 'entertainment', 'general'];
    const primaryId = priorityOrder.find((id) => groups.has(id)) || 'general';
    const primaryDef = CATEGORY_DEFS.find((d) => d.id === primaryId);

    return {
        isNsfw: isAdult,
        tvGroups: Array.from(groups),
        primaryCategory: primaryDef ? primaryDef.name : 'General'
    };
}

function scoreStream(stream, hasLogo, isCurated = false) {
    let score = isCurated ? 1000 : 0;
    const url = stream.url || '';
    if (url.startsWith('https://')) score += 30;
    if (hasLogo) score += 45;
    if (RELIABLE_HOSTS.some((h) => url.includes(h))) score += 40;
    if (stream.quality === '1080p' || stream.quality === '4K' || stream.quality === '2160p') score += 15;
    else if (stream.quality === '720p') score += 10;

    const labels = Array.isArray(stream.labels) ? stream.labels : [];
    if (labels.includes('Geo-blocked')) score -= 35;
    if (labels.includes('Not 24/7')) score -= 20;
    if (stream.userAgent || stream.referrer) score -= 5;
    return score;
}

function isHlsUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (!/^https?:\/\//i.test(url)) return false;
    // Exclude clear non-HLS formats like DASH (.mpd) or RTMP
    if (/\.mpd(\?|$)/i.test(url) || /\/dash[-/]/i.test(url)) return false;
    return /\.m3u8(\?|$)/i.test(url) || /m3u8/i.test(url);
}

function parseSimpleM3u(text) {
    const lines = text.split(/\r?\n/);
    const entries = [];
    let currentMeta = null;
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith('#EXTINF:')) {
            const commaIdx = line.indexOf(',');
            const title = commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : 'Live Channel';
            const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
            const groupMatch = line.match(/group-title="([^"]*)"/i);
            const idMatch = line.match(/tvg-id="([^"]*)"/i);
            currentMeta = {
                title: title.replace(/\s*\(\d+p\)\s*/gi, '').replace(/\s*\[[^\]]+\]\s*/g, '').trim(),
                logo: logoMatch ? logoMatch[1] : '',
                group: groupMatch ? groupMatch[1] : '',
                tvgId: idMatch ? idMatch[1].split('@')[0] : ''
            };
        } else if (!line.startsWith('#') && currentMeta) {
            if (isHlsUrl(line)) {
                entries.push({ ...currentMeta, url: line });
            }
            currentMeta = null;
        }
    }
    return entries;
}

let tvCache = {
    updatedAt: 0,
    channels: [],
    countries: [],
    countryMap: new Map(),
    loadingPromise: null
};

function buildCuratedFallback() {
    const fallbackCountries = new Map([
        ['PH', { code: 'PH', name: 'Philippines', flag: '🇵🇭' }],
        ['US', { code: 'US', name: 'United States', flag: '🇺🇸' }],
        ['GB', { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' }],
        ['CA', { code: 'CA', name: 'Canada', flag: '🇨🇦' }],
        ['DE', { code: 'DE', name: 'Germany', flag: '🇩🇪' }],
        ['FR', { code: 'FR', name: 'France', flag: '🇫🇷' }],
        ['KR', { code: 'KR', name: 'South Korea', flag: '🇰🇷' }],
        ['CN', { code: 'CN', name: 'China', flag: '🇨🇳' }],
        ['AT', { code: 'AT', name: 'Austria', flag: '🇦🇹' }],
        ['QA', { code: 'QA', name: 'Qatar', flag: '🇶🇦' }],
        ['INT', { code: 'INT', name: 'International', flag: '🌐' }]
    ]);

    const channels = CURATED_CHANNELS.map((c) => {
        const countryInfo = fallbackCountries.get(c.country) || { code: 'INT', name: 'International', flag: '🌐' };
        const stream = {
            url: c.url,
            quality: c.quality || 'HD',
            label: `${c.name}${c.quality ? ` (${c.quality})` : ''}`,
            userAgent: null,
            referrer: null,
            isGeoBlocked: false
        };
        return {
            id: c.id,
            name: c.name,
            logo: c.logo || '',
            country: countryInfo.code,
            countryName: countryInfo.name,
            flag: countryInfo.flag,
            categories: c.categories,
            tvGroups: c.tvGroups,
            primaryCategory: c.primaryCategory,
            quality: c.quality || 'HD',
            isCurated: true,
            isNsfw: false,
            score: scoreStream(stream, !!c.logo, true),
            streams: [stream]
        };
    });

    return { channels, countryMap: fallbackCountries };
}

async function fetchJsonWithTimeout(url, timeoutMs = 15000) {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return res.json();
}

async function refreshTvIndex() {
    if (tvCache.loadingPromise) return tvCache.loadingPromise;

    tvCache.loadingPromise = (async () => {
        try {
            // Sequential/lightweight fetching to minimize peak RAM usage on small instances
            const countriesList = await fetchJsonWithTimeout(`${IPTV_ORG_API}/countries.json`);
            const countryMap = new Map();
            for (const c of countriesList) {
                const code = c.code === 'UK' ? 'GB' : c.code;
                countryMap.set(code, { code, name: c.name, flag: c.flag || '🏳️' });
            }
            countryMap.set('INT', { code: 'INT', name: 'International', flag: '🌐' });
            countryMap.set('UK', countryMap.get('GB') || { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' });

            const rawChannels = await fetchJsonWithTimeout(`${IPTV_ORG_API}/channels.json`);
            const chanMetaMap = new Map();
            for (const ch of rawChannels) {
                if (ch.closed) continue;
                chanMetaMap.set(ch.id, {
                    id: ch.id,
                    name: ch.name,
                    country: ch.country === 'UK' ? 'GB' : (ch.country || 'INT'),
                    categories: Array.isArray(ch.categories) ? ch.categories : [],
                    isNsfw: Boolean(ch.is_nsfw),
                    logo: ''
                });
            }

            const rawLogos = await fetchJsonWithTimeout(`${IPTV_ORG_API}/logos.json`);
            for (const l of rawLogos) {
                const meta = chanMetaMap.get(l.channel);
                if (!meta) continue;
                if (!meta.logo || l.in_use) {
                    meta.logo = l.url || meta.logo;
                }
            }

            const rawStreams = await fetchJsonWithTimeout(`${IPTV_ORG_API}/streams.json`);
            const aggregatedMap = new Map();

            // Seed with curated verified channels first
            for (const c of CURATED_CHANNELS) {
                const countryInfo = countryMap.get(c.country) || { code: c.country, name: c.country, flag: '🌐' };
                const streamObj = {
                    url: c.url,
                    quality: c.quality || 'HD',
                    label: c.quality ? `Primary (${c.quality})` : 'Primary',
                    userAgent: null,
                    referrer: null,
                    isGeoBlocked: false
                };
                aggregatedMap.set(c.id, {
                    id: c.id,
                    name: c.name,
                    logo: c.logo || '',
                    country: countryInfo.code,
                    countryName: countryInfo.name,
                    flag: countryInfo.flag,
                    categories: [...c.categories],
                    tvGroups: [...c.tvGroups],
                    primaryCategory: c.primaryCategory,
                    quality: c.quality || 'HD',
                    isCurated: true,
                    isNsfw: false,
                    score: scoreStream(streamObj, !!c.logo, true),
                    streams: [streamObj],
                    _seenUrls: new Set([c.url])
                });
            }

            // Add iptv-org streams
            for (const s of rawStreams) {
                if (!isHlsUrl(s.url)) continue;

                const meta = s.channel ? chanMetaMap.get(s.channel) : null;
                if (s.channel && !meta) continue; // Channel was closed

                const name = (meta ? meta.name : s.title || '').trim();
                if (!name) continue;

                const rawCategories = meta ? meta.categories : [];
                const { isNsfw, tvGroups, primaryCategory } = classifyChannel(name, rawCategories, Boolean(meta && meta.isNsfw));

                const countryCode = meta ? meta.country : 'INT';
                const countryInfo = countryMap.get(countryCode) || { code: 'INT', name: 'International', flag: '🌐' };
                const logo = meta ? meta.logo : '';

                // Deduplicate unmatched streams by normalized name + country
                const key = meta
                    ? meta.id
                    : `fast:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}:${countryCode}`;

                const streamObj = {
                    url: s.url,
                    quality: s.quality || (s.feed && /^(HD|FHD|UHD|4K|SD)$/i.test(s.feed) ? s.feed : ''),
                    label: s.quality ? `${s.feed || 'Feed'} (${s.quality})` : (s.feed || 'Live Feed'),
                    userAgent: s.user_agent || null,
                    referrer: s.referrer || null,
                    labels: Array.isArray(s.labels) ? s.labels : [],
                    isGeoBlocked: Array.isArray(s.labels) && s.labels.includes('Geo-blocked')
                };

                if (!aggregatedMap.has(key)) {
                    aggregatedMap.set(key, {
                        id: key,
                        name,
                        logo,
                        country: countryInfo.code,
                        countryName: countryInfo.name,
                        flag: countryInfo.flag,
                        categories: rawCategories,
                        tvGroups,
                        primaryCategory,
                        quality: streamObj.quality || 'LIVE',
                        isCurated: false,
                        isNsfw,
                        score: scoreStream(streamObj, !!logo, false),
                        streams: [streamObj],
                        _seenUrls: new Set([s.url])
                    });
                } else {
                    const existing = aggregatedMap.get(key);
                    if (!existing._seenUrls.has(s.url) && existing.streams.length < 6) {
                        existing._seenUrls.add(s.url);
                        existing.streams.push(streamObj);
                        if (!existing.logo && logo) existing.logo = logo;
                        const sScore = scoreStream(streamObj, !!existing.logo, existing.isCurated);
                        if (sScore > existing.score) {
                            existing.score = sScore;
                            if (streamObj.quality) existing.quality = streamObj.quality;
                        }
                    }
                }
            }

            // Enrich with IPHTV public Philippine / International M3U if available
            try {
                const phRes = await fetch(IPHTV_PH_M3U, { signal: AbortSignal.timeout(6000) });
                if (phRes.ok) {
                    const m3uText = await phRes.text();
                    const m3uItems = parseSimpleM3u(m3uText);
                    for (const item of m3uItems) {
                        const existingMatch = Array.from(aggregatedMap.values()).find(
                            (ch) => ch.name.toLowerCase() === item.title.toLowerCase()
                        );
                        if (existingMatch && !existingMatch._seenUrls.has(item.url) && existingMatch.streams.length < 6) {
                            existingMatch._seenUrls.add(item.url);
                            existingMatch.streams.push({
                                url: item.url,
                                quality: 'HD',
                                label: 'Mirror Feed',
                                userAgent: null,
                                referrer: null,
                                isGeoBlocked: false
                            });
                        }
                    }
                }
            } catch {
                // Non-fatal if extra M3U fails
            }

            // Sort streams within each channel by quality/reliability, strip internal helper fields
            const finalChannels = [];
            const countryCounts = new Map();

            for (const ch of aggregatedMap.values()) {
                ch.streams.sort((a, b) => scoreStream(b, !!ch.logo, false) - scoreStream(a, !!ch.logo, false));
                const cleanedStreams = ch.streams.map(({ url, quality, label, userAgent, referrer, isGeoBlocked }) => ({
                    url,
                    quality,
                    label,
                    userAgent,
                    referrer,
                    isGeoBlocked
                }));

                finalChannels.push({
                    id: ch.id,
                    name: ch.name,
                    logo: ch.logo,
                    country: ch.country,
                    countryName: ch.countryName,
                    flag: ch.flag,
                    categories: ch.categories,
                    tvGroups: ch.tvGroups,
                    primaryCategory: ch.primaryCategory,
                    quality: ch.quality,
                    isCurated: ch.isCurated,
                    isNsfw: Boolean(ch.isNsfw),
                    score: ch.score,
                    streams: cleanedStreams
                });

                countryCounts.set(ch.country, (countryCounts.get(ch.country) || 0) + 1);
            }

            finalChannels.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.name.localeCompare(b.name);
            });

            const countries = Array.from(countryCounts.entries())
                .map(([code, count]) => {
                    const info = countryMap.get(code) || { code, name: code, flag: '🌐' };
                    return { code: info.code, name: info.name, flag: info.flag, count };
                })
                .sort((a, b) => {
                    if (a.code === 'INT') return 1;
                    if (b.code === 'INT') return -1;
                    return b.count - a.count;
                });

            tvCache.channels = finalChannels;
            tvCache.countries = countries;
            tvCache.countryMap = countryMap;
            tvCache.updatedAt = Date.now();
            console.log(`[Television] Indexed ${finalChannels.length} live HLS channels across ${countries.length} countries.`);
        } catch (err) {
            console.error('[Television] Failed to fetch iptv-org directory:', err.message);
            if (tvCache.channels.length === 0) {
                const fallback = buildCuratedFallback();
                tvCache.channels = fallback.channels;
                tvCache.countries = Array.from(fallback.countryMap.values()).map((c) => ({
                    ...c,
                    count: fallback.channels.filter((ch) => ch.country === c.code).length
                })).filter((c) => c.count > 0);
                tvCache.countryMap = fallback.countryMap;
                tvCache.updatedAt = Date.now() - CACHE_TTL_MS + 60 * 1000; // retry in 1 min
            }
        } finally {
            tvCache.loadingPromise = null;
        }
    })();

    return tvCache.loadingPromise;
}

async function ensureTvIndex() {
    if (tvCache.channels.length === 0 || Date.now() - tvCache.updatedAt > CACHE_TTL_MS) {
        if (tvCache.channels.length === 0) {
            await refreshTvIndex();
        } else {
            // Stale-while-revalidate in background
            refreshTvIndex().catch(() => {});
        }
    }
    return tvCache;
}

async function getTvMeta(localCountry = 'PH') {
    const cache = await ensureTvIndex();
    const localCode = String(localCountry || 'PH').toUpperCase();

    const categoryCounts = new Map();
    for (const def of CATEGORY_DEFS) {
        categoryCounts.set(def.id, 0);
    }

    let localCount = 0;
    let internationalCount = 0;

    for (const ch of cache.channels) {
        categoryCounts.set('all', categoryCounts.get('all') + 1);
        for (const g of ch.tvGroups) {
            if (categoryCounts.has(g)) {
                categoryCounts.set(g, categoryCounts.get(g) + 1);
            }
        }
        if (ch.country === localCode) localCount++;
        else internationalCount++;
    }

    return {
        totalChannels: cache.channels.length,
        localCountry: localCode,
        localCount,
        internationalCount,
        categories: CATEGORY_DEFS.map((def) => ({
            id: def.id,
            name: def.name,
            count: categoryCounts.get(def.id) || 0
        })),
        countries: cache.countries
    };
}

async function getFeaturedTvShelves(localCountry = 'PH') {
    const cache = await ensureTvIndex();
    const localCode = String(localCountry || 'PH').toUpperCase();

    const pickTop = (predicate, limit = 16) => {
        const list = [];
        for (const ch of cache.channels) {
            if (predicate(ch)) {
                list.push(ch);
                if (list.length >= limit) break;
            }
        }
        return list;
    };

    return {
        local: pickTop((ch) => ch.country === localCode, 16),
        cartoons: pickTop((ch) => ch.tvGroups.includes('cartoons'), 16),
        wildlife: pickTop((ch) => ch.tvGroups.includes('wildlife'), 16),
        sports: pickTop((ch) => ch.tvGroups.includes('sports'), 16),
        international: pickTop((ch) => ch.country !== localCode && (ch.tvGroups.includes('news') || ch.tvGroups.includes('documentary') || ch.tvGroups.includes('entertainment')), 16)
    };
}

async function queryTvChannels({
    category = 'all',
    scope = 'all',
    country = '',
    localCountry = 'PH',
    q = '',
    page = 1,
    limit = 48
}) {
    const cache = await ensureTvIndex();
    const localCode = String(localCountry || 'PH').toUpperCase();
    const targetCountry = String(country || '').toUpperCase();
    const cat = String(category || 'all').toLowerCase();
    const query = String(q || '').trim().toLowerCase();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(12, parseInt(limit, 10) || 48));

    const filtered = cache.channels.filter((ch) => {
        if (scope === 'local' && ch.country !== localCode) return false;
        if (scope === 'international' && ch.country === localCode) return false;
        if (targetCountry && ch.country !== targetCountry) return false;
        if (cat && cat !== 'all' && !ch.tvGroups.includes(cat)) return false;

        if (query) {
            const hay = `${ch.name} ${ch.countryName} ${ch.country} ${ch.primaryCategory} ${ch.tvGroups.join(' ')}`.toLowerCase();
            if (!hay.includes(query)) return false;
        }
        return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (pageNum - 1) * pageSize;
    const channels = filtered.slice(start, start + pageSize);

    return {
        channels,
        total,
        page: pageNum,
        totalPages,
        hasMore: pageNum < totalPages
    };
}

// ==========================================
// SSRF-Protected HLS / M3U8 Proxy
// ==========================================
function isPrivateOrBlockedIp(ip) {
    if (!ip) return true;
    // Strip IPv6-mapped IPv4 prefix
    const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

    if (net.isIPv4(normalized)) {
        const parts = normalized.split('.').map(Number);
        const [a, b] = parts;
        if (a === 0 || a === 10 || a === 127) return true;
        if (a === 169 && b === 254) return true; // link-local / cloud metadata
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
        if (a >= 224) return true; // multicast / reserved
        return false;
    }

    if (net.isIPv6(normalized)) {
        const lower = normalized.toLowerCase();
        if (lower === '::' || lower === '::1') return true;
        if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
        if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local
        return false;
    }

    return true;
}

async function assertSafePublicUrl(rawUrl) {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error('Invalid stream URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Unsupported URL protocol');
    }

    const host = parsed.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
        throw new Error('Blocked host');
    }

    if (net.isIP(host)) {
        if (isPrivateOrBlockedIp(host)) {
            throw new Error('Blocked IP address');
        }
        return parsed;
    }

    const records = await dns.lookup(host, { all: true });
    if (!records || records.length === 0) {
        throw new Error('Host resolution failed');
    }
    for (const rec of records) {
        if (isPrivateOrBlockedIp(rec.address)) {
            throw new Error('Blocked resolved IP');
        }
    }
    return parsed;
}

async function fetchFollowSafeRedirects(initialUrl, headers, signal) {
    let currentUrl = initialUrl;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
        await assertSafePublicUrl(currentUrl);
        const res = await fetch(currentUrl, {
            headers,
            redirect: 'manual',
            signal
        });

        if (res.status >= 300 && res.status < 400) {
            const loc = res.headers.get('location');
            if (!loc) return { res, finalUrl: currentUrl };
            res.body?.cancel().catch(() => {});
            currentUrl = new URL(loc, currentUrl).toString();
            continue;
        }
        return { res, finalUrl: currentUrl };
    }
    throw new Error('Too many redirects');
}

function buildProxyUrl(absUrl, ua, ref) {
    let out = `/api/tv/proxy?url=${encodeURIComponent(absUrl)}`;
    if (ua) out += `&ua=${encodeURIComponent(ua)}`;
    if (ref) out += `&ref=${encodeURIComponent(ref)}`;
    return out;
}

function rewriteM3u8Manifest(manifestText, baseUrl, ua, ref) {
    const lines = manifestText.split(/\r?\n/);
    const rewritten = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        if (trimmed.startsWith('#')) {
            // Rewrite URI="..." attributes inside tags like #EXT-X-KEY, #EXT-X-MEDIA, #EXT-X-MAP, etc.
            return line.replace(/URI="([^"]+)"/gi, (_, rawUri) => {
                try {
                    const resolved = new URL(rawUri, baseUrl).toString();
                    return `URI="${buildProxyUrl(resolved, ua, ref)}"`;
                } catch {
                    return `URI="${rawUri}"`;
                }
            });
        }

        // Standalone segment / variant playlist URI line
        try {
            const resolved = new URL(trimmed, baseUrl).toString();
            return buildProxyUrl(resolved, ua, ref);
        } catch {
            return line;
        }
    });

    return rewritten.join('\n');
}

async function proxyStream(req, res) {
    const targetUrl = req.query.url;
    const ua = typeof req.query.ua === 'string' && req.query.ua.length < 300 ? req.query.ua : '';
    const ref = typeof req.query.ref === 'string' && req.query.ref.length < 500 ? req.query.ref : '';

    if (!targetUrl || typeof targetUrl !== 'string') {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
    req.on('close', () => controller.abort());

    try {
        const headers = {
            'User-Agent': ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
            'Accept': '*/*'
        };
        if (ref) {
            headers['Referer'] = ref;
            try {
                headers['Origin'] = new URL(ref).origin;
            } catch {
                // ignore invalid referrer origin
            }
        }

        const { res: upstreamRes, finalUrl } = await fetchFollowSafeRedirects(targetUrl, headers, controller.signal);

        if (!upstreamRes.ok) {
            clearTimeout(timeoutId);
            return res.status(upstreamRes.status).send(`Upstream returned ${upstreamRes.status}`);
        }

        const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();
        const isManifestByHeaderOrUrl =
            contentType.includes('mpegurl') ||
            contentType.includes('m3u8') ||
            contentType.startsWith('text/plain') ||
            /\.m3u8?(\?|$)/i.test(finalUrl);

        if (isManifestByHeaderOrUrl) {
            const text = await upstreamRes.text();
            clearTimeout(timeoutId);
            res.setHeader('Access-Control-Allow-Origin', '*');
            if (text.trimStart().startsWith('#EXTM3U')) {
                const rewritten = rewriteM3u8Manifest(text, finalUrl, ua, ref);
                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                return res.send(rewritten);
            }
            if (contentType) res.setHeader('Content-Type', contentType);
            return res.send(text);
        }

        // Binary segment (.ts, .m4s, .mp4, .aac, .key, etc.)
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (contentType) res.setHeader('Content-Type', contentType);
        const contentLength = upstreamRes.headers.get('content-length');
        if (contentLength) res.setHeader('Content-Length', contentLength);
        res.setHeader('Cache-Control', 'public, max-age=30');

        if (!upstreamRes.body) {
            clearTimeout(timeoutId);
            return res.status(502).send('Empty upstream body');
        }

        const nodeStream = Readable.fromWeb(upstreamRes.body);
        nodeStream.on('error', () => {
            clearTimeout(timeoutId);
            if (!res.headersSent) res.status(502).end();
            else res.end();
        });
        nodeStream.on('end', () => clearTimeout(timeoutId));
        nodeStream.pipe(res);
    } catch (err) {
        clearTimeout(timeoutId);
        if (!res.headersSent) {
            const status = err.message && err.message.startsWith('Blocked') ? 403 : 502;
            res.status(status).json({ error: err.message || 'Proxy request failed' });
        }
    }
}

module.exports = {
    ensureTvIndex,
    getTvMeta,
    getFeaturedTvShelves,
    queryTvChannels,
    proxyStream
};
