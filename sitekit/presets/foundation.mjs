import { DEFAULT_ORDER, RESPECT, EASY, LOCAL, COPY } from './shared.mjs';

export default {
  industry: 'foundation',
  trade: 'Foundation Repair',
  schemaType: 'HomeAndConstructionBusiness',
  theme: { preset: 'earth', mode: 'light' },
  hero: {
    headline: 'Protect your home from the ground up.',
    sub: 'Foundation repair, basement waterproofing, and crawl space solutions for homes across the Kansas City metro.',
    image: 'stock:foundation/hero.jpg',
    cta: 'Get a Free Inspection',
  },
  banner: { enabled: false, text: 'Water in your basement? Call now to schedule an inspection.' },
  copy: {
    ...COPY,
    servicesIntro: 'We find what’s causing the problem and fix it at the source, not just the symptoms.',
    whyUsTitle: 'Why homeowners choose us',
    ctaTitle: 'Cracks, water, or sinking floors?',
  },
  services: [
    {
      slug: 'foundation-repair', name: 'Foundation Repair', icon: 'layers', image: 'stock:foundation/foundation-repair.jpg',
      summary: 'Stabilize settling, cracked, and bowing foundation walls for good.',
      body: 'Kansas City’s clay soil swells and shrinks with the seasons, and foundations pay the price. We find the cause of the movement and recommend a repair that addresses it.\n\n- Wall bracing and anchors for bowing walls\n- Piering for settling foundations\n- Crack repair and sealing',
    },
    {
      slug: 'basement-waterproofing', name: 'Basement Waterproofing', icon: 'droplet', image: 'stock:foundation/basement-waterproofing.jpg',
      summary: 'Keep water out and your basement dry, usable, and healthy.',
      body: 'A wet basement ruins belongings, invites mold, and makes finished space impossible. We pinpoint where water is getting in and stop it.\n\n- Interior drainage systems and sump pumps\n- Crack and wall sealing\n- Dehumidification',
    },
    {
      slug: 'crawl-space', name: 'Crawl Space Repair', icon: 'home', image: 'stock:foundation/crawl-space.jpg',
      summary: 'Encapsulation and support for damp or sagging crawl spaces.',
      body: 'What happens in your crawl space affects the air and floors in the rest of your home. We dry it out, seal it up, and support floors that have started to sag.\n\n- Vapor barriers and encapsulation\n- Floor joist support\n- Moisture and humidity control',
    },
    {
      slug: 'concrete-leveling', name: 'Concrete Leveling', icon: 'tools', image: 'stock:foundation/concrete-leveling.jpg',
      summary: 'Lift and level sunken driveways, patios, and walkways.',
      body: 'Sunken concrete is a trip hazard and can send water toward your foundation. Leveling lifts the existing slab back into place, usually for far less than replacement.\n\n- Driveways, sidewalks, and patios\n- Steps and garage floors\n- Joint sealing to prevent future settling',
    },
  ],
  whyUs: [
    { icon: 'check', title: 'Honest assessments', text: 'We’ll tell you what your home actually needs — and what it doesn’t.' },
    RESPECT, EASY, LOCAL,
  ],
  faq: [
    { q: 'Are foundation cracks always a problem?', a: 'No — some hairline cracks are normal. Wide, growing, or stair-step cracks and bowing walls should be inspected.' },
    { q: 'Why is my basement wet?', a: 'Common causes include poor drainage, cracks, and pressure from saturated soil. An inspection pinpoints the source.' },
    { q: 'How long does foundation repair take?', a: 'Many repairs are completed in one to three days, depending on the method and scope.' },
    { q: 'Will repairs disrupt my home?', a: 'Most work happens outside or in the basement, and we protect the areas we work in.' },
  ],
  financing: { enabled: false, title: 'Flexible financing available', text: 'Ask about payment options for larger repairs.' },
  trustSuggestions: ['Licensed & Insured', 'Transferable Warranty', 'BBB Accredited', 'Free Inspections'],
  sectionOrder: DEFAULT_ORDER,
};
