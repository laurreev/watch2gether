import requests
from bs4 import BeautifulSoup
import re

url = 'https://fmoviess.org/film/breaking-bad-season-1-3231/'
headers = {'User-Agent': 'Mozilla/5.0'}
r = requests.get(url, headers=headers)
soup = BeautifulSoup(r.text, 'html.parser')
# Find elements that contain episode text
text = r.text
ep_matches = re.findall(r'Episode\s+(\d+)', text, re.IGNORECASE)
print("Episodes found:", sorted(list(set(ep_matches)), key=lambda x: int(x)))

# also check for data-ep
ep_data = re.findall(r'data-ep="(\d+)"', text)
print("data-ep found:", sorted(list(set(ep_data)), key=lambda x: int(x)))
