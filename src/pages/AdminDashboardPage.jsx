import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { getApiBaseUrl } from '../services/apiConfig';
import { cloudSyncService } from '../services/cloudSyncService';
import { piService } from '../services/piService';
import EmptyState from '../components/EmptyState';
import { 
  LayoutDashboard, 
  Layers, 
  CreditCard, 
  ShieldAlert, 
  Save, 
  Check, 
  Percent, 
  Lock, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  UserX, 
  Users, 
  ShieldCheck, 
  AlertTriangle, 
  RotateCw, 
  Database, 
  RefreshCw, 
  AlertOctagon, 
  Sparkles, 
  UserCheck, 
  Globe, 
  Wifi,
  UploadCloud,
  Edit3,
  Loader2,
  AlertCircle
} from 'lucide-react';

export default function AdminDashboardPage({ onNavigate, onOpenPublicProfile, onEditItem }) {
  const { lang, dir, t, l } = useLanguage();
  const { isAdmin, currentUser, toggleUserStatus, moderateListingStatus, logout, loginWithPi } = usePiAuth();
  const { 
    items = [], 
    rentals = [], 
    transactions = [], 
    reports = [], 
    platformConfig, 
    updatePlatformConfig, 
    deleteItem, 
    resolveReport, 
    purgeDatabase, 
    refreshApp, 
    isRefreshing 
  } = useRentora();

  const [activeTab, setActiveTab] = useState('overview');
  const [commissionPercent, setCommissionPercent] = useState(platformConfig?.platformFeePercentage !== undefined ? platformConfig.platformFeePercentage : 5);
  const [minFeeFloor, setMinFeeFloor] = useState(platformConfig?.minFeePi !== undefined ? platformConfig.minFeePi : 0.0001);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [purgeSuccessNotice, setPurgeSuccessNotice] = useState(false);
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);

  // Admin server-side data states
  const [adminOverview, setAdminOverview] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [loadingAdminData, setLoadingAdminData] = useState(true);
  const [adminAuthError, setAdminAuthError] = useState(false);

  // Backend URL state
  const [backendUrlInput, setBackendUrlInput] = useState(getApiBaseUrl());
  const [backendTestStatus, setBackendTestStatus] = useState(null); // 'testing' | 'success' | 'error'
  const [backendTestMsg, setBackendTestMsg] = useState('');

  // Treasury Payout state (A2U)
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMemo, setPayoutMemo] = useState('');
  const [adminWalletAddress, setAdminWalletAddress] = useState(() => {
    try { return localStorage.getItem('rentora_admin_wallet_addr') || ''; }
    catch (_) { return ''; }
  });
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState('');
  const [payoutTxid, setPayoutTxid] = useState('');
  const [payoutErrorMsg, setPayoutErrorMsg] = useState('');
  const [needsWalletAuth, setNeedsWalletAuth] = useState(false);

  // Stable Idempotency-Key tracking across retries for the active payout operation
  const activePayoutKeyRef = useRef(null);

  const getOrCreatePayoutKey = useCallback(() => {
    if (!activePayoutKeyRef.current) {
      activePayoutKeyRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `admin_payout_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
    return activePayoutKeyRef.current;
  }, []);

  // Database Cleanup state
  const [isCleaningDb, setIsCleaningDb] = useState(false);
  const [cleanupResultMsg, setCleanupResultMsg] = useState('');

  const handleCleanupDatabase = async () => {
    setIsCleaningDb(true);
    setCleanupResultMsg('');
    try {
      const res = await cloudSyncService.cleanupDatabase();
      const count = res.cleaned?.staleRentalsCancelled || 0;
      setCleanupResultMsg(l(
        `پاکسازی با موفقیت انجام شد: ${count} رزرو معلق و منقضی لغو گردید.`,
        `Database cleanup successful: ${count} stale pending rentals cancelled.`,
        `تم تنظيف قاعدة البيانات بنجاح: تم إلغاء ${count} حجوزات معلقة.`,
        `数据库清理成功：已取消 ${count} 条过期未付款订单。`
      ));
      await loadAdminServerData();
      setTimeout(() => setCleanupResultMsg(''), 5000);
    } catch (err) {
      setCleanupResultMsg(err?.message || 'خطا در پاکسازی دیتابیس');
    } finally {
      setIsCleaningDb(false);
    }
  };

  const loadAdminServerData = async (silent = false) => {
    if (!silent && !adminOverview) {
      setLoadingAdminData(true);
    }
    setAdminAuthError(false);
    try {
      const [overviewData, usersData] = await Promise.all([
        cloudSyncService.fetchAdminOverview(),
        cloudSyncService.fetchAdminUsers()
      ]);
      setAdminOverview(overviewData || null);
      setAdminUsers(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        setAdminAuthError(true);
      }
    } finally {
      setLoadingAdminData(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAdminServerData(true);
    }
  }, [isAdmin, activeTab]);

  const handleToggleUserKyc = async (u) => {
    if (!u?.id && !u?.uid) return;
    const currentKyc = u.kycStatus === 'verified' || u.isKyced === true;
    const newKycStatus = currentKyc ? 'unverified' : 'verified';
    try {
      const targetId = u.id || u.uid;
      const updatedUser = await cloudSyncService.setAdminUserKycStatus(targetId, newKycStatus);
      setAdminUsers(prev => prev.map(user => (user.id === targetId || user.uid === targetId) ? { ...user, ...updatedUser, kycStatus: newKycStatus } : user));
    } catch (err) {
      alert(err.message || 'خطا در تغییر وضعیت احراز هویت');
    }
  };

  const allRealUsers = useMemo(() => {
    // The admin API is the sole source of truth.
    if (Array.isArray(adminUsers)) return adminUsers;
    return [];
  }, [adminUsers, currentUser]);

  // Strict 403 for non-admins
  if (!isAdmin || adminAuthError) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4 animate-fadeIn select-none">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center border border-rose-200 dark:border-rose-900 shadow-sm">
          <Lock className="w-7 h-7 stroke-[1.8]" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {l('دسترسی غیرمجاز (۴۰۳)', 'Access Restricted (403)', 'غير مصرح بالدخول (403)', '访问受限 (403)')}
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {l('این بخش اختصاصی مدیر کل رنتورا (@avina60) است.', 'This panel is restricted to master administrators.', 'هذه اللوحة مخصصة للمدير العام فقط.', '此面板仅对主管理员开放。')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="btn-primary px-4 py-2 text-xs font-bold cursor-pointer"
        >
          {t('emptyBackHome')}
        </button>
      </div>
    );
  }

  const totalCommissionRevenue = adminOverview?.totalPlatformRevenue !== undefined
    ? adminOverview.totalPlatformRevenue
    : (transactions || []).reduce((sum, tx) => sum + (tx.platformFee || tx.amount || 0), 0);

  const availableTreasuryBalance = Number(
    adminOverview?.availableBalance !== undefined 
      ? adminOverview.availableBalance 
      : (adminOverview?.totalPlatformRevenue !== undefined ? adminOverview.totalPlatformRevenue : totalCommissionRevenue)
  );

  const handleSaveCommission = (e) => {
    e.preventDefault();
    if (updatePlatformConfig) {
      updatePlatformConfig({
        platformFeePercentage: parseFloat(commissionPercent) || 0,
        minFeePi: parseFloat(minFeeFloor) || 0.0001
      });
    }
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2500);
  };

  const handleAuthorizeWalletScope = async () => {
    setIsSubmittingPayout(true);
    setPayoutErrorMsg('');
    setPayoutSuccessMsg('');
    try {
      if (logout) await logout();
      if (loginWithPi) await loginWithPi();
      setNeedsWalletAuth(false);
      setPayoutSuccessMsg(l(
        'مجوز دسترسی به کیف پول با موفقیت تایید شد! اکنون می‌توانید واریز را انجام دهید.',
        'Wallet address authorized successfully! You can now submit payout.',
        'تم منح الإذن بنجاح! يمكنك الآن السحب.',
        '钱包权限已授权成功，现在可以发起提现。'
      ));
    } catch (err) {
      setPayoutErrorMsg(err.message || 'خطا در ثبت مجوز در Pi Browser');
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const handleRequestPayout = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setPayoutErrorMsg('');
    setPayoutSuccessMsg('');
    setPayoutTxid('');

    const amount = Number(payoutAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      setPayoutErrorMsg(l('لطفاً مبلغ معتبری برای برداشت وارد کنید.', 'Please enter a valid payout amount.', 'يرجى إدخال مبلغ صحيح.', '请输入有效的提现金额。'));
      return;
    }

    if (amount > availableTreasuryBalance && availableTreasuryBalance > 0) {
      setPayoutErrorMsg(l('مبلغ درخواستی بیشتر از موجودی قابل برداشت صندوق است.', 'Requested amount exceeds available treasury balance.', 'المبلغ المطلوب يتجاوز الرصيد المتاح.', '提现金额超出金库可用余额。'));
      return;
    }

    // Acquire or maintain the exact same Idempotency-Key for this operation attempt / retry
    const currentIdempotencyKey = getOrCreatePayoutKey();

    setIsSubmittingPayout(true);
    try {
      if (adminWalletAddress) {
        try { localStorage.setItem('rentora_admin_wallet_addr', adminWalletAddress.trim()); } catch (_) {}
      }
      const result = await cloudSyncService.requestAdminPayout(amount, payoutMemo, adminWalletAddress.trim(), currentIdempotencyKey);
      setPayoutSuccessMsg(result.message || l(
        `مبلغ ${amount} π با موفقیت به حساب پای @${currentUser?.username || 'admin'} واریز شد.`,
        `Successfully transferred ${amount} π to your Pi account.`,
        `تم تحويل ${amount} π بنجاح إلى حسابك.`,
        `已成功将 ${amount} π 提现至您的 Pi 账号。`
      ));
      if (result?.txid) setPayoutTxid(result.txid);

      // On SUCCESS: Reset form and clear the active key so the next operation gets a fresh unique key
      setPayoutAmount('');
      setPayoutMemo('');
      activePayoutKeyRef.current = null;
      setNeedsWalletAuth(false);
      await loadAdminServerData();
      await refreshApp();
      setTimeout(() => { setPayoutSuccessMsg(''); setPayoutTxid(''); }, 10000);
    } catch (err) {
      // On FAILURE: DO NOT reset activePayoutKeyRef.current!
      // This ensures that retrying the payout sends the exact same Idempotency-Key
      const msg = String(err?.message || '');
      if (msg.includes('wallet_address') || msg.includes('scope') || msg.includes('public key')) {
        setNeedsWalletAuth(true);
        setPayoutErrorMsg(l(
          'جهت واریز مستقیم به کیف پول شما، نیاز به تایید یکباره مجوز آدرس کیف پول در Pi Browser است. لطفاً روی دکمه سبز زیر کلیک کنید.',
          'To transfer directly to your wallet, please grant the wallet_address scope in Pi Browser. Click the green button below.',
          'يتطلب التحويل منح إذن عنوان المحفظة. يرجى الضغط بالأسفل.',
          '转账需授权钱包地址权限，请点击下方按钮完成授权。'
        ));
      } else {
        setPayoutErrorMsg(msg || l('خطا در تسویه حساب', 'Payout transfer failed', 'فشل التحويل', '提现失败'));
      }
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const handleToggleUserStatus = async (user) => {
    const targetStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      const updated = await cloudSyncService.setAdminUserStatus(user.id || user.uid, targetStatus);
      if (updated) {
        setAdminUsers(prev => prev.map(u => (u.id === user.id || u.uid === user.uid) ? { ...u, status: updated.status } : u));
      }
    } catch (err) {
      alert(err.message || 'خطا در تغییر وضعیت کاربر');
    }
  };

  const handleToggleListingModeration = async (item) => {
    const newStatus = item.status === 'active' ? 'paused' : 'active';
    try {
      await cloudSyncService.setAdminListingStatus(item.id, newStatus);
      await refreshApp();
    } catch (err) {
      alert(err.message || 'خطا در تغییر وضعیت آگهی');
    }
  };

  const handleTestBackendConnection = async () => {
    const rawUrl = (backendUrlInput || '').trim().replace(/\/$/, '');
    if (!rawUrl) {
      setBackendTestStatus('error');
      setBackendTestMsg(l('لطفاً آدرس ورکر کلودفلر (https://...) را وارد کنید.', 'Please enter Cloudflare Worker URL (https://...).', 'يرجى إدخال رابط وركر كلاودفلير.', '请输入 Cloudflare Worker 的完整 URL 地址。'));
      return;
    }

    setBackendTestStatus('testing');
    setBackendTestMsg(l('در حال تست اتصال به سرور...', 'Testing connection to server...', 'جارٍ اختبار الاتصال بالخادم...', '正在测试与服务器连接...'));

    try {
      const res = await fetch(`${rawUrl}/api/health`);
      const contentType = res.headers.get('content-type') || '';

      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setBackendTestStatus('success');
        setBackendTestMsg(l(
          `اتصال موفق به سرور رنتورا (${data.service || 'Cloudflare Worker'}) - نسخه ${data.version || '4.3.0'}`,
          `Connected successfully to (${data.service || 'Cloudflare Worker'}) - v${data.version || '4.3.0'}`,
          `تم الاتصال بنجاح بخادم رنتورا (${data.service || 'Cloudflare Worker'})`,
          `已成功连接至 Rentora 云端 Worker (${data.version || '4.3.0'})`
        ));
      } else {
        setBackendTestStatus('error');
        setBackendTestMsg(l('آدرس نامعتبر است یا خروجی JSON بازنگرداند. لطفاً URL ورکر را مجدداً بررسی کنید.', 'Invalid URL or non-JSON response. Please check worker URL.', 'الرابط غير صحيح أو لم يرجع بيانات JSON.', 'URL 无效或未返回 JSON。请核对 Worker 地址。'));
      }
    } catch (e) {
      setBackendTestStatus('error');
      setBackendTestMsg(l(`خطا در اتصال: ${e.message}`, `Connection error: ${e.message}`, `خطأ في الاتصال: ${e.message}`, `连接失败：${e.message}`));
    }
  };

  const handlePurgeDatabase = async () => {
    try {
      if (purgeDatabase) {
        await purgeDatabase();
        setIsPurgeModalOpen(false);
        setPurgeSuccessNotice(true);
        await loadAdminServerData();
        await refreshApp();
        setTimeout(() => setPurgeSuccessNotice(false), 3000);
      }
    } catch (err) {
      alert(err.message || 'خطا در بازنشانی پایگاه‌داده');
    }
  };

  return (
    <div className="space-y-5 pb-16 select-none max-w-4xl mx-auto animate-fadeIn">
      
      {/* Admin Header with In-App Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl rentora-card">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#26215C] text-white flex items-center justify-center shrink-0">
            <LayoutDashboard className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-bold text-slate-900 dark:text-white">
                {t('adminTitle')}
              </h1>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#EEEDFE] text-[#26215C] dark:bg-[#26215C] dark:text-[#EEEDFE]">
                {l('مدیر ارشد', 'Master Admin', 'المدير العام', '主管理员')}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {t('adminSubtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              await refreshApp();
              await loadAdminServerData();
            }}
            disabled={isRefreshing || loadingAdminData}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#16152B] text-slate-700 dark:text-slate-200 hover:border-[#534AB7] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 text-[#534AB7] stroke-[2] ${(isRefreshing || loadingAdminData) ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? l('در حال رفرش...', 'Refreshing...', 'جارٍ التحديث...', '正在刷新...') : l('رفرش داده‌ها', 'Refresh Data', 'تحديث البيانات', '刷新数据')}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPurgeModalOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('adminPurgeBtn')}</span>
          </button>
        </div>
      </div>

      {/* Success Toasts */}
      {purgeSuccessNotice && (
        <div className="p-3 rounded-xl badge-trust text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-[#0F6E56]" />
          <span>{l('پایگاه‌داده با موفقیت بازنشانی و پاکسازی شد.', 'Database purged successfully.', 'تمت إعادة ضبط قاعدة البيانات بنجاح.', '数据库已成功重置并清空。')}</span>
        </div>
      )}

      {saveSuccessNotice && (
        <div className="p-3 rounded-xl badge-trust text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-[#0F6E56]" />
          <span>{t('adminCommissionSaved')}</span>
        </div>
      )}

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3 rounded-xl rentora-card space-y-1">
          <span className="text-[10px] text-slate-400 font-medium">{t('adminStatsTotalPioneers')}</span>
          <div className="text-lg font-black text-slate-900 dark:text-white font-mono">
            {adminOverview?.totalUsers ?? allRealUsers.length}
          </div>
        </div>

        <div className="p-3 rounded-xl rentora-card space-y-1">
          <span className="text-[10px] text-slate-400 font-medium">{t('adminStatsTotalListings')}</span>
          <div className="text-lg font-black text-slate-900 dark:text-white font-mono">
            {adminOverview?.totalListings ?? items.length}
          </div>
        </div>

        <div className="p-3 rounded-xl rentora-card space-y-1">
          <span className="text-[10px] text-slate-400 font-medium">{t('adminStatsTotalRentals')}</span>
          <div className="text-lg font-black text-[#534AB7] dark:text-[#AFA9EC] font-mono">
            {adminOverview?.totalRentals ?? rentals.length}
          </div>
        </div>

        <div className="p-3 rounded-xl rentora-card space-y-1">
          <span className="text-[10px] text-slate-400 font-medium">{t('adminStatsTreasuryRev')}</span>
          <div className="text-lg font-black text-[#0F6E56] dark:text-[#48D2A8] font-mono">
            {Number(availableTreasuryBalance).toFixed(4)} π
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#1A1930] rounded-xl overflow-x-auto pb-1 text-xs">
        {[
          { id: 'overview', label: t('adminTabCommission'), icon: Percent },
          { id: 'database', label: t('adminTabDatabase'), icon: Database },
          { id: 'users', label: `${t('adminTabUsers')} (${allRealUsers.length})`, icon: Users },
          { id: 'moderation', label: `${t('adminTabModeration')} (${items.length})`, icon: Layers },
          { id: 'reports', label: `${t('adminTabReports')} (${reports.length})`, icon: ShieldAlert, badge: reports.length },
          { id: 'transactions', label: t('adminTabTransactions'), icon: CreditCard }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-[#26215C] text-[#26215C] dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Commission Config & Treasury Payout */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          
          {/* Treasury Payout Card (A2U) */}
          <div className="p-4 sm:p-5 rounded-xl rentora-card space-y-4 border-2 border-[#0F6E56]/30 bg-gradient-to-b from-white to-[#E1F5EE]/20 dark:from-[#151426] dark:to-[#0B382C]/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-150 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#0F6E56] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CreditCard className="w-4 h-4 stroke-[2]" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    {l('تسویه و واریز درآمد به کیف پول پای ادمین (A2U)', 'Direct Treasury Payout to Admin (A2U)', 'تحويل الأرباح لحساب الأدمن (A2U)', '金库收益直接提现至管理员账户 (A2U)')}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {l('انتقال موجودی کارمزدها از کیف پول اپلیکیشن به حساب پای شما', 'Transfer platform fees from App Wallet to your Pi account', 'تحويل عمولات المنصة إلى محفظتك الشخصية', '从 App 官方金库钱包直接打款至您的 Pi 钱包')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <span className="text-[11px] text-slate-500 font-medium">{l('اکانت مقصد:', 'Recipient:', 'المستلم:', '收款账号：')}</span>
                <span className="font-mono text-xs font-bold text-[#0F6E56] dark:text-[#48D2A8] bg-[#E1F5EE] dark:bg-[#0B382C] px-2 py-0.5 rounded-lg">
                  @{currentUser?.username || 'admin'}
                </span>
              </div>
            </div>

            {/* Balances summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1C1B33] border border-slate-200 dark:border-slate-700 space-y-0.5">
                <span className="text-[10px] text-slate-400 block">{l('کل کارمزد دریافتی:', 'Total Revenue:', 'إجمالي العمولات:', '累计平台费：')}</span>
                <strong className="font-mono text-sm font-black text-slate-900 dark:text-white">{Number(totalCommissionRevenue).toFixed(4)} π</strong>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1C1B33] border border-slate-200 dark:border-slate-700 space-y-0.5">
                <span className="text-[10px] text-slate-400 block">{l('مجموع تسویه‌شده پیشین:', 'Total Payouts Done:', 'إجمالي المسحوب:', '累计已提现：')}</span>
                <strong className="font-mono text-sm font-black text-[#534AB7] dark:text-[#AFA9EC]">{Number(adminOverview?.totalPayouts || 0).toFixed(4)} π</strong>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-[#0B382C]/60 border border-emerald-200 dark:border-emerald-800 space-y-0.5">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold block">{l('موجودی قابل برداشت:', 'Available to Withdraw:', 'الرصيد المتاح للسحب:', '可提现余额：')}</span>
                <strong className="font-mono text-sm font-black text-[#0F6E56] dark:text-[#48D2A8]">{Number(availableTreasuryBalance).toFixed(4)} π</strong>
              </div>
            </div>

            {payoutSuccessMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[#0F6E56] dark:text-[#48D2A8] text-xs font-bold space-y-1.5 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{payoutSuccessMsg}</span>
                </div>
                {payoutTxid && (
                  <div className="text-[11px] font-mono opacity-90 break-all bg-emerald-100/60 dark:bg-emerald-900/40 p-1.5 rounded-lg">
                    <span className="font-sans font-normal text-slate-600 dark:text-slate-300">TXID: </span>
                    {payoutTxid}
                  </div>
                )}
              </div>
            )}

            {payoutErrorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center justify-between gap-2 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{payoutErrorMsg}</span>
                </div>
                {!needsWalletAuth && (
                  <button
                    type="button"
                    onClick={handleRequestPayout}
                    disabled={isSubmittingPayout}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shrink-0 cursor-pointer disabled:opacity-50 transition"
                  >
                    {l('تلاش مجدد', 'Retry', 'إعادة المحاولة', '重试')}
                  </button>
                )}
              </div>
            )}

            {/* Payout Form */}
            <form onSubmit={handleRequestPayout} className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {l('مبلغ برداشت کارمزد (π):', 'Withdrawal Amount (π):', 'مبلغ السحب (π):', '提现金额 (π)：')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      max={availableTreasuryBalance > 0 ? availableTreasuryBalance : undefined}
                      placeholder={availableTreasuryBalance > 0 ? `مثلاً ${availableTreasuryBalance.toFixed(4)}` : '0.0000'}
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white font-mono focus:outline-none focus:border-[#0F6E56]"
                    />
                    {availableTreasuryBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => setPayoutAmount(String(availableTreasuryBalance))}
                        className="absolute left-2 rtl:left-2 rtl:right-auto top-2 px-2 py-0.5 rounded bg-[#E1F5EE] dark:bg-[#0B382C] text-[#0F6E56] dark:text-[#48D2A8] text-[10px] font-bold cursor-pointer hover:opacity-80 transition"
                      >
                        {l('حداکثر', 'Max', 'الكل', '全部')}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {l('عنوان تراکنش (اختیاری):', 'Memo (Optional):', 'ملاحظة (اختياري):', '备注（可选）：')}
                  </label>
                  <input
                    type="text"
                    placeholder={l('تسویه درآمد صندوق رنتورا', 'Rentora Treasury Payout', 'سحب أرباح الخزينة', 'Rentora 金库提现')}
                    value={payoutMemo}
                    onChange={(e) => setPayoutMemo(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white focus:outline-none focus:border-[#0F6E56]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {l('آدرس عمومی کیف پول پای ادمین (جهت واریز و ثبت):', 'Admin Pi Wallet Public Address (Optional Destination Key):', 'عنوان محفظة باي العامة للأدمن:', '管理员 Pi 钱包公钥地址：')}
                </label>
                <input
                  type="text"
                  placeholder={l('آدرس عمومی کیف پول پای (مثلاً G...)', 'Public Pi Wallet Key (e.g. G...)', 'عنوان المحفظة العام (مثال: G...)', '钱包公钥地址（如 G...）')}
                  value={adminWalletAddress}
                  onChange={(e) => setAdminWalletAddress(e.target.value)}
                  dir="ltr"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white font-mono focus:outline-none focus:border-[#0F6E56]"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  {l('مبالغ کارمزد پلتفرم از کیف پول اپلیکیشن به حساب پای شما تسویه و ثبت می‌شود.', 'Platform fee earnings will be settled from the App Wallet directly to your Pi account.', 'سيتم تحويل عمولات المنصة من محفظة التطبيق إلى حسابك.', '平台收益将从 App 金库直接结算至您的 Pi 账号。')}
                </p>
              </div>

              {needsWalletAuth ? (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 space-y-2">
                  <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-semibold">
                    {l(
                      'شبکه پای برای ارسال وجه از برنامه به کیف پول شما (A2U)، نیازمند تایید دسترسی به آدرس عمومی کیف پول است. روی دکمه سبز زیر کلیک کنید و مجوز را تایید نمایید:',
                      'Pi Network requires wallet address authorization to transfer funds to your wallet. Please click below to grant access in Pi Browser:',
                      'تتطلب شبكة باي منح الإذن بعنوان المحفظة لإتمام التحويل. اضغط بالأسفل:',
                      'Pi 官方网络要求授权钱包地址权限方可打款，请点击下方按钮授权：'
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={handleAuthorizeWalletScope}
                    disabled={isSubmittingPayout}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0F6E56] hover:bg-[#0B5441] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 transition"
                  >
                    {isSubmittingPayout ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{l('در حال تایید در Pi Browser...', 'Authorizing in Pi Browser...', 'جارٍ التحقق...', '正在授权...')}</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4 text-emerald-300" />
                        <span>{l('تایید مجوز کیف پول در Pi Browser (Wallet Address Scope)', 'Authorize Wallet Address in Pi Browser', 'منح إذن المحفظة في متصفح باي', '在 Pi 浏览器中授权钱包地址')}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmittingPayout || availableTreasuryBalance <= 0}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0F6E56] hover:bg-[#0B5441] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 transition"
                >
                  {isSubmittingPayout ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{l('در حال صدور تراکنش واریز به کیف پول پای...', 'Processing Pi A2U payout...', 'جارٍ التحويل...', '正在向 Pi 钱包转账...')}</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 text-emerald-300" />
                      <span>{l(`برداشت کارمزد به حساب پای (@${currentUser?.username || 'admin'})`, `Withdraw Commission to Pi Account (@${currentUser?.username || 'admin'})`, `سحب الأرباح إلى حساب باي (@${currentUser?.username || 'admin'})`, `提现平台收益至 Pi 账号 (@${currentUser?.username || 'admin'})`)}</span>
                    </>
                  )}
                </button>
              )}
            </form>
          </div>

          {/* Platform Fee Percentage & Floor Config Form */}
          <form onSubmit={handleSaveCommission} className="p-4 sm:p-5 rounded-xl rentora-card space-y-4">
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-[#534AB7]" />
              <span>{t('adminCommissionTitle')}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t('adminPlatformFeeLabel')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={commissionPercent}
                    onChange={(e) => setCommissionPercent(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white font-mono focus:outline-none focus:border-[#534AB7]"
                  />
                  <span className="absolute left-3 rtl:left-3 rtl:right-auto top-2.5 text-xs text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t('adminMinFeeLabel')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={minFeeFloor}
                    onChange={(e) => setMinFeeFloor(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white font-mono focus:outline-none focus:border-[#534AB7]"
                  />
                  <span className="absolute left-3 rtl:left-3 rtl:right-auto top-2.5 text-xs text-slate-400 font-bold">π</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary px-4 py-2 text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{t('adminSaveBtn')}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: Database & Backend Diagnostic */}
      {activeTab === 'database' && (
        <div className="space-y-4">
          <div className="p-4 sm:p-5 rounded-xl rentora-card space-y-4">
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-[#534AB7]" />
              <span>{l('وضعیت اتصال سرور ابری (Cloudflare Worker)', 'Cloudflare Worker Status', 'حالة خادم كلاودفلير', 'Cloudflare Worker 状态')}</span>
            </h3>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {l('آدرس ورکر سرور:', 'Worker URL:', 'رابط الخادم:', 'Worker 地址：')}
              </label>
              <input
                type="url"
                value={backendUrlInput}
                onChange={(e) => setBackendUrlInput(e.target.value)}
                placeholder="https://rentora.your-subdomain.workers.dev"
                dir="ltr"
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151426] text-slate-900 dark:text-white font-mono focus:outline-none focus:border-[#534AB7]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestBackendConnection}
                disabled={backendTestStatus === 'testing'}
                className="btn-secondary px-4 py-2 text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Wifi className="w-3.5 h-3.5 text-[#534AB7]" />
                <span>{backendTestStatus === 'testing' ? l('در حال تست...', 'Testing...', 'جارٍ الفحص...', '测试中...') : l('تست اتصال ورکر', 'Test Connection', 'اختبار الاتصال', '测试连接')}</span>
              </button>
            </div>

            {backendTestMsg && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn ${
                backendTestStatus === 'success'
                  ? 'badge-trust'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 border border-rose-200 dark:border-rose-900'
              }`}>
                {backendTestStatus === 'success' ? <CheckCircle2 className="w-4 h-4 text-[#0F6E56]" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                <span>{backendTestMsg}</span>
              </div>
            )}
          </div>

          {/* Secure Database Cleanup Tool */}
          <div className="p-4 sm:p-5 rounded-xl rentora-card space-y-3">
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <Database className="w-4 h-4 text-[#534AB7]" />
              <span>{l('ابزار پاکسازی امن و ابطال رزروهای معلق منقضی (Database Maintenance)', 'Database Maintenance & Cleanup Tool', 'أداة تنظيف قاعدة البيانات', '数据库维护与安全清理工具')}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {l('این ابزار رزروهای معلق بدون پرداخت (Pending Payment) که بیش از ۱۵ دقیقه رها شده‌اند را به صورت امن لغو کرده و گزارش لاگ حسابرسی (Audit Log) را ثبت می‌نماید.', 'This tool cancels abandoned unpaid rentals older than 15 minutes and records an authoritative audit log.', 'تقوم هذه الأداة بإلغاء الحجوزات المعلقة غير المدفوعة لأكثر من 15 دقيقة مع تسجيل سجل التدقيق.', '此工具可自动清理超过15分钟未付款的滞留订单并记录管理员审计日志。')}
            </p>

            {cleanupResultMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[#0F6E56] dark:text-[#48D2A8] text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{cleanupResultMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleCleanupDatabase}
              disabled={isCleaningDb}
              className="btn-primary px-4 py-2 text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCleaningDb ? 'animate-spin' : ''}`} />
              <span>{isCleaningDb ? l('در حال اجرای پاکسازی...', 'Cleaning Database...', 'جارٍ التنظيف...', '正在清理...') : l('اجرای پاکسازی رزروهای معلق', 'Execute Cleanup Now', 'تنفيذ التنظيف الآن', '立即执行清理')}</span>
            </button>
          </div>

          {/* Audit Logs Trail */}
          <div className="p-4 sm:p-5 rounded-xl rentora-card space-y-3">
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0F6E56]" />
              <span>{l('گزارش رویدادهای مدیریتی و حسابرسی (Audit Logs Trail)', 'Admin Audit Logs Trail', 'سجل تدقيق الإدارة', '管理员操作审计日志')}</span>
            </h3>

            {(!adminOverview?.auditLogs || adminOverview.auditLogs.length === 0) ? (
              <p className="text-xs text-slate-400 py-2">
                {l('هنوز هیچ لاگ حسابرسی ثبت نشده است.', 'No audit logs recorded yet.', 'لا توجد سجلات تدقيق بعد.', '暂无审计记录。')}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {adminOverview.auditLogs.map((log) => (
                  <div key={log.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-700 dark:text-slate-300">
                    <div>
                      <span className="font-bold text-[#534AB7] dark:text-[#AFA9EC]">{log.action}</span>
                      <span className="text-slate-400 ml-1.5">by @{log.adminUsername || log.adminUid}</span>
                      {log.details && (
                        <span className="text-slate-500 dark:text-slate-400 block sm:inline sm:ml-2 font-sans text-[10px]">
                          ({JSON.stringify(log.details)})
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Users Directory */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl rentora-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#534AB7]" />
                <span>{t('adminTabUsers')} ({allRealUsers.length})</span>
              </h3>
            </div>

            {allRealUsers.length === 0 ? (
              <EmptyState
                type="user"
                title={l('کاربری یافت نشد', 'No users found', 'لا يوجد مستخدمين', '未找到用户')}
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {allRealUsers.map((u, idx) => {
                  const isUserActive = u.status !== 'suspended';
                  const isSelf = currentUser?.username?.toLowerCase() === u.username?.toLowerCase();
                  return (
                    <div key={u.id || u.uid || idx} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white truncate">
                              {u.displayName || u.username}
                            </span>
                            <span className="font-mono text-slate-400 text-[10px]">@{u.username}</span>
                            {u.role === 'admin' && (
                              <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-[#26215C] text-white">{l('ادمین', 'Admin', 'أدمن', '管理员')}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                            <span className={isUserActive ? 'text-[#0F6E56] font-bold' : 'text-rose-500 font-bold'}>
                              {isUserActive ? l('فعال', 'Active', 'نشط', '正常') : l('مسدود', 'Suspended', 'محظور', '已冻结')}
                            </span>
                            <span>•</span>
                            <span className={u.kycStatus === 'verified' ? 'text-[#0F6E56] font-bold' : 'text-slate-400'}>
                              {u.kycStatus === 'verified' ? l('احراز هویت شده (KYC)', 'KYC Verified', 'موثق (KYC)', 'KYC 已实名') : l('احراز هویت نشده', 'Unverified', 'غير موثق', '未认证')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleUserKyc(u)}
                          className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1 ${
                            u.kycStatus === 'verified'
                              ? 'border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                              : 'border border-emerald-200 dark:border-emerald-800 text-[#0F6E56] dark:text-[#48D2A8] hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                          }`}
                          title={l('تغییر وضعیت احراز هویت پای', 'Toggle Pi KYC status', 'تغيير حالة التوثيق', '切换 KYC 认证状态')}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{u.kycStatus === 'verified' ? l('لغو KYC', 'Revoke KYC', 'إلغاء التوثيق', '取消认证') : l('تایید KYC', 'Verify KYC', 'توثيق KYC', '认证 KYC')}</span>
                        </button>

                        {!isSelf && u.role !== 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(u)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1 ${
                              isUserActive
                                ? 'border border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                : 'badge-trust text-[#0F6E56]'
                            }`}
                          >
                            {isUserActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            <span>{isUserActive ? l('مسدودسازی', 'Suspend', 'حظر', '冻结') : l('رفع انسداد', 'Activate', 'تفعيل', '解冻')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Listings Moderation */}
      {activeTab === 'moderation' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl rentora-card space-y-3">
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#534AB7]" />
              <span>{t('adminTabModeration')} ({items.length})</span>
            </h3>

            {items.length === 0 ? (
              <EmptyState
                type="package"
                title={l('هیچ آگهی ثبت نشده است', 'No listings yet', 'لا توجد إعلانات بعد', '暂无上架物品')}
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((it) => {
                  const isActive = it.status === 'active';
                  return (
                    <div key={it.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={it.images?.[0] || 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=900&auto=format&fit=crop&q=80'}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 dark:text-white truncate">{it.title}</h4>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[#0F6E56] font-bold">{it.pricePerDay} π / {l('روز', 'day', 'يوم', '天')}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-500">@{it.ownerUsername}</span>
                            <span>•</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'}`}>
                              {isActive ? l('فعال و منتشرشده', 'Active', 'نشط', '已发布') : l('متوقف', 'Paused', 'موقوف', '已暂停')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onEditItem && onEditItem(it)}
                          className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#534AB7] text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition"
                          title={l('ویرایش آگهی', 'Edit Listing', 'تعديل', '编辑')}
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#534AB7]" />
                          <span>{l('ویرایش', 'Edit', 'تعديل', '编辑')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleListingModeration(it)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition ${
                            isActive
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          <span>{isActive ? l('توقف نمایش', 'Pause', 'إيقاف', '暂停') : l('تایید و انتشار', 'Activate', 'تفعيل', '发布上线')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteItem(it.id)}
                          className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title={t('btnDelete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: Violation Reports */}
      {activeTab === 'reports' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl rentora-card space-y-3">
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>{t('adminTabReports')} ({reports.length})</span>
            </h3>

            {reports.length === 0 ? (
              <EmptyState
                type="package"
                title={l('هیچ گزارشی ثبت نشده است', 'No violation reports', 'لا توجد بلاغات', '暂无违规举报')}
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {reports.map((rep, idx) => (
                  <div key={rep.id || idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-rose-600 dark:text-rose-400">{rep.reason || l('گزارش تخلف', 'Violation Report', 'بلاغ مخالفة', '违规举报')}</span>
                        <span className="text-[10px] text-slate-400 font-mono">@{rep.reporterUsername}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mt-1">{rep.description || rep.details || l('توضیحاتی ثبت نشده است.', 'No details provided.', 'لا توجد تفاصيل.', '未提供详细说明。')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => resolveReport(rep.id)}
                      className="px-3 py-1.5 rounded-lg badge-trust text-xs font-bold cursor-pointer shrink-0 flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5 text-[#0F6E56]" />
                      <span>{l('بررسی شد', 'Resolve', 'تم الحل', '标记已处理')}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: Transactions Ledger */}
      {activeTab === 'transactions' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl rentora-card space-y-3">
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[#0F6E56]" />
              <span>{t('adminTabTransactions')} ({transactions.length})</span>
            </h3>

            {transactions.length === 0 ? (
              <EmptyState
                type="wallet"
                title={l('هنوز تراکنشی ثبت نشده است', 'No transactions yet', 'لا توجد معاملات بعد', '暂无交易流水')}
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions.map((tx, idx) => {
                  const isPayout = tx.type === 'admin_payout';
                  return (
                    <div key={tx.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {isPayout 
                              ? l('تسویه درآمد به کیف پول ادمین', 'Treasury Payout to Admin', 'سحب أرباح الخزينة', '金库提现')
                              : (tx.itemTitle || l('کارمزد پلتفرم رنتورا', 'Rentora Platform Fee', 'عمولة المنصة', '平台服务费'))
                            }
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            isPayout 
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' 
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}>
                            {isPayout ? l('تسویه‌حساب', 'Payout', 'سحب', '提现') : l('دریافت کارمزد', 'Revenue', 'دخل', '收益')}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono" dir="ltr">{tx.piTxRef || tx.pi_txid || tx.txid || tx.id}</span>
                      </div>
                      <div className="text-right">
                        <span className={`font-black font-mono text-xs block ${
                          isPayout ? 'text-amber-600 dark:text-amber-400' : 'text-[#0F6E56] dark:text-[#48D2A8]'
                        }`}>
                          {isPayout ? `-${tx.amount} π` : `+${tx.platformFee || tx.amount || 0.0001} π`}
                        </span>
                        <span className="text-[9px] text-slate-400">{tx.created_at || tx.timestamp ? new Date(tx.created_at || tx.timestamp).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US') : l('تاییدشده', 'Confirmed', 'مؤكد', '已确认')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Purge Modal */}
      {isPurgeModalOpen && (
        <div 
          onClick={() => setIsPurgeModalOpen(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn select-none"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#151426] rounded-2xl p-5 w-full max-w-sm text-center space-y-4 border border-rose-200 dark:border-rose-900/60 shadow-2xl animate-scaleIn mx-auto"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shadow-xs">
              <AlertOctagon className="w-6 h-6 stroke-[2]" />
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">{t('adminPurgeTitle')}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('adminPurgeDesc')}
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
              >
                {t('btnCancel')}
              </button>
              <button
                type="button"
                onClick={handlePurgeDatabase}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition shadow-md"
              >
                {t('adminPurgeBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
