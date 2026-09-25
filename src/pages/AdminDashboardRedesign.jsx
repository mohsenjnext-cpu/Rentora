import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowUpRight, CheckCircle2, CreditCard, Database,
  LayoutDashboard, Loader2, Package, RefreshCw, ShieldCheck, Users, Wallet,
  XCircle
} from 'lucide-react';
import { usePiAuth } from '../context/PiAuthContext';
import { getApiBaseUrl } from '../services/apiConfig';

const copy = {
  fa: {
    title: 'مرکز مدیریت', subtitle: 'نمای عملیاتی Rentora، داده‌های زنده از API و D1',
    refresh: 'به‌روزرسانی', users: 'کاربران', listings: 'آگهی‌ها', rentals: 'اجاره‌ها',
    revenue: 'درآمد', treasury: 'خزانه در دسترس', alerts: 'هشدارهای باز',
    operations: 'وضعیت عملیات', healthy: 'سالم', attention: 'نیازمند بررسی',
    reports: 'گزارش‌های باز', payouts: 'پرداخت‌های در جریان', recent: 'آخرین فعالیت',
    noData: 'داده‌ای برای نمایش وجود ندارد.', loading: 'در حال بارگذاری مرکز مدیریت...',
    unauthorized: 'دسترسی غیرمجاز', retry: 'تلاش دوباره', api: 'اتصال API',
    d1: 'پایگاه D1', kv: 'KV', pi: 'Pi API'
  },
  en: {
    title: 'Admin Center', subtitle: 'Rentora operations, live API and D1 data',
    refresh: 'Refresh', users: 'Users', listings: 'Listings', rentals: 'Rentals',
    revenue: 'Revenue', treasury: 'Available treasury', alerts: 'Open alerts',
    operations: 'Operations', healthy: 'Healthy', attention: 'Needs review',
    reports: 'Open reports', payouts: 'Payouts in flight', recent: 'Recent activity',
    noData: 'No data available.', loading: 'Loading admin center...', unauthorized: 'Unauthorized',
    retry: 'Retry', api: 'API', d1: 'D1', kv: 'KV', pi: 'Pi API'
  },
  ar: {
    title: 'مركز الإدارة', subtitle: 'عمليات Rentora وبيانات API وD1 المباشرة',
    refresh: 'تحديث', users: 'المستخدمون', listings: 'الإعلانات', rentals: 'الإيجارات',
    revenue: 'الإيرادات', treasury: 'الخزينة المتاحة', alerts: 'التنبيهات المفتوحة',
    operations: 'حالة العمليات', healthy: 'سليم', attention: 'يحتاج مراجعة',
    reports: 'التقارير المفتوحة', payouts: 'الدفعات الجارية', recent: 'النشاط الأخير',
    noData: 'لا توجد بيانات.', loading: 'جارٍ تحميل مركز الإدارة...', unauthorized: 'غير مصرح',
    retry: 'إعادة المحاولة', api: 'API', d1: 'D1', kv: 'KV', pi: 'Pi API'
  },
  zh: {
    title: '管理中心', subtitle: 'Rentora 运营与实时 API、D1 数据',
    refresh: '刷新', users: '用户', listings: '物品', rentals: '租赁',
    revenue: '收入', treasury: '可用资金', alerts: '待处理提醒',
    operations: '运营状态', healthy: '正常', attention: '需要检查',
    reports: '待处理报告', payouts: '进行中的付款', recent: '最近活动',
    noData: '暂无数据。', loading: '正在加载管理中心...', unauthorized: '无权访问',
    retry: '重试', api: 'API', d1: 'D1', kv: 'KV', pi: 'Pi API'
  }
};

const money = (value) => `${Number(value || 0).toFixed(4)} π`;
const statusTone = (value) => ['active', 'completed', 'approved', 'healthy', 'verified'].includes(String(value).toLowerCase()) ? 'trust' : ['open', 'reviewing', 'failed', 'reconciliation_required', 'suspended'].includes(String(value).toLowerCase()) ? 'warning' : 'neutral';

