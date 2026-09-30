import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, WalletCards, ArrowUpRight, Users, Package, AlertTriangle,
  CreditCard, ShieldCheck, Settings, RefreshCw, Lock, Search,
  Activity, Database, Wallet, ChevronDown, Loader2, CheckCircle2
} from 'lucide-react';
import { usePiAuth } from '../context/PiAuthContext';
import { getApiBaseUrl } from '../services/apiConfig';
import { cloudSyncService } from '../services/cloudSyncService';
import '../styles/admin-dashboard.css';

const NAV = [
  { id: 'overview', label: 'نمای کلی', icon: LayoutDashboard },
  { id: 'treasury', label: 'خزانه', icon: WalletCards, children: [
    ['treasury-total', 'کل درآمد'], ['treasury-available', 'قابل استفاده'],
    ['treasury-reserved', 'رزروشده'], ['treasury-paid', 'پرداخت‌شده'], ['treasury-wallet', 'وضعیت کیف پول']
  ]},
  { id: 'payouts', label: 'پرداخت‌ها', icon: ArrowUpRight, children: [
    ['payout-create', 'ایجاد پرداخت'], ['payout-pending', 'در انتظار'], ['payout-processing', 'در حال پردازش'],
    ['payout-completed', 'تکمیل‌شده'], ['payout-failed', 'ناموفق'], ['payout-reconcile', 'تطبیق پرداخت']
  ]},
  { id: 'users', label: 'کاربران', icon: Users, children: [['users-all','همه کاربران'],['users-kyc','احراز هویت'],['users-suspended','تعلیق‌شده'],['users-details','جزئیات کاربر']]},
  { id: 'listings', label: 'آگهی‌ها', icon: Package, children: [['listings-all','همه'],['listings-active','فعال'],['listings-paused','متوقف'],['listings-moderation','نظارت و بررسی']]},
  { id: 'reports', label: 'گزارش‌ها', icon: AlertTriangle, children: [['reports-open','باز'],['reports-reviewing','در حال بررسی'],['reports-resolved','حل‌شده']]},
  { id: 'transactions', label: 'تراکنش‌ها', icon: CreditCard, children: [['tx-fees','کارمزدهای پلتفرم'],['tx-payouts','پرداخت‌ها'],['tx-details','جزئیات تراکنش']]},
  { id: 'audit', label: 'گزارش رویدادها', icon: ShieldCheck },
  { id: 'system', label: 'سیستم', icon: Settings, children: [['system-fee','کارمزد پلتفرم'],['system-health','سلامت Backend'],['system-db','نگهداری پایگاه داده'],['system-pi','یکپارچه‌سازی Pi']]}
];

function money(v) { return `${Number(v || 0).toFixed(4)} π`; }
function date(v) { if (!v) return '—'; try { return new Date(v).toLocaleString('fa-IR'); } catch { return v; } }
function statusLabel(s) {
  const map = { open:'باز', reviewing:'در حال بررسی', resolved:'حل‌شده', dismissed:'ردشده', completed:'تکمیل‌شده',
    reserved:'رزروشده', creating:'در حال ایجاد', pi_created:'پرداخت Pi ایجاد شد', approving:'در حال تأیید', approved:'تأییدشده',
    completing:'در حال تکمیل', reconciliation_required:'تطبیق پرداخت', cancelled:'لغوشده', active:'فعال', paused:'متوقف',
    suspended:'تعلیق‌شده', failed:'ناموفق' };
  return map[s] || s || '—';
}

