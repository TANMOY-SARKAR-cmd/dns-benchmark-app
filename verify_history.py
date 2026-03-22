import os
from playwright.sync_api import Page, expect, sync_playwright

os.makedirs("/app/verification/video", exist_ok=True)

def verify_feature(page: Page):
  page.goto("http://localhost:5173")
  page.wait_for_timeout(2000)

  # Click History tab
  page.get_by_role("tab", name="History").click()
  page.wait_for_timeout(2000)

  page.screenshot(path="/app/verification/verification.png")
  page.wait_for_timeout(1000)

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(record_video_dir="/app/verification/video")
    page = context.new_page()
    try:
      verify_feature(page)
    finally:
      context.close()
      browser.close()
