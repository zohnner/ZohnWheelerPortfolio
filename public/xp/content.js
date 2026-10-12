// Single source of truth for the immersive homepage: projects, audience
// tracks and narration. Data only, no logic. Imported by the browser modules,
// by functions/api/status.js and by scripts/render-voice.mjs.

export const OWNER = {
  name: 'Zohn Wheeler',
  email: 'zohnwheeler@gmail.com',
  github: 'https://github.com/zohnner',
  linkedin: 'https://www.linkedin.com/in/zohn-wheeler/',
};

export const GITHUB_USER = 'zohnner';

export const PROJECTS = [
  {
    id: 'sportstrata',
    name: 'SportStrata',
    color: '#4fd1ff',
    story:
      'Multi-sport analytics platform for broadcast pros and fantasy players. MLB is the flagship, with live play-by-play scorecards, Statcast leaderboards, Monte Carlo playoff odds and a natural-language Ask bar; NFL, college football, college basketball and WNBA run alongside it. No framework, no build step. Built solo across 800+ commits with a multi-agent AI review team that keeps shipping velocity high.',
    stack: ['JavaScript', 'Cloudflare Workers + D1', 'Live APIs', 'AI workflow'],
    links: [
      { label: 'Live', href: 'https://sportstrata.cc/' },
      { label: 'GitHub', href: 'https://github.com/zohnner/zohn-sports-stats' },
      { label: 'Case study', href: '/ai-workflow.html' },
    ],
    thumb: '/thumb-sportstrata.jpg',
    healthUrl: 'https://sportstrata.cc/',

    repo: 'zohnner/zohn-sports-stats',
  },
  {
    id: 'botchase',
    name: 'BotChase',
    color: '#ff9f43',
    story:
      'AI sales automation SaaS for local service businesses like roofing, HVAC and plumbing. It scores leads, drafts outreach copy and turns campaigns into client-ready proposals, with real Stripe billing, a per-account dashboard and an admin console. Claude-powered generation is cost-tracked per customer and gated to paying accounts. In development: the live demo is offline for now.',
    stack: ['Python / Flask', 'Stripe billing', 'Claude API', 'SaaS'],
    links: [{ label: 'Ask about it', href: 'mailto:zohnwheeler@gmail.com?subject=BotChase' }],
    thumb: '/thumb-botchase.jpg',
    healthUrl: null,

    repo: null,
  },
  {
    id: 'zretrobuild',
    name: 'ZRetroBuild',
    color: '#ff4fd8',
    story:
      'A fully playable 8-bit arcade with Snake, Breakout and Space Invaders inside an authentic CRT cabinet: scanlines, neon glow, a coin-insert system, synthesized Web Audio and a Konami Code easter egg. Zero dependencies.',
    stack: ['HTML / CSS / JS', 'Web Audio API', 'CSS animation', 'Zero deps'],
    links: [
      { label: 'Play', href: 'https://zretrobuild.zohnwheeler.workers.dev/' },
      { label: 'GitHub', href: 'https://github.com/zohnner/ZRetroBuild' },
    ],
    thumb: '/thumb-zretrobuild.jpg',
    healthUrl: 'https://zretrobuild.zohnwheeler.workers.dev/',

    repo: 'zohnner/ZRetroBuild',
  },
  {
    id: 'picksharp',
    name: 'PickSharp',
    color: '#e0b030',
    story:
      "A sports betting tool that prices bets instead of predicting games. Every game day it compares 9 US sportsbooks against Pinnacle's no-vig fair price, flags the bets selling for more than they're worth, and tracks every flagged bet against the closing line in public, misses included.",
    stack: ['React + Vite', 'Cloudflare Worker + D1', 'Supabase Auth', 'Tailwind'],
    links: [
      { label: 'Live', href: 'https://wepicksharp.com/' },
      { label: 'GitHub', href: 'https://github.com/zohnner/PickSharp' },
    ],
    thumb: '/thumb-picksharp.jpg',
    healthUrl: 'https://wepicksharp.com/',

    repo: 'zohnner/PickSharp',
  },
  {
    id: 'pepper',
    name: 'Pepper',
    color: '#ff7a59',
    story:
      'An AI-generated serialized adventure for TikTok and Reels: a stray tabby, a lantern-lit tunnel city and a lift back to the surface. The project is the production system behind it: a locked story bible and continuity log, per-episode scripts, visual prompts and voiceover, and fixed templates that keep every episode on-model.',
    stack: ['AI video', 'Story bible', 'Content pipeline', 'TikTok / Reels'],
    links: [{ label: 'GitHub', href: 'https://github.com/zohnner/Pepper' }],
    thumb: null,
    healthUrl: null,

    repo: 'zohnner/Pepper',
  },
  {
    id: 'oraclebot',
    name: 'Discord Educational Bot',
    color: '#a78bfa',
    story:
      'A senior capstone Discord bot that uses AI to help students work through course material with natural-language Q&A. Built by a team of four and featured by the University of Missouri College of Engineering.',
    stack: ['Python', 'NLP', 'React', 'Team of four'],
    links: [
      { label: 'Article', href: 'https://engineering.missouri.edu/2024/information-technology-students-develop-an-educational-ai-bot-for-capstone-project/' },
      { label: 'GitHub', href: 'https://github.com/zohnner/OracleChatBot' },
    ],
    thumb: null,
    healthUrl: null,

    repo: 'zohnner/OracleChatBot',
  },
  {
    id: 'sitekit',
    name: 'Sitekit',
    color: '#3dff9a',
    story:
      'Fast, mobile-first websites for local service businesses like roofing, HVAC and foundation repair. Every site ships with service and service-area pages, SEO fundamentals and a lead form that goes straight to the owner.',
    stack: ['Cloudflare Pages', 'D1', 'Templated content', 'Lead capture'],
    links: [{ label: 'Get a quote', href: '/hire.html#contact-form' }],
    thumb: null,
    healthUrl: null,

    repo: 'zohnner/ZohnWheelerPortfolio',
  },
];

