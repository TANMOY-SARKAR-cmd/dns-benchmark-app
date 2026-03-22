from playwright.sync_api import Page, expect, sync_playwright

def verify_feature(page: Page):
  page.goto("http://localhost:5173")
  page.wait_for_timeout(2000)

  # Try to click the guest user button to open Auth Dialog
  page.locator("text=Using as Guest").click()
  page.wait_for_timeout(500)

  page.screenshot(path="verification.png")
  page.wait_for_timeout(1000)

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(record_video_dir="/home/jules/verification/video")
    page = context.new_page()
    try:
      verify_feature(page)
    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="verification_error.png")
    finally:
      context.close()
      browser.close()
