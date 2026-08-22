export interface Project {
  href: string
  image: string
  slug: string
  title: string
}

export const projects: readonly Project[] = [
  { slug: 'omni', title: 'Omni', image: '/projects/portals/omni1.webp', href: 'https://omni.ltd/' },
  { slug: 'vpay', title: 'vPay', image: '/projects/portals/vpay1.webp', href: 'https://app.vpay.fund/' },
  { slug: 'cloak', title: 'Cloak', image: '/projects/portals/Cloak.webp', href: 'https://cloak.credit/' },
  { slug: 'relay', title: 'Relay', image: '/projects/portals/relay.webp', href: 'https://relay.credit/' },
  {
    slug: 'wish-galaxy',
    title: 'WishGalaxy',
    image: '/projects/portals/wish-galaxy.webp',
    href: 'https://wishgalaxy.majorginger.com/',
  },
  {
    slug: 'idea-farm',
    title: 'IdeaFarm',
    image: '/projects/portals/idea-farm1.webp',
    href: 'https://ideafarm.majorginger.com/',
  },
  {
    slug: 'between-the-lines',
    title: 'BetweenTheLines',
    image: '/projects/portals/between-the-lines.webp',
    href: 'https://inbetween.majorginger.com/',
  },
  {
    slug: 'pod-racing',
    title: 'PodRacing',
    image: '/projects/portals/pod-racing1.webp',
    href: 'https://now-this-is-podracing.vercel.app/',
  },
  {
    slug: 'we-are-on-the-cruise',
    title: 'WeAreOnTheCruise',
    image: '/projects/portals/we-are-on-the-cruise1.webp',
    href: 'https://we-are-on-the-cruise.vercel.app/',
  },
] as const