export const TRACKS = {
  hire: {
    label: 'Hiring',
    order: ['sportstrata', 'picksharp', 'zretrobuild', 'botchase', 'pepper', 'oraclebot', 'sitekit'],
    contact: { prefix: 'email: ', text: OWNER.email, href: `mailto:${OWNER.email}` },
  },
  build: {
    label: 'Building',
    order: ['sitekit', 'sportstrata', 'picksharp', 'zretrobuild'],
    contact: { prefix: 'quote form: ', text: '/hire.html#contact-form', href: '/hire.html#contact-form' },
  },
};

// Voice narration is off until the clips are tuned. Captions always play.
// Flip to true to bring back the sound toggle and the `sound` command.
export const VOICE_ENABLED = false;

// Every entry here gets a pre-rendered voice clip (scripts/render-voice.mjs).
// Keep each line at 140 characters or fewer.
export const NARRATION = {
  intro: "Hello. I'm ZW-Core, the system Zohn Wheeler built to make introductions.",
  welcome: 'Welcome back. Picking up where we left off.',
  bio: 'Zohn is a Kansas City developer and federal IT professional who ships full-stack products from idea to production.',
  ask: 'So, are you here to hire Zohn, or to have something built?',
  'track.hire': 'Engineering it is. These projects show the most range. Pick one, or type help.',
  'track.build': "Let's talk results. This is what Zohn builds for businesses like yours. Pick one, or type help.",
  'project.sportstrata': "SportStrata: a live baseball analytics platform, built solo, running on Cloudflare's edge.",
  'project.botchase': 'BotChase: an AI sales assistant for local service businesses, with real billing.',
  'project.zretrobuild': 'Z Retro Build: a fully playable arcade in the browser, with zero dependencies.',
  'project.picksharp': 'PickSharp: a betting tool that flags bets priced better than the market, and tracks every one in public.',
  'project.pepper': 'Pepper: an AI-generated serial about a lost cat, run as a real production pipeline.',
  'project.oraclebot': 'The capstone AI bot that helped students study, featured by Mizzou Engineering.',
  'project.sitekit': 'Sitekit: fast, professional websites for local businesses, built to turn visitors into calls.',
};

// Lab Notes, newest first. The `notes` command lists these.
export const LAB_NOTES = [
  { id: '001', date: '2026-10-12', title: 'The bug that never threw an error', href: '/notes/silent-subsets.html' },
];

