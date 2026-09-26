import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard, WalletCards, ArrowUpRight, Users, Package, AlertTriangle,
  CreditCard, ShieldCheck, Settings, RefreshCw, Lock, Search, CheckCircle2,
  XCircle, Clock3, Activity, Database, Wallet, ChevronDown, Loader2, Wrench
} from 'lucide-react';
import { usePiAuth } from '../context/PiAuthContext';
import { getApiBaseUrl } from '../services/apiConfig';
import { cloudSyncService } from '../services/cloudSyncService';

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'treasury', label: 'Treasury', icon: WalletCards, children: [
    ['treasury-total', 'Total Revenue'], ['treasury-available', 'Available'],
    ['treasury-reserved', 'Reserved'], ['treasury-paid', 'Paid Out'], ['treasury-wallet', 'Wallet Status']
  ]},
  { id: 'payouts', label: 'Payouts', icon: ArrowUpRight, children: [
    ['payout-create', 'Create Payout'], ['payout-pending', 'Pending'], ['payout-processing', 'Processing'],
    ['payout-completed', 'Completed'], ['payout-failed', 'Failed'], ['payout-reconcile', 'Reconciliation']
  ]},
  { id: 'users', label: 'Users', icon: Users, children: [['users-all','All Users'],['users-kyc','KYC'],['users-suspended','Suspended'],['users-details','User Details']]},
  { id: 'listings', label: 'Listings', icon: Package, children: [['listings-all','All'],['listings-active','Active'],['listings-paused','Paused'],['listings-moderation','Moderation']]},
  { id: 'reports', label: 'Reports', icon: AlertTriangle, children: [['reports-open','Open'],['reports-reviewing','Reviewing'],['reports-resolved','Resolved']]},
  { id: 'transactions', label: 'Transactions', icon: CreditCard, children: [['tx-fees','Platform Fees'],['tx-payouts','Payouts'],['tx-details','TX Details']]},
  { id: 'audit', label: 'Audit Logs', icon: ShieldCheck },
  { id: 'system', label: 'System', icon: Settings, children: [['system-fee','Platform Fee'],['system-health','Backend Health'],['system-db','Database Maintenance'],['system-pi','Pi Integration']]}
];

function money(v) { return `${Number(v || 0).toFixed(4)} π`; }
function date(v) { if (!v) return '—'; try { return new Date(v).toLocaleString('fa-IR'); } catch { return v; } }
function statusLabel(s) {
  const map = { open:'Open', reviewing:'Reviewing', resolved:'Resolved', dismissed:'Dismissed', completed:'Completed',
    reserved:'Reserved', creating:'Creating', pi_created:'Pi Created', approving:'Approving', approved:'Approved',
    completing:'Completing', reconciliation_required:'Reconciliation', cancelled:'Cancelled', active:'Active', paused:'Paused',
    suspended:'Suspended', failed:'Failed' };
  return map[s] || s || '—';
}

