import React, {useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {api} from '../api.js';

function Brand({light = false}) {
  return <Link className={`site-brand${light ? ' site-brand-light' : ''}`} to="/" aria-label="Domain Hub home">
    <span className="site-brand-icon">D<span /></span>
    <span>domain hub</span>
  </Link>;
}

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
    <path d="M4.25 10h11.5m-4.5-4.5 4.5 4.5-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

function FeatureIcon({type}) {
  const paths = {
    search: <><circle cx="10.8" cy="10.8" r="5.8" /><path d="m15.2 15.2 3.3 3.3M3 5.2h4M3 9h2" /></>,
    dns: <><circle cx="10" cy="10" r="7" /><path d="M3.5 10h13M10 3c1.8 1.9 2.7 4.2 2.7 7S11.8 15.1 10 17m0-14c-1.8 1.9-2.7 4.2-2.7 7s.9 5.1 2.7 7" /></>,
    transfer: <><path d="M4 7h12m-3-3 3 3-3 3M16 13H4m3-3-3 3 3 3" /></>,
    auction: <><path d="m8 4 8 8m-5-11 5 5m-9 5 5 5m-9-9 5 5m-1 5 7-7m-9 9 2-2" /><path d="m13 13 3 3" /></>
  };
  return <span className="feature-icon">
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">{paths[type]}</svg>
  </span>;
}

function WorkspacePreview() {
  return <div className="workspace-preview" aria-label="Illustrative sample domain dashboard">
    <div className="preview-topbar">
      <div className="preview-window-dots"><i /><i /><i /></div>
      <span>WORKSPACE PREVIEW</span>
      <span className="preview-menu">•••</span>
    </div>
    <div className="preview-body">
      <div className="preview-rail">
        <div className="preview-rail-mark">D</div>
        <span className="rail-active">⌂</span><span>◇</span><span>⌘</span><span>↗</span>
        <span className="preview-rail-avatar">M</span>
      </div>
      <div className="preview-content">
        <div className="preview-heading">
          <div><span className="preview-kicker">MONDAY, 9:41 AM</span><h2>Your domains</h2></div>
          <span className="preview-add">+</span>
        </div>
        <div className="preview-summary">
          <div><span>In your workspace</span><strong>04 <small>domains</small></strong></div>
          <div className="preview-summary-mark">↗</div>
        </div>
        <div className="preview-domain-head"><span>DOMAIN</span><span>STATUS</span><span>RENEWS</span></div>
        <div className="preview-domain-row">
          <span className="preview-domain-icon">↗</span>
          <span className="preview-domain-name">fieldnotes.studio<small>DNS managed</small></span>
          <span className="preview-status"><i /> Active</span>
          <span className="preview-renewal">Oct 24</span>
        </div>
        <div className="preview-domain-row preview-domain-row-muted">
          <span className="preview-domain-icon">⌘</span>
          <span className="preview-domain-name">madebyday.co<small>DNS managed</small></span>
          <span className="preview-status"><i /> Active</span>
          <span className="preview-renewal">Nov 08</span>
        </div>
        <div className="preview-footer"><span><i /> All systems in one place</span><span>View workspace ↗</span></div>
      </div>
    </div>
    <div className="preview-caption"><span className="caption-dot" /> Illustrative interface · sample data</div>
    <div className="orbit-note"><span className="orbit-note-icon">↗</span><span>One home for<br /><strong>every domain.</strong></span></div>
  </div>;
}

const features = [
  {type: 'search', title: 'Find the right name', text: 'Check this workspace’s records and see pricing for its configured extensions.'},
  {type: 'dns', title: 'Keep DNS close', text: 'View and manage A, AAAA, CNAME, MX, TXT and NS records in one place.'},
  {type: 'transfer', title: 'Make handoffs clear', text: 'Send a transfer to another member and track acceptance in the workspace.'},
  {type: 'auction', title: 'List and follow auctions', text: 'Create a listing, follow bids and see the outcome alongside your domains.'}
];

export function Landing() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  async function searchDomains(event) {
    event.preventDefault();
    setError('');
    setResults([]);
    setSearching(true);
    try {
      setResults(await api.get('/search', {params: {domain}}));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSearching(false);
    }
  }

  function continueWithDomain(name, extension) {
    navigate('/register', {state: {domain: `${name}${extension}`}});
  }

  return <main className="landing">
    <header className="site-header">
      <Brand />
      <nav className="site-nav" aria-label="Main navigation">
        <a href="#platform">Platform</a>
        <a href="#how-it-works">How it works</a>
        <a href="#about">About</a>
      </nav>
      <div className="site-header-actions">
        <Link className="site-signin" to="/login">Sign in</Link>
        <Link className="button button-dark header-cta" to="/register">Create account <ArrowIcon /></Link>
      </div>
    </header>

    <section className="hero">
      <div className="hero-copy">
        <div className="hero-note"><span /> DOMAIN MANAGEMENT, MADE CLEAR</div>
        <h1>Your domains.<br /><span>One home.</span></h1>
        <p className="hero-description">Search names, keep DNS details close, and manage the domain work that happens after you find the right one.</p>
        <form className="domain-search" onSubmit={searchDomains}>
          <label className="visually-hidden" htmlFor="landing-domain">Search a domain name</label>
          <span className="search-icon"><FeatureIcon type="search" /></span>
          <input id="landing-domain" value={domain} onChange={event => setDomain(event.target.value)} placeholder="Try a name like goodthings.com" required />
          <button type="submit" className="button button-blue" disabled={searching}>{searching ? 'Checking…' : 'Search domains'} <ArrowIcon /></button>
        </form>
        <p className="search-hint">Checks this workspace’s records—not external registrar inventory.</p>
        {error && <p className="landing-error" role="alert">{error}</p>}
        {results.length > 0 && <div className="search-results" aria-live="polite">
          <div className="search-results-heading">Search results</div>
          {results.map((result, index) => <div className="search-result" key={`${result.name}.${result.extension}.${index}`}>
            <span className="result-domain">{result.name}{result.extension}</span>
            <span className={result.available ? 'result-available' : 'result-unavailable'}>{result.available ? `No matching workspace record · $${result.registrationPrice}/year` : 'Already in this workspace'}</span>
            {result.available && <button type="button" className="result-action" onClick={() => continueWithDomain(result.name, result.extension)}>Continue <ArrowIcon /></button>}
          </div>)}
        </div>}
        <div className="hero-proof"><span className="proof-check">✓</span> Search first. Create an account when you’re ready.</div>
      </div>
      <WorkspacePreview />
      <span className="hero-index">01 / DOMAIN WORKSPACE</span>
    </section>

    <section className="platform-section" id="platform">
      <div className="section-intro">
        <span className="section-index">A DOMAIN IS MORE THAN A NAME</span>
        <h2>Everything around<br />the name, together.</h2>
        <p>From the first search to the next renewal, keep the details and decisions in one workspace.</p>
      </div>
      <div className="feature-list">
        {features.map((feature, index) => <article className="feature-row" key={feature.type}>
          <span className="feature-count">0{index + 1}</span>
          <FeatureIcon type={feature.type} />
          <div className="feature-copy"><h3>{feature.title}</h3><p>{feature.text}</p></div>
          <span className="feature-arrow"><ArrowIcon /></span>
        </article>)}
      </div>
    </section>

    <section className="process-section" id="how-it-works">
      <div className="process-heading">
        <span className="section-index">A SIMPLE PLACE TO START</span>
        <h2>From search to<br />a clearer workspace.</h2>
      </div>
      <div className="process-steps">
        <article><span className="step-marker">01</span><h3>Search a name</h3><p>See whether a name has a matching record in this workspace.</p></article>
        <article><span className="step-marker">02</span><h3>Make it yours here</h3><p>Create an account and record the domain in your Domain Hub workspace.</p></article>
        <article><span className="step-marker">03</span><h3>Manage what follows</h3><p>Keep its renewal, DNS details and ownership activity together over time.</p></article>
      </div>
    </section>

    <section className="closing-section" id="about">
      <div className="closing-mark"><span>D</span><i /></div>
      <div><span className="section-index">A BETTER VIEW OF YOUR DOMAIN WORK</span><h2>Bring your domain work<br />into focus.</h2></div>
      <Link className="button button-lime" to="/register">Create your account <ArrowIcon /></Link>
    </section>

    <footer className="site-footer">
      <Brand />
      <p>Domain Hub is a domain-management demo. Registrations and payments are recorded in the app; no external registrar, DNS provider or payment service is connected.</p>
      <span>© 2026 Domain Hub</span>
    </footer>
  </main>;
}