// about.txt in the virtual filesystem.
export const ABOUT = [
  "Zohn Wheeler: I build systems that don't break. Kansas City, MO.",
  '',
  'Supports mission-critical treasury systems for a federal agency',
  '(active TS/SCI clearance) and ships full-stack products end to end:',
  'Cloudflare Workers backends, AI-assisted workflows and fast sites',
  'for local businesses.',
  '',
  'Try: cat contact.txt, cd projects, man zohn',
];

// `man zohn`.
export const MAN = [
  'ZOHN(1)                     User Commands                     ZOHN(1)',
  '',
  'NAME',
  '    zohn - full-stack developer and federal IT professional',
  '',
  'SYNOPSIS',
  '    zohn [--hire] [--build] [--contact]',
  '',
  'DESCRIPTION',
  '    Kansas City developer who ships full-stack products end to end and',
  '    supports mission-critical treasury systems for a federal agency.',
  '',
  'SKILLS',
  '    JavaScript, TypeScript, Python, SQL, Bash',
  '    React, Node.js, Docker, Linux, Active Directory',
  '    Cloudflare Workers + D1, AWS, CI/CD, REST APIs',
  '',
  'PROJECTS',
  '    sportstrata, picksharp, zretrobuild, botchase, pepper,',
  '    oraclebot, sitekit',
  '',
  'SEE ALSO',
  '    resume(1), contact(1), scan(1), history(1)',
];

// Printed once at the end of the boot (decorative, aria-hidden).
export const BANNER = [
  '╔═╗╔═╗╦ ╦╔╗╔  ╦ ╦╦ ╦╔═╗╔═╗╦  ╔═╗╦═╗',
  '╔═╝║ ║╠═╣║║║  ║║║╠═╣║╣ ║╣ ║  ║╣ ╠╦╝',
  '╚═╝╚═╝╩ ╩╝╚╝  ╚╩╝╩ ╩╚═╝╚═╝╩═╝╚═╝╩╚═',
];

export const FALLBACK_REPLY = "I don't have that on file. Ask about projects, stack, experience, education or hiring, or type 'help'.";

