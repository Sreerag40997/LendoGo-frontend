import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../../components/Navbar/Navbar';
import Footer from '../../../components/Footer/Footer';
import ScrollReveal from '../../../components/ScrollReveal/ScrollReveal';
import ParallaxShapes from '../../../components/ParallaxShapes/ParallaxShapes';
import { JOBS } from './jobsData';
import './JobListingsPage.css';

/* ── tiny icon helpers ── */
const IconLocation = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);
const IconBag = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
  </svg>
);
const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const IconMoney = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
const IconChevron = ({ open }) => (
  <svg
    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: 'transform 0.3s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const deptColor = {
  Product: '#7c3aed',
  Operations: '#ea580c',
  'Credit & Risk': '#0891b2',
  Engineering: '#0066FF',
  Data: '#059669',
  Design: '#db2777',
};

const JobCard = ({ job }) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const color = deptColor[job.dept] || '#0066FF';

  return (
    <article className="jl-card">
      {/* ── header row ── */}
      <div className="jl-card-header">
        <div className="jl-card-logo" style={{ background: `${color}18`, color }}>
          {job.dept.slice(0, 2).toUpperCase()}
        </div>
        <div className="jl-card-meta">
          <h2 className="jl-job-title">{job.title}</h2>
          <div className="jl-meta-row">
            <span className="jl-dept-tag" style={{ color, background: `${color}14` }}>{job.dept}</span>
            <span className="jl-dot" />
            <span className="jl-posted">LendoGO · Posted recently</span>
          </div>
        </div>
        <div className="jl-card-actions">
          <button
            className="jl-btn-apply"
            onClick={() => navigate(`/careers/apply/${job.id}`)}
          >
            Apply Now
          </button>
        </div>
      </div>

      {/* ── details row ── */}
      <div className="jl-details-row">
        <span className="jl-detail"><IconLocation /> {job.location}</span>
        <span className="jl-detail"><IconClock /> {job.experience}</span>
        <span className={`jl-work-badge jl-work-badge--${job.workMode?.toLowerCase()}`}>{job.workMode}</span>
        <span className="jl-detail"><IconBag /> {job.type}</span>
      </div>

      {/* ── skills ── */}
      <div className="jl-skills-row">
        {job.skills.map((s) => (
          <span key={s} className="jl-skill-tag">{s}</span>
        ))}
      </div>

      {/* ── short description ── */}
      <p className="jl-short-desc">{job.shortDesc}</p>

      {/* ── expandable JD ── */}
      {expanded && (
        <div className="jl-jd-block">
          {job.jd.split('\n').map((line, i) => {
            if (!line.trim()) return <br key={i} />;
            if (/^[A-Z]/.test(line) && !line.startsWith('•')) {
              return <h4 className="jl-jd-heading" key={i}>{line}</h4>;
            }
            if (line.startsWith('•')) {
              return <p className="jl-jd-bullet" key={i}>{line}</p>;
            }
            return <p className="jl-jd-text" key={i}>{line}</p>;
          })}
        </div>
      )}

      {/* ── read more toggle ── */}
      <div className="jl-card-footer">
        <button className="jl-btn-read-more" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show less' : 'Read more'}
          <IconChevron open={expanded} />
        </button>
      </div>
    </article>
  );
};

const JobListingsPage = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  React.useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/careers/openings?status=Open`);
        const resData = await response.json();
        const data = resData?.data || resData || [];

        const safeParse = (field) => Array.isArray(field) ? field : (typeof field === 'string' ? JSON.parse(field || '[]') : []);

        const formattedJobs = data.map(job => {
          const about = job.about_role || '';
          const resps = safeParse(job.responsibilities).map(r => `• ${r}`).join('\n');
          const reqs = safeParse(job.requirements).map(r => `• ${r}`).join('\n');
          const bens = safeParse(job.benefits).map(b => `• ${b}`).join('\n');
          
          let fullJD = about;
          if (resps.trim()) fullJD += `\n\nResponsibilities\n${resps}`;
          if (reqs.trim()) fullJD += `\n\nRequirements\n${reqs}`;
          if (bens.trim()) fullJD += `\n\nPerks & Benefits\n${bens}`;

          return {
            id: job.id,
            dept: job.department || 'Product',
            title: job.title,
            location: job.location,
            experience: job.experience_range,
            workMode: job.work_mode,
            type: job.employment_type,
            skills: safeParse(job.skills),
            shortDesc: job.short_description,
            jd: fullJD
          };
        });

        setJobs(formattedJobs);
      } catch (error) {
        console.error("Failed to fetch jobs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  const depts = ['All', ...Array.from(new Set(jobs.map((j) => j.dept)))];
  const filtered = filter === 'All' ? jobs : jobs.filter((j) => j.dept === filter);

  return (
    <div className="jl-page-wrapper" style={{ position: 'relative', overflow: 'hidden' }}>
      <Navbar />

      {/* Dynamic ambient moving shapes background */}
      <ParallaxShapes preset="side-decor" />

      {/* ── page header ── */}
      <header className="jl-page-header" style={{ position: 'relative', zIndex: 2 }}>
        <ScrollReveal variant="fade-up">
          <div className="jl-header-inner">
            <span className="jl-header-eyebrow">LendoGO Careers</span>
            <h1 className="jl-header-title">Current Openings</h1>
            <p className="jl-header-sub">
              {loading ? "Loading open roles..." : `${jobs.length} open roles · Join us and help build India's most trusted digital lending platform`}
            </p>
          </div>
        </ScrollReveal>
      </header>

      {/* ── filter bar ── */}
      <div className="jl-filter-bar" style={{ position: 'relative', zIndex: 2 }}>
        <ScrollReveal variant="fade-up" delay={0.05}>
          <div className="jl-filter-inner">
            {depts.map((d) => (
              <button
                key={d}
                className={`jl-filter-btn ${filter === d ? 'jl-filter-btn--active' : ''}`}
                onClick={() => setFilter(d)}
              >
                {d}
              </button>
            ))}
            <span className="jl-result-count">{filtered.length} role{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </ScrollReveal>
      </div>

      {/* ── listings ── */}
      <main className="jl-listings" style={{ position: 'relative', zIndex: 2 }}>
        <div className="jl-listings-inner">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-light)' }}>
              Loading...
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((job, index) => (
              <ScrollReveal 
                key={job.id} 
                variant="fade-up" 
                delay={(index % 3) * 0.08}
              >
                <JobCard job={job} />
              </ScrollReveal>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-light)' }}>
              No openings found matching your criteria.
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default JobListingsPage;
