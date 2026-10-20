"""
CSS styles for HEJI Pages Candidates Review
"""

CSS_CONTENT = """/* Candidate styles for HEJI Pages 100 UI/UX Improvements */
.scr {
  font-family: Inter, system-ui, -apple-system, sans-serif;
  color: #1A1C20;
  background: #F8F9FD;
  width: 100%;
  min-height: 100%;
  position: relative;
  box-sizing: border-box;
}

.scr.dark {
  color: #E2E6EF;
  background: #0E1117;
}

/* Base Nav */
.h-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 28px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  position: sticky;
  top: 0;
  z-index: 50;
}
.scr.dark .h-nav {
  background: rgba(14, 17, 23, 0.85);
  border-bottom-color: rgba(255, 255, 255, 0.08);
}
.h-nav-left { display: flex; align-items: center; gap: 10px; }
.h-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; }
.h-logo { border-radius: 7px; }
.h-title { font-weight: 700; font-size: 17px; letter-spacing: -0.01em; }
.h-nav-mid { display: flex; align-items: center; gap: 18px; }
.h-link { font-size: 14px; font-weight: 500; color: #555E6D; cursor: pointer; text-decoration: none; }
.scr.dark .h-link { color: #9AADC3; }
.h-link.on { color: #2F5BEA; font-weight: 600; }
.scr.dark .h-link.on { color: #7F9DFF; }
.h-link.status-pill {
  padding: 4px 10px;
  border-radius: 99px;
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
  font-weight: 600;
  font-size: 13px;
}
.scr.dark .h-link.status-pill {
  background: rgba(16, 185, 129, 0.2);
  color: #34D399;
}
.h-nav-right { display: flex; align-items: center; gap: 12px; }
.h-search-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px;
  background: #F1F3F8;
  color: #64748B;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid rgba(0,0,0,0.04);
}
.scr.dark .h-search-btn {
  background: #1A202C;
  color: #94A3B8;
  border-color: rgba(255,255,255,0.06);
}
.h-search-btn kbd {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #E2E8F0;
  color: #475569;
}
.scr.dark .h-search-btn kbd {
  background: #2D3748;
  color: #CBD5E1;
}
.h-nav-icon {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: #64748B;
  cursor: pointer;
}
.scr.dark .h-nav-icon { color: #94A3B8; }

/* Hero Section */
.h-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 64px 36px 48px;
  max-width: 1080px;
  margin: 0 auto;
  gap: 36px;
}
.h-hero-content { flex: 1; max-width: 620px; }
.h-hero-title {
  font-size: 44px;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin: 0 0 8px;
  background: linear-gradient(120deg, #2F5BEA, #1D4ED8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.scr.dark .h-hero-title {
  background: linear-gradient(120deg, #A9BCFF, #5D82FF);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.h-hero-tagline {
  font-size: 22px;
  font-weight: 600;
  color: #1E293B;
  margin: 0 0 12px;
}
.scr.dark .h-hero-tagline { color: #F1F5F9; }
.h-hero-sub {
  font-size: 16px;
  line-height: 1.6;
  color: #64748B;
  margin: 0 0 24px;
}
.scr.dark .h-hero-sub { color: #94A3B8; }
.h-hero-actions { display: flex; gap: 12px; }
.h-btn-hero-pri {
  display: inline-block;
  padding: 10px 22px;
  border-radius: 10px;
  background: #2F5BEA;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;
}
.h-btn-hero-sec {
  display: inline-block;
  padding: 10px 22px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #CBD5E1;
  color: #1E293B;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;
}
.scr.dark .h-btn-hero-sec {
  background: #1E293B;
  border-color: #334155;
  color: #F8FAFC;
}
.h-hero-art { flex: none; }

/* Apps Section & Cards */
.h-apps-section { max-width: 1080px; margin: 0 auto; padding: 24px 36px; }
.h-sec-hd { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 20px; }
.h-sec-hd h2 { font-size: 28px; font-weight: 700; margin: 0; }
.h-apps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}
.h-card {
  display: flex;
  gap: 16px;
  padding: 22px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid #E2E8F0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  position: relative;
  transition: transform 0.2s, box-shadow 0.2s;
}
.scr.dark .h-card {
  background: #151922;
  border-color: #232B3B;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.h-card-icon { flex: none; width: 48px; height: 48px; }
.h-card-main { flex: 1; min-width: 0; }
.h-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.h-card-top h4 { font-size: 18px; font-weight: 700; margin: 0; }
.h-card-ver { font-size: 11px; font-weight: 600; color: #64748B; background: #F1F5F9; padding: 2px 8px; border-radius: 99px; }
.scr.dark .h-card-ver { background: #1E293B; color: #94A3B8; }
.h-card-desc { font-size: 14px; line-height: 1.5; color: #64748B; margin: 0 0 12px; }
.scr.dark .h-card-desc { color: #94A3B8; }
.h-card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.h-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
  background: #EEF2FF;
  color: #3730A3;
}
.scr.dark .h-tag { background: #1E1B4B; color: #A5B4FC; }
.h-card-actions { display: flex; gap: 8px; }
.h-btn-pri {
  padding: 5px 12px;
  border-radius: 8px;
  background: #2F5BEA;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}
.h-btn-sec {
  padding: 5px 12px;
  border-radius: 8px;
  background: #F1F5F9;
  border: 1px solid #CBD5E1;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}
.scr.dark .h-btn-sec { background: #1E293B; border-color: #334155; color: #CBD5E1; }

/* Principles Section */
.h-principles-sec { max-width: 1080px; margin: 32px auto; padding: 0 36px 60px; }
.h-principles-sec h2 { font-size: 24px; font-weight: 700; margin: 0 0 16px; }
.h-principles-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.h-principle {
  padding: 20px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid #E2E8F0;
}
.scr.dark .h-principle { background: #151922; border-color: #232B3B; }
.h-principle h3 { font-size: 16px; font-weight: 700; margin: 0 0 6px; }
.h-principle p { font-size: 13.5px; color: #64748B; margin: 0; line-height: 1.5; }
.scr.dark .h-principle p { color: #94A3B8; }

/* Feedback FAB */
.h-feedback-fab {
  position: absolute;
  bottom: 24px;
  right: 28px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 99px;
  background: #2F5BEA;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 4px 14px rgba(47, 91, 234, 0.4);
  cursor: pointer;
  z-index: 100;
}

/* ─────────────────────────────────────────────────────────────
   Candidate-Specific Custom Elements
   ───────────────────────────────────────────────────────────── */

/* C01: App Dock in Hero */
.c01-dock {
  display: flex;
  gap: 12px;
  padding: 8px 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 12px 36px rgba(0,0,0,0.08);
  margin-top: 24px;
  width: fit-content;
}
.scr.dark .c01-dock {
  background: rgba(26, 32, 44, 0.7);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 12px 36px rgba(0,0,0,0.4);
}
.c01-dock-item {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: grid;
  place-items: center;
}
.c01-dock-item:hover { transform: scale(1.22) translateY(-4px); }

/* C02: Live Terminal Sandbox */
.c02-terminal {
  border-radius: 12px;
  background: #0D1117;
  color: #C9D1D9;
  border: 1px solid #30363D;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  box-shadow: 0 16px 40px rgba(0,0,0,0.25);
  margin-top: 20px;
}
.c02-term-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #161B22;
  border-bottom: 1px solid #30363D;
}
.c02-term-dot { width: 10px; height: 10px; border-radius: 50%; }
.c02-term-title { margin-left: 12px; font-size: 11px; color: #8B949E; }
.c02-term-body { padding: 14px; line-height: 1.6; }
.c02-term-prompt { color: #58A6FF; font-weight: 600; }
.c02-term-out { color: #7EE787; }

/* C03: Dual Audience Switcher */
.c03-persona-switch {
  display: inline-flex;
  padding: 4px;
  border-radius: 12px;
  background: #E2E8F0;
  margin-bottom: 16px;
}
.scr.dark .c03-persona-switch { background: #1E293B; }
.c03-persona-btn {
  padding: 6px 14px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: #64748B;
}
.c03-persona-btn.active {
  background: #fff;
  color: #0F172A;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.scr.dark .c03-persona-btn.active {
  background: #334155;
  color: #F8FAFC;
}

/* C11: Bento Box Grid */
.c11-bento {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: minmax(140px, auto);
  gap: 16px;
}
.c11-bento-card {
  padding: 22px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #E2E8F0;
  position: relative;
  overflow: hidden;
}
.scr.dark .c11-bento-card { background: #151922; border-color: #232B3B; }
.c11-bento-hero { grid-column: span 2; grid-row: span 2; background: linear-gradient(135deg, #EEF2FF, #E0E7FF); }
.scr.dark .c11-bento-hero { background: linear-gradient(135deg, #1E1B4B, #0F172A); }
.c11-bento-wide { grid-column: span 2; }

/* C21: Filter Pill Bar */
.c21-pill-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.c21-pill {
  padding: 6px 14px;
  border-radius: 99px;
  background: #fff;
  border: 1px solid #CBD5E1;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  white-space: nowrap;
}
.c21-pill.active {
  background: #2F5BEA;
  border-color: #2F5BEA;
  color: #fff;
}
.scr.dark .c21-pill { background: #1E293B; border-color: #334155; color: #CBD5E1; }
.scr.dark .c21-pill.active { background: #4F7CFF; border-color: #4F7CFF; color: #fff; }

/* C31: Pipeline Pulse Board */
.c31-pulse-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}
.c31-pulse-card {
  padding: 16px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #E2E8F0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.scr.dark .c31-pulse-card { background: #151922; border-color: #232B3B; }
.c31-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #10B981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

/* C41: Reading Progress & Sticky TOC */
.c41-doc-layout {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 36px;
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px;
}
.c41-toc {
  position: sticky;
  top: 80px;
  padding-left: 16px;
  border-left: 2px solid #E2E8F0;
  font-size: 13px;
  color: #64748B;
}
.scr.dark .c41-toc { border-left-color: #232B3B; color: #94A3B8; }
.c41-toc-link.active { color: #2F5BEA; font-weight: 600; }

/* C51: MCP Playground */
.c51-mcp-panel {
  border-radius: 14px;
  border: 1px solid #E2E8F0;
  background: #fff;
  padding: 20px;
  margin: 20px 0;
}
.scr.dark .c51-mcp-panel { background: #151922; border-color: #232B3B; }
.c51-tool-badge {
  font-size: 11px;
  font-weight: 700;
  background: #EEF2FF;
  color: #4F46E5;
  padding: 3px 8px;
  border-radius: 6px;
  font-family: monospace;
}
.scr.dark .c51-tool-badge { background: #1E1B4B; color: #C7D2FE; }

/* C61: Feedback Kanban */
.c61-kanban {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin: 20px 0;
}
.c61-col {
  padding: 14px;
  border-radius: 12px;
  background: #F1F5F9;
  min-height: 240px;
}
.scr.dark .c61-col { background: #11141B; }
.c61-col-title { font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 10px; color: #64748B; }
.c61-ticket {
  padding: 12px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #CBD5E1;
  font-size: 12.5px;
  margin-bottom: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.scr.dark .c61-ticket { background: #1A202C; border-color: #2D3748; color: #E2E8F0; }

/* Browser frame styling for candidate review */
.frame.browser:has(.scr.dark) { background: #14171E; }
.frame.browser:has(.scr.dark) .chrome { background: #1C2028; border-bottom-color: rgba(255,255,255,0.08); }
.frame.browser:has(.scr.dark) .chrome i { background: #353B47; }
.frame.browser:has(.scr.dark) .chrome span { background: #12141A; color: #9AA3AF; }
"""

def write_css(dest_path):
    with open(dest_path, "w", encoding="utf-8") as f:
        f.write(CSS_CONTENT)
    print("Wrote CSS to", dest_path)

if __name__ == "__main__":
    write_css("reports/2026-10-20-heji-pages-100-ui-ux/site/css/candidates.css")
