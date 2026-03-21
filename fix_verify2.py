import sys
from playwright.sync_api import sync_playwright, expect

def verify_feature(page):
    page.goto("http://localhost:5173")
    page.wait_for_timeout(2000)

    # Fill in some domains to test
    textarea = page.locator('textarea')
    textarea.fill("cloudflare.com\nexample.com")
    page.wait_for_timeout(500)

    # Click the start button
    run_btn = page.get_by_role("button", name="Run DNS Test")
    run_btn.click()
    page.wait_for_timeout(2000)

    # Wait for completion
    expect(run_btn).to_have_text("Run DNS Test", timeout=30000)
    page.wait_for_timeout(1000)

    # Scroll down to the table
    page.mouse.wheel(0, 500)
    page.wait_for_timeout(500)

    page.screenshot(path="verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(record_video_dir="verification/video")
        page = context.new_page()
        try:
            verify_feature(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification_error.png")
            sys.exit(1)
        finally:
            context.close()
            browser.close()
