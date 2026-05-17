#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

const SNAPSHOTS_DIR = join(import.meta.dirname, '../tests/visual');
const OUTPUT = join(import.meta.dirname, '../visual-story-report.html');

// Story definitions: title, spec file, priority, description
const STORIES = [
  {
    id: 'homepage',
    title: 'Homepage',
    spec: 'homepage.spec.ts-snapshots',
    priority: 1,
    description: 'First impression — landing page for all users',
  },
  {
    id: 'login',
    title: 'Login Flow',
    spec: 'tournament.spec.ts-snapshots',
    filter: (f) => f.startsWith('login'),
    priority: 2,
    description: 'Authentication entry point',
  },
  {
    id: 'admin-dashboard',
    title: 'Admin Dashboard',
    spec: 'admin.spec.ts-snapshots',
    filter: (f) => f.startsWith('admin-dashboard'),
    priority: 3,
    description: 'Main admin landing after login',
  },
  {
    id: 'admin-tournaments',
    title: 'Admin — Tournaments',
    spec: 'admin.spec.ts-snapshots',
    filter: (f) => f.startsWith('admin-tournaments'),
    priority: 4,
    description: 'Tournament management view',
  },
  {
    id: 'admin-users',
    title: 'Admin — Users',
    spec: 'admin.spec.ts-snapshots',
    filter: (f) => f.startsWith('admin-users'),
    priority: 5,
    description: 'User management view',
  },
  {
    id: 'tournament-public',
    title: 'Public Tournament Page',
    spec: 'tournament.spec.ts-snapshots',
    filter: (f) => f.startsWith('tournament-public'),
    priority: 6,
    description: 'What spectators see',
  },
  {
    id: 'responsive',
    title: 'Responsive Layouts',
    spec: 'responsive.spec.ts-snapshots',
    priority: 7,
    description: 'Desktop, tablet, and mobile views',
  },
];

function parseScreenshotName(filename) {
  // e.g. admin-dashboard-chromium-desktop-linux.png
  const name = filename.replace(/\.png$/, '');
  const parts = name.split('-');
  // last 3 parts are: browser, viewport, os
  const os = parts.pop();
  const viewport = parts.pop();
  const browser = parts.pop();
  const label = parts.join('-');
  return { label, browser, viewport, os };
}

function collectScreenshots(story) {
  const dir = join(SNAPSHOTS_DIR, story.spec);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => extname(f) === '.png');
  const filtered = story.filter ? files.filter(story.filter) : files;
  return filtered.map((f) => {
    const parsed = parseScreenshotName(f);
    const data = readFileSync(join(dir, f));
    return {
      ...parsed,
      filename: f,
      src: `data:image/png;base64,${data.toString('base64')}`,
    };
  });
}

function groupByLabel(screenshots) {
  const groups = {};
  for (const s of screenshots) {
    if (!groups[s.label]) groups[s.label] = [];
    groups[s.label].push(s);
  }
  return groups;
}

