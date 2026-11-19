with open('page-afd621192f2acebb.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Let's find function W and surrounding code
idx = js.find('function W(')
if idx != -1:
    print("Function W found:")
    print(js[max(0, idx-100):idx+500])
else:
    # Look for "W=" or "W ("
    m = re.search(r'function W\b|const W\b|let W\b|var W\b|[,\s]W=\(', js)
    if m:
        pos = m.start()
        print("W definition:")
        print(js[max(0, pos-50):pos+400])

# Also let's inspect where streams / channels are passed or fetched
# Search for "/api/live" or "/api/pbb" or similar in js
for m in re.finditer(r'/api/live/[a-zA-Z0-9_\-\.\?&=]+', js):
    print("Endpoint:", m.group(0))

# Search for the page component props or default channels
# Check pbb_live.html for initial state or Next.js payload
with open('pbb_live.html', 'r', encoding='utf-8') as f:
    html = f.read()

print("\n--- Searching pbb_live.html for channels, streams, kids, keys ---")
for line in html.split('\n'):
    for kw in ['dash', 'mpd', 'kid', 'key', 'channels', 'streams', 'server']:
        if kw in line.lower() and ('http' in line.lower() or 'akamaized' in line.lower() or '/api/' in line.lower() or 'collab' in line.lower()):
            print(f"[{kw}]", line[:300])
            break