export default function AdminDashboardRedesign({ onNavigate }) {
  const { isAdmin } = usePiAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePanel, setActivePanel] = useState('overview');
  const api = getApiBaseUrl();
  const lang = document.documentElement.lang?.toLowerCase().split('-')[0] || 'fa';
  const t = copy[lang] || copy.fa;

  const load = useCallback(async () => {
    if (!isAdmin || !api) return;
    setLoading(true); setError('');
    try {
      const response = await fetch(`${api}/api/admin/console?_t=${Date.now()}`, {
        headers: { 'Content-Type': 'application/json' }, credentials: 'include', cache: 'no-store'
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success) throw new Error(json.error || t.noData);
      setData(json);
    } catch (e) {
      setError(e.message || t.noData);
    } finally {
      setLoading(false);
    }
  }, [api, isAdmin, t.noData]);

  useEffect(() => { load(); }, [load]);

  const overview = data?.overview || {};
  const treasury = data?.treasury || {};
  const reports = data?.reports || [];
  const payouts = data?.payouts || [];
  const audit = data?.auditLogs || [];
  const system = data?.system || {};

  const metrics = useMemo(() => [
    [t.users, overview.users, Users],
    [t.listings, overview.listings, Package],
    [t.rentals, overview.rentals, Activity],
    [t.revenue, money(overview.revenue), Wallet],
    [t.treasury, money(overview.availableTreasury), Database],
    [t.alerts, overview.openAlerts || 0, AlertTriangle]
  ], [overview, t]);

  if (!isAdmin) return (
    <section dir="rtl" className="rentora-card p-8 text-center max-w-lg mx-auto">
      <ShieldCheck className="w-10 h-10 mx-auto text-rose-500 mb-3" />
      <h1 className="text-lg font-black">{t.unauthorized}</h1>
      <p className="text-xs text-slate-500 mt-2">این بخش فقط برای مدیر تأییدشده قابل دسترسی است.</p>
      <button type="button" onClick={() => onNavigate?.('home')} className="btn-primary mt-5 px-4 py-2 text-xs font-bold">بازگشت</button>
    </section>
  );

  if (loading && !data) return (
    <section dir="rtl" className="py-24 text-center">
      <Loader2 className="w-7 h-7 mx-auto animate-spin text-rentora-primary-mid" />
      <p className="mt-3 text-xs text-slate-500">{t.loading}</p>
    </section>
  );

  if (error && !data) return (
    <section dir="rtl" className="rentora-card p-7 text-center max-w-lg mx-auto">
      <XCircle className="w-9 h-9 mx-auto text-rose-500" />
      <p className="text-sm font-bold mt-3">{error}</p>
      <button type="button" onClick={load} className="btn-primary mt-4 px-4 py-2 text-xs font-bold">{t.retry}</button>
    </section>
  );

  const reportCounts = {
    open: reports.filter(r => r.status === 'open').length,
    reviewing: reports.filter(r => r.status === 'reviewing').length,
    resolved: reports.filter(r => ['resolved', 'dismissed'].includes(r.status)).length
  };
  const payoutCounts = {
    active: payouts.filter(p => !['completed', 'cancelled'].includes(p.status)).length,
    completed: payouts.filter(p => p.status === 'completed').length,
    failed: payouts.filter(p => p.error || p.status === 'cancelled').length
  };
  const systems = [
    [t.api, Boolean(system.piApiConfigured)],
    [t.d1, Boolean(system.d1Configured)],
    [t.kv, Boolean(system.kvConfigured)],
    [t.pi, Boolean(system.piApiConfigured)]
  ];

  return (
    <section dir="rtl" className="space-y-4 pb-10">
      <header className="relative overflow-hidden rounded-[28px] bg-rentora-primary p-5 sm:p-7 text-white shadow-panel">
        <div className="absolute -left-12 -bottom-20 w-44 h-44 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> Admin only
            </div>
            <h1 className="text-2xl sm:text-3xl font-black mt-3 tracking-tight">{t.title}</h1>
            <p className="text-xs sm:text-sm text-white/70 mt-1 max-w-xl">{t.subtitle}</p>
          </div>
          <button type="button" onClick={load} className="h-11 px-4 rounded-xl bg-white text-rentora-primary font-black text-xs inline-flex items-center justify-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t.refresh}
          </button>
        </div>
      </header>

      {error && <div role="alert" className="rounded-2xl bg-rentora-danger-soft text-rentora-danger p-3 text-xs flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
        {metrics.map(([label, value, Icon]) => (
          <article key={label} className="rentora-card p-4 sm:p-5 shadow-card">
            <div className="w-9 h-9 rounded-xl bg-rentora-primary-soft text-rentora-primary-mid flex items-center justify-center"><Icon className="w-4.5 h-4.5" /></div>
            <div className="mt-4 text-xl sm:text-2xl font-black tracking-tight">{value}</div>
            <div className="text-[10px] sm:text-xs text-slate-500 mt-1">{label}</div>
          </article>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-3">
        <article className="rentora-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-sm font-black">{t.operations}</h2><p className="text-[10px] text-slate-500 mt-1">وضعیت سرویس‌های حیاتی، بدون داده ساختگی.</p></div>
            <CheckCircle2 className="w-5 h-5 text-rentora-success" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {systems.map(([label, ok]) => <div key={label} className={`rounded-2xl p-3 ${ok ? 'badge-trust' : 'badge-amber'}`}>
              <div className="text-[9px] font-bold opacity-70">{label}</div>
              <div className="text-xs font-black mt-1">{ok ? t.healthy : t.attention}</div>
            </div>)}
          </div>
        </article>

        <article className="rentora-card p-4 sm:p-5">
          <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rentora-warning" /><h2 className="text-sm font-black">{t.alerts}</h2></div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[['open', reportCounts.open], ['reviewing', reportCounts.reviewing], ['resolved', reportCounts.resolved]].map(([label, value]) => (
              <button key={label} type="button" onClick={() => setActivePanel(label)} className="rounded-2xl bg-slate-50 dark:bg-white/5 p-3 text-right">
                <div className="text-lg font-black">{value}</div><div className="text-[9px] text-slate-500 mt-1">{label}</div>
              </button>
            ))}
          </div>
        </article>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <article className="rentora-card p-4 sm:p-5">
          <div className="flex items-center justify-between"><h2 className="text-sm font-black">{t.reports}</h2><AlertTriangle className="w-4 h-4 text-rentora-warning" /></div>
          <div className="mt-4 space-y-2">
            {reports.slice(0, 4).map(report => <div key={report.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 dark:bg-white/5 p-3">
              <div className="min-w-0"><div className="text-xs font-bold truncate">{report.reason || report.target_type || 'Report'}</div><div className="text-[9px] text-slate-500 mt-1 truncate">{report.reporter_username ? `@${report.reporter_username}` : report.id}</div></div>
              <span className={`px-2 py-1 rounded-full text-[9px] font-bold ${statusTone(report.status)==='warning'?'badge-amber':'bg-slate-100 dark:bg-slate-800'}`}>{report.status || '—'}</span>
            </div>)}
            {!reports.length && <p className="text-xs text-slate-400 py-5 text-center">{t.noData}</p>}
          </div>
        </article>

        <article className="rentora-card p-4 sm:p-5">
          <div className="flex items-center justify-between"><h2 className="text-sm font-black">{t.payouts}</h2><ArrowUpRight className="w-4 h-4 text-rentora-primary-mid" /></div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[['active', payoutCounts.active], ['completed', payoutCounts.completed], ['failed', payoutCounts.failed]].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200/70 dark:border-white/10 p-3"><div className="text-lg font-black">{value}</div><div className="text-[9px] text-slate-500 mt-1">{label}</div></div>
            ))}
          </div>
          <div className="mt-3 rounded-2xl bg-rentora-primary-soft dark:bg-rentora-primary/20 p-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-rentora-primary-mid" />
            <span className="text-[10px] leading-5">مسیر A2U و وضعیت پرداخت از داده عملیاتی سرور خوانده می‌شود.</span>
          </div>
        </article>
      </div>

      <article className="rentora-card p-4 sm:p-5">
        <div className="flex items-center justify-between"><h2 className="text-sm font-black">{t.recent}</h2><Activity className="w-4 h-4 text-rentora-primary-mid" /></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {audit.slice(0, 6).map((entry, index) => <div key={entry.id || index} className="rounded-2xl bg-slate-50 dark:bg-white/5 p-3">
            <div className="text-xs font-bold truncate">{entry.action || 'Activity'}</div>
            <div className="text-[9px] text-slate-500 mt-1 truncate">{entry.adminUsername || 'admin'}</div>
          </div>)}
          {!audit.length && <p className="text-xs text-slate-400 py-5 text-center sm:col-span-2 lg:col-span-3">{t.noData}</p>}
        </div>
      </article>

      <nav aria-label="Admin quick actions" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[['users', Users], ['listings', Package], ['reports', AlertTriangle], ['treasury', Wallet]].map(([id, Icon]) => (
          <button key={id} type="button" onClick={() => onNavigate?.('admin')} className={`min-h-11 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-3 text-xs font-bold inline-flex items-center justify-center gap-2 ${activePanel===id?'ring-2 ring-rentora-primary-accent':''}`}>
            <Icon className="w-4 h-4" /> {id}
          </button>
        ))}
      </nav>
    </section>
  );
}
