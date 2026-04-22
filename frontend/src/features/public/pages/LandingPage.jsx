import { Link } from 'react-router-dom'
import OperationsPreview from '../components/OperationsPreview'
import PublicSiteFooter from '../components/PublicSiteFooter'
import PublicSiteHeader from '../components/PublicSiteHeader'
import '../styles/public.css'

function CheckoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v9A2.5 2.5 0 0 1 16.5 19h-9A2.5 2.5 0 0 1 5 16.5z" />
      <path d="M8 9h8" />
      <path d="M8 12h3" />
      <path d="M13 12h3" />
      <path d="M8 15h5" />
    </svg>
  )
}

function InventoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4.5 8.5 12 4l7.5 4.5L12 13z" />
      <path d="M4.5 8.5V16L12 20l7.5-4V8.5" />
      <path d="M12 13v7" />
    </svg>
  )
}

function ExpiryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2.5" />
    </svg>
  )
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M6.5 18.5h11" />
      <path d="M8.5 15V11" />
      <path d="M12 15V8" />
      <path d="M15.5 15v-5" />
      <path d="M5.5 4.5h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

function BranchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4.5 19.5h15" />
      <path d="M6 19.5V8.5l6-3 6 3v11" />
      <path d="M9 12h0" />
      <path d="M15 12h0" />
      <path d="M12 19.5v-4.5" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
      <path d="M18 8a2.4 2.4 0 1 1 1.7 4.1" />
      <path d="M4.3 12.1A2.4 2.4 0 1 1 6 8" />
    </svg>
  )
}

const HERO_TAGS = [
  'POS checkout',
  'Inventory control',
  'Expiry awareness',
  'Branch monitoring',
]

const HERO_STATS = [
  {
    label: 'Operational scope',
    value: 'Checkout to reporting',
  },
  {
    label: 'Branch-ready',
    value: 'Built for multi-branch use',
  },
  {
    label: 'Access control',
    value: 'Admin and employee roles',
  },
]

const VALUE_PILLARS = [
  {
    title: 'Faster service at the counter',
    description:
      'Support cashier flow with a cleaner checkout experience, payment handling, discounts, and receipt-ready totals.',
  },
  {
    title: 'Clearer stock decisions during the day',
    description:
      'Watch low-stock items, expiry-sensitive inventory, and per-branch quantities before service quality is affected.',
  },
  {
    title: 'One view for managers and branch leads',
    description:
      'Move from dashboard summary to inventory, reports, products, and users without stitching together separate tools.',
  },
]

const FEATURE_CARDS = [
  {
    title: 'Checkout operations',
    description:
      'Process orders, discounts, payment collection, and change calculations in a cashier-friendly flow.',
    Icon: CheckoutIcon,
  },
  {
    title: 'Inventory tracking',
    description:
      'Manage stock in, adjustments, product details, reorder exposure, and branch-level inventory records.',
    Icon: InventoryIcon,
  },
  {
    title: 'Expiry and risk awareness',
    description:
      'Surface products nearing expiry and highlight stock issues before they disrupt service or purchasing.',
    Icon: ExpiryIcon,
  },
  {
    title: 'Reporting and visibility',
    description:
      'Review sales totals, transactions, best sellers, and low-stock watchlists from the dashboard and reports.',
    Icon: ReportsIcon,
  },
  {
    title: 'Branch operations',
    description:
      'Keep monitoring grounded in the correct store with branch selection, assignment, and oversight built into the product.',
    Icon: BranchIcon,
  },
  {
    title: 'Role-based access',
    description:
      'Separate admin and employee responsibilities while keeping user status, access, and branch scope clear.',
    Icon: UsersIcon,
  },
]

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Create the workspace',
    description:
      'Start with the admin account, then configure branches, products, categories, and staff access.',
  },
  {
    step: '02',
    title: 'Run daily operations',
    description:
      'Cashiers handle checkout while employees and managers update stock, track expiry, and review branch status.',
  },
  {
    step: '03',
    title: 'Monitor what needs action',
    description:
      'Use dashboard and report visibility to catch stock issues, review sales, and keep each branch aligned.',
  },
]

const SHOWCASE_MODULES = [
  {
    eyebrow: 'Daily Operations Board',
    title: 'See the state of service and stock in one dashboard rhythm.',
    bullets: [
      'Sales totals, transaction counts, and item movement stay close to stock visibility.',
      'Low-stock and expiry-sensitive items are surfaced beside day-to-day branch context.',
      'Managers move into inventory or reports without losing operational continuity.',
    ],
  },
  {
    eyebrow: 'Checkout and Inventory Loop',
    title: 'Keep the counter fast without losing control of inventory accuracy.',
    metrics: [
      { label: 'Discount handling', value: 'Senior and PWD ready' },
      { label: 'Payments', value: 'Cash flow built in' },
      { label: 'Stock actions', value: 'Stock in and adjust stock' },
    ],
  },
  {
    eyebrow: 'Branch and Access Oversight',
    title: 'Separate admin visibility from employee execution cleanly.',
    bullets: [
      'Admins manage products, reports, branches, and users.',
      'Employees stay focused on the branch and actions relevant to daily operations.',
      'Branch assignments keep monitoring and updates tied to the right location.',
    ],
  },
]

