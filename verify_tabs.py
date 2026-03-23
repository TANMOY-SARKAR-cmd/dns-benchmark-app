from playwright.sync_api import Page, expect, sync_playwright

def verify_feature(page: Page):
  page.goto("http://localhost:5173")
  page.wait_for_timeout(2000)

  # Check Benchmark tab exists
  expect(page.get_by_role("tab", name="Benchmark")).to_be_visible()
  page.screenshot(path="/app/verification/benchmark_tab.png")
  page.wait_for_timeout(500)

  # Check Live Logs tab
  page.get_by_role("tab", name="Live Logs").click()
  page.wait_for_timeout(1000)
  page.screenshot(path="/app/verification/livelogs_tab.png")

  # Check Monitors tab
  page.get_by_role("tab", name="Monitors").click()
  page.wait_for_timeout(1000)
  page.screenshot(path="/app/verification/monitors_tab.png")

  # Check History tab
  page.get_by_role("tab", name="History").click()
  page.wait_for_timeout(1000)
  page.screenshot(path="/app/verification/history_tab.png")

  # Check Leaderboard tab
  page.get_by_role("tab", name="Leaderboard").click()
  page.wait_for_timeout(1000)
  page.screenshot(path="/app/verification/leaderboard_tab.png")

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
