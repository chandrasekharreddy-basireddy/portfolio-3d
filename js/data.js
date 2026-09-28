/* data.js - the single source of truth for all portfolio content.
   Every UI (cards, boards, quests, dialogs) reads from here. */
(function () {
  'use strict';

  var PORTFOLIO = {
    profile: {
      name: 'Chandra Sekhar Reddy',
      role: 'B.Tech Computer Science Student',
      tagline: 'COMPUTER SCIENCE · BUILDER · EXPLORER',
      university: 'Sai University',
      year: 'Second year',
      blurb: 'I turned my portfolio into a small 3D world that you can walk through.',
      email: 'srinivasabasireddy06@gmail.com'
    },
    links: {
      github: 'https://github.com/chandrasekharreddy-basireddy',
      linkedin: 'https://www.linkedin.com/in/chandra-sekhar-reddy-basireddy',
      email: 'mailto:srinivasabasireddy06@gmail.com'
    },
    skills: [
      { id: 'python', name: 'Python', desc: 'Used for AI, automation, data and development. My main language for DSA practice.', icon: 'py' },
      { id: 'c', name: 'C', desc: 'Fundamentals first: memory, pointers and how things really work.', icon: 'c' },
      { id: 'dsa', name: 'DSA', desc: 'Data structures and algorithms, practiced daily in Python and C.', icon: 'dsa' },
      { id: 'javascript', name: 'JavaScript', desc: 'The language this whole world is built in.', icon: 'js' },
      { id: 'html', name: 'HTML', desc: 'Semantic, accessible structure for every page I build.', icon: 'html' },
      { id: 'css', name: 'CSS', desc: 'Responsive layouts and interfaces that stay out of the way.', icon: 'css' },
      { id: 'fastapi', name: 'FastAPI', desc: 'Backend services: server-authoritative scoring, auth, real-time APIs.', icon: 'api' },
      { id: 'postgresql', name: 'PostgreSQL', desc: 'Relational data modeling for the platforms I ship.', icon: 'db' },
      { id: 'redis', name: 'Redis', desc: 'Caching, sessions and WebSocket fan-out.', icon: 'redis' },
      { id: 'nextjs', name: 'Next.js', desc: 'Frontends for full-stack products like Survival School.', icon: 'next' },
      { id: 'typescript', name: 'TypeScript', desc: 'Types where they earn their keep.', icon: 'ts' },
      { id: 'powerbi', name: 'Power BI', desc: 'Data analysis and dashboards.', icon: 'bi' },
      { id: 'n8n', name: 'n8n', desc: 'Automation: connecting tools so small repetitive tasks run themselves.', icon: 'n8n' },
      { id: 'git', name: 'Git & GitHub', desc: 'Version control, PRs, CI — everything ships through repos.', icon: 'git' }
    ],
    projects: [
      {
        id: 'survival-school', no: 'P01', name: 'Survival School',
        tag: 'MCQ-driven learning platform for universities',
        built: 'Timed exams with server-authoritative scoring, points and badges, QR-verifiable certificates, an AI study assistant, timetables and real-time chat.',
        tech: ['FastAPI', 'PostgreSQL', 'Redis', 'Next.js'],
        live: 'https://survivalschool.vercel.app',
        code: 'https://github.com/chandrasekharreddy-basireddy/survivalschool'
      },
      {
        id: 'signal-lite', no: 'P02', name: 'Signal-Lite',
        tag: 'A security-first real-time messaging platform',
        built: 'Phone/OTP login, rotating refresh tokens, server-side authorization on every resource, WebSocket fan-out over Redis and private object storage.',
        tech: ['FastAPI', 'PostgreSQL', 'Next.js'],
        live: null,
        code: 'https://github.com/chandrasekharreddy-basireddy/Runnerup--chat'
      },
      {
        id: 'saiu-v2', no: 'P03', name: 'SaiU V2 — Student OS',
        tag: 'An offline-first university companion PWA',
        built: 'Live timetable from Google Sheets, conflict and free-time engines, .ics calendar export, planner, XP and badges — with automated tests and CI.',
        tech: ['Vanilla JS', 'Service Worker'],
        live: null,
        code: 'https://github.com/chandrasekharreddy-basireddy/SaiU-V2'
      },
      {
        id: 'next', no: 'P04', name: 'Next Build',
        tag: 'Spot reserved — whatever I build next goes here.',
        built: '', tech: [], live: null, code: null
      }
    ],
    education: [
      { stage: 'Class X', place: 'Bhashyam High School', detail: '560 / 600' },
      { stage: 'Class XII', place: 'Bhashyam Junior College', detail: '975 / 1000' },
      { stage: 'B.Tech Y2', place: 'Sai University, Computer Science (pursuing)', detail: 'CGPA 9.33' }
    ]
  };

  /* The guided journey. Objectives unlock in order; each ties to a station p value. */
  var QUESTS = [
    { id: 'q-home', text: 'Walk the trail and find the first station', stop: 'home' },
    { id: 'q-about', text: 'Reach the camp — learn who I am', stop: 'about' },
    { id: 'q-skills', text: 'Find the Skills Forest', stop: 'skills' },
    { id: 'q-projects', text: 'Explore the Project District', stop: 'projects' },
    { id: 'q-education', text: 'Visit the University grounds', stop: 'education' },
    { id: 'q-contact', text: 'Reach the end of the trail', stop: 'contact' },
    { id: 'q-orbs', text: 'Find all 10 hidden orbs', stop: null, needOrbs: 10 },
    { id: 'q-done', text: 'Complete the journey', stop: null, final: true }
  ];

  /* Website/game achievements only — no real-world claims. */
  var ACHIEVEMENTS = [
    { id: 'first-step', name: 'FIRST STEP', desc: 'Started the journey' },
    { id: 'explorer', name: 'EXPLORER', desc: 'Visited every major location' },
    { id: 'collector', name: 'COLLECTOR', desc: 'Found all 10 hidden orbs' },
    { id: 'full-tour', name: 'FULL TOUR', desc: 'Completed the world' },
    { id: 'project-explorer', name: 'PROJECT EXPLORER', desc: 'Opened every project' },
    { id: 'animal-friend', name: 'ANIMAL FRIEND', desc: 'Petted the fox and the horse' },
    { id: 'night-owl', name: 'NIGHT OWL', desc: 'Saw the world after dark' },
    { id: 'all-seasons', name: 'WEATHERED', desc: 'Experienced all four seasons' }
  ];

  var LOADING_TIPS = [
    'Explore the world to discover hidden collectibles.',
    'Scroll to walk — or switch to free walk and use WASD.',
    'Stop at any board along the trail to read it.',
    'Try every season. Even the monsoon.',
    'At night, look for the fireflies.',
    'Night lamps light the campus paths after dusk.'
  ];

  window.DATA = {
    PORTFOLIO: PORTFOLIO,
    QUESTS: QUESTS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    LOADING_TIPS: LOADING_TIPS
  };
})();