function LandingPage() {
  return (
    <div className="public-page">
      <div className="public-page-shell">
        <PublicSiteHeader />

        <main className="public-main">
          <section className="landing-hero" id="product">
            <div className="landing-hero-copy">
              <p className="eyebrow">Samgyupsal Operations Platform</p>
              <h1>Checkout faster. Track stock earlier. Keep every branch aligned.</h1>
              <p className="landing-hero-description">
                Samgyupsal POS connects cashier flow, inventory control, expiry
                monitoring, reporting, and branch operations in one modern
                workspace built for real Korean food service teams.
              </p>

              <div className="landing-hero-actions">
                <Link to="/signup" className="public-primary-button">
                  Create Account
                </Link>
                <Link to="/login" className="public-secondary-button">
                  Log In
                </Link>
              </div>

              <div className="landing-hero-tags" aria-label="Product areas">
                {HERO_TAGS.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>

              <div className="landing-hero-stats">
                {HERO_STATS.map((item) => (
                  <article key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>
            </div>

            <OperationsPreview />
          </section>

          <section className="landing-value-band">
            {VALUE_PILLARS.map((pillar) => (
              <article key={pillar.title} className="landing-value-card">
                <strong>{pillar.title}</strong>
                <p>{pillar.description}</p>
              </article>
            ))}
          </section>

          <section className="landing-section" id="features">
            <div className="landing-section-heading">
              <p className="eyebrow">Feature Highlights</p>
              <h2>Designed around the work this system already performs.</h2>
              <p>
                This is not generic SaaS filler. The public experience now
                explains the actual product: POS checkout, stock movement,
                expiry awareness, branch monitoring, reports, and user access.
              </p>
            </div>

            <div className="landing-feature-grid">
              {FEATURE_CARDS.map(({ title, description, Icon }) => (
                <article key={title} className="landing-feature-card">
                  <div className="landing-feature-icon" aria-hidden="true">
                    <Icon />
                  </div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="landing-section landing-workflow-section" id="workflow">
            <div className="landing-section-heading">
              <p className="eyebrow">How It Works</p>
              <h2>Set up once, then run daily service with better visibility.</h2>
            </div>

            <div className="landing-workflow-grid">
              {WORKFLOW_STEPS.map((item) => (
                <article key={item.step} className="landing-workflow-step">
                  <span>{item.step}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="landing-section" id="preview">
            <div className="landing-section-heading">
              <p className="eyebrow">Product Preview</p>
              <h2>More credible than a placeholder dashboard block.</h2>
              <p>
                The preview direction now mirrors a practical operations system:
                stable panels, compact metrics, clear alerts, and believable
                module boundaries for service, stock, and oversight.
              </p>
            </div>

            <div className="landing-showcase-grid">
              <article className="landing-showcase-card landing-showcase-card--wide">
                <span className="card-label">{SHOWCASE_MODULES[0].eyebrow}</span>
                <strong>{SHOWCASE_MODULES[0].title}</strong>
                <div className="landing-showcase-list">
                  {SHOWCASE_MODULES[0].bullets.map((bullet) => (
                    <div key={bullet}>
                      <span aria-hidden="true" />
                      <p>{bullet}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="landing-showcase-card">
                <span className="card-label">{SHOWCASE_MODULES[1].eyebrow}</span>
                <strong>{SHOWCASE_MODULES[1].title}</strong>
                <div className="landing-showcase-metrics">
                  {SHOWCASE_MODULES[1].metrics.map((metric) => (
                    <div key={metric.label}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>
              </article>

              <article className="landing-showcase-card">
                <span className="card-label">{SHOWCASE_MODULES[2].eyebrow}</span>
                <strong>{SHOWCASE_MODULES[2].title}</strong>
                <div className="landing-showcase-list">
                  {SHOWCASE_MODULES[2].bullets.map((bullet) => (
                    <div key={bullet}>
                      <span aria-hidden="true" />
                      <p>{bullet}</p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>

          <section className="landing-cta-banner">
            <div>
              <p className="eyebrow">Ready To Start</p>
              <h2>Open the system from a public entry point that finally feels product-ready.</h2>
              <p>
                Create the administrator account, or return to login if your
                branch team already has access.
              </p>
            </div>

            <div className="landing-cta-actions">
              <Link to="/signup" className="public-primary-button">
                Sign Up
              </Link>
              <Link to="/login" className="public-secondary-button">
                Log In
              </Link>
            </div>
          </section>
        </main>

        <PublicSiteFooter />
      </div>
    </div>
  )
}

export default LandingPage
