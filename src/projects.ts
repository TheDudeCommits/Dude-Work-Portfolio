export interface Project {
  about: readonly [string, string]
  deliverables: readonly string[]
  discipline: string
  href: string
  image: string
  partner: string
  slug: string
  statement: string
  title: string
}

export const projects: readonly Project[] = [
  {
    slug: 'idea-farm',
    title: 'Idea Farm',
    partner: 'Major Ginger',
    discipline: 'AI & Ideation',
    image: '/projects/idea-farm1.webp',
    href: 'https://ideafarm.majorginger.com/',
    statement: 'A living workshop that turns loose sparks into ideas worth growing.',
    about: [
      'Idea Farm treats creative thinking as something tactile: gather a seed, challenge it, cross-pollinate it and watch it become a useful concept. The product gives the earliest, messiest part of invention a calm and legible home.',
      'The experience balances playful discovery with enough structure to keep momentum. Generative assistance stays in service of the person at the center, helping expand the field without deciding what deserves to survive.',
    ],
    deliverables: ['Product strategy', 'AI interaction', 'Experience design', 'Creative direction'],
  },
  {
    slug: 'between-the-lines',
    title: 'Between The Lines',
    partner: 'Major Ginger',
    discipline: 'Story & Interaction',
    image: '/projects/between-the-lines.webp',
    href: 'https://inbetween.majorginger.com/',
    statement: 'A social reading experiment where subtext becomes the interface.',
    about: [
      'Between The Lines builds a space for what writing implies rather than only what it says. Readers move through fragments, interpretations and quiet contradictions, making meaning through attention instead of speed.',
      'The interface uses pacing, layered typography and responsive transitions to turn reading into a shared act of discovery. Every interaction protects ambiguity while still making the experience easy to enter.',
    ],
    deliverables: ['Narrative system', 'Interaction design', 'Motion', 'Web experience'],
  },
  {
    slug: 'vpay',
    title: 'vPay',
    partner: 'vPay Global',
    discipline: 'Fintech & Payments',
    image: '/projects/vpay1.webp',
    href: 'https://app.vpay.fund/',
    statement: 'Borderless payments made immediate, legible and human.',
    about: [
      'vPay brings movement of value into one focused financial experience. Complex rails, balances and transaction states are translated into a clear flow that lets people understand what is happening before they commit.',
      'The product language is built around trust: exact state, calm hierarchy and visible confirmation at every consequential step. Speed is felt in the interaction without ever hiding the underlying accounting.',
    ],
    deliverables: ['Product design', 'Financial UX', 'Design system', 'Frontend'],
  },
  {
    slug: 'omni',
    title: 'OMNI',
    partner: 'OMNI',
    discipline: 'Finance & Platform',
    image: '/projects/omni1.webp',
    href: 'https://omni.ltd/',
    statement: 'A focused digital headquarters for an interconnected financial world.',
    about: [
      'OMNI gathers a broad financial ecosystem into one coherent point of view. The experience gives each product room to speak while keeping the larger system visible, so navigation feels intentional rather than encyclopedic.',
      'A disciplined visual hierarchy, measured motion and strong editorial rhythm carry visitors from proposition to proof. The result feels expansive without becoming noisy.',
    ],
    deliverables: ['Information architecture', 'Brand expression', 'Product narrative', 'Motion'],
  },
  {
    slug: 'relay',
    title: 'Relay',
    partner: 'Relay Credit',
    discipline: 'Credit & Infrastructure',
    image: '/projects/relay.webp',
    href: 'https://relay.credit/',
    statement: 'Credit infrastructure shaped around speed, trust and visible movement.',
    about: [
      'Relay makes a dense credit proposition understandable at first contact. The product story moves from mechanism to value with a steady cadence, turning infrastructure into something people can picture and evaluate.',
      'The system uses concise copy, precise diagrams and restrained animation to signal momentum. Every transition reinforces continuity: capital moving, states changing and participants staying informed.',
    ],
    deliverables: ['Product positioning', 'UX architecture', 'Visual system', 'Development'],
  },
  {
    slug: 'wish-galaxy',
    title: 'Wish Galaxy',
    partner: 'Major Ginger',
    discipline: 'Community & Play',
    image: '/projects/wish-galaxy.webp',
    href: 'https://wishgalaxy.majorginger.com/',
    statement: 'A playful universe where small wishes gather into shared constellations.',
    about: [
      'Wish Galaxy turns a private impulse into a gentle communal ritual. Each wish becomes part of an explorable field, giving people the pleasure of leaving a trace without forcing performance or competition.',
      'Spatial motion, sound-ready pacing and a deliberately simple contribution flow make the world feel alive. The technology recedes so the emotional gesture can remain the focus.',
    ],
    deliverables: ['Creative concept', 'Generative world', 'Interaction', 'Art direction'],
  },
  {
    slug: 'cloak',
    title: 'Cloak',
    partner: 'Cloak Credit',
    discipline: 'Private Credit',
    image: '/projects/Cloak.webp',
    href: 'https://cloak.credit/',
    statement: 'Institutional-grade private credit presented with unusual calm.',
    about: [
      'Cloak frames a serious financial product without leaning on the familiar visual noise of fintech. Clear hierarchy and deliberate restraint make the offer feel considered, direct and credible.',
      'The experience separates explanation, evidence and action so visitors can build confidence progressively. Movement is scarce and purposeful, marking transitions instead of decorating them.',
    ],
    deliverables: ['Brand direction', 'Financial UX', 'Content system', 'Web design'],
  },
  {
    slug: 'vstats',
    title: 'vStats',
    partner: 'vPay Global',
    discipline: 'Analytics & Data',
    image: '/projects/vstats1.webp',
    href: 'https://stats.vpay.fund/',
    statement: 'A live analytics cockpit that turns payment activity into decisive signals.',
    about: [
      'vStats organizes live operational data around the questions that matter now. Exact values remain primary while trends, comparisons and distribution views provide context without competing for attention.',
      'Dense information is paced through clear typography and responsive visualization. The system is designed to feel quick under pressure while preserving the provenance and meaning of every metric.',
    ],
    deliverables: ['Data product', 'Dashboard UX', 'Visualization', 'Frontend'],
  },
  {
    slug: 'pod-racing',
    title: 'Pod Racing',
    partner: 'Dude.Work',
    discipline: 'Games & WebGL',
    image: '/projects/pod-racing1.webp',
    href: 'https://now-this-is-podracing.vercel.app/',
    statement: 'A cinematic browser race built from speed, choice and spectacle.',
    about: [
      'Pod Racing compresses the sensation of a much larger game into an immediate browser encounter. Camera, sound, track rhythm and feedback work together to make every near miss readable and every burst of speed physical.',
      'The experience is built as a responsive real-time system rather than a prerecorded illusion. Performance budgets and visual ambition are treated as the same design problem.',
    ],
    deliverables: ['Game direction', '3D runtime', 'Interaction', 'Sound design'],
  },
  {
    slug: 'we-are-on-the-cruise',
    title: 'We Are On The Cruise',
    partner: 'Dude.Work',
    discipline: 'Travel & Experience',
    image: '/projects/we-are-on-the-cruise1.webp',
    href: 'https://we-are-on-the-cruise.vercel.app/',
    statement: 'A sun-soaked interactive voyage built around discovery and anticipation.',
    about: [
      'We Are On The Cruise turns an itinerary into a world you can feel before departure. Places, moments and practical details unfold through an editorial journey that keeps the excitement of travel intact.',
      'Layered movement and generous photography create momentum while the underlying structure stays straightforward. The result behaves like a useful guide and feels like the beginning of the trip.',
    ],
    deliverables: ['Experience concept', 'Editorial design', 'Motion', 'Development'],
  },
] as const

export function projectPath(project: Project) {
  return `/work/${project.slug}`
}
