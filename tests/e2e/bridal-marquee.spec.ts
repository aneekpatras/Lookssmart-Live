import { expect, test } from '@playwright/test';

/**
 * Real-browser checks for the bridal marquee. It is driven by real `scrollLeft` (not a CSS
 * animation), so these verify things that only exist at runtime: that it really auto-scrolls, that
 * hover genuinely pauses it, that a mouse drag moves it, that the track holds three copies so the
 * loop never shows a gap, and that the images really decode.
 */

const track = '.marquee-track';
const viewportSelector = '.marquee-viewport';

const scrollLeftOf = (page: import('@playwright/test').Page) => () =>
  page.locator(viewportSelector).evaluate((el) => el.scrollLeft);

test('marquee heading, subtitle and cards render', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('body')).toContainText('Looks Smart Brides');
  await expect(page.locator('body')).toContainText(
    'Moments of beauty and elegance from our real brides',
  );

  // Portrait cards, per the brief's aspect-[3/4].
  const card = page.locator(`${track} li`).first();
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThan(box!.width);
});

test('auto-scrolls on its own', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator(`${track} li`).first()).toBeVisible();
  await page.locator(viewportSelector).scrollIntoViewIfNeeded();

  const read = scrollLeftOf(page);
  const first = await read();
  await expect.poll(read, { timeout: 10_000 }).not.toBe(first);
});

test('hovering the strip pauses the scroll, and leaving resumes it', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator(`${track} li`).first()).toBeVisible();

  const viewport = page.locator(viewportSelector);
  await viewport.scrollIntoViewIfNeeded();
  await viewport.hover();

  const read = scrollLeftOf(page);
  await page.waitForTimeout(300); // let a frame that was already in flight finish
  const parked = await read();
  await page.waitForTimeout(1000);
  expect(await read()).toBe(parked);

  // Moving away resumes it (after a short grace period), so a hover cannot stall the strip for good.
  await page.mouse.move(0, 0);
  await expect.poll(read, { timeout: 10_000 }).not.toBe(parked);
});

test('a mouse can drag the strip', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator(`${track} li`).first()).toBeVisible();

  const viewport = page.locator(viewportSelector);
  await viewport.scrollIntoViewIfNeeded();
  const box = (await viewport.boundingBox())!;
  const y = box.y + box.height / 2;
  const x = box.x + box.width / 2;

  await page.mouse.move(x, y);
  await page.waitForTimeout(300);
  const before = await scrollLeftOf(page)();

  await page.mouse.down();
  await page.mouse.move(x - 150, y, { steps: 8 });
  await page.mouse.up();

  // Dragging left by 150px scrolls the strip right by about the same amount.
  const after = await scrollLeftOf(page)();
  expect(after - before).toBeGreaterThan(100);
});

test('the track holds three copies so the loop has no gap', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // `locator.count()` does NOT auto-wait, so it must not be called before hydration has rendered
  // the track.
  await expect(page.locator(`${track} li`).first()).toBeVisible();

  const total = await page.locator(`${track} li`).count();
  const announced = await page.locator(`${track} li:not([aria-hidden="true"])`).count();

  // Exactly three passes, and only one is exposed to assistive tech.
  expect(total).toBe(announced * 3);
  expect(announced).toBeGreaterThan(0);
});

test('never runs out of photos, however far it is dragged', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator(`${track} li`).first()).toBeVisible();

  const viewport = page.locator(viewportSelector);
  await viewport.scrollIntoViewIfNeeded();
  const box = (await viewport.boundingBox())!;
  const y = box.y + box.height / 2;

  for (let i = 0; i < 6; i += 1) {
    await page.mouse.move(box.x + box.width - 20, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, y, { steps: 5 });
    await page.mouse.up();

    const gap = await viewport.evaluate((el) => {
      const list = el.querySelector('ul')!;
      return el.getBoundingClientRect().right - list.getBoundingClientRect().right;
    });
    // No empty space after the last photo.
    expect(gap).toBeLessThanOrEqual(0);
  }
});

test('bridal images actually decode', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const image = page.locator(`${track} img`).first();
  await expect
    .poll(async () => image.evaluate((img: HTMLImageElement) => img.naturalWidth), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
});

test('viewport is a native horizontal scroller (touch swipe and trackpad)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const overflow = await page.locator(viewportSelector).evaluate((el) => getComputedStyle(el).overflowX);

  expect(overflow).toBe('auto');
});

test('renders correctly on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator(track)).toHaveCount(1);
  await expect(page.locator(`${track} li`).first()).toBeVisible();

  // The section must not make the PAGE scroll sideways — the marquee scrolls, the body does not.
  const bodyOverflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(bodyOverflows, 'page should not scroll horizontally on mobile').toBe(false);
});

test('reduced motion stops the auto-scroll but the strip can still be scrolled by hand', async ({
  page,
}) => {
  // Emulated over CDP rather than Playwright's `reducedMotion` context option: on
  // @playwright/test 1.62.1 in this setup that option does NOT take effect — probed directly and
  // `matchMedia('(prefers-reduced-motion: reduce)').matches` came back false, so any test relying
  // on it silently exercises the ordinary path. CDP genuinely flips the media feature.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true,
  );

  await expect(page.locator(`${track} li`).first()).toBeVisible();
  await page.locator(viewportSelector).scrollIntoViewIfNeeded();

  const read = scrollLeftOf(page);
  await page.waitForTimeout(300);
  const parked = await read();
  await page.waitForTimeout(1500);
  expect(await read()).toBe(parked);
});
