import { DEFAULT_ORDER, RESPECT, EASY, LOCAL, COPY } from './shared.mjs';

export default {
  industry: 'roofing',
  trade: 'Roofing',
  schemaType: 'RoofingContractor',
  theme: { preset: 'storm', mode: 'light' },
  hero: {
    headline: 'Roofing done right the first time.',
    sub: 'Roof replacement, repairs, and storm damage restoration for homes across the Kansas City metro.',
    image: 'stock:roofing/hero.jpg',
    cta: 'Get a Free Estimate',
  },
  banner: { enabled: false, text: 'Hail or wind damage? Call now to schedule a storm inspection.' },
  copy: {
    ...COPY,
    servicesIntro: 'From a few missing shingles to a full tear-off, every job starts with a clear written quote.',
    whyUsTitle: 'Why homeowners call us first',
    ctaTitle: 'Ready for a roof you don’t have to think about?',
  },
  services: [
    {
      slug: 'roof-replacement', name: 'Roof Replacement', icon: 'home', image: 'stock:roofing/roof-replacement.jpg',
      summary: 'Complete tear-off and replacement with quality materials and a clean job site.',
      body: 'A new roof is one of the biggest investments you’ll make in your home. We walk you through material options, colors, and ventilation, then handle the full tear-off, decking inspection, and installation.\n\n- Architectural shingle and metal options\n- Decking inspected and replaced where needed\n- Full cleanup, including a magnetic nail sweep',
    },
    {
      slug: 'roof-repair', name: 'Roof Repair', icon: 'tools', image: 'stock:roofing/roof-repair.jpg',
      summary: 'Leaks, missing shingles, flashing, and vent boots fixed fast.',
      body: 'Small problems turn into big ones once water gets in. We find the source of the leak — not just the stain on your ceiling — and fix it properly.\n\n- Leak detection and repair\n- Flashing, vent boot, and chimney repairs\n- Missing or damaged shingle replacement',
    },
    {
      slug: 'storm-damage', name: 'Storm Damage', icon: 'cloud', image: 'stock:roofing/storm-damage.jpg',
      summary: 'Hail and wind damage inspections, with help understanding your insurance claim.',
      body: 'Kansas City hail can damage a roof in minutes, and the damage isn’t always visible from the ground. We inspect, document what we find with photos, and explain your options before you file a claim.\n\n- Hail and wind damage inspections\n- Photo documentation for your insurance company\n- Emergency tarping to prevent further damage',
    },
    {
      slug: 'gutters', name: 'Gutters', icon: 'droplet', image: 'stock:roofing/gutters.jpg',
      summary: 'Seamless gutters and downspouts that keep water away from your home.',
      body: 'Gutters protect your roof, siding, and foundation. We install seamless gutters sized for your roof and run downspouts where the water actually needs to go.\n\n- Seamless aluminum gutters\n- Downspout extensions and drainage planning\n- Gutter guards',
    },
  ],
  whyUs: [
    { icon: 'check', title: 'Clear, written quotes', text: 'You’ll know exactly what’s included and what it costs before any work begins.' },
    RESPECT, EASY, LOCAL,
  ],
  faq: [
    { q: 'How do I know if I need a new roof or just a repair?', a: 'It depends on the roof’s age, how widespread the damage is, and whether leaks keep coming back. We’ll inspect it and give you an honest recommendation — if a repair will do the job, we’ll tell you.' },
    { q: 'Do you help with insurance claims?', a: 'We document storm damage with photos and walk you through what to expect from the claims process. Coverage decisions are always up to your insurance company.' },
    { q: 'How long does a roof replacement take?', a: 'Most homes are finished in one to two days, depending on size, weather, and the materials you choose.' },
    { q: 'How much does a new roof cost?', a: 'It depends on the size and pitch of your roof and the materials you pick. You’ll get a detailed written estimate so there are no surprises.' },
  ],
  financing: { enabled: false, title: 'Flexible financing available', text: 'Ask about payment options that fit your budget.' },
  trustSuggestions: ['Licensed & Insured', 'Manufacturer Certified', 'BBB Accredited', 'Workmanship Warranty'],
  sectionOrder: DEFAULT_ORDER,
};
