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
      'Full-stack MLB analytics platform for broadcast pros and fantasy players: live play-by-play scorecards, Statcast leaderboards, printable game-prep sheets, a custom stat builder and AI-generated broadcast narratives. Built solo across 200+ commits with a multi-agent AI review team that keeps shipping velocity high.',
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
      'AI sales automation SaaS for local service businesses like roofing, HVAC and plumbing. It scores leads, drafts outreach copy and turns campaigns into client-ready proposals, with real Stripe billing, a per-account dashboard and an admin console. Claude-powered generation is cost-tracked per customer and gated to paying accounts.',
    stack: ['Python / Flask', 'Stripe billing', 'Claude API', 'SaaS'],
    links: [{ label: 'Live', href: 'https://botchase.onrender.com/' }],
    thumb: '/thumb-botchase.jpg',
    healthUrl: 'https://botchase.onrender.com/',

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
    order: ['sportstrata', 'botchase', 'zretrobuild', 'oraclebot', 'sitekit'],
    contact: { prefix: 'email: ', text: OWNER.email, href: `mailto:${OWNER.email}` },
  },
  build: {
    label: 'Building',
    order: ['sitekit', 'botchase', 'sportstrata', 'zretrobuild'],
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
  'project.oraclebot': 'The capstone AI bot that helped students study, featured by Mizzou Engineering.',
  'project.sitekit': 'Sitekit: fast, professional websites for local businesses, built to turn visitors into calls.',
};

// about.txt in the virtual filesystem.
export const ABOUT = [
  'Zohn Wheeler: full-stack developer, Kansas City, MO.',
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
  '    sportstrata, botchase, zretrobuild, oraclebot, sitekit',
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
  { id: 'hire', keywords: ['hire', 'hiring', 'available', 'availability', 'open', 'opportunity', 'recruit', 'recruiter', 'position', 'role', 'interview'],
    reply: "Zohn is open to full-time roles, contract work and interesting conversations. The fastest route is email: zohnwheeler@gmail.com. Or type 'contact'." },
  { id: 'education', keywords: ['education', 'school', 'degree', 'college', 'university', 'mizzou', 'graduate', 'study'],
    reply: "B.S. in Information Technology from the University of Missouri, 2024, with Dean's List honors. The senior capstone AI bot was featured by Mizzou Engineering." },
  { id: 'sitekit', keywords: ['sitekit', 'website', 'site', 'build', 'quote', 'business', 'price', 'cost', 'local', 'client', 'roofing', 'hvac'],
    reply: "Through Sitekit, Zohn builds fast, mobile-first sites for local service businesses: service and area pages, SEO fundamentals and a lead form straight to the owner. Type 'track build', then 'contact' for a quote." },
  { id: 'ai', keywords: ['ai', 'agent', 'claude', 'llm', 'automation', 'workflow', 'persona', 'review'],
    reply: "Zohn builds with AI agent teams. SportStrata ships with a design reviewer, code auditor and deep-review analyst. I was planned, built and reviewed by agents too. Type 'history' for the receipts." },
  { id: 'site', keywords: ['site', 'portfolio', 'terminal', 'orb', 'made', 'built', 'core', 'zw'],
    reply: "You're inside it: plain HTML, CSS and JavaScript modules on Cloudflare Pages, Workers functions for live data and a Three.js core. No framework, no build step. Type 'history' to see how I was made." },
  { id: 'sportstrata', keywords: ['sportstrata', 'baseball', 'mlb', 'sport', 'stat', 'analytic', 'fantasy', 'statcast', 'broadcast'],
    reply: "SportStrata is a full-stack MLB analytics platform: live scorecards, Statcast leaderboards and AI-generated broadcast narratives, built solo across 200+ commits. Try 'open sportstrata' or 'scan sportstrata'." },
  { id: 'botchase', keywords: ['botchase', 'sale', 'lead', 'outreach', 'stripe', 'billing'],
    reply: "BotChase is an AI sales automation SaaS for local service businesses, with lead scoring, outreach drafts and real Stripe billing. Try 'open botchase' or 'ping botchase'." },
  { id: 'zretrobuild', keywords: ['zretrobuild', 'arcade', 'game', 'retro', 'snake', 'breakout', 'invader'],
    reply: "ZRetroBuild is a playable 8-bit arcade (Snake, Breakout, Space Invaders) inside a CRT cabinet, with zero dependencies. Try 'open zretrobuild'." },
  { id: 'oraclebot', keywords: ['discord', 'bot', 'capstone', 'oracle', 'oraclebot', 'student'],
    reply: "The capstone Discord bot used AI to help students work through course material. Built by a team of four and featured by Mizzou Engineering. Try 'open oraclebot'." },
  { id: 'contact', keywords: ['contact', 'email', 'reach', 'linkedin', 'github', 'message', 'touch', 'call'],
    reply: "Email zohnwheeler@gmail.com, or find Zohn on LinkedIn and GitHub. Type 'contact' for clickable links." },
];
