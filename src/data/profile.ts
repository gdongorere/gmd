// src/data/profile.ts
// Single source of truth for personal details, links and page copy that appear in
// more than one place (nav, footer, hero, contact page, metadata).

export const profile = {
  name: 'Godliness Dongorere',
  firstName: 'Godliness',
  lastName: 'Dongorere',
  title: 'Software Developer',
  tagline: 'Full-stack developer building fast, dependable products, from PLC dashboards to polished web apps.',
  shortBio: 'Software Developer | FullStack Solutions',
  location: 'Eswatini',
  availability: 'Open to new projects',
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000'),
  email: 'godlinessdongorere@gmail.com',
  phone: '+268 7934 2380',
  phoneHref: 'tel:+26879342380',
  github: { label: 'github.com/geehyness', url: 'https://github.com/geehyness' },
  linkedin: { label: 'linkedin.com/in/gdongorere', url: 'https://linkedin.com/in/gdongorere' },
  resume: { url: '/Godliness_Dongorere_Resume_Systems.pdf', label: 'Download résumé (PDF)' },
} as const;

export interface NavItem {
  label: string;
  href: string;
}

export const navItems: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Projects', href: '/projects' },
  { label: 'About', href: '/#about' },
  { label: 'Stars', href: '/stars' },
  { label: 'Fly', href: '/fly' },
  { label: 'Contact', href: '/contact' },
];

export const skillGroups = [
  { category: 'Languages', items: ['Java', 'Python', 'C++', 'TypeScript / JavaScript'] },
  { category: 'Web & Frameworks', items: ['Next.js', 'React', 'Node.js / Express', 'Chakra UI', 'OutSystems'] },
  { category: 'Industrial & Automation', items: ['Siemens PLC (TIA Portal)', 'Profinet', 'SCADA Ignition'] },
  { category: '3D & Visualization', items: ['Three.js', '3D modelling', 'Prototyping', '3D printing'] },
  { category: 'AI & Data', items: ['Data analysis', 'AI-driven problem solving', 'Process optimization'] },
  { category: 'Ways of working', items: ['Git', 'Problem solving', 'Teamwork', 'Adaptability', 'Time management'] },
] as const;

export const experience = [
  {
    company: 'Synapse Digital',
    position: 'Software Developer, FullStack Solutions',
    period: 'Jan 2025 – present',
    achievements: [
      'Build and ship full-stack web applications end to end',
      'Turn designs into responsive, accessible interfaces',
      'Integrate third-party APIs and payment/mapping services',
      'Profile and optimise application performance',
    ],
    tech: ['Next.js', 'React', 'Node.js', 'TypeScript'],
  },
  {
    company: 'The Luke Commission, Sidvokodvo, eSwatini',
    position: 'Systems Engineer',
    period: 'May 2023 – Sep 2025',
    achievements: [
      'Designed an Oxygen Plant dashboard (SCADA Ignition) that improved product-gas quality monitoring',
      'Programmed Siemens PLCs in TIA Portal and integrated Profinet slaves',
      'Built OutSystems applications for organisational processes',
      'Created custom 3D-printed solutions for hospital IT settings',
    ],
    tech: ['SCADA Ignition', 'TIA Portal', 'OutSystems', '3D printing'],
  },
] as const;

export const interests = [
  'Emerging technologies (AI, 3D printing)',
  'Open-source software',
  'Healthcare innovation',
  '3D visualization and prototyping',
] as const;
