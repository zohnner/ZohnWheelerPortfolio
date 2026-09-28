import { DEFAULT_ORDER, RESPECT, EASY, LOCAL, COPY } from './shared.mjs';

// Fallback for trades without a dedicated preset. Services must come from the
// content file (validation requires at least one).
export default {
  industry: 'generic',
  trade: 'Home Services',
  schemaType: 'HomeAndConstructionBusiness',
  theme: { preset: 'bold', mode: 'light' },
  hero: {
    headline: 'Quality work, done right.',
    sub: 'Trusted local service for homes across the Kansas City metro.',
    image: 'stock:generic/hero.jpg',
    cta: 'Get a Free Estimate',
  },
  banner: { enabled: false, text: 'Need help fast? Call us today.' },
  copy: {
    ...COPY,
    servicesIntro: 'Every job starts with a clear quote and ends with a clean workspace.',
    whyUsTitle: 'Why homeowners choose us',
    ctaTitle: 'Ready to get started?',
  },
  services: [],
  whyUs: [
    { icon: 'check', title: 'Clear, upfront quotes', text: 'You’ll know what’s included and what it costs before work begins.' },
    RESPECT, EASY, LOCAL,
  ],
  faq: [
    { q: 'What areas do you serve?', a: 'We serve homeowners across the Kansas City metro. Give us a call to confirm we cover your neighborhood.' },
    { q: 'How do I get started?', a: 'Call us or request an estimate online, and we’ll get back to you quickly.' },
  ],
  financing: { enabled: false, title: 'Financing available', text: 'Ask about payment options.' },
  trustSuggestions: ['Licensed & Insured'],
  sectionOrder: DEFAULT_ORDER,
};
