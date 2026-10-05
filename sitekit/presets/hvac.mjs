import { DEFAULT_ORDER, RESPECT, EASY, LOCAL, COPY } from './shared.mjs';

export default {
  industry: 'hvac',
  trade: 'Heating & Cooling',
  schemaType: 'HVACBusiness',
  serviceIcon: 'fan',
  theme: { preset: 'clean', mode: 'light' },
  hero: {
    headline: 'Stay comfortable all year long.',
    sub: 'Air conditioning, furnace repair, and system replacement for homes across the Kansas City metro.',
    image: 'stock:hvac/hero.jpg',
    cta: 'Schedule Service',
  },
  banner: { enabled: false, text: 'AC or furnace out? Call now for fast service.' },
  copy: {
    ...COPY,
    servicesIntro: 'Repairs, replacements, and tune-ups for every major brand of heating and cooling equipment.',
    whyUsTitle: 'Why homeowners trust our techs',
    ctaTitle: 'Too hot, too cold, or just not right?',
  },
  services: [
    {
      slug: 'ac-repair', name: 'AC Repair', icon: 'snowflake', image: 'stock:hvac/ac-repair.jpg',
      summary: 'Fast diagnosis and repair when your air conditioner stops keeping up.',
      body: 'Kansas City summers don’t wait. We diagnose the real problem, explain your options in plain language, and get the cool air flowing again.\n\n- Refrigerant leaks and weak cooling\n- Capacitors, contactors, and fan motors\n- Frozen coils and drainage problems',
    },
    {
      slug: 'furnace-repair', name: 'Furnace Repair', icon: 'flame', image: 'stock:hvac/furnace-repair.jpg',
      summary: 'Heat restored quickly and safely when the temperature drops.',
      body: 'A furnace that won’t start on a January night is an emergency. We troubleshoot ignition, airflow, and safety issues, and make sure your system is running safely before we leave.\n\n- No-heat and short-cycling repairs\n- Igniters, flame sensors, and blower motors\n- Carbon monoxide safety checks',
    },
    {
      slug: 'hvac-replacement', name: 'System Replacement', icon: 'fan', image: 'stock:hvac/hvac-replacement.jpg',
      summary: 'Right-sized, efficient heating and cooling systems, installed properly.',
      body: 'When repairs stop making sense, we help you choose a system sized for your home — not just the biggest unit on the truck — and install it to manufacturer specifications.\n\n- Load calculations for proper sizing\n- High-efficiency furnaces, air conditioners, and heat pumps\n- Clear options at different price points',
    },
    {
      slug: 'maintenance-plans', name: 'Maintenance Plans', icon: 'tools', image: 'stock:hvac/maintenance-plans.jpg',
      summary: 'Seasonal tune-ups that prevent breakdowns and extend system life.',
      body: 'Most breakdowns start as small problems a tune-up would have caught. A maintenance plan keeps your system checked every spring and fall.\n\n- Spring AC and fall furnace tune-ups\n- Filter, coil, and electrical checks\n- Priority scheduling for plan members',
    },
  ],
  whyUs: [
    { icon: 'check', title: 'Straight answers', text: 'We explain what’s wrong and what it will cost before any work begins.' },
    RESPECT, EASY, LOCAL,
  ],
  faq: [
    { q: 'How often should my system be serviced?', a: 'Once a year for each system is a good rule — cooling in the spring and heating in the fall.' },
    { q: 'Should I repair or replace my system?', a: 'Age, repair cost, and efficiency all factor in. We’ll give you an honest side-by-side so you can decide.' },
    { q: 'How long does a new system install take?', a: 'Most replacements are completed in a single day.' },
    { q: 'What size system do I need?', a: 'It depends on your home’s square footage, insulation, windows, and layout. We calculate it rather than guess.' },
  ],
  financing: { enabled: false, title: 'Flexible financing available', text: 'Ask about payment options for new equipment.' },
  trustSuggestions: ['Licensed & Insured', 'NATE-Certified Technicians', 'Manufacturer Dealer', 'Satisfaction Guarantee'],
  sectionOrder: DEFAULT_ORDER,
};
