/**
 * Site Content CMS — editable public/admin menus and page copy.
 * Values live in site_settings; schema defaults keep the site unchanged until edited.
 */

export const LANDING_MENU_ITEMS = {
  home: { label: 'Home', path: '/' },
  trainings: { label: 'Training', path: '/trainings' },
  events: { label: 'Events', path: '/events' },
  register: { label: 'Register Now', path: '/register-now' },
  apply: { label: 'Apply Now', path: '/apply-now', special: true },
  gallery: { label: 'Gallery', path: '/gallery' },
  about: { label: 'About Us', path: '/about' },
  shareholders: { label: 'Shareholders', path: '/shareholders' },
  contact: { label: 'Contact Us', path: '/contact' },
  qr: { label: 'QR Scanner', path: '/qr-scanner', icon: 'scan' },
};

export const SIDE_MENU_ITEMS = {
  dashboard: 'Dashboard',
  'site-content': 'Site Content',
  tasks: 'Task Management',
  jobs: 'Job Board',
  events: 'Event Management',
  invitations: 'Digital Invitations',
  'event-templates': 'Event Templates & Config',
  announcements: 'Announcements',
  gallery: 'Gallery',
  timesheets: 'TimeSheets (Employee)',
  'timesheet-admin': 'TimeSheet Admin',
  payments: 'Payments',
  courses: 'Courses',
  hr: 'Human Resources',
  'hr-letters': 'HR Letters',
  users: 'Users',
  members: 'Members (Team)',
  shareholders: 'ShareHolders',
  reports: 'Reports Hub',
  logs: 'Activity Logs',
  backup: 'Backup & Restore',
  'general-settings': 'General Settings',
  roles: 'Roles & Permissions',
  history: 'System History',
};

export const SETTINGS_MENU_ITEMS = {
  reports: 'Reports Hub',
  logs: 'Activity Logs',
  backup: 'Backup & Restore',
  'general-settings': 'General Settings',
  roles: 'Roles & Permissions',
  history: 'System History',
};

