export const PAGE_SIZE = 6;
export const RESULT_VALUES = ['works', 'fails', 'skipped'];

const SAFE = 'Do not delete a real record, pay real money, or empty the database. Use TEST in the name if you save anything.';

function check(id, module, text, steps) {
  return { id, module, text, steps: [...steps, SAFE] };
}

export const SYSTEM_TEST_MODULES = [
  {
    id: 'public',
    label: 'Public website',
    checks: [
      check('home-open', 'Public website', 'Open the homepage. The hero, logo, and Get a Free Quote should show.', [
        'Open https://alpha-bridge.net in a new tab.',
        'Confirm the Alpha Bridge logo and the Kigali hero text.',
        'Confirm Get a Free Quote and WhatsApp. Extra marketing blocks under the hero should not appear.',
      ]),
      check('home-mobile', 'Public website', 'Check the homepage on a phone or a narrow window.', [
        'Make the window narrow, or open the site on a phone.',
        'Tap the menu (three lines). Home, Training, Events, About Us, and Shareholders should be easy to tap.',
        'The page should not slide sideways.',
      ]),
      check('public-training', 'Public website', 'Open Training. You should see programs and Enroll Now only at the bottom.', [
        'Click Training.',
        'The address should be /trainings.',
        'Program cards should load. Why Train With Us should not appear. Enroll Now should be at the bottom.',
      ]),
      check('public-events', 'Public website', 'Open Events. The list or a clear empty message should show.', [
        'Click Events.',
        'You should see event cards or a clear empty message, not an error.',
        'If a card is listed, open it. The title should show.',
      ]),
      check('public-about', 'Public website', 'Open About Us. Mission and team should show. Core Values and Get in Touch should not.', [
        'Click About Us.',
        'The blue banner and Our Mission should be readable.',
        'Our Core Values and Get in Touch should not appear.',
      ]),
      check('public-shareholders', 'Public website', 'Open Shareholders. Read only. Do not pay.', [
        'Click Shareholders.',
        'The page should explain shares. Do not complete a real payment.',
      ]),
      check('public-gallery', 'Public website', 'Open Gallery. Videos should show a picture or a player, not a blank or overload error.', [
        'Click Gallery, or open /gallery.',
        'TikTok, Instagram, and YouTube cards should show a picture or a playable player.',
        'Tap play on one item. It should open, or Open should take you to the original video.',
      ]),
      check('public-contact', 'Public website', 'Open Contact. The form, phone, and email should show.', [
        'Open /contact.',
        'The form and the Rwanda phone and email should be visible.',
        'You may send a message whose subject starts with TEST.',
      ]),
      check('public-footer', 'Public website', 'Check the footer. Copyright should be easy to read. Norrsken House should open a map.', [
        'Scroll to the bottom, or wait for the copyright bar.',
        'Copyright, Developed by, phone, and email should be easy to read (white and gold).',
        'Tap Norrsken House, Kigali, Rwanda. A map should open. The moving ticker should hide while you scroll.',
      ]),
    ],
  },
  {
    id: 'login',
    label: 'Sign in',
    checks: [
      check('login-ok', 'Sign in', 'Sign in with the test username and password you were given.', [
        'Click Login.',
        'Enter the username and password. Complete the WhatsApp code if asked.',
        'You should reach the admin area. There should be no Create Customer Account or Sign Up extras on the login form.',
      ]),
      check('login-bad', 'Sign in', 'Try a wrong password. The site should refuse it.', [
        'Sign out if needed. Open Login.',
        'Type the right username and a wrong password.',
        'The site should refuse it. You should not see the admin menu.',
      ]),
      check('logout', 'Sign in', 'Sign out.', [
        'Sign in again.',
        'Open the account menu and click Sign Out.',
        'You should leave the admin area.',
      ]),
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    checks: [
      check('dash-open', 'Dashboard', 'Open Dashboard. Shortcuts and summary cards should show.', [
        'Sign in. Click Dashboard.',
        'The address should be /admin/dashboard.',
        'Cards or shortcuts should show. The page should not be blank or an error.',
      ]),
    ],
  },
  {
    id: 'tasks',
    label: 'Task Manager',
    checks: [
      check('tasks-dashboard', 'Task Manager', 'Open Task Dashboard.', [
        'Open Task Management, then Task Dashboard.',
        'You should see counts or a clear empty state.',
      ]),
      check('tasks-create', 'Task Manager', 'Open Create Task. Do not assign a real person unless the title starts with TEST.', [
        'Open Create Task.',
        'The form should ask for a title and a deadline.',
        'Stop before saving, or save a task whose title starts with TEST.',
      ]),
      check('tasks-list', 'Task Manager', 'Open All Tasks.', [
        'Open All Tasks.',
        'Rows should show, or a clear empty message.',
        'Do not delete a real task.',
      ]),
    ],
  },
  {
    id: 'jobs',
    label: 'Job Board',
    checks: [
      check('jobs-list', 'Job Board', 'Open Manage Jobs.', [
        'Open Job Board, then Manage Jobs.',
        'Jobs should list, or the list should be clearly empty.',
        'Do not publish a real job unless the title starts with TEST.',
      ]),
      check('jobs-applications', 'Job Board', 'Open All Applications.', [
        'Open All Applications.',
        'You should see applications or a clear empty message.',
        'Do not reject a real application.',
      ]),
    ],
  },
  {
    id: 'events',
    label: 'Events & invitations',
    checks: [
      check('events-admin', 'Events & invitations', 'Open Event Management.', [
        'Open Event Management.',
        'The list or create screen should load, not an error.',
      ]),
      check('events-invites', 'Events & invitations', 'Open Digital Invitations.', [
        'Open Digital Invitations.',
        'The page should load. If there is an event dropdown, it should show events or a clear empty message.',
      ]),
    ],
  },
  {
    id: 'announce',
    label: 'Announcements',
    checks: [
      check('announce-compose', 'Announcements', 'Open Compose announcement.', [
        'Open Announcements, then Compose.',
        'The compose form should load.',
        'Do not send a real WhatsApp blast unless the title starts with TEST.',
      ]),
      check('announce-list', 'Announcements', 'Open All Announcements.', [
        'Open All Announcements.',
        'The list or empty message should show.',
      ]),
    ],
  },
  {
    id: 'gallery-admin',
    label: 'Gallery admin',
    checks: [
      check('gallery-admin-open', 'Gallery admin', 'Open Gallery admin. Existing items should list.', [
        'Open Gallery in the admin menu.',
        'You should see the public items or a way to add one.',
        'Do not delete a real gallery item.',
      ]),
    ],
  },
  {
    id: 'timesheet',
    label: 'Time & Attendance',
    checks: [
      check('ts-fill', 'Time & Attendance', 'Open Fill Time Sheet.', [
        'Open TimeSheets, then Fill Time Sheet.',
        'The sheet should load. Do not change a real week unless the note starts with TEST.',
      ]),
      check('ts-week', 'Time & Attendance', 'Open Working Week.', [
        'Open Working Week.',
        'The calendar or week view should load.',
      ]),
    ],
  },
  {
    id: 'courses',
    label: 'Courses',
    checks: [
      check('courses-list', 'Courses', 'Open Course List.', [
        'Open Courses, then Course List.',
        'Courses should list or show a clear empty message.',
      ]),
      check('courses-reg', 'Courses', 'Open Registrations.', [
        'Open Registrations.',
        'The list should load. Do not delete a real registration.',
      ]),
    ],
  },
  {
    id: 'hr',
    label: 'HR & Payroll',
    checks: [
      check('hr-staff', 'HR & Payroll', 'Open Staff Management.', [
        'Open Human Resources, then Staff Management.',
        'Staff should list, or a clear empty message.',
      ]),
      check('hr-payroll', 'HR & Payroll', 'Open Monthly Payroll.', [
        'Open Monthly Payroll.',
        'The payroll screen should load. Do not approve a real run.',
      ]),
      check('hr-payslips', 'HR & Payroll', 'Open Payslips.', [
        'Open Payslips.',
        'The list should load.',
      ]),
    ],
  },
  {
    id: 'letters',
    label: 'HR Letters',
    checks: [
      check('letters-leave', 'HR Letters', 'Open Leave of Absence and search a recipient.', [
        'Open HR Letters, then Leave of Absence.',
        'The recipient search should open and show people.',
        'Do not send a real letter unless the subject starts with TEST.',
      ]),
    ],
  },
  {
    id: 'people',
    label: 'People',
    checks: [
      check('people-users', 'People', 'Open User List.', [
        'Open People, then User List.',
        'Users should list. Add should be on this page.',
      ]),
      check('people-customers', 'People', 'Open Customer List.', [
        'Open Customer List.',
        'Customers should list. Add should ask for Name, Phone, Address, Country. No email field.',
      ]),
      check('people-suppliers', 'People', 'Open Supplier List.', [
        'Open Supplier List.',
        'The list or empty message should show.',
      ]),
      check('people-members', 'People', 'Open Member List.', [
        'Open Member List.',
        'The list or empty message should show.',
      ]),
      check('people-students', 'People', 'Open Student List.', [
        'Open Student List.',
        'The list or empty message should show.',
      ]),
    ],
  },
  {
    id: 'shares-admin',
    label: 'Shareholders admin',
    checks: [
      check('shares-list', 'Shareholders admin', 'Open Shareholders List View.', [
        'Open ShareHolders, then List View.',
        'The list should load. Do not approve a real payment.',
      ]),
    ],
  },
  {
    id: 'products',
    label: 'Products & stock',
    checks: [
      check('prod-category', 'Products & stock', 'Open Category. You should be able to add or paste an image.', [
        'Open Products & Stock, then Category.',
        'Categories should list. Add should allow drop, click, or paste of an image.',
      ]),
      check('prod-list', 'Products & stock', 'Open Product List.', [
        'Open Product List.',
        'Products should list with name and price.',
      ]),
    ],
  },
  {
    id: 'pos',
    label: 'POS',
    checks: [
      check('pos-open', 'POS', 'Open POS. Categories and product search should work.', [
        'Open POS.',
        'Category search should show categories. Product search should filter as you type.',
        'Customer, warehouse, and biller should be searchable.',
      ]),
      check('pos-pay', 'POS', 'Check payment buttons. Cash, MoMo, and Visa should show. Do not take a real payment.', [
        'On POS, add a TEST item if needed, then open pay.',
        'Cash, MoMo, and Visa should be available. JE, Hold, Credit, and Group Credit should not appear.',
        'Amounts should show without extra .00. Stop before a real charge.',
      ]),
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    checks: [
      check('sales-list', 'Sales', 'Open Sale List.', [
        'Open Sale, then Sale List.',
        'Sales should list. Customer, warehouse, biller, and status should be searchable.',
      ]),
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    checks: [
      check('purchases-open', 'Purchases', 'Open Purchases.', [
        'Open Purchases.',
        'The list or add screen should load.',
      ]),
    ],
  },
  {
    id: 'payments',
    label: 'Payments',
    checks: [
      check('pay-open', 'Payments', 'Open Payments. Do not send real money.', [
        'Open Payments.',
        'Awaiting payment or lists should load.',
        'Do not confirm a real withdrawal or deposit.',
      ]),
    ],
  },
  {
    id: 'rentals',
    label: 'Rentals',
    checks: [
      check('rentals-list', 'Rentals', 'Open Booking List.', [
        'Open Rental Module, then Booking List.',
        'The list should load. Do not sign a real contract.',
      ]),
    ],
  },
  {
    id: 'contracts',
    label: 'Contracts & assets',
    checks: [
      check('contracts-open', 'Contracts & assets', 'Open Contracts.', [
        'Open Contracts.',
        'The page should load.',
      ]),
      check('assets-open', 'Contracts & assets', 'Open Fixed Assets.', [
        'Open Fixed Assets.',
        'The page should load.',
      ]),
    ],
  },
];

export function allChecks() {
  return SYSTEM_TEST_MODULES.flatMap((mod) =>
    mod.checks.map((item) => ({ ...item, section: mod.label }))
  );
}

export function pages() {
  const checks = allChecks();
  const chunks = [];
  for (let i = 0; i < checks.length; i += PAGE_SIZE) {
    chunks.push(checks.slice(i, i + PAGE_SIZE));
  }
  return chunks.map((chunk, index) => ({
    number: index + 1,
    title: chunk[0]?.section || 'Checks',
    checks: chunk,
  }));
}

export function checkMap() {
  const map = {};
  for (const item of allChecks()) map[item.id] = item;
  return map;
}

export function moduleSummary(checks = {}) {
  return SYSTEM_TEST_MODULES.map((mod) => {
    const items = mod.checks;
    const works = items.filter((item) => checks[item.id] === 'works').length;
    const fails = items.filter((item) => checks[item.id] === 'fails').length;
    const skipped = items.filter((item) => checks[item.id] === 'skipped').length;
    const answered = works + fails + skipped;
    return {
      id: mod.id,
      label: mod.label,
      total: items.length,
      works,
      fails,
      skipped,
      pending: items.length - answered,
    };
  });
}
