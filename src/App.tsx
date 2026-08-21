import {
  createContext,
  type AnchorHTMLAttributes,
  type CSSProperties,
  type FormEvent,
  type PointerEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { projectPath, projects, type Project } from './projects'

type Navigate = (path: string) => void

const RouterContext = createContext<Navigate>(() => undefined)

function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((path: string) => {
    if (path === window.location.pathname) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    window.history.pushState({}, '', path)
    setPathname(path)
  }, [])

  return { navigate, pathname }
}

function RouteLink({ href = '/', onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const navigate = useContext(RouterContext)
  const isLocal = href.startsWith('/')

  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event)
        if (
          event.defaultPrevented
          || !isLocal
          || event.button !== 0
          || event.metaKey
          || event.ctrlKey
          || event.shiftKey
          || event.altKey
        ) return
        event.preventDefault()
        navigate(href)
      }}
    />
  )
}

function InkSeal({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className={`ink-seal${inverted ? ' ink-seal--inverted' : ''}`} aria-hidden="true">
      <span>DW</span>
    </span>
  )
}

function Header({ menuOpen, onMenuToggle }: { menuOpen: boolean; onMenuToggle: () => void }) {
  return (
    <header className="site-header">
      <RouteLink className="wordmark" href="/" aria-label="Dude.Work home">
        <span className="wordmark__main">dude.work</span>
        <span className="wordmark__echo" aria-hidden="true">living ink</span>
      </RouteLink>
      <button
        className="menu-toggle"
        type="button"
        aria-controls="site-menu"
        aria-expanded={menuOpen}
        onClick={onMenuToggle}
      >
        <span className="menu-toggle__brush" aria-hidden="true" />
        <span className="menu-toggle__label">{menuOpen ? 'close' : 'menu'}</span>
      </button>
    </header>
  )
}

function MenuOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    document.body.classList.add('menu-is-open')
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.classList.remove('menu-is-open')
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  const navItems = [
    ['00.', 'home', '/'],
    ['01.', 'about', '/about'],
    ['02.', 'contact', '/contact'],
    ['03.', 'works', projectPath(projects[0])],
  ] as const

  return (
    <aside id="site-menu" className={`menu-overlay${open ? ' is-open' : ''}`} aria-hidden={!open}>
      <Header menuOpen onMenuToggle={onClose} />
      <div className="menu-overlay__wash" aria-hidden="true" />
      <div className="menu-overlay__projects" aria-label="Selected work">
        {projects.map((project, index) => (
          <RouteLink
            href={projectPath(project)}
            key={project.slug}
            onClick={onClose}
            tabIndex={open ? 0 : -1}
            style={{ '--menu-row': index } as CSSProperties}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <span>{project.title}</span>
          </RouteLink>
        ))}
      </div>
      <nav className="menu-overlay__nav" aria-label="Primary navigation">
        {navItems.map(([number, label, href], index) => (
          <RouteLink
            href={href}
            key={label}
            onClick={onClose}
            tabIndex={open ? 0 : -1}
            style={{ '--menu-row': index } as CSSProperties}
          >
            <span>{number}</span>
            <span>{label}</span>
          </RouteLink>
        ))}
      </nav>
      <p className="menu-overlay__note">digital worlds · useful systems · one decisive mark</p>
    </aside>
  )
}

function HomePage({ menuOpen, onMenuToggle }: { menuOpen: boolean; onMenuToggle: () => void }) {
  const [activeProject, setActiveProject] = useState<number | null>(null)
  const [pointer, setPointer] = useState({ x: 50, y: 50 })

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    setPointer({
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    })
  }

  return (
    <main
      className={`home-page${activeProject !== null ? ' has-active-project' : ''}`}
      onPointerMove={handlePointerMove}
      style={{
        '--pointer-x': `${pointer.x}%`,
        '--pointer-y': `${pointer.y}%`,
        '--parallax-x': `${(pointer.x - 50) * -0.08}px`,
        '--parallax-y': `${(pointer.y - 50) * -0.06}px`,
      } as CSSProperties}
    >
      <div className="home-page__field" aria-hidden="true" />
      <div className="home-previews" aria-hidden="true">
        {projects.map((project, index) => (
          <figure className={`home-preview${activeProject === index ? ' is-active' : ''}`} key={project.slug}>
            <img src={project.image} alt="" draggable="false" />
            <span className="home-preview__grain" />
          </figure>
        ))}
      </div>
      <Header menuOpen={menuOpen} onMenuToggle={onMenuToggle} />

      <section className="desktop-index" aria-label="Selected work">
        <div className="desktop-index__head" aria-hidden="true">
          <span>work</span>
          <span>with</span>
          <span>field</span>
        </div>
        <ol>
          {projects.map((project, index) => (
            <li key={project.slug} style={{ '--row': index } as CSSProperties}>
              <RouteLink
                href={projectPath(project)}
                onMouseEnter={() => setActiveProject(index)}
                onMouseLeave={() => setActiveProject(null)}
                onFocus={() => setActiveProject(index)}
                onBlur={() => setActiveProject(null)}
                aria-label={`${project.title}, ${project.partner}, ${project.discipline}`}
              >
                <span>{project.title}</span>
                <span>{project.partner}</span>
                <span>{project.discipline}</span>
              </RouteLink>
            </li>
          ))}
        </ol>
      </section>

      <section className="mobile-index" aria-label="Selected work">
        {projects.map((project, index) => (
          <RouteLink
            className="mobile-project"
            href={projectPath(project)}
            key={project.slug}
            style={{ '--row': index } as CSSProperties}
          >
            <span className="mobile-project__title">{project.title}</span>
            <span className="mobile-project__image">
              <img src={project.image} alt={`${project.title} project preview`} loading={index > 3 ? 'lazy' : 'eager'} />
            </span>
            <span className="mobile-project__discipline">{project.discipline}</span>
          </RouteLink>
        ))}
      </section>
      <div className="home-page__footer" aria-hidden="true">
        <span>Berlin · 2026</span>
        <InkSeal />
      </div>
    </main>
  )
}

