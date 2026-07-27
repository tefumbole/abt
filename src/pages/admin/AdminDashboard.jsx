import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Briefcase,
  PieChart as PieChartIcon,
  Settings,
  TrendingUp,
  UserCheck,
  Layers,
  DollarSign,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileText,
  ShieldCheck,
  ArrowUpRight,
  GraduationCap,
  Globe,
  Image as ImageIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/context/AuthContext';
import { getAdminDashboardAnalytics } from '@/services/adminDashboardService';

const currency = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

const numberFmt = (n) => new Intl.NumberFormat('en-US').format(Number(n) || 0);

function KpiCard({ title, value, subtitle, icon: Icon, tone = 'blue', delay = 0, to }) {
  const tones = {
    blue: 'bg-blue-50 text-[#003D82]',
    green: 'bg-emerald-50 text-emerald-700',
    gold: 'bg-amber-50 text-amber-700',
    purple: 'bg-violet-50 text-violet-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  const TitleValue = to
    ? ({ children }) => (
        <Link
          to={to}
          className="block min-w-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003D82]"
        >
          {children}
        </Link>
      )
    : ({ children }) => <div className="min-w-0">{children}</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="border-slate-200 shadow-sm hover:shadow-md hover:border-[#003D82]/40 transition-all h-full group">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <TitleValue>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1 group-hover:text-[#003D82]">
                  {title}
                  {to ? (
                    <ArrowUpRight className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity text-[#003D82]" />
                  ) : null}
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900 truncate group-hover:text-[#003D82]">{value}</p>
              </TitleValue>
              {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
            </div>
            {to ? (
              <Link
                to={to}
                className={`rounded-xl p-2.5 shrink-0 ${tones[tone]} hover:scale-105 transition-transform`}
                aria-label={`Open ${title}`}
              >
                <Icon className="h-5 w-5" />
              </Link>
            ) : (
              <div className={`rounded-xl p-2.5 shrink-0 ${tones[tone]}`}>
                <Icon className="h-5 w-5" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SectionLink({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 hover:text-[#D4AF37] transition-colors group"
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
    </Link>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs">
      {label ? <p className="mb-1 font-semibold text-slate-700">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.name || entry.dataKey} className="text-slate-600">
          <span className="font-medium" style={{ color: entry.color || entry.fill }}>
            {entry.name}:
          </span>{' '}
          {typeof entry.value === 'number' ? numberFmt(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const analytics = await getAdminDashboardAnalytics();
      setData(analytics);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Failed to load dashboard analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const kpis = data?.kpis;
  const soldPct =
    kpis && kpis.totalCompanyShares > 0
      ? Math.min(100, Math.round((kpis.sharesSold / kpis.totalCompanyShares) * 100))
      : 0;

  const quickLinks = [
    { to: '/admin/applications', title: 'Applications', desc: 'All job applications', icon: FileText },
    { to: '/admin/jobs', title: 'Recruitment', desc: 'Jobs & openings', icon: Briefcase },
    { to: '/admin/shareholders/dashboard', title: 'Shareholders', desc: 'Equity management', icon: TrendingUp },
    { to: '/admin/members', title: 'Members', desc: 'Team directory', icon: UserCheck },
    { to: '/admin/students', title: 'Students', desc: 'Student registry', icon: GraduationCap },
    { to: '/admin/users', title: 'Manage Users', desc: 'Staff & admins', icon: Users },
    { to: '/admin/site-content', title: 'Site Content', desc: 'Edit public pages', icon: Globe },
    { to: '/admin/gallery', title: 'Gallery', desc: 'Photos & embeds', icon: ImageIcon },
    { to: '/admin/general-settings', title: 'General Settings', desc: 'System config', icon: Settings },
  ];

  const equityRows = [
    { label: 'Shareholders', value: numberFmt(kpis?.shareholders), to: '/admin/shareholders/list' },
    { label: 'Approved', value: numberFmt(kpis?.shareholdersApproved), to: '/admin/shareholders/list' },
    {
      label: 'Pending review',
      value: numberFmt(kpis?.shareholdersPending),
      to: '/admin/shareholders/pending-approvals',
    },
    {
      label: 'Completed payments',
      value: numberFmt(kpis?.completedPayments),
      to: '/admin/shareholders/dashboard',
    },
    {
      label: 'Pending payments',
      value: numberFmt(kpis?.pendingPayments),
      to: '/admin/shareholders/pending-payments',
    },
    { label: 'Price / share', value: currency(kpis?.pricePerShare), to: '/admin/shareholders/settings' },
    {
      label: 'Remaining value',
      value: currency(kpis?.remainingWorth),
      to: '/admin/shareholders/dashboard',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#003D82]">Dashboard</h1>
          <p className="mt-1 text-slate-600">
            Welcome back, <span className="font-medium text-slate-800">{user?.email}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className="bg-blue-100 text-[#003D82] hover:bg-blue-100 border-0 capitalize">
              {user?.role?.replace(/_/g, ' ') || 'user'}
            </Badge>
            <span className="text-xs text-slate-500">Live operational analytics</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          className="self-start border-slate-300"
        >
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3 text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div className="flex-1 text-sm">{error}</div>
            <Button size="sm" variant="outline" onClick={load}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center justify-center py-24 text-slate-500 gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading analytics…
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Applications"
              value={numberFmt(kpis?.applicationsTotal)}
              subtitle={
                <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <Link to="/admin/applications" className="hover:text-[#003D82] hover:underline">
                    {numberFmt(kpis?.applicationsPending)} pending
                  </Link>
                  <span>·</span>
                  <Link to="/admin/applications/shortlisted" className="hover:text-[#003D82] hover:underline">
                    {numberFmt(kpis?.applicationsShortlisted)} shortlisted
                  </Link>
                </span>
              }
              icon={FileText}
              tone="blue"
              delay={0.05}
              to="/admin/applications"
            />
            <KpiCard
              title="Members"
              value={numberFmt(kpis?.members)}
              subtitle={
                <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <Link to="/admin/students" className="hover:text-[#003D82] hover:underline">
                    {numberFmt(kpis?.students)} students
                  </Link>
                  <span>·</span>
                  <Link to="/admin/jobs" className="hover:text-[#003D82] hover:underline">
                    {numberFmt(kpis?.jobs)} jobs
                  </Link>
                </span>
              }
              icon={Users}
              tone="green"
              delay={0.1}
              to="/admin/members"
            />
            <KpiCard
              title="Shares Sold"
              value={numberFmt(kpis?.sharesSold)}
              subtitle={`${numberFmt(kpis?.sharesRemaining)} remaining of ${numberFmt(kpis?.totalCompanyShares)}`}
              icon={Layers}
              tone="purple"
              delay={0.15}
              to="/admin/shareholders/dashboard"
            />
            <KpiCard
              title="Portfolio Worth"
              value={currency(kpis?.portfolioWorth)}
              subtitle={`${currency(kpis?.pricePerShare)} / share · ${currency(kpis?.remainingWorth)} available`}
              icon={DollarSign}
              tone="gold"
              delay={0.2}
              to="/admin/shareholders/dashboard"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1 border-slate-200 shadow-sm hover:border-[#003D82]/30 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-[#003D82]">
                  <PieChartIcon className="h-4 w-4" />
                  <SectionLink to="/admin/shareholders/dashboard">Share Allocation</SectionLink>
                </CardTitle>
                <CardDescription>Sold vs remaining company shares</CardDescription>
              </CardHeader>
              <CardContent>
                {(data?.shareAllocation?.length || 0) === 0 ? (
                  <p className="text-sm text-slate-500 py-10 text-center">No share data yet</p>
                ) : (
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.shareAllocation}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="48%"
                          innerRadius={58}
                          outerRadius={88}
                          paddingAngle={3}
                        >
                          {data.shareAllocation.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={28} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-2 space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Sold {soldPct}%</span>
                    <span>{numberFmt(kpis?.sharesRemaining)} left</span>
                  </div>
                  <Progress value={soldPct} className="h-2" />
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Link
                      to="/admin/shareholders/settings"
                      className="rounded-lg bg-slate-50 p-2.5 hover:bg-slate-100 transition-colors"
                    >
                      <p className="text-[10px] uppercase text-slate-500">Company worth</p>
                      <p className="text-sm font-semibold text-slate-900">{currency(kpis?.totalCompanyWorth)}</p>
                    </Link>
                    <Link
                      to="/admin/shareholders/dashboard"
                      className="rounded-lg bg-amber-50 p-2.5 hover:bg-amber-100/80 transition-colors"
                    >
                      <p className="text-[10px] uppercase text-amber-700/80">Invested</p>
                      <p className="text-sm font-semibold text-amber-900">{currency(kpis?.portfolioWorth)}</p>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-slate-200 shadow-sm hover:border-[#003D82]/30 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-[#003D82]">
                  <TrendingUp className="h-4 w-4" />
                  <SectionLink to="/admin/applications">Applications Trend</SectionLink>
                </CardTitle>
                <CardDescription>Applications received over the last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.applicationsTrend || []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="appFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#003D82" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#003D82" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="applications"
                        name="Applications"
                        stroke="#003D82"
                        strokeWidth={2.5}
                        fill="url(#appFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-slate-200 shadow-sm hover:border-[#003D82]/30 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-[#003D82]">
                  <SectionLink to="/admin/applications">Application Pipeline</SectionLink>
                </CardTitle>
                <CardDescription>
                  Status breakdown ·{' '}
                  <Link to="/admin/applications/shortlisted" className="text-[#003D82] hover:underline">
                    shortlisted
                  </Link>
                  {' · '}
                  <Link to="/admin/applications/rejected" className="text-[#003D82] hover:underline">
                    rejected
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const pipeline = (data?.applicationsByStatus || []).filter((d) => d.value > 0);
                  if (pipeline.length === 0) {
                    return (
                      <p className="text-sm text-slate-500 py-16 text-center">
                        No applications yet.{' '}
                        <Link to="/admin/jobs" className="text-[#003D82] font-medium hover:underline">
                          Manage jobs
                        </Link>
                      </p>
                    );
                  }
                  return (
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pipeline}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="45%"
                            outerRadius={80}
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {pipeline.map((entry) => (
                              <Cell key={entry.name} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm hover:border-[#003D82]/30 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-[#003D82]">
                  <SectionLink to="/admin/jobs">Top Job Openings</SectionLink>
                </CardTitle>
                <CardDescription>Applications by job</CardDescription>
              </CardHeader>
              <CardContent>
                {(data?.topJobs?.length || 0) === 0 ? (
                  <p className="text-sm text-slate-500 py-16 text-center">
                    No job applications yet.{' '}
                    <Link to="/admin/jobs" className="text-[#003D82] font-medium hover:underline">
                      Open jobs
                    </Link>
                  </p>
                ) : (
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.topJobs}
                        layout="vertical"
                        margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={100}
                          tick={{ fontSize: 11 }}
                          stroke="#94a3b8"
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="applications" name="Applications" fill="#D4AF37" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm hover:border-[#003D82]/30 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-[#003D82]">
                  <ShieldCheck className="h-4 w-4" />
                  <SectionLink to="/admin/shareholders/dashboard">Equity Snapshot</SectionLink>
                </CardTitle>
                <CardDescription>Shareholders & payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {equityRows.map((row) => (
                  <Link
                    key={row.label}
                    to={row.to}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 hover:bg-blue-50 hover:border-[#003D82]/20 transition-colors group"
                  >
                    <span className="text-xs text-slate-600 group-hover:text-[#003D82]">{row.label}</span>
                    <span className="text-sm font-semibold text-slate-900 inline-flex items-center gap-1">
                      {row.value}
                      <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-70 text-[#003D82]" />
                    </span>
                  </Link>
                ))}
                <Button asChild className="w-full mt-1 bg-[#003D82] hover:bg-[#002a5c]">
                  <Link to="/admin/shareholders/dashboard">Open Shareholders</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#003D82]">Quick Access</CardTitle>
              <CardDescription>Jump to frequently used management tools</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {quickLinks.map(({ to, title, desc, icon: Icon }) => (
                  <Button
                    key={to}
                    asChild
                    variant="outline"
                    className="h-auto justify-start gap-3 p-4 border-slate-200 hover:border-[#003D82]/60 hover:bg-blue-50/50"
                  >
                    <Link to={to}>
                      <div className="rounded-lg bg-[#003D82]/10 p-2">
                        <Icon className="h-4 w-4 text-[#003D82]" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-slate-900">{title}</div>
                        <div className="text-xs text-slate-500">{desc}</div>
                      </div>
                    </Link>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
