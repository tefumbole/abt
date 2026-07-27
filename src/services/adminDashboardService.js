import { supabase } from '@/lib/customSupabaseClient';
import { getApplicationStats } from '@/services/applicationStatusService';
import { getShareholderStats } from '@/services/shareholderService';
import { getAllMembers } from '@/services/membersService';

function monthKey(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en', { month: 'short', year: '2-digit' });
}

function buildLastSixMonths() {
  const keys = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

async function safeCount(table) {
  try {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Aggregate analytics for the main admin dashboard.
 */
export async function getAdminDashboardAnalytics() {
  const [applications, shareStats, members, appRows, students, courses, jobs] = await Promise.all([
    getApplicationStats().catch(() => ({ total: 0, pending: 0, rejected: 0, shortlisted: 0 })),
    getShareholderStats().catch(() => null),
    getAllMembers().catch(() => []),
    supabase
      .from('applications')
      .select('status, created_at, job_id, jobs(title)')
      .then(({ data, error }) => {
        if (error) throw error;
        return data || [];
      })
      .catch(() => []),
    safeCount('students'),
    safeCount('courses'),
    safeCount('jobs'),
  ]);

  const shares = shareStats || {
    totalShareholders: 0,
    approvedShareholders: 0,
    pendingShareholders: 0,
    totalShares: 0,
    totalInvestment: 0,
    completedPayments: 0,
    pendingPayments: 0,
    totalCompanyShares: 100,
    availableShares: 100,
    pricePerShare: 1000,
  };

  const soldShares = Number(shares.totalShares) || 0;
  const totalCompanyShares = Number(shares.totalCompanyShares) || 0;
  const availableShares = Number(shares.availableShares) || Math.max(0, totalCompanyShares - soldShares);
  const pricePerShare = Number(shares.pricePerShare) || 0;
  const portfolioWorth = Number(shares.totalInvestment) || soldShares * pricePerShare;
  const remainingWorth = availableShares * pricePerShare;

  const monthKeys = buildLastSixMonths();
  const monthCounts = Object.fromEntries(monthKeys.map((k) => [k, 0]));
  const jobCounts = {};

  (appRows || []).forEach((row) => {
    const key = monthKey(row.created_at);
    if (key && monthCounts[key] !== undefined) monthCounts[key] += 1;
    const title = row.jobs?.title || 'Other';
    jobCounts[title] = (jobCounts[title] || 0) + 1;
  });

  const applicationsTrend = monthKeys.map((key) => ({
    month: monthLabel(key),
    applications: monthCounts[key],
  }));

  const applicationsByStatus = [
    { name: 'Pending', value: applications.pending || 0, fill: '#D4AF37' },
    { name: 'Shortlisted', value: applications.shortlisted || 0, fill: '#16a34a' },
    { name: 'Rejected', value: applications.rejected || 0, fill: '#dc2626' },
  ];

  const shareAllocation = [
    { name: 'Sold / Allocated', value: soldShares, fill: '#003D82' },
    { name: 'Remaining', value: availableShares, fill: '#94a3b8' },
  ].filter((d) => d.value > 0);

  const topJobs = Object.entries(jobCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({
      name: name.length > 22 ? `${name.slice(0, 20)}…` : name,
      applications: value,
    }));

  return {
    kpis: {
      applicationsTotal: applications.total || 0,
      applicationsPending: applications.pending || 0,
      applicationsShortlisted: applications.shortlisted || 0,
      applicationsRejected: applications.rejected || 0,
      members: Array.isArray(members) ? members.length : 0,
      students,
      courses,
      jobs,
      shareholders: shares.totalShareholders || 0,
      shareholdersApproved: shares.approvedShareholders || 0,
      shareholdersPending: shares.pendingShareholders || 0,
      sharesSold: soldShares,
      sharesRemaining: availableShares,
      totalCompanyShares,
      pricePerShare,
      portfolioWorth,
      remainingWorth,
      totalCompanyWorth: totalCompanyShares * pricePerShare,
      completedPayments: shares.completedPayments || 0,
      pendingPayments: shares.pendingPayments || 0,
    },
    applicationsByStatus,
    applicationsTrend,
    shareAllocation,
    topJobs,
  };
}