export default function AdminDashboardPage({ onNavigate }) {
  const { isAdmin } = usePiAuth();
  const [section, setSection] = useState('overview');
  const [expanded, setExpanded] = useState({});
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMemo, setPayoutMemo] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [payoutMessage, setPayoutMessage] = useState('');
  const [feeRatePercent, setFeeRatePercent] = useState('5');
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeMessage, setFeeMessage] = useState('');
  const payoutKey = useRef(null);

  const api = getApiBaseUrl();
  // PiAuthContext installs the authenticated-session fetch bridge for API requests.
  // Keep the admin console free of direct session-token storage access.
  const headers = useCallback(() => ({ 'Content-Type': 'application/json' }), []);

  const load = useCallback(async () => {
    if (!isAdmin || !api) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${api}/api/admin/console?_t=${Date.now()}`, { headers: headers(), credentials: 'include', cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'دریافت داده‌های پنل مدیر ممکن نیست.');
      setData(json);
    } catch (e) { setError(e.message || 'خطای اتصال به پنل مدیریت'); }
    finally { setLoading(false); }
  }, [api, headers, isAdmin]);

  useEffect(() => {
    load();
    if (isAdmin && api) {
      fetch(api + '/api/admin/platform-fee?_t=' + Date.now(), { headers: headers(), credentials: 'include', cache: 'no-store' })
        .then(async (res) => {
          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json.success) throw new Error(json.error || 'دریافت نرخ کارمزد ناموفق بود.');
          setFeeRatePercent(String(json.ratePercent));
        })
        .catch((e) => setFeeMessage(e.message || 'دریافت نرخ کارمزد ناموفق بود.'));
    }
  }, [load, isAdmin, api, headers]);

  const go = (id) => {
    setSection(id);
    const parent = NAV.find(n => n.id === id || n.children?.some(c => c[0] === id));
    if (parent?.children) setExpanded(e => ({ ...e, [parent.id]: true }));
  };

  const currentParent = NAV.find(n => n.id === section || n.children?.some(c => c[0] === section));
  const title = section.includes('-') ? (currentParent?.children?.find(c => c[0] === section)?.[1] || currentParent?.label) : (currentParent?.label || 'نمای کلی');

  const updateUser = async (user, kind) => {
    const id = user.id || user.uid;
    if (!id) return;
    setBusyId(id);
    try {
      if (kind === 'status') await cloudSyncService.setAdminUserStatus(id, user.status === 'active' ? 'suspended' : 'active');
      if (kind === 'kyc') await cloudSyncService.setAdminUserKycStatus(id, user.kycStatus === 'verified' ? 'unverified' : 'verified');
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(''); }
  };

  const deleteUser = async (user) => {
    const id = user.id || user.uid;
    if (!id) return;
    if (!window.confirm(`حذف حساب @${user.username || id}؟ این عملیات حساب را غیرفعال، اطلاعات هویتی را ناشناس و آگهی‌های او را حذف می‌کند و قابل بازگشت نیست.`)) return;
    setBusyId(id); setError('');
    try {
      await cloudSyncService.deleteAdminUser(id);
      await load();
    } catch (e) { setError(e.message || 'حذف حساب کاربر ناموفق بود.'); }
    finally { setBusyId(''); }
  };

  const updateListing = async (item, nextStatus = item.status === 'active' ? 'paused' : 'active') => {
    if (nextStatus === 'deleted' && !window.confirm(`حذف آگهی «${item.title || item.id}»؟ این عملیات آگهی را از بازار خارج می‌کند.`)) return;
    setBusyId(item.id); setError('');
    try {
      await cloudSyncService.setAdminListingStatus(item.id, nextStatus);
      await load();
    } catch (e) { setError(e.message || 'تغییر وضعیت آگهی ناموفق بود.'); }
    finally { setBusyId(''); }
  };

  const updateReport = async (report, status) => {
    setBusyId(report.id);
    try {
      const res = await fetch(`${api}/api/admin/reports/${encodeURIComponent(report.id)}/status`, {
        method:'POST', headers:headers(), credentials:'include', body:JSON.stringify({ status })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'تغییر وضعیت گزارش ناموفق بود.');
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(''); }
  };

  const retryReconciliation = async (queueId) => {
    setBusyId(queueId); setError('');
    try {
      const res = await fetch(`${api}/api/admin/reconciliation/${encodeURIComponent(queueId)}/retry`, { method:'POST', headers:headers(), credentials:'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'تطبیق پرداخت ناموفق بود.');
      await load();
    } catch (e) { setError(e.message || 'تطبیق پرداخت ناموفق بود.'); }
    finally { setBusyId(''); }
  };

  const saveFeeRate = async (e) => {
    e.preventDefault();
    const value = Number(feeRatePercent);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      setFeeMessage('نرخ کارمزد باید بین ۱٪ تا ۵٪ باشد.');
      return;
    }
    setFeeSaving(true); setFeeMessage('');
    try {
      const res = await fetch(api + '/api/admin/platform-fee', {
        method: 'POST', headers: headers(), credentials: 'include', body: JSON.stringify({ ratePercent: value })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'ذخیره نرخ کارمزد ناموفق بود.');
      setFeeRatePercent(String(json.ratePercent));
      setFeeMessage('نرخ کارمزد با موفقیت ذخیره شد.');
      await load();
    } catch (e) {
      setFeeMessage(e.message || 'ذخیره نرخ کارمزد ناموفق بود.');
    } finally { setFeeSaving(false); }
  };

  const submitPayout = async (e) => {
    e.preventDefault(); setPayoutMessage('');
    const amount = Number(payoutAmount);
    if (!amount || amount <= 0) { setPayoutMessage('مبلغ معتبر وارد کنید.'); return; }
    payoutKey.current ||= (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `payout_${Date.now()}`);
    try {
      const result = await cloudSyncService.requestAdminPayout(amount, payoutMemo, walletAddress, payoutKey.current);
      setPayoutMessage(result.message || `پرداخت ${money(amount)} ثبت شد.`);
      setPayoutAmount(''); setPayoutMemo(''); payoutKey.current = null;
      await load();
    } catch (e) { setPayoutMessage(e.message || 'پرداخت ناموفق بود.'); }
  };

  if (!isAdmin) return <div className="py-20 text-center" role="alert" aria-live="assertive"><Lock className="w-10 h-10 mx-auto text-rose-500 mb-3"/><h2 className="font-bold">دسترسی غیرمجاز (403)</h2></div>;

  if (loading && !data) return <div className="py-24 text-center" role="status" aria-live="polite"><Loader2 className="w-7 h-7 mx-auto animate-spin text-[#534AB7]"/><p className="mt-3 text-xs text-slate-500">در حال بارگذاری مرکز مدیریت...</p></div>;

  if (error && !data) return <div className="rentora-card p-6 text-center" role="alert" aria-live="assertive"><AlertTriangle className="w-8 h-8 mx-auto text-rose-500 mb-2"/><p className="text-sm">{error}</p><button type="button" aria-label="تلاش دوباره برای بارگذاری پنل مدیریت" onClick={load} className="btn-primary px-4 py-2 mt-4 text-xs">تلاش دوباره</button></div>;

  const o = data?.overview || {};
  const t = data?.treasury || {};
  const users = data?.users || [], listings = data?.listings || [], rentals = data?.rentals || [];
  const reports = data?.reports || [], txs = data?.transactions || [], payouts = data?.payouts || [];
  const audit = data?.auditLogs || [], reconciliation = data?.reconciliation || [], system = data?.system || {};
  const q = query.trim().toLowerCase();

  const filtered = (rows, fields) => rows.filter(r => !q || fields.some(f => String(r?.[f] ?? '').toLowerCase().includes(q)));

  const cards = [
    ['کاربران', o.users, Users], ['آگهی‌ها', o.listings, Package], ['Rentals', o.rentals, Activity],
    ['درآمد', money(o.revenue), WalletCards], ['خزانه قابل استفاده', money(o.availableTreasury), Wallet], ['هشدارهای فعال', o.openAlerts, AlertTriangle]
  ];

  const renderTable = (columns, rows, empty='داده‌ای وجود ندارد.') => (
    <div className="overflow-x-auto rentora-card">
      <table className="w-full text-xs min-w-[720px]"><thead><tr className="text-right border-b border-slate-200 dark:border-slate-700">
        {columns.map(c => <th key={c[0]} className="p-3 font-bold text-slate-500">{c[0]}</th>)}
      </tr></thead><tbody>{rows.length ? rows.map((r,i) => <tr key={r.id || i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
        {columns.map(c => <td key={c[0]} className="p-3">{typeof c[1] === 'function' ? c[1](r) : r[c[1]] ?? '—'}</td>)}
      </tr>) : <tr><td colSpan={columns.length} className="p-8 text-center text-slate-400">{empty}</td></tr>}</tbody></table>
    </div>
  );

  const page = () => {
    if (section === 'overview') return <Overview cards={cards} o={o} reports={reports} payouts={payouts} go={go}/>;
    if (section.startsWith('treasury')) return <Treasury t={t} system={system} go={go}/>;
    if (section.startsWith('payout')) return <Payouts payouts={payouts} reconciliation={reconciliation} section={section} submitPayout={submitPayout} payoutAmount={payoutAmount} setPayoutAmount={setPayoutAmount} payoutMemo={payoutMemo} setPayoutMemo={setPayoutMemo} walletAddress={walletAddress} setWalletAddress={setWalletAddress} payoutMessage={payoutMessage} retryReconciliation={retryReconciliation} busyId={busyId}/>;
    if (section === 'users-details') {
      const selected = users.find(u => (u.id || u.uid) === selectedUserId) || users[0];
      return <UserDetails user={selected} onBack={() => go('users-all')} />;
    }
    if (section.startsWith('users')) {
      const rows = section === 'users-kyc' ? users.filter(u => u.kycStatus !== 'verified') : section === 'users-suspended' ? users.filter(u => u.status === 'suspended') : filtered(users,['username','display_name','pi_uid','status','kycStatus']);
      return <UsersView rows={rows} section={section} busyId={busyId} updateUser={updateUser} deleteUser={deleteUser} onDetails={(u)=>{setSelectedUserId(u.id || u.uid); go('users-details')}} renderTable={renderTable}/>;
    }
    if (section.startsWith('listings')) {
      let rows = filtered(listings,['title','owner_username','location','status']);
      if(section==='listings-active') rows=rows.filter(x=>x.status==='active');
      if(section==='listings-paused') rows=rows.filter(x=>x.status==='paused');
      return <ListingsView rows={rows} section={section} busyId={busyId} updateListing={updateListing} renderTable={renderTable}/>;
    }
    if (section.startsWith('reports')) {
      let rows = filtered(reports,['id','reporter_username','target_type','target_id','reason','status']);
      if(section==='reports-open') rows=rows.filter(x=>x.status==='open');
      if(section==='reports-reviewing') rows=rows.filter(x=>x.status==='reviewing');
      if(section==='reports-resolved') rows=rows.filter(x=>['resolved','dismissed'].includes(x.status));
      return <ReportsView rows={rows} busyId={busyId} updateReport={updateReport} renderTable={renderTable}/>;
    }
    if (section.startsWith('transactions')) {
      let rows=filtered(txs,['id','type','status','pi_payment_id','pi_txid','user_id']);
      if(section==='tx-fees') rows=rows.filter(x=>x.type==='platform_fee'||!x.type);
      if(section==='tx-payouts') rows=rows.filter(x=>x.type==='admin_payout'||x.type==='user_payout');
      const fees=rows.filter(x=>x.type==='platform_fee'||!x.type).length;
      const payoutRows=rows.filter(x=>x.type==='admin_payout'||x.type==='user_payout').length;
      const completed=rows.filter(x=>['completed','success','succeeded'].includes(x.status)).length;
      const pending=rows.filter(x=>['pending','processing','created','approved'].includes(x.status)).length;
      return <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[['کارمزدهای پلتفرم',fees],['پرداخت‌ها',payoutRows],['تکمیل‌شده',completed],['در انتظار',pending]].map(([l,v])=><div key={l} className="rentora-card p-3"><div className="text-[10px] text-slate-500">{l}</div><div className="text-lg font-black mt-1">{v}</div></div>)}
        </div>
        <div className="p-3 rounded-xl bg-[#EEEDFE] dark:bg-[#211E45] text-xs">تراکنش‌ها فقط برای مشاهده و تطبیق مدیریتی هستند. مبلغ و وضعیت مالی از داده‌های معتبر سرور خوانده می‌شود و این نما منطق پرداخت را تغییر نمی‌دهد.</div>
        {renderTable([['ID','id'],['Type',r=>statusLabel(r.type)],['مبلغ',r=>money(r.amount)],['Status',r=><Status s={r.status}/>],['Pi Payment','pi_payment_id'],['TXID','pi_txid'],['تاریخ',r=>date(r.created_at)]],rows,'تراکنشی برای این بخش وجود ندارد.')}
      </div>;
    }
    if(section==='audit') return <AuditView audit={filtered(audit,['adminUsername','action'])}/>;
    if(section.startsWith('system')) return <SystemView system={system} section={section} onCleanup={async()=>{try{await cloudSyncService.cleanupDatabase();await load();}catch(e){setError(e.message)}}} feeRatePercent={feeRatePercent} setFeeRatePercent={setFeeRatePercent} feeSaving={feeSaving} feeMessage={feeMessage} saveFeeRate={saveFeeRate}/>;
    return null;
  };

  const activeNav = NAV.find(n => n.id === section || n.children?.some(c => c[0] === section)) || NAV[0];
  const childNav = activeNav.children || [];

  return <div className="admin-shell pb-16 max-w-[1480px] mx-auto" dir="rtl">
    <header className="admin-header">
      <div className="admin-brand">
        <div className="admin-brand-mark"><LayoutDashboard className="w-5 h-5"/></div>
        <div className="min-w-0">
          <h1>مرکز مدیریت Rentora</h1>
          <p>کنترل کاربران، آگهی‌ها، کارمزد، پرداخت و امنیت</p>
        </div>
        <span className="admin-live"><span/> متصل به سرور</span>
      </div>
      <div className="admin-header-actions">
        <div className="admin-search">
          <Search className="w-4 h-4"/>
          <input aria-label="جستجوی پنل مدیریت" value={query} onChange={e=>setQuery(e.target.value)} placeholder="جستجو در داده‌های مدیریتی..." />
        </div>
        <button type="button" aria-label="تازه‌سازی پنل مدیریت" onClick={load} className="admin-icon-action">
          <RefreshCw className={loading?'animate-spin':''} />
          <span>به‌روزرسانی</span>
        </button>
      </div>
    </header>

    {error && <div className="admin-alert admin-alert-danger" role="alert"><AlertTriangle className="w-4 h-4"/><span>{error}</span></div>}

    <nav className="admin-primary-nav" aria-label="ناوبری اصلی مدیریت">
      {NAV.map(n => {
        const Icon=n.icon;
        const active=n.id===activeNav.id;
        return <button key={n.id} type="button" aria-current={active ? "page" : undefined} onClick={()=>go(n.id)} className={active ? 'is-active' : ''}>
          <Icon className="w-4 h-4"/><span>{n.label}</span>
        </button>;
      })}
    </nav>

    {childNav.length > 0 && <div className="admin-subnav" aria-label={`زیرمنوی ${activeNav.label}`}>
      {childNav.map(([id,label]) => <button key={id} type="button" aria-current={section===id ? "page" : undefined} onClick={()=>go(id)} className={section===id?'is-active':''}>{label}</button>)}
    </div>}

    <section className="admin-context-bar">
      <div>
        <div className="admin-breadcrumb">مدیریت <span>/</span> {activeNav.label}</div>
        <h2 id="admin-section-title">{title}</h2>
        <p>اطلاعات و تغییرات از API مدیریتی و D1 خوانده می‌شوند.</p>
      </div>
      <div className="admin-context-actions">
        <button type="button" onClick={()=>go('system-fee')}><WalletCards className="w-4 h-4"/> تنظیم کارمزد</button>
        <button type="button" onClick={()=>go('users-all')}><Users className="w-4 h-4"/> مدیریت کاربران</button>
        <button type="button" onClick={()=>go('listings-all')}><Package className="w-4 h-4"/> مدیریت آگهی‌ها</button>
      </div>
    </section>

    <main className="admin-main min-w-0">
      {page()}
    </main>
  </div>;
}

function Overview({cards,o,reports,payouts,go}) {
  return <div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-3 gap-3">{cards.map(([l,v,I])=><div key={l} className="rentora-card p-4"><I className="w-4 h-4 text-[#534AB7] mb-3"/><div className="text-lg font-black">{v}</div><div className="text-[10px] text-slate-500 mt-1">{l}</div></div>)}</div>
    <div className="grid md:grid-cols-2 gap-3"><div className="rentora-card p-4"><div className="flex justify-between"><b className="text-sm">هشدارهای عملیاتی</b><AlertTriangle className="w-4 h-4 text-amber-600"/></div><p className="text-xs text-slate-500 mt-3">{o.openAlerts||0} مورد نیازمند بررسی.</p><button onClick={()=>go('reports-open')} className="btn-secondary px-3 py-2 text-[11px] mt-3">مشاهده گزارش‌ها</button></div>
      <div className="rentora-card p-4"><b className="text-sm">چرخه پرداخت</b><div className="flex gap-2 mt-3 flex-wrap">{['reserved','creating','pi_created','approving','approved','completing','completed','reconciliation_required'].map(s=><span key={s} className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px]">{s}: {payouts.filter(p=>p.status===s).length}</span>)}</div></div></div>
    <NeedsAttention reports={reports} payouts={payouts} go={go}/>
  </div>;
}

function NeedsAttention({ reports, payouts, go }) {
  const openReports = reports.filter(r => r.status === 'open').slice(0, 4);
  const payoutIssues = payouts.filter(p => ['failed', 'reconciliation_required'].includes(p.status)).slice(0, 4);
  const items = [
    ...openReports.map(r => ({
      key: 'report-' + r.id,
      title: 'گزارش نیازمند بررسی',
      detail: r.reason || r.target_type || r.id,
      action: () => go('reports-open'),
      icon: AlertTriangle
    })),
    ...payoutIssues.map(p => ({
      key: 'payout-' + p.id,
      title: p.status === 'failed' ? 'پرداخت ناموفق' : 'نیازمند تطبیق پرداخت',
      detail: money(p.amount),
      action: () => go('payout-reconcile'),
      icon: CreditCard
    }))
  ].slice(0, 6);

  return <section className="rentora-card p-4">
    <div className="flex items-center justify-between gap-3">
      <div><h3 className="font-bold text-sm">نیازمند توجه</h3><p className="text-[10px] text-slate-500 mt-1">موارد عملیاتی که قبل از ادامه کار باید بررسی شوند.</p></div>
      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800">{items.length}</span>
    </div>
    {items.length ? <div className="mt-3 space-y-2">{items.map(item => {
      const Icon = item.icon;
      return <button key={item.key} onClick={item.action} className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-right hover:bg-slate-50 dark:hover:bg-slate-900/40">
        <Icon className="w-4 h-4 shrink-0 text-amber-600"/>
        <span className="min-w-0 flex-1"><span className="block text-xs font-bold">{item.title}</span><span className="block text-[10px] text-slate-500 truncate mt-0.5">{item.detail}</span></span>
        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400"/>
      </button>;
    })}</div> : <div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 p-4 text-xs text-slate-500 flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> مورد فوری ثبت نشده است.</div>}
  </section>;
}

function Treasury({t,system,go}) {
  const rows=[['کل درآمد',t.totalRevenue],['قابل استفاده',t.available],['رزروشده',t.reserved],['پرداخت‌شده',t.paidOut]];
  return <div className="space-y-3"><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{rows.map(([l,v])=><div key={l} className="rentora-card p-4"><div className="text-[10px] text-slate-500">{l}</div><div className="text-xl font-black mt-2">{money(v)}</div></div>)}</div>
    <div className="rentora-card p-5"><div className="flex items-center gap-2 font-bold"><Wallet className="w-4 h-4"/>وضعیت کیف پول</div><div className="mt-4 text-xs grid sm:grid-cols-3 gap-3"><span>Pi API: {system.piApiConfigured?'پیکربندی‌شده':'پیکربندی نشده'}</span><span>Available: {money(t.available)}</span><span>Reserved: {money(t.reserved)}</span></div><button type="button" aria-label="ایجاد پرداخت از خزانه" onClick={()=>go('payout-create')} className="btn-primary px-4 py-2 text-xs mt-4">ایجاد پرداخت</button></div></div>;
}

function Payouts({payouts,reconciliation,section,submitPayout,payoutAmount,setPayoutAmount,payoutMemo,setPayoutMemo,walletAddress,setWalletAddress,payoutMessage,retryReconciliation,busyId}) {
  if(section==='payout-create') return <form onSubmit={submitPayout} className="rentora-card p-5 max-w-xl space-y-3"><h3 className="font-bold">ایجاد پرداخت از خزانه</h3><label className="block text-xs font-bold">مبلغ پرداخت (π)<input aria-label="مبلغ پرداخت از خزانه به پی" value={payoutAmount} onChange={e=>setPayoutAmount(e.target.value)} type="number" min="0" step="0.0001" placeholder="مبلغ (π)" className="mt-1 w-full p-3 rounded-lg border bg-transparent text-sm"/></label><label className="block text-xs font-bold">آدرس کیف پول Pi<input aria-label="آدرس کیف پول Pi برای پرداخت خزانه" value={walletAddress} onChange={e=>setWalletAddress(e.target.value)} placeholder="آدرس کیف پول Pi (اختیاری)" className="mt-1 w-full p-3 rounded-lg border bg-transparent text-sm"/></label><label className="block text-xs font-bold">یادداشت پرداخت<input aria-label="یادداشت پرداخت خزانه" value={payoutMemo} onChange={e=>setPayoutMemo(e.target.value)} placeholder="یادداشت" className="mt-1 w-full p-3 rounded-lg border bg-transparent text-sm"/></label>{payoutMessage&&<div className="text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-800">{payoutMessage}</div>}<button className="btn-primary px-4 py-2 text-xs flex items-center gap-2"><ArrowUpRight className="w-4 h-4"/> ثبت پرداخت</button><p className="text-[10px] text-slate-500">پرداخت از مسیر A2U موجود انجام می‌شود و کلید idempotency برای retry حفظ می‌شود.</p></form>;
  let rows=payouts;
  if(section==='payout-pending') rows=rows.filter(x=>['reserved'].includes(x.status));
  if(section==='payout-processing') rows=rows.filter(x=>['creating','pi_created','approving','approved','completing'].includes(x.status));
  if(section==='payout-completed') rows=rows.filter(x=>x.status==='completed');
  if(section==='payout-failed') rows=rows.filter(x=>['cancelled'].includes(x.status) || x.error);
  if(section==='payout-reconcile') rows=reconciliation;
  return <div className="rentora-card overflow-x-auto"><table className="w-full min-w-[820px] text-xs"><thead><tr className="border-b"><th className="p-3 text-right">عملیات</th><th className="p-3 text-right">مبلغ</th><th className="p-3 text-right">Status</th><th className="p-3 text-right">دریافت‌کننده</th><th className="p-3 text-right">آخرین تغییر</th><th className="p-3 text-right">عملیات</th></tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={r.id||i} className="border-b last:border-0"><td className="p-3">{r.operation_key||r.id}</td><td className="p-3">{money(r.amount)}</td><td className="p-3"><Status s={r.status}/></td><td className="p-3">{r.recipient||r.pi_payment_id||'—'}</td><td className="p-3">{date(r.updated_at)}</td><td className="p-3">{section==='payout-reconcile'?<button type="button" aria-label={`تلاش مجدد برای تطبیق پرداخت ${r.id}`} disabled={busyId===r.id} onClick={()=>retryReconciliation(r.id)} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">{busyId===r.id?'...':'تلاش مجدد / حل مشکل'}</button>:'—'}</td></tr>):<tr><td colSpan="6" className="p-8 text-center text-slate-400">موردی وجود ندارد.</td></tr>}</tbody></table></div>;
}

function UsersView({rows,section,busyId,updateUser,deleteUser,onDetails,renderTable}) {
  const verified = rows.filter(r => (r.adminKycStatus || r.kycStatus) === 'verified').length;
  const pending = rows.filter(r => (r.adminKycStatus || r.kycStatus) !== 'verified').length;
  const suspended = rows.filter(r => r.status === 'suspended').length;
  return <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2">
      {[['نمایش', rows.length], ['KYC تاییدشده', verified], ['تعلیق‌شده', suspended]].map(([l,v]) => <div key={l} className="rentora-card p-3"><div className="text-[10px] text-slate-500">{l}</div><div className="text-lg font-black mt-1">{v}</div></div>)}
    </div>
    {section === 'users-kyc' && <div className="p-3 rounded-xl bg-[#EEEDFE] dark:bg-[#211E45] text-xs">صفحه KYC فقط کاربرانی را نشان می‌دهد که هنوز وضعیت تاییدشده ندارند. {pending} مورد در این فهرست است.</div>}
    {renderTable([['نام کاربری',r=>`@${r.username||'—'}`],['Status',r=><Status s={r.status}/>],['احراز هویت',r=><Status s={r.adminKycStatus || r.kycStatus || 'unknown'}/>],['نقش',r=>r.role],['تاریخ عضویت',r=>date(r.created_at||r.joinedDate)],['Actions',r=><div className="flex gap-1 flex-wrap"><button type="button" aria-label={r.status==='active'?`تعلیق کاربر ${r.username||r.id}`:`فعال‌سازی کاربر ${r.username||r.id}`} disabled={busyId===r.id} onClick={()=>updateUser(r,'status')} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">{r.status==='active'?'تعلیق':'فعال‌سازی'}</button><button type="button" aria-label={(r.adminKycStatus || r.kycStatus)==='verified'?`لغو تایید KYC کاربر ${r.username||r.id}`:`تایید KYC کاربر ${r.username||r.id}`} disabled={busyId===r.id} onClick={()=>updateUser(r,'kyc')} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">{(r.adminKycStatus || r.kycStatus)==='verified'?'لغو تأیید':'تأیید احراز هویت'}</button><button type="button" aria-label={`مشاهده جزئیات کاربر ${r.username||r.id}`} onClick={()=>onDetails(r)} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">جزئیات</button>{r.role !== 'admin' && <button type="button" aria-label={`حذف حساب کاربر ${r.username||r.id}`} disabled={busyId===r.id} onClick={()=>deleteUser(r)} className="px-2 py-1 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">حذف حساب</button>}</div>]],rows)}
  </div>;
}
function UserDetails({user,onBack}) {
  if (!user) return <div className="rentora-card p-6 text-sm text-slate-500">کاربری برای نمایش وجود ندارد.</div>;
  const fields=[['نام کاربری',user.username?`@${user.username}`:'—'],['شناسه Pi',user.piUid || user.uid || '—'],['نقش',user.role || 'user'],['Status',user.status || '—'],['احراز هویت',user.adminKycStatus || user.kycStatus || 'unknown'],['تاریخ عضویت',user.joinedDate || user.created_at || '—'],['نام نمایشی',user.displayName || '—'],['موقعیت',user.location || '—'],['معرفی',user.bio || '—']];
  return <div className="space-y-3"><button type="button" aria-label="بازگشت به فهرست کاربران" onClick={onBack} className="btn-secondary px-3 py-2 text-xs">بازگشت به کاربران</button><div className="rentora-card p-5 grid sm:grid-cols-2 gap-4">{fields.map(([label,value])=><div key={label}><div className="text-[10px] text-slate-500">{label}</div><div className="text-sm font-bold mt-1 break-words">{String(value)}</div></div>)}</div></div>;
}
function ListingsView({rows,section,busyId,updateListing,renderTable}) {
  const active=rows.filter(r=>r.status==='active').length;
  const paused=rows.filter(r=>r.status==='paused').length;
  const moderation=rows.filter(r=>['pending','moderation','pending_moderation','review'].includes(r.status)).length;
  return <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2">
      {[['فعال',active],['متوقف',paused],['نظارت و بررسی',moderation]].map(([l,v]) => <div key={l} className="rentora-card p-3"><div className="text-[10px] text-slate-500">{l}</div><div className="text-lg font-black mt-1">{v}</div></div>)}
    </div>
    {section==='listings-moderation' && <div className="p-3 rounded-xl bg-[#EEEDFE] dark:bg-[#211E45] text-xs">صف بررسی محتوا و وضعیت آگهی‌ها. تغییر وضعیت فقط از مسیر مدیریتی و سرویس سمت سرور انجام می‌شود.</div>}
    {renderTable([['Title','title'],['Owner',r=>`@${r.owner_username||'—'}`],['Price',r=>money(r.price_per_day)],['Status',r=><Status s={r.status}/>],['آخرین تغییر',r=>date(r.updated_at)],['عملیات',r=><div className="flex gap-1 flex-wrap"><button type="button" aria-label={`${r.status==='active'?'توقف' : 'فعال‌سازی'} آگهی ${r.title||r.id}`} disabled={busyId===r.id} onClick={()=>updateListing(r)} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">{r.status==='active'?'توقف':'فعال‌سازی'}</button>{r.status!=='deleted'&&<button type="button" aria-label={`حذف آگهی ${r.title||r.id}`} disabled={busyId===r.id} onClick={()=>updateListing(r,'deleted')} className="px-2 py-1 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">حذف</button>}</div>]],rows,section==='listings-moderation'?'آگهی‌ای در صف بررسی نیست.':'آگهی‌ای وجود ندارد.')}
  </div>;
}
function ReportsView({rows,busyId,updateReport,renderTable}) {
  const open=rows.filter(r=>r.status==='open').length;
  const reviewing=rows.filter(r=>r.status==='reviewing').length;
  const resolved=rows.filter(r=>['resolved','dismissed'].includes(r.status)).length;
  return <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2">
      {[['باز',open],['در حال بررسی',reviewing],['حل‌شده',resolved]].map(([l,v]) => <div key={l} className="rentora-card p-3"><div className="text-[10px] text-slate-500">{l}</div><div className="text-lg font-black mt-1">{v}</div></div>)}
    </div>
    <div className="p-3 rounded-xl bg-[#EEEDFE] dark:bg-[#211E45] text-xs">گزارش‌ها برای بررسی Trust & Safety دسته‌بندی شده‌اند. تغییر وضعیت فقط از مسیر مدیریتی انجام می‌شود و نتیجه مستقیماً از API دریافت می‌شود.</div>
    {renderTable([
      ['گزارش‌دهنده',r=>`@${r.reporter_username||'—'}`],
      ['هدف',r=>`${r.target_type||'—'} / ${r.target_id||'—'}`],
      ['دلیل','reason'],
      ['Status',r=><Status s={r.status}/>],
      ['تاریخ',r=>date(r.created_at)],
      ['عملیات',r=><div className="flex gap-1 flex-wrap">
        {r.status==='open'&&<button type="button" aria-label={`انتقال گزارش ${r.id} به بررسی`} disabled={busyId===r.id} onClick={()=>updateReport(r,'reviewing')} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">بررسی</button>}
        {r.status==='reviewing'&&<button type="button" aria-label={`بستن گزارش ${r.id}`} disabled={busyId===r.id} onClick={()=>updateReport(r,'resolved')} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">حل کردن</button>}
      </div>]
    ],rows,'گزارشی در این وضعیت وجود ندارد.')}
  </div>;
}
function AuditView({audit}) {
  const actions = audit.reduce((m, r) => { const k = r.action || 'unknown'; m[k] = (m[k] || 0) + 1; return m; }, {});
  const recent = audit.slice(0, 8);
  return <div className="space-y-3">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {[['کل رویدادها',audit.length],['مدیران',new Set(audit.map(r=>r.adminUsername).filter(Boolean)).size],['نوع عملیات',Object.keys(actions).length],['اخیر',recent.length]].map(([l,v])=><div key={l} className="rentora-card p-3"><div className="text-[10px] text-slate-500">{l}</div><div className="text-lg font-black mt-1">{v}</div></div>)}
    </div>
    <div className="p-3 rounded-xl bg-[#EEEDFE] dark:bg-[#211E45] text-xs">Audit Logs برای مشاهده رویدادهای مدیریتی است. این نما داده‌های ثبت‌شده را فقط نمایش می‌دهد و هیچ رکورد یا وضعیت عملیاتی را تغییر نمی‌دهد.</div>
    <div className="rentora-card overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead><tr className="border-b"><th className="p-3 text-right">زمان</th><th className="p-3 text-right">مدیر</th><th className="p-3 text-right">عملیات</th><th className="p-3 text-right">جزئیات</th></tr></thead><tbody>{audit.length?audit.map((r,i)=><tr key={r.id||i} className="border-b last:border-0"><td className="p-3">{date(r.timestamp||r.created_at)}</td><td className="p-3">@{r.adminUsername||'—'}</td><td className="p-3 font-bold">{r.action||'—'}</td><td className="p-3 max-w-[420px] truncate">{JSON.stringify(r.details||{})}</td></tr>):<tr><td colSpan="4" className="p-8 text-center text-slate-400">رویداد مدیریتی ثبت نشده است.</td></tr>}</tbody></table></div>
  </div>;
}

function SystemView({system,section,onCleanup,feeRatePercent,setFeeRatePercent,feeSaving,feeMessage,saveFeeRate}) {
  if(section==='system-db') return <div className="rentora-card p-5"><div className="flex items-center gap-2 font-bold"><Database className="w-4 h-4"/>نگهداری پایگاه داده</div><p className="text-xs text-slate-500 mt-2">پاکسازی فقط رکوردهای stale تعریف‌شده در backend را هدف می‌گیرد.</p><button type="button" aria-label="اجرای پاکسازی پایگاه داده" onClick={onCleanup} className="btn-primary px-4 py-2 text-xs mt-4">اجرای پاکسازی</button></div>;
  if(section==='system-fee') return <div className="space-y-3">
    <form onSubmit={saveFeeRate} className="rentora-card p-5 max-w-2xl space-y-4">
      <div><h3 className="font-bold">کارمزد پلتفرم</h3><p className="text-xs text-slate-500 mt-1">نرخ کارمزد پلتفرم بین ۱٪ تا ۵٪ تنظیم می‌شود. مبلغ نهایی همیشه بر اساس قیمت معتبر سرور محاسبه می‌شود.</p></div>
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="text-xs font-bold">نرخ کارمزد (%)<input value={feeRatePercent} onChange={e=>setFeeRatePercent(e.target.value)} type="number" min="1" max="5" step="0.01" inputMode="decimal" className="mt-2 w-full p-3 rounded-lg border bg-transparent text-sm" />
        </label>
        <div className="px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm font-black">{Number(feeRatePercent||0).toFixed(2)}%</div>
      </div>
      <div className="p-3 rounded-lg bg-[#EEEDFE] dark:bg-[#211E45] text-xs">نمونه: قیمت 100 π با نرخ {Number(feeRatePercent||0).toFixed(2)}٪ → کارمزد {Number((100 * Number(feeRatePercent||0) / 100).toFixed(4))} π</div>
      {feeMessage && <div className="text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-800">{feeMessage}</div>}
      <button disabled={feeSaving} className="btn-primary px-4 py-2 text-xs">{feeSaving ? 'در حال ذخیره...' : 'ذخیره نرخ کارمزد'}</button>
    </form>
    <div className="grid md:grid-cols-2 gap-3">{[['D1',system.d1Configured?'آماده':'ناقص'],['KV',system.kvConfigured?'آماده':'ناقص'],['R2',system.r2Configured?'آماده':'اختیاری'],['API Pi',system.piApiConfigured?'پیکربندی‌شده':'ناقص']].map(([l,v])=><div key={l} className="rentora-card p-4"><div className="text-[10px] text-slate-500">{l}</div><div className="font-bold mt-1">{v}</div></div>)}</div>
  </div>;
  return <div className="grid md:grid-cols-2 gap-3">{[['کارمزد پلتفرم',`${(Number(feeRatePercent||system.platformFeeRate||0)).toFixed(2)}%`],['D1',system.d1Configured?'آماده':'ناقص'],['KV',system.kvConfigured?'آماده':'ناقص'],['R2',system.r2Configured?'آماده':'اختیاری'],['API Pi',system.piApiConfigured?'پیکربندی‌شده':'ناقص']].map(([l,v])=><div key={l} className="rentora-card p-4"><div className="text-[10px] text-slate-500">{l}</div><div className="font-bold mt-1">{v}</div></div>)}</div>;
}
function Status({s}) { return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800"><span className="w-1.5 h-1.5 rounded-full bg-current"/>{statusLabel(s)}</span>; }