/** Page schema: fields[key] = { type, label, default }. type: text|textarea|html|image */
export const PAGE_SCHEMA = {
  home: {
    label: 'Home',
    url: '/',
    fields: {
      hero_title: {
        type: 'html',
        label: 'Hero title (HTML allowed)',
        default: 'Your Technology Bridge to <span class="text-[#D4AF37]">Kigali</span>',
      },
      hero_subtitle: {
        type: 'textarea',
        label: 'Hero subtitle',
        default:
          'Professional IT Consultancy, Enterprise Networking, and Audio-Visual Production, Cloud, AI and Cyber',
      },
      hero_image: {
        type: 'image',
        label: 'Hero background image',
        default: '',
      },
      cta_primary: {
        type: 'text',
        label: 'Hero primary button text',
        default: 'Get a Free Quote',
      },
      services_heading: { type: 'text', label: 'Services heading', default: 'Our Services' },
      services_subheading: {
        type: 'text',
        label: 'Services subheading',
        default: 'Comprehensive technology solutions for your needs',
      },
      why_heading: { type: 'text', label: 'Why-us heading', default: 'Why Alpha Bridge?' },
      why_subheading: {
        type: 'text',
        label: 'Why-us subheading',
        default: 'Excellence in every solution we deliver',
      },
      industries_heading: {
        type: 'text',
        label: 'Industries heading',
        default: 'Industries We Serve',
      },
      industries_subheading: {
        type: 'text',
        label: 'Industries subheading',
        default: 'Trusted by diverse organizations across Africa and the World',
      },
      testimonials_heading: {
        type: 'text',
        label: 'Testimonials heading',
        default: 'What Our Clients Say',
      },
      testimonials_subheading: {
        type: 'text',
        label: 'Testimonials subheading',
        default: 'Trusted by businesses and organizations across Kigali',
      },
      cta_heading: { type: 'text', label: 'Bottom CTA heading', default: 'Ready to Get Started?' },
      cta_text: {
        type: 'textarea',
        label: 'Bottom CTA text',
        default: 'Contact us today for a consultation and let us bridge your technology needs.',
      },
    },
  },
  trainings: {
    label: 'Training',
    url: '/trainings',
    fields: {
      hero_title: {
        type: 'html',
        label: 'Hero title (HTML allowed)',
        default: 'Professional <span class="text-[#D4AF37]">IT Training</span>',
      },
      hero_subtitle: {
        type: 'textarea',
        label: 'Hero subtitle',
        default:
          'Advanced technical training in AI, Cloud, Cybersecurity, Networking, and more — hands-on learning in Kigali.',
      },
      heading: { type: 'text', label: 'Programs heading', default: 'Training Programs' },
      subheading: {
        type: 'textarea',
        label: 'Programs subheading',
        default: 'Choose a track and build real-world skills with industry practitioners.',
      },
    },
  },
  events: {
    label: 'Events',
    url: '/events',
    fields: {
      hero_title: {
        type: 'html',
        label: 'Hero title (HTML allowed)',
        default: 'Upcoming <span class="text-[#D4AF37]">Events</span>',
      },
      hero_subtitle: {
        type: 'text',
        label: 'Hero subtitle',
        default: 'Join Alpha Bridge at our next gathering, workshop, or masterclass.',
      },
      empty_title: { type: 'text', label: 'Empty state title', default: 'No events yet' },
      empty_text: {
        type: 'textarea',
        label: 'Empty state text',
        default: 'Check back soon for upcoming events and programs.',
      },
    },
  },
  gallery: {
    label: 'Gallery',
    url: '/gallery',
    fields: {
      hero_title: {
        type: 'html',
        label: 'Hero title (HTML allowed)',
        default: 'Our <span class="text-[#D4AF37]">Gallery</span>',
      },
      hero_subtitle: {
        type: 'text',
        label: 'Hero subtitle',
        default: 'Events and moments from Alpha Bridge Technologies.',
      },
    },
  },
  about: {
    label: 'About',
    url: '/about',
    fields: {
      hero_title: { type: 'text', label: 'Hero title', default: 'Bridging Technology & Innovation' },
      hero_subtitle: {
        type: 'textarea',
        label: 'Hero subtitle',
        default:
          'We are a premier IT consultancy and infrastructure firm dedicated to transforming businesses through cutting-edge technology solutions.',
      },
      mission_heading: { type: 'text', label: 'Mission heading', default: 'Our Mission' },
      mission_text: {
        type: 'textarea',
        label: 'Mission text',
        default:
          'To empower organizations in Africa and beyond with robust, scalable, and secure technology infrastructure. We strive to be the bridge that connects complex technological challenges with simple, effective, and sustainable solutions.',
      },
      about_image: { type: 'image', label: 'Mission image', default: '' },
      leadership_heading: { type: 'text', label: 'Leadership heading', default: 'Our Leadership' },
      leadership_subtext: {
        type: 'text',
        label: 'Leadership subtext',
        default: 'The visionaries driving Alpha Bridge forward',
      },
      values_heading: { type: 'text', label: 'Core values heading', default: 'Our Core Values' },
      cta_heading: { type: 'text', label: 'CTA heading', default: 'Ready to work with us?' },
      cta_text: {
        type: 'text',
        label: 'CTA text',
        default: "Let's build something extraordinary together.",
      },
      stat_years: { type: 'text', label: 'Stat: years experience', default: '15+' },
      stat_projects: { type: 'text', label: 'Stat: projects completed', default: '500+' },
      stat_team: { type: 'text', label: 'Stat: team members', default: '50+' },
      stat_partners: { type: 'text', label: 'Stat: global partners', default: '20+' },
    },
  },
  shareholders: {
    label: 'Shareholders',
    url: '/shareholders',
    fields: {
      hero_title: {
        type: 'html',
        label: 'Hero title (HTML allowed)',
        default: 'Become a <span class="text-[#D4AF37]">Shareholder</span>',
      },
      hero_subtitle: {
        type: 'textarea',
        label: 'Hero subtitle',
        default: 'Invest in Alpha Bridge Technologies and share in our growth across Africa.',
      },
      cta_primary: { type: 'text', label: 'Primary CTA / Agree button text', default: 'I Agree' },
    },
  },
  contact: {
    label: 'Contact',
    url: '/contact',
    fields: {
      heading: { type: 'text', label: 'Page heading', default: 'Get in Touch' },
      intro: {
        type: 'textarea',
        label: 'Intro text',
        default:
          "Have a question, need assistance, or want to explore partnership opportunities? We're here to help. Reach out to the Alpha Bridge team today.",
      },
      office_name: { type: 'text', label: 'Office name', default: 'Alpha Bridge.' },
      office_line1: { type: 'text', label: 'Office address line 1', default: 'Norrsken House Kigali' },
      office_line2: { type: 'text', label: 'Office address line 2', default: 'Kigali, Rwanda' },
      person_name: { type: 'text', label: 'Contact person name', default: 'Sr. Engr. Mbole' },
      person_role: { type: 'text', label: 'Contact person role', default: 'Lead Technical Director' },
      phone: { type: 'text', label: 'Phone', default: '+250 794 006 160' },
      email: { type: 'text', label: 'Email', default: 'info@alpha-bridge.net' },
      website: { type: 'text', label: 'Website', default: 'www.alpha-bridge.net' },
      hours_weekday: { type: 'text', label: 'Business hours (Mon-Fri)', default: '9:00 AM - 6:00 PM' },
      hours_weekend: { type: 'text', label: 'Business hours (Sat-Sun)', default: 'Closed' },
    },
  },
};

