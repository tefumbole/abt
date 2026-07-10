/** Default shareholder license agreement sections shown on /shareholders-agreement */
export const DEFAULT_LICENSE_SECTIONS = [
  {
    number: 1,
    icon: 'Info',
    title: 'About the Company',
    paragraphs: [
      'Alpha Bridge is a private limited company registered in Rwanda, specializing in IT consultancy, networking, and security systems.',
    ],
  },
  {
    number: 2,
    icon: 'DollarSign',
    title: 'Share Price',
    paragraphs: [
      'The value of one (1) share is USD ${price_per_share}. This price is subject to change based on future valuations.',
    ],
  },
  {
    number: 3,
    icon: 'PieChart',
    title: 'Share Issuance',
    paragraphs: [
      'Shares are issued after a vesting period of 24 months.',
      'During this period, your investment is treated as Convertible Equity.',
    ],
  },
  {
    number: 4,
    icon: 'Users',
    title: 'Share Ownership',
    paragraphs: [
      'Ownership percentage is calculated based on shares held relative to total authorized shares.',
    ],
  },
  {
    number: 5,
    icon: 'Scale',
    title: 'Share Value',
    paragraphs: [
      'The value of shares can fluctuate based on market conditions and company performance.',
    ],
  },
  {
    number: 6,
    icon: 'DollarSign',
    title: 'Dividends (Profit Sharing)',
    paragraphs: [
      'Dividends are not guaranteed and are declared by the Board of Directors from company profits.',
    ],
  },
  {
    number: 7,
    icon: 'Users',
    title: 'Management & Voting',
    paragraphs: [
      'Shareholders vote on critical matters like Director elections and major structural changes.',
    ],
  },
  {
    number: 8,
    icon: 'RefreshCw',
    title: 'Share Transfer & Exit',
    paragraphs: [
      'Right of First Refusal: Existing shareholders have the first right to buy shares.',
      'Transfer Approval: Transfers to third parties require Board approval.',
    ],
  },
];

export function parseLicenseSections(raw) {
  if (!raw) return DEFAULT_LICENSE_SECTIONS;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : DEFAULT_LICENSE_SECTIONS;
    } catch {
      return DEFAULT_LICENSE_SECTIONS;
    }
  }
  return DEFAULT_LICENSE_SECTIONS;
}

export function personalizeLicenseSection(section, settings = {}) {
  const price = settings.price_per_share ?? 500;
  return {
    ...section,
    paragraphs: (section.paragraphs || []).map((p) =>
      String(p).replace(/\$\{price_per_share\}/g, String(price))
    ),
  };
}
