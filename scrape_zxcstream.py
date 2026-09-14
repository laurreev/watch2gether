import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})
        
        print("Navigating to zxcstream.icu...")
        await page.goto("https://zxcstream.icu", wait_until="networkidle")
        
        # Take screenshot of home page
        print("Taking screenshot of home page...")
        await page.screenshot(path="zxcstream_home.png", full_page=True)
        
        # Try to find a movie and click it
        print("Looking for a movie to click...")
        movie_links = await page.locator("a[href*='/movie/']").all()
        if movie_links:
            await movie_links[0].click()
            await page.wait_for_load_state("networkidle")
            print("Taking screenshot of details page...")
            await page.screenshot(path="zxcstream_details.png", full_page=True)
        
        await browser.close()
        print("Done.")

if __name__ == "__main__":
    asyncio.run(main())