function generateHTML(stories) {
  const storyBlocks = stories
    .map((story) => {
      const screenshots = collectScreenshots(story);
      if (screenshots.length === 0) return '';
      const grouped = groupByLabel(screenshots);
      const screenshotsHTML = Object.entries(grouped)
        .map(([label, shots]) => {
          const cards = shots
            .map(
              (s) => `
            <div class="screenshot-card">
              <img src="${s.src}" alt="${s.label}" loading="lazy" />
              <div class="meta">
                <span class="badge browser">${s.browser}</span>
                <span class="badge viewport">${s.viewport}</span>
              </div>
            </div>`
            )
            .join('');
          return `
          <div class="screenshot-group">
            <h3>${label.replace(/-/g, ' ')}</h3>
            <div class="screenshot-grid">${cards}</div>
          </div>`;
        })
        .join('\n');
      return `
      <section class="story" id="${story.id}">
        <div class="story-header">
          <span class="priority">#${story.priority}</span>
          <div>
            <h2>${story.title}</h2>
            <p class="description">${story.description}</p>
          </div>
        </div>
        ${screenshotsHTML}
      </section>`;
    })
    .filter(Boolean)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Visual Story Report</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f1117; color: #e1e4e8; line-height: 1.6; }
  .nav { position: fixed; top: 0; left: 0; width: 220px; height: 100vh; background: #161b22; border-right: 1px solid #30363d; padding: 20px 0; overflow-y: auto; z-index: 100; }
  .nav h1 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #8b949e; padding: 0 16px 16px; border-bottom: 1px solid #30363d; }
  .nav a { display: flex; align-items: center; gap: 8px; padding: 10px 16px; color: #c9d1d9; text-decoration: none; font-size: 14px; transition: background 0.15s; }
  .nav a:hover, .nav a.active { background: #21262d; color: #58a6ff; }
  .nav .priority-num { background: #30363d; color: #8b949e; font-size: 11px; padding: 2px 6px; border-radius: 10px; min-width: 22px; text-align: center; }
  .main { margin-left: 220px; padding: 32px 40px; max-width: 1200px; }
  .story { margin-bottom: 48px; scroll-margin-top: 20px; }
  .story-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #30363d; }
  .priority { background: #238636; color: #fff; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 12px; white-space: nowrap; }
  .story-header h2 { font-size: 22px; color: #f0f6fc; }
  .description { color: #8b949e; font-size: 14px; margin-top: 2px; }
  .screenshot-group { margin-bottom: 24px; }
  .screenshot-group h3 { font-size: 15px; color: #c9d1d9; margin-bottom: 12px; text-transform: capitalize; }
  .screenshot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
  .screenshot-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; overflow: hidden; transition: border-color 0.15s; }
  .screenshot-card:hover { border-color: #58a6ff; }
  .screenshot-card img { width: 100%; display: block; cursor: pointer; }
  .meta { padding: 8px 12px; display: flex; gap: 6px; }
  .badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; text-transform: capitalize; }
  .badge.browser { background: #1f6feb22; color: #58a6ff; }
  .badge.viewport { background: #23863622; color: #56d364; }
  .lightbox { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 1000; align-items: center; justify-content: center; cursor: zoom-out; }
  .lightbox.active { display: flex; }
  .lightbox img { max-width: 95vw; max-height: 95vh; border-radius: 4px; }
  @media (max-width: 768px) {
    .nav { display: none; }
    .main { margin-left: 0; padding: 16px; }
    .screenshot-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<nav class="nav">
  <h1>Visual Stories</h1>
  ${STORIES.map(
    (s) => `<a href="#${s.id}"><span class="priority-num">${s.priority}</span> ${s.title}</a>`
  ).join('\n  ')}
</nav>
<main class="main">
  <h1 style="font-size:28px;margin-bottom:8px;">Visual Story Report</h1>
  <p style="color:#8b949e;margin-bottom:32px;">Generated ${new Date().toISOString().split('T')[0]} &mdash; ${stories.length} flows</p>
  ${storyBlocks}
</main>
<div class="lightbox" id="lightbox"><img src="" alt="" /></div>
<script>
  document.querySelectorAll('.screenshot-card img').forEach(img => {
    img.addEventListener('click', () => {
      const lb = document.getElementById('lightbox');
      lb.querySelector('img').src = img.src;
      lb.classList.add('active');
    });
  });
  document.getElementById('lightbox').addEventListener('click', () => {
    document.getElementById('lightbox').classList.remove('active');
  });
  const navLinks = document.querySelectorAll('.nav a');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        const link = document.querySelector('.nav a[href="#' + e.target.id + '"]');
        if (link) link.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  document.querySelectorAll('.story').forEach(s => observer.observe(s));
</script>
</body>
</html>`;
}

const html = generateHTML(STORIES);
writeFileSync(OUTPUT, html);
console.log(`Visual story report written to ${OUTPUT}`);
