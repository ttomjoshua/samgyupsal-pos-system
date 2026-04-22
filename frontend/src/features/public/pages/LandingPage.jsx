import { Link } from 'react-router-dom'
import PublicSiteFooter from '../components/PublicSiteFooter'
import PublicSiteHeader from '../components/PublicSiteHeader'
import '../styles/public.css'

function CheckoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4.5 8.5 12 4l7.5 4.5L12 13z" />
      <path d="M4.5 8.5V16L12 20l7.5-4V8.5" />
      <path d="M12 13v7" />
    </svg>
  )
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6.5 18.5h11" />
      <path d="M8.5 15V11" />
      <path d="M12 15V8" />
      <path d="M15.5 15v-5" />
      <path d="M5.5 4.5h13a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

function AccessIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
      <path d="M18 8a2.4 2.4 0 1 1 1.7 4.1" />
      <path d="M4.3 12.1A2.4 2.4 0 1 1 6 8" />
    </svg>
  )
}

const FEATURE_CARDS = [
  {
    title: 'Cashier-friendly checkout',
    description:
      'Speed up order processing with a clean POS flow, payment handling, discounts, receipts, and hold-order support.',
    Icon: CheckoutIcon,
  },
  {
    title: 'Branch-aware inventory control',
    description:
      'Track stock movement, low-stock exposure, expiry dates, and per-branch inventory without losing operational context.',
    Icon: InventoryIcon,
  },
  {
    title: 'Daily visibility for managers',
    description:
      'Review dashboard metrics, sales activity, best sellers, and inventory watchlists from one connected workspace.',
    Icon: ReportsIcon,
  },
  {
    title: 'Structured access management',
    description:
      'Separate administrator and employee responsibilities while keeping branch assignments and account status easy to manage.',
    Icon: AccessIcon,
  },
]

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Set up your workspace',
    description:
      'Create an administrator account, configure products and categories, and add the branches your team will operate.',
  },
  {
    step: '02',
    title: 'Run service and stock updates',
    description:
      'Cashiers process orders while inventory users track stock-in, adjustments, low-stock items, and expiry-sensitive products.',
  },
  {
    step: '03',
    title: 'Review performance every day',
    description:
      'Managers move from dashboard snapshot to inventory and reports without switching systems or reconciling separate spreadsheets.',
  },
]

const BENEFITS = [
  'One connected system for POS, products, inventory, reports, and employee access.',
  'Warm, readable UI designed for daily use on real cashier and back-office workflows.',
  'Branch-based data handling that keeps operational decisions grounded in the correct store scope.',
  'Cleaner monitoring of stock levels, expiry dates, sales activity, and account assignments.',
]

const HERO_METRICS = [
  {
    label: 'Live Modules',
    value: '6',
    note: 'Dashboard, Sales, Inventory, Reports, Products, Users',
  },
  {
    label: 'Branch Scope',
    value: 'Multi-Branch',
    note: 'Designed for branch selection, assignment, and monitoring',
  },
  {
    label: 'Operational Focus',
    value: 'Daily Ready',
    note: 'Made for fast service, stock accuracy, and management visibility',
  },
]

