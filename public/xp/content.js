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