export function contentTabItems() {
  return Object.fromEntries(Object.entries(PAGE_SCHEMA).map(([k, p]) => [k, p.label]));
}

export function mergeOrder(saved, items) {
  const keys = Object.keys(items);
  const ordered = [];
  const list = Array.isArray(saved) ? saved : [];
  for (const k of list) {
    if (items[k] != null && !ordered.includes(k)) ordered.push(k);
  }
  for (const k of keys) {
    if (!ordered.includes(k)) ordered.push(k);
  }
  return ordered;
}

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_settings (
      \`key\` VARCHAR(191) NOT NULL PRIMARY KEY,
      value LONGTEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function getSetting(pool, key, defaultValue = null) {
  try {
    await ensureTable(pool);
    const [rows] = await pool.query('SELECT value FROM site_settings WHERE `key` = ? LIMIT 1', [key]);
    if (!rows.length || rows[0].value == null) return defaultValue;
    const raw = rows[0].value;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  } catch {
    return defaultValue;
  }
}

export async function setSetting(pool, key, value) {
  await ensureTable(pool);
  const stored = typeof value === 'string' ? value : JSON.stringify(value);
  await pool.query(
    `INSERT INTO site_settings (\`key\`, value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP`,
    [key, stored]
  );
}

export async function getContentValue(pool, pageField, defaultValue = '') {
  const val = await getSetting(pool, `content.${pageField}`, null);
  if (val === null || val === undefined || val === '') return defaultValue;
  return typeof val === 'string' ? val : String(val);
}

export async function getPageContent(pool, page) {
  const schema = PAGE_SCHEMA[page];
  if (!schema) return null;
  const fields = {};
  for (const [field, meta] of Object.entries(schema.fields)) {
    fields[field] = await getContentValue(pool, `${page}.${field}`, meta.default);
  }
  return { label: schema.label, url: schema.url, fields };
}

export async function getAllPageContent(pool) {
  const out = {};
  for (const page of Object.keys(PAGE_SCHEMA)) {
    out[page] = await getPageContent(pool, page);
  }
  return out;
}

export async function savePageContent(pool, page, values = {}) {
  const schema = PAGE_SCHEMA[page];
  if (!schema) throw new Error('Unknown page');
  for (const field of Object.keys(schema.fields)) {
    if (Object.prototype.hasOwnProperty.call(values, field)) {
      const v = values[field];
      await setSetting(pool, `content.${page}.${field}`, v == null ? '' : String(v));
    }
  }
  return getPageContent(pool, page);
}

export async function getMenuBundle(pool) {
  const landingSaved = await getSetting(pool, 'landing_menu_order', []);
  const sideSaved = await getSetting(pool, 'side_menu_order', []);
  const settingsSaved = await getSetting(pool, 'settings_menu_order', []);
  const tabsSaved = await getSetting(pool, 'content_tabs_order', []);

  return {
    landing: {
      items: LANDING_MENU_ITEMS,
      order: mergeOrder(landingSaved, LANDING_MENU_ITEMS),
    },
    side: {
      items: SIDE_MENU_ITEMS,
      order: mergeOrder(sideSaved, SIDE_MENU_ITEMS),
    },
    settings: {
      items: SETTINGS_MENU_ITEMS,
      order: mergeOrder(settingsSaved, SETTINGS_MENU_ITEMS),
    },
    contentTabs: {
      items: contentTabItems(),
      order: mergeOrder(tabsSaved, contentTabItems()),
    },
  };
}

export async function getPublicSiteContent(pool) {
  const menus = await getMenuBundle(pool);
  const pages = await getAllPageContent(pool);
  return {
    landingMenu: menus.landing.order.map((key) => ({
      key,
      ...LANDING_MENU_ITEMS[key],
    })),
    pages,
  };
}