// Scripted knowledge base for plain-English questions. Every reply is written
// from content already on the portfolio. Keywords are single lowercase tokens
// in the form answers.tokenize produces (a trailing plural 's' is dropped
// unless the word ends in ss, us or is).
export const KB = [
  { id: 'greeting', keywords: ['hi', 'hello', 'hey', 'yo', 'sup', 'greeting'],
    reply: "Hello. Ask me about Zohn's projects, stack, experience, education or availability. Or type 'help' to drive the terminal yourself." },
  { id: 'stack', keywords: ['stack', 'tech', 'language', 'framework', 'tool', 'skill', 'javascript', 'typescript', 'python', 'react', 'node', 'docker', 'aws', 'cloudflare', 'sql'],
    reply: 'Zohn works in JavaScript, TypeScript, Python, SQL and Bash, with React, Node.js, Docker and Linux. Infrastructure runs on Cloudflare Workers and D1, AWS, CI/CD and REST APIs.' },
  { id: 'experience', keywords: ['experience', 'job', 'work', 'career', 'employer', 'background', 'administrator', 'engineer'],
    reply: 'Applications Administrator on federal treasury systems since March 2026, giving Tier 2/3 support for enterprise financial applications. Before that, Junior Engineer at a Missouri state agency from July 2024 to January 2026: infrastructure, identity and automation.' },
  { id: 'clearance', keywords: ['clearance', 'sci', 'secret', 'security', 'federal', 'government', 'treasury', 'classified'],
    reply: 'Zohn holds an active TS/SCI clearance and supports classified, air-gapped federal treasury systems as a contractor.' },
  { id: 'location', keywords: ['where', 'location', 'based', 'city', 'missouri', 'remote', 'relocate'],
    reply: 'Zohn is based in Kansas City, Missouri, and open to opportunities.' },
  { id: 'hire', keywords: ['hire', 'hiring', 'available', 'availability', 'opportunity', 'recruit', 'recruiter', 'position', 'role', 'interview'],
    reply: "Zohn is open to platform and reliability roles in Kansas City, Seattle, Denver, Los Angeles or remote. The one-page brief is at /platform.html; the fastest route is email: zohnwheeler@gmail.com." },
  { id: 'education', keywords: ['education', 'school', 'degree', 'college', 'university', 'mizzou', 'graduate', 'study'],
    reply: "B.S. in Information Technology from the University of Missouri, 2024, with Dean's List honors. The senior capstone AI bot was featured by Mizzou Engineering." },
  { id: 'sitekit', keywords: ['sitekit', 'website', 'site', 'build', 'quote', 'business', 'price', 'cost', 'local', 'client', 'roofing', 'hvac'],
    reply: "Through Sitekit, Zohn builds fast, mobile-first sites for local service businesses: service and area pages, SEO fundamentals and a lead form straight to the owner. Type 'track build', then 'contact' for a quote." },
  { id: 'ai', keywords: ['ai', 'agent', 'claude', 'llm', 'automation', 'workflow', 'persona', 'review'],
    reply: "Zohn builds with AI agent teams. SportStrata ships with a design reviewer, code auditor and deep-review analyst. I was planned, built and reviewed by agents too. Type 'history' for the receipts." },
  { id: 'site', keywords: ['site', 'portfolio', 'terminal', 'orb', 'made', 'built', 'core', 'zw'],
    reply: "You're inside it: plain HTML, CSS and JavaScript modules on Cloudflare Pages, Workers functions for live data and a Three.js core. No framework, no build step. Type 'history' to see how I was made." },
  { id: 'sportstrata', keywords: ['sportstrata', 'baseball', 'mlb', 'sport', 'stat', 'analytic', 'fantasy', 'statcast', 'broadcast'],
    reply: "SportStrata is a multi-sport analytics platform: MLB scorecards, Statcast leaderboards and playoff odds, plus NFL, college football, college basketball and WNBA, built solo across 800+ commits. Try 'open sportstrata' or 'scan sportstrata'." },
  { id: 'botchase', keywords: ['botchase', 'sale', 'lead', 'outreach', 'stripe', 'billing'],
    reply: "BotChase is an AI sales automation SaaS for local service businesses, with lead scoring, outreach drafts and Stripe billing. It's in development, so the live demo is offline for now. Try 'open botchase'." },
  { id: 'picksharp', keywords: ['picksharp', 'betting', 'bet', 'odd', 'sportsbook', 'pinnacle', 'vig', 'wager', 'gambling'],
    reply: "PickSharp compares 9 US sportsbooks against Pinnacle's no-vig fair price, flags bets priced above fair, and tracks each one against the closing line in public. Try 'open picksharp'." },
  { id: 'pepper', keywords: ['pepper', 'cat', 'tiktok', 'reel', 'serial', 'episode', 'video'],
    reply: "Pepper is an AI-generated serialized adventure for TikTok and Reels, run like a production: a locked story bible, a continuity log and per-episode scripts and prompts. Try 'open pepper'." },
  { id: 'zretrobuild', keywords: ['zretrobuild', 'arcade', 'game', 'retro', 'snake', 'breakout', 'invader'],
    reply: "ZRetroBuild is a playable 8-bit arcade (Snake, Breakout, Space Invaders) inside a CRT cabinet, with zero dependencies. Try 'open zretrobuild'." },
  { id: 'oraclebot', keywords: ['discord', 'bot', 'capstone', 'oracle', 'oraclebot', 'student'],
    reply: "The capstone Discord bot used AI to help students work through course material. Built by a team of four and featured by Mizzou Engineering. Try 'open oraclebot'." },
  { id: 'decisions', keywords: ['decision', 'adr', 'tradeoff', 'architecture', 'why', 'reasoning'],
    reply: "SportStrata keeps a written decision log: the problem, the options and why one won. Type 'decisions' for the latest entries, or 'decisions D-135' to read one." },
  { id: 'deploy', keywords: ['deploy', 'pipeline', 'ci', 'gate', 'release', 'reliability', 'ship'],
    reply: "Type 'deploy' to replay the gates SportStrata's latest real CI run passed on main, plus the nightly contract monitor's last result. Live from GitHub Actions." },
  { id: 'notes', keywords: ['note', 'blog', 'writing', 'article', 'lab', 'incident', 'postmortem'],
    reply: "Zohn writes up incidents as Lab Notes: what broke, why nothing caught it, and the fix. Type 'notes' for the list." },
  { id: 'contact', keywords: ['contact', 'email', 'reach', 'linkedin', 'github', 'message', 'touch', 'call'],
    reply: "Email zohnwheeler@gmail.com, or find Zohn on LinkedIn and GitHub. Type 'contact' for clickable links." },
];
