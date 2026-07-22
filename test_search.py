import requests
from bs4 import BeautifulSoup

url = 'https://fmoviess.org/search/?q=breaking+bad'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
}
response = requests.get(url, headers=headers)
soup = BeautifulSoup(response.text, 'html.parser')

elements = soup.select('a.poster')
print(f"Found {len(elements)} items using requests.")
for a in elements[:3]:
    print(a.get('href'), a.select_one('h2').text if a.select_one('h2') else "No title")