function useScrollShift() {
  const [shift, setShift] = useState(0)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    const onScroll = () => {
      if (frame.current !== null) return
      frame.current = window.requestAnimationFrame(() => {
        setShift(Math.min(window.scrollY * 0.075, 72))
        frame.current = null
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame.current !== null) window.cancelAnimationFrame(frame.current)
    }
  }, [])

  return shift
}

function ProjectPage({ menuOpen, onMenuToggle, project }: {
  menuOpen: boolean
  onMenuToggle: () => void
  project: Project
}) {
  const shift = useScrollShift()
  const index = projects.findIndex((item) => item.slug === project.slug)
  const next = projects[(index + 1) % projects.length]

  return (
    <main className="project-page">
      <div className="project-page__atmosphere" aria-hidden="true" />
      <Header menuOpen={menuOpen} onMenuToggle={onMenuToggle} />
      <article>
        <header className="project-intro">
          <div className="project-intro__meta">
            <span>{project.partner}</span>
            <span>{project.discipline}</span>
          </div>
          <h1>{project.title}</h1>
        </header>

        <figure className="project-hero">
          <img
            src={project.image}
            alt={`${project.title} interface`}
            style={{ transform: `translate3d(0, ${shift}px, 0) scale(1.055)` }}
          />
          <span className="project-hero__edge" aria-hidden="true" />
        </figure>

        <section className="project-statement">
          <h2>{project.statement}</h2>
          <p><span aria-hidden="true" />{project.title}</p>
        </section>

        <section className="project-about">
          <p className="section-label"><span aria-hidden="true" />about</p>
          <div className="project-about__copy">
            <p>{project.about[0]}</p>
            <p>{project.about[1]}</p>
          </div>
        </section>

        <section className="project-deliverables">
          <p className="section-label"><span aria-hidden="true" />deliverables</p>
          <ol>
            {project.deliverables.map((deliverable, itemIndex) => (
              <li key={deliverable}>
                <span>{String(itemIndex + 1).padStart(2, '0')}</span>
                <span>{deliverable}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="project-gallery" aria-label={`${project.title} detail views`}>
          {['left', 'center', 'right'].map((position) => (
            <figure key={position} data-position={position}>
              <img src={project.image} alt="" loading="lazy" />
            </figure>
          ))}
        </section>

        <div className="project-actions">
          <a className="launch-link" href={project.href} target="_blank" rel="noreferrer">
            <span>visit live project</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>

        <RouteLink className="next-project" href={projectPath(next)}>
          <span><i aria-hidden="true" />next</span>
          <strong>{next.title}</strong>
        </RouteLink>
      </article>
      <Footer />
    </main>
  )
}

function AboutPage({ menuOpen, onMenuToggle }: { menuOpen: boolean; onMenuToggle: () => void }) {
  return (
    <main className="editorial-page about-page">
      <Header menuOpen={menuOpen} onMenuToggle={onMenuToggle} />
      <section className="about-intro">
        <p>I build digital products as living systems: useful enough to depend on, strange enough to remember. The work moves between financial tools, operational AI, interactive worlds and playful experiments.</p>
        <p>Dude.Work is the thread connecting them. Each project begins with the real behavior and ends with a singular visual language—technology, motion, sound and story working as one experience.</p>
      </section>

      <section className="about-gallery" aria-label="Selected project atlas">
        {projects.map((project, index) => (
          <RouteLink href={projectPath(project)} key={project.slug} style={{ '--row': index } as CSSProperties}>
            <img src={project.image} alt={`${project.title} project`} loading={index > 3 ? 'lazy' : 'eager'} />
            <span>{String(index + 1).padStart(2, '0')} · {project.title}</span>
          </RouteLink>
        ))}
      </section>

      <section className="about-ledger">
        <div>
          <p>[ practice ]</p>
          <ul>
            <li>Creative technologist, Dude.Work {`{ now }`}</li>
            <li>Product systems &amp; operational AI</li>
            <li>Interactive worlds &amp; browser games</li>
            <li>Finance, data &amp; decision interfaces</li>
            <li>Original art, motion &amp; sound</li>
          </ul>
        </div>
        <div>
          <p>[ principles ]</p>
          <ul>
            <li>Truth before theatre</li>
            <li>One decisive mark</li>
            <li>State is the source of truth</li>
            <li>Motion with consequence</li>
            <li>Ship the whole story</li>
          </ul>
        </div>
        <div>
          <p>[ services ]</p>
          <ul>
            <li>Creative direction</li>
            <li>Product design</li>
            <li>AI systems</li>
            <li>3D &amp; interactive</li>
            <li>Full-stack delivery</li>
          </ul>
        </div>
      </section>
      <Footer />
    </main>
  )
}

function ContactPage({ menuOpen, onMenuToggle }: { menuOpen: boolean; onMenuToggle: () => void }) {
  const [status, setStatus] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name') ?? '')
    const email = String(data.get('email') ?? '')
    const message = String(data.get('message') ?? '')
    const subject = encodeURIComponent(`Dude.Work project enquiry from ${name}`)
    const body = encodeURIComponent(`${message}\n\nFrom: ${name}\nEmail: ${email}`)
    setStatus('Email draft prepared in your mail app.')
    window.location.href = `mailto:hello@dude.work?subject=${subject}&body=${body}`
  }

  return (
    <main className="editorial-page contact-page">
      <Header menuOpen={menuOpen} onMenuToggle={onMenuToggle} />
      <section className="contact-intro">
        <h1>Bring the difficult idea.<br />We’ll find its one clear form.</h1>
      </section>
      <section className="contact-layout">
        <form onSubmit={handleSubmit}>
          <label>
            <span>name</span>
            <input name="name" type="text" autoComplete="name" placeholder="Your name" required />
          </label>
          <label>
            <span>email</span>
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          </label>
          <label>
            <span>your message</span>
            <textarea name="message" placeholder="Tell me what you want to make…" required />
          </label>
          <button type="submit"><span>prepare email</span><span aria-hidden="true">↗</span></button>
          <p className="contact-status" aria-live="polite">{status || 'This prepares a message in your email app.'}</p>
        </form>
        <aside>
          <p>Connect</p>
          <a href="https://github.com/TheDudeCommits" target="_blank" rel="noreferrer">GitHub ↗</a>
          <a href="mailto:hello@dude.work">Email ↗</a>
          <RouteLink href="/about">About the practice →</RouteLink>
        </aside>
      </section>
      <section className="contact-closing">
        <InkSeal />
        <p>Have an idea that does not fit neatly into a category? Good. Those are usually the ones worth building.</p>
      </section>
      <Footer />
    </main>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <span>© 2026 Dude.Work</span>
      <span>made with paper, code &amp; living ink</span>
    </footer>
  )
}

function App() {
  const { navigate, pathname } = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const cleanPath = pathname !== '/' ? pathname.replace(/\/$/, '') : '/'

  const project = useMemo(
    () => projects.find((item) => projectPath(item) === cleanPath),
    [cleanPath],
  )

  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo(0, 0)
    const pageTitle = project?.title
      ?? (cleanPath === '/about' ? 'About' : cleanPath === '/contact' ? 'Contact' : 'Living Ink')
    document.title = `${pageTitle} — Dude.Work`
  }, [cleanPath, project])

  const page = project ? (
    <ProjectPage project={project} menuOpen={menuOpen} onMenuToggle={() => setMenuOpen((value) => !value)} />
  ) : cleanPath === '/about' ? (
    <AboutPage menuOpen={menuOpen} onMenuToggle={() => setMenuOpen((value) => !value)} />
  ) : cleanPath === '/contact' ? (
    <ContactPage menuOpen={menuOpen} onMenuToggle={() => setMenuOpen((value) => !value)} />
  ) : (
    <HomePage menuOpen={menuOpen} onMenuToggle={() => setMenuOpen((value) => !value)} />
  )

  return (
    <RouterContext.Provider value={navigate}>
      <div className="route-stage" key={cleanPath} aria-hidden={menuOpen || undefined}>{page}</div>
      <MenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </RouterContext.Provider>
  )
}

export default App