function LandingPage() {
  return (
    <div className="public-page">
      <div className="public-page-shell">
        <PublicSiteHeader />

        <main className="public-main">
          <section className="landing-hero">
            <div className="landing-hero-copy">
              <p className="eyebrow">Operations Command Center</p>
              <h1>
                Run checkout, inventory, and branch performance from one
                polished Samgyupsal POS workspace.
              </h1>
              <p className="landing-hero-description">
                Samgyupsal POS brings together cashier operations, stock
                monitoring, product management, reporting, and employee access
                so the team can move faster with fewer gaps between front-of-house
                and back-office work.
              </p>

              <div className="landing-hero-actions">
                <Link to="/signup" className="primary-button">
                  Get Started
                </Link>
                <Link to="/login" className="landing-secondary-button">
                  Log In
                </Link>
              </div>

              <div className="landing-hero-metrics" aria-label="Product highlights">
                {HERO_METRICS.map((metric) => (
                  <article key={metric.label} className="landing-hero-metric">
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                    <p>{metric.note}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="landing-hero-preview" id="preview">
              <div className="landing-preview-window">
                <div className="landing-preview-toolbar">
                  <div className="landing-preview-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span>Samgyupsal POS Workspace Preview</span>
                </div>

                <div className="landing-preview-body">
                  <div className="landing-preview-sidebar">
                    <div className="landing-preview-sidebar-brand">SP</div>
                    <div className="landing-preview-sidebar-links">
                      <span className="active">Dashboard</span>
                      <span>Sales</span>
                      <span>Inventory</span>
                      <span>Reports</span>
                    </div>
                  </div>

                  <div className="landing-preview-content">
                    <div className="landing-preview-top">
                      <article className="landing-preview-stat">
                        <span>Sales Today</span>
                        <strong>P42,860</strong>
                      </article>
                      <article className="landing-preview-stat">
                        <span>Low Stock Items</span>
                        <strong>11</strong>
                      </article>
                      <article className="landing-preview-stat">
                        <span>Active Branch</span>
                        <strong>Dollar</strong>
                      </article>
                    </div>

                    <div className="landing-preview-grid">
                      <section className="landing-preview-panel">
                        <div className="landing-preview-panel-header">
                          <strong>Restock Watchlist</strong>
                          <span>Inventory</span>
                        </div>

                        <div className="landing-preview-list">
                          <div>
                            <span>Samgyup Meat</span>
                            <strong>Low Stock</strong>
                          </div>
                          <div>
                            <span>Seaweed</span>
                            <strong>3 days left</strong>
                          </div>
                          <div>
                            <span>Korean Noodles</span>
                            <strong>12 packs</strong>
                          </div>
                        </div>
                      </section>

                      <section className="landing-preview-panel landing-preview-panel--receipt">
                        <div className="landing-preview-panel-header">
                          <strong>Checkout Snapshot</strong>
                          <span>POS</span>
                        </div>

                        <div className="landing-preview-receipt">
                          <div>
                            <span>Subtotal</span>
                            <strong>P1,560.00</strong>
                          </div>
                          <div>
                            <span>Discount</span>
                            <strong>P312.00</strong>
                          </div>
                          <div>
                            <span>Total</span>
                            <strong>P1,248.00</strong>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="landing-section" id="features">
            <div className="landing-section-heading">
              <p className="eyebrow">Feature Highlights</p>
              <h2>Built around the workflows this system already manages.</h2>
              <p>
                The landing experience reflects the real product: checkout,
                inventory monitoring, branch operations, reporting, and employee
                access control.
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
              <h2>Move from setup to daily service without losing operational clarity.</h2>
            </div>

            <div className="landing-workflow-grid">
              <div className="landing-workflow-list">
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

              <aside className="landing-why-card">
                <p className="card-label">Why Choose This System</p>
                <h3>Operational visibility without juggling separate tools.</h3>
                <div className="landing-benefit-list">
                  {BENEFITS.map((benefit) => (
                    <div key={benefit} className="landing-benefit-item">
                      <span aria-hidden="true" />
                      <p>{benefit}</p>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-section-heading">
              <p className="eyebrow">System Preview</p>
              <h2>Designed to feel dependable during busy service hours.</h2>
              <p>
                The interface direction stays close to the current dashboard:
                warm surfaces, readable spacing, strong hierarchy, and action
                controls that feel stable under repeated daily use.
              </p>
            </div>

            <div className="landing-preview-strip">
              <article className="landing-preview-strip-card">
                <span className="card-label">Branch Monitoring</span>
                <strong>Keep stock context tied to the correct branch.</strong>
                <p>
                  Inventory and reporting views stay grounded in the selected or
                  assigned branch, helping teams avoid cross-branch confusion.
                </p>
              </article>

              <article className="landing-preview-strip-card">
                <span className="card-label">Inventory Accuracy</span>
                <strong>Follow low-stock and expiry-sensitive items clearly.</strong>
                <p>
                  Managers can quickly spot inventory risk while employees stay
                  focused on the stock actions available to their role.
                </p>
              </article>

              <article className="landing-preview-strip-card">
                <span className="card-label">Access Control</span>
                <strong>Separate admin oversight from employee execution.</strong>
                <p>
                  User roles, branch assignments, and status handling create a
                  cleaner boundary between oversight and day-to-day operations.
                </p>
              </article>
            </div>
          </section>

          <section className="landing-cta-banner">
            <div>
              <p className="eyebrow">Ready To Start</p>
              <h2>Open the system through a public entry point that matches the product.</h2>
              <p>
                Create an administrator account for demo mode or continue into
                the existing login flow for the current workspace.
              </p>
            </div>

            <div className="landing-cta-actions">
              <Link to="/signup" className="primary-button">
                Sign Up
              </Link>
              <Link to="/login" className="landing-secondary-button">
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