export default function AdminDashboardPage({ onNavigate }) {
  const { isAdmin, currentUser } = usePiAuth();
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
      const res = await fetch(`${api}/api/admin/console?_t=${Date.now()}`, { headers: headers(), cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'دریافت داده‌های پنل مدیر ممکن نیست.');
      setData(json);
    } catch (e) { setError(e.message || 'خطای اتصال به پنل مدیریت'); }
    finally { setLoading(false); }
  }, [api, headers, isAdmin]);

  useEffect(() => {
    load();
    if (isAdmin && api) {
      fetch(api + '/api/admin/platform-fee?_t=' + Date.now(), { headers: headers(), cache: 'no-store' })
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
  const title = section.includes('-') ? (currentParent?.children?.find(c => c[0] === section)?.[1] || currentParent?.label) : (currentParent?.label || 'Overview');

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

  const updateListing = async (item) => {
    setBusyId(item.id);
    try {
      const next = item.status === 'active' ? 'paused' : 'active';
      await cloudSyncService.setAdminListingStatus(item.id, next);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(''); }
  };

  const updateReport = async (report, status) => {
    setBusyId(report.id);
    try {
      const res = await fetch(`${api}/api/admin/reports/${encodeURIComponent(report.id)}/status`, {
        method:'POST', headers:headers(), body:JSON.stringify({ status })
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
      const res = await fetch(`${api}/api/admin/reconciliation/${encodeURIComponent(queueId)}/retry`, { method:'POST', headers:headers() });
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
        method: 'POST', headers: headers(), body: JSON.stringify({ ratePercent: value })
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

  if (!isAdmin) return <div className="py-20 text-center"><Lock className="w-10 h-10 mx-auto text-rose-500 mb-3"/><h2 className="font-bold">دسترسی غیرمجاز (403)</h2></div>;

  if (loading && !data) return <div className="py-24 text-center"><Loader2 className="w-7 h-7 mx-auto animate-spin text-[#534AB7]"/><p className="mt-3 text-xs text-slate-500">در حال بارگذاری مرکز مدیریت...</p></div>;

  if (error && !data) return <div className="rentora-card p-6 text-center"><AlertTriangle className="w-8 h-8 mx-auto text-rose-500 mb-2"/><p className="text-sm">{error}</p><button onClick={load} className="btn-primary px-4 py-2 mt-4 text-xs">تلاش دوباره</button></div>;

  const o = data?.overview || {};
  const t = data?.treasury || {};
  const users = data?.users || [], listings = data?.listings || [], rentals = data?.rentals || [];
  const reports = data?.reports || [], txs = data?.transactions || [], payouts = data?.payouts || [];
  const audit = data?.auditLogs || [], reconciliation = data?.reconciliation || [], system = data?.system || {};
  const q = query.trim().toLowerCase();

  const filtered = (rows, fields) => rows.filter(r => !q || fields.some(f => String(r?.[f] ?? '').toLowerCase().includes(q)));

  const cards = [
    ['Users', o.users, Users], ['Listings', o.listings, Package], ['Rentals', o.rentals, Activity],
    ['Revenue', money(o.revenue), WalletCards], ['Available Treasury', money(o.availableTreasury), Wallet], ['Active Alerts', o.openAlerts, AlertTriangle]
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
      return <UsersView rows={rows} section={section} busyId={busyId} updateUser={updateUser} onDetails={(u)=>{setSelectedUserId(u.id || u.uid); go('users-details')}} renderTable={renderTable}/>;
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
      return renderTable([['ID','id'],['Type',r=>statusLabel(r.type)],['Amount',r=>money(r.amount)],['Status',r=>statusLabel(r.status)],['Pi Payment','pi_payment_id'],['TXID','pi_txid'],['Date',r=>date(r.created_at)]],rows);
    }
    if(section==='audit') return renderTable([['Time',r=>date(r.timestamp)],['Admin',r=>r.adminUsername],['Action',r=>r.action],['Details',r=>JSON.stringify(r.details||{})]],filtered(audit,['adminUsername','action']));
    if(section.startsWith('system')) return <SystemView system={system} section={section} onCleanup={async()=>{try{await cloudSyncService.cleanupDatabase();await load();}catch(e){setError(e.message)}}} feeRatePercent={feeRatePercent} setFeeRatePercent={setFeeRatePercent} feeSaving={feeSaving} feeMessage={feeMessage} saveFeeRate={saveFeeRate}/>;
    return null;
  };

  return <div className="space-y-4 pb-16 max-w-7xl mx-auto" dir="rtl">
    <header className="rentora-card p-4 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
      <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-[#26215C] text-white flex items-center justify-center"><LayoutDashboard className="w-5 h-5"/></div>
        <div><h1 className="font-bold text-lg">مرکز مدیریت Rentora</h1><p className="text-[11px] text-slate-500">مدیریت عملیاتی، خزانه، پرداخت و نظارت</p></div></div>
      <div className="flex gap-2"><div className="relative"><Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جستجو..." className="h-9 w-48 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent pr-9 pl-3 text-xs"/></div>
        <button onClick={load} className="h-9 px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/> رفرش</button></div>
    </header>
    {error && <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs flex gap-2"><AlertTriangle className="w-4 h-4"/>{error}</div>}
    <div className="grid lg:grid-cols-[245px_1fr] gap-4">
      <aside className="rentora-card p-2 h-fit lg:sticky lg:top-3">
        {NAV.map(n => { const Icon=n.icon, open=expanded[n.id] || section===n.id || n.children?.some(c=>c[0]===section); return <div key={n.id}>
          <button onClick={()=> n.children ? setExpanded(e=>({...e,[n.id]:!open})) : go(n.id)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold ${section===n.id?'bg-[#EEEDFE] text-[#26215C] dark:bg-[#211E45] dark:text-white':''}`}>
            <Icon className="w-4 h-4"/><span className="flex-1 text-right">{n.label}</span>{n.children&&<ChevronDown className={`w-3.5 h-3.5 transition ${open?'rotate-180':''}`}/>}
          </button>
          {open&&n.children&&<div className="mr-4 border-r pr-2 border-slate-200 dark:border-slate-700">{n.children.map(c=><button key={c[0]} onClick={()=>go(c[0])} className={`block w-full text-right px-3 py-2 rounded-md text-[11px] ${section===c[0]?'font-bold text-[#534AB7] bg-slate-50 dark:bg-[#1b1930]':'text-slate-500'}`}>{c[1]}</button>)}</div>}
        </div>})}
      </aside>
      <main className="min-w-0"><div className="mb-3"><h2 className="text-base font-bold">{title}</h2><p className="text-[11px] text-slate-500">داده‌ها مستقیماً از API مدیریتی و D1 خوانده می‌شوند.</p></div>{page()}</main>
    </div>
  </div>;
}

function Overview({cards,o,reports,payouts,go}) {
  return <div className="space-y-4"><div className="grid grid-cols-2 md:grid-cols-3 gap-3">{cards.map(([l,v,I])=><div key={l} className="rentora-card p-4"><I className="w-4 h-4 text-[#534AB7] mb-3"/><div className="text-lg font-black">{v}</div><div className="text-[10px] text-slate-500 mt-1">{l}</div></div>)}</div>
    <div className="grid md:grid-cols-2 gap-3"><div className="rentora-card p-4"><div className="flex justify-between"><b className="text-sm">Operational Alerts</b><AlertTriangle className="w-4 h-4 text-amber-600"/></div><p className="text-xs text-slate-500 mt-3">{o.openAlerts||0} مورد نیازمند بررسی.</p><button onClick={()=>go('reports-open')} className="btn-secondary px-3 py-2 text-[11px] mt-3">مشاهده گزارش‌ها</button></div>
      <div className="rentora-card p-4"><b className="text-sm">Payout Pipeline</b><div className="flex gap-2 mt-3 flex-wrap">{['reserved','creating','pi_created','approving','approved','completing','completed','reconciliation_required'].map(s=><span key={s} className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px]">{s}: {payouts.filter(p=>p.status===s).length}</span>)}</div></div></div>
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
      <div><h3 className="font-bold text-sm">Needs Attention</h3><p className="text-[10px] text-slate-500 mt-1">موارد عملیاتی که قبل از ادامه کار باید بررسی شوند.</p></div>
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
  const rows=[['Total Revenue',t.totalRevenue],['Available',t.available],['Reserved',t.reserved],['Paid Out',t.paidOut]];
  return <div className="space-y-3"><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{rows.map(([l,v])=><div key={l} className="rentora-card p-4"><div className="text-[10px] text-slate-500">{l}</div><div className="text-xl font-black mt-2">{money(v)}</div></div>)}</div>
    <div className="rentora-card p-5"><div className="flex items-center gap-2 font-bold"><Wallet className="w-4 h-4"/> Wallet Status</div><div className="mt-4 text-xs grid sm:grid-cols-3 gap-3"><span>Pi API: {system.piApiConfigured?'Configured':'Not configured'}</span><span>Available: {money(t.available)}</span><span>Reserved: {money(t.reserved)}</span></div><button onClick={()=>go('payout-create')} className="btn-primary px-4 py-2 text-xs mt-4">Create Payout</button></div></div>;
}

function Payouts({payouts,reconciliation,section,submitPayout,payoutAmount,setPayoutAmount,payoutMemo,setPayoutMemo,walletAddress,setWalletAddress,payoutMessage,retryReconciliation,busyId}) {
  if(section==='payout-create') return <form onSubmit={submitPayout} className="rentora-card p-5 max-w-xl space-y-3"><h3 className="font-bold">Create Treasury Payout</h3><input value={payoutAmount} onChange={e=>setPayoutAmount(e.target.value)} type="number" min="0" step="0.0001" placeholder="Amount (π)" className="w-full p-3 rounded-lg border bg-transparent text-sm"/><input value={walletAddress} onChange={e=>setWalletAddress(e.target.value)} placeholder="Pi wallet address (optional)" className="w-full p-3 rounded-lg border bg-transparent text-sm"/><input value={payoutMemo} onChange={e=>setPayoutMemo(e.target.value)} placeholder="Memo" className="w-full p-3 rounded-lg border bg-transparent text-sm"/>{payoutMessage&&<div className="text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-800">{payoutMessage}</div>}<button className="btn-primary px-4 py-2 text-xs flex items-center gap-2"><ArrowUpRight className="w-4 h-4"/> ثبت پرداخت</button><p className="text-[10px] text-slate-500">پرداخت از مسیر A2U موجود انجام می‌شود و کلید idempotency برای retry حفظ می‌شود.</p></form>;
  let rows=payouts;
  if(section==='payout-pending') rows=rows.filter(x=>['reserved'].includes(x.status));
  if(section==='payout-processing') rows=rows.filter(x=>['creating','pi_created','approving','approved','completing'].includes(x.status));
  if(section==='payout-completed') rows=rows.filter(x=>x.status==='completed');
  if(section==='payout-failed') rows=rows.filter(x=>['cancelled'].includes(x.status) || x.error);
  if(section==='payout-reconcile') rows=reconciliation;
  return <div className="rentora-card overflow-x-auto"><table className="w-full min-w-[820px] text-xs"><thead><tr className="border-b"><th className="p-3 text-right">Operation</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Status</th><th className="p-3 text-right">Recipient</th><th className="p-3 text-right">Updated</th><th className="p-3 text-right">Action</th></tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={r.id||i} className="border-b last:border-0"><td className="p-3">{r.operation_key||r.id}</td><td className="p-3">{money(r.amount)}</td><td className="p-3"><Status s={r.status}/></td><td className="p-3">{r.recipient||r.pi_payment_id||'—'}</td><td className="p-3">{date(r.updated_at)}</td><td className="p-3">{section==='payout-reconcile'?<button disabled={busyId===r.id} onClick={()=>retryReconciliation(r.id)} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">{busyId===r.id?'...':'Retry / Resolve'}</button>:'—'}</td></tr>):<tr><td colSpan="6" className="p-8 text-center text-slate-400">موردی وجود ندارد.</td></tr>}</tbody></table></div>;
}

function UsersView({rows,section,busyId,updateUser,onDetails,renderTable}) {
  const verified = rows.filter(r => r.kycStatus === 'verified').length;
  const pending = rows.filter(r => r.kycStatus && r.kycStatus !== 'verified').length;
  const suspended = rows.filter(r => r.status === 'suspended').length;
  return <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2">
      {[['نمایش', rows.length], ['KYC تاییدشده', verified], ['تعلیق‌شده', suspended]].map(([l,v]) => <div key={l} className="rentora-card p-3"><div className="text-[10px] text-slate-500">{l}</div><div className="text-lg font-black mt-1">{v}</div></div>)}
    </div>
    {section === 'users-kyc' && <div className="p-3 rounded-xl bg-[#EEEDFE] dark:bg-[#211E45] text-xs">صفحه KYC فقط کاربرانی را نشان می‌دهد که هنوز وضعیت تاییدشده ندارند. {pending} مورد در این فهرست است.</div>}
    {renderTable([['Username',r=>`@${r.username||'—'}`],['Status',r=><Status s={r.status}/>],['KYC',r=><Status s={r.kycStatus||'unknown'}/>],['Role',r=>r.role],['Joined',r=>date(r.created_at||r.joinedDate)],['Actions',r=><div className="flex gap-1 flex-wrap"><button disabled={busyId===r.id} onClick={()=>updateUser(r,'status')} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">{r.status==='active'?'Suspend':'Activate'}</button><button disabled={busyId===r.id} onClick={()=>updateUser(r,'kyc')} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">{r.kycStatus==='verified'?'Unverify':'Verify KYC'}</button><button onClick={()=>onDetails(r)} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">Details</button></div>]],rows)}
  </div>;
}
function UserDetails({user,onBack}) {
  if (!user) return <div className="rentora-card p-6 text-sm text-slate-500">کاربری برای نمایش وجود ندارد.</div>;
  const fields=[['Username',user.username?`@${user.username}`:'—'],['Pi UID',user.piUid || user.uid || '—'],['Role',user.role || 'user'],['Status',user.status || '—'],['KYC',user.kycStatus || 'unknown'],['Joined',user.joinedDate || user.created_at || '—'],['Display Name',user.displayName || '—'],['Location',user.location || '—'],['Bio',user.bio || '—']];
  return <div className="space-y-3"><button onClick={onBack} className="btn-secondary px-3 py-2 text-xs">بازگشت به کاربران</button><div className="rentora-card p-5 grid sm:grid-cols-2 gap-4">{fields.map(([label,value])=><div key={label}><div className="text-[10px] text-slate-500">{label}</div><div className="text-sm font-bold mt-1 break-words">{String(value)}</div></div>)}</div></div>;
}
function ListingsView({rows,section,busyId,updateListing,renderTable}) {
  const active=rows.filter(r=>r.status==='active').length;
  const paused=rows.filter(r=>r.status==='paused').length;
  const moderation=rows.filter(r=>['pending','moderation','pending_moderation','review'].includes(r.status)).length;
  return <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2">
      {[['Active',active],['Paused',paused],['Moderation',moderation]].map(([l,v]) => <div key={l} className="rentora-card p-3"><div className="text-[10px] text-slate-500">{l}</div><div className="text-lg font-black mt-1">{v}</div></div>)}
    </div>
    {section==='listings-moderation' && <div className="p-3 rounded-xl bg-[#EEEDFE] dark:bg-[#211E45] text-xs">صف بررسی محتوا و وضعیت آگهی‌ها. تغییر وضعیت فقط از مسیر مدیریتی و سرویس سمت سرور انجام می‌شود.</div>}
    {renderTable([['Title','title'],['Owner',r=>`@${r.owner_username||'—'}`],['Price',r=>money(r.price_per_day)],['Status',r=><Status s={r.status}/>],['Updated',r=>date(r.updated_at)],['Action',r=><button disabled={busyId===r.id} onClick={()=>updateListing(r)} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">{r.status==='active'?'Pause':'Activate'}</button>]],rows,section==='listings-moderation'?'آگهی‌ای در صف بررسی نیست.':'آگهی‌ای وجود ندارد.')}
  </div>;
}
function ReportsView({rows,busyId,updateReport,renderTable}) { return renderTable([['Reporter',r=>`@${r.reporter_username||'—'}`],['Target',r=>`${r.target_type} / ${r.target_id}`],['Reason','reason'],['Status',r=><Status s={r.status}/>],['Date',r=>date(r.created_at)],['Action',r=><div className="flex gap-1">{r.status==='open'&&<button disabled={busyId===r.id} onClick={()=>updateReport(r,'reviewing')} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">Review</button>}{r.status==='reviewing'&&<button disabled={busyId===r.id} onClick={()=>updateReport(r,'resolved')} className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">Resolve</button>}</div>]],rows); }
function SystemView({system,section,onCleanup,feeRatePercent,setFeeRatePercent,feeSaving,feeMessage,saveFeeRate}) {
  if(section==='system-db') return <div className="rentora-card p-5"><div className="flex items-center gap-2 font-bold"><Database className="w-4 h-4"/> Database Maintenance</div><p className="text-xs text-slate-500 mt-2">پاکسازی فقط رکوردهای stale تعریف‌شده در backend را هدف می‌گیرد.</p><button onClick={onCleanup} className="btn-primary px-4 py-2 text-xs mt-4">Run Cleanup</button></div>;
  if(section==='system-fee') return <div className="space-y-3">
    <form onSubmit={saveFeeRate} className="rentora-card p-5 max-w-2xl space-y-4">
      <div><h3 className="font-bold">Platform Fee</h3><p className="text-xs text-slate-500 mt-1">نرخ کارمزد پلتفرم بین ۱٪ تا ۵٪ تنظیم می‌شود. مبلغ نهایی همیشه بر اساس قیمت معتبر سرور محاسبه می‌شود.</p></div>
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="text-xs font-bold">Fee rate (%)
          <input value={feeRatePercent} onChange={e=>setFeeRatePercent(e.target.value)} type="number" min="1" max="5" step="0.01" inputMode="decimal" className="mt-2 w-full p-3 rounded-lg border bg-transparent text-sm" />
        </label>
        <div className="px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm font-black">{Number(feeRatePercent||0).toFixed(2)}%</div>
      </div>
      <div className="p-3 rounded-lg bg-[#EEEDFE] dark:bg-[#211E45] text-xs">نمونه: قیمت 100 π با نرخ {Number(feeRatePercent||0).toFixed(2)}٪ → کارمزد {Number((100 * Number(feeRatePercent||0) / 100).toFixed(4))} π</div>
      {feeMessage && <div className="text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-800">{feeMessage}</div>}
      <button disabled={feeSaving} className="btn-primary px-4 py-2 text-xs">{feeSaving ? 'در حال ذخیره...' : 'ذخیره نرخ کارمزد'}</button>
    </form>
    <div className="grid md:grid-cols-2 gap-3">{[['D1',system.d1Configured?'Ready':'Missing'],['KV',system.kvConfigured?'Ready':'Missing'],['R2',system.r2Configured?'Ready':'Optional'],['Pi API',system.piApiConfigured?'Configured':'Missing']].map(([l,v])=><div key={l} className="rentora-card p-4"><div className="text-[10px] text-slate-500">{l}</div><div className="font-bold mt-1">{v}</div></div>)}</div>
  </div>;
  return <div className="grid md:grid-cols-2 gap-3">{[['Platform Fee',`${(Number(feeRatePercent||system.platformFeeRate||0)).toFixed(2)}%`],['D1',system.d1Configured?'Ready':'Missing'],['KV',system.kvConfigured?'Ready':'Missing'],['R2',system.r2Configured?'Ready':'Optional'],['Pi API',system.piApiConfigured?'Configured':'Missing']].map(([l,v])=><div key={l} className="rentora-card p-4"><div className="text-[10px] text-slate-500">{l}</div><div className="font-bold mt-1">{v}</div></div>)}</div>;
}
function Status({s}) { return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800"><span className="w-1.5 h-1.5 rounded-full bg-current"/>{statusLabel(s)}</span>; }
