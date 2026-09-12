import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { getApiBaseUrl } from '../services/apiConfig';
import { cloudSyncService } from '../services/cloudSyncService';
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
  Edit3
} from 'lucide-react';

export default function AdminDashboardPage({ onNavigate, onOpenPublicProfile, onEditItem }) {
  const { lang, dir, t, l } = useLanguage();
  const { isAdmin, currentUser, users = [], toggleUserStatus } = usePiAuth();
  const { 
    items = [], 
    rentals = [], 
    transactions = [], 
    reports = [], 
    platformConfig, 
    updatePlatformConfig, 
    toggleItemStatus, 
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
  const [isPushingCloud, setIsPushingCloud] = useState(false);

  // Backend URL state
  const [backendUrlInput, setBackendUrlInput] = useState(getApiBaseUrl());
  const [backendTestStatus, setBackendTestStatus] = useState(null); // 'testing' | 'success' | 'error'
  const [backendTestMsg, setBackendTestMsg] = useState('');

  // Compute real dynamic users list
  const allRealUsers = useMemo(() => {
    const userMap = new Map();

    (users || []).forEach(u => {
      if (u.username) userMap.set(u.username.toLowerCase(), u);
    });

    if (currentUser?.username) {
      userMap.set(currentUser.username.toLowerCase(), currentUser);
    }

    (items || []).forEach(item => {
      if (item.ownerUsername && !userMap.has(item.ownerUsername.toLowerCase())) {
        userMap.set(item.ownerUsername.toLowerCase(), {
          uid: item.ownerUid || `pi_usr_${item.ownerUsername}`,
          username: item.ownerUsername,
          displayName: item.ownerUsername,
          avatar: item.ownerAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${item.ownerUsername}`,
          bio: item.ownerBio || 'پیشگام تاییدشده شبکه پای',
          role: 'user',
          kycStatus: 'verified',
          status: 'active'
        });
      }
    });

    return Array.from(userMap.values());
  }, [users, currentUser, items]);

  // Strict 403 for non-admins
  if (!isAdmin) {
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

  const totalCommissionRevenue = (transactions || []).reduce((sum, tx) => sum + (tx.platformFee || 0), 0);

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
          `اتصال موفق به سرور رنتورا (${data.service || 'Cloudflare Worker'}) - نسخه ${data.version || '2.3.0'}`,
          `Connected successfully to (${data.service || 'Cloudflare Worker'}) - v${data.version || '2.3.0'}`,
          `تم الاتصال بنجاح بخادم رنتورا (${data.service || 'Cloudflare Worker'})`,
          `已成功连接至 Rentora 云端 Worker (${data.version || '2.3.0'})`
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

  // Push all local items & users to the remote backend
  const handlePushAllToCloud = async () => {
    setIsPushingCloud(true);
    try {
      for (const item of items) {
        await cloudSyncService.broadcastNewItem(item);
      }
      for (const user of allRealUsers) {
        await cloudSyncService.broadcastUserProfile(user);
      }
      await refreshApp();
      setBackendTestStatus('success');
      setBackendTestMsg(l('تمام آگهی‌ها و کاربران با موفقیت در فضای ابری همگام شدند.', 'All items and users pushed to cloud successfully.', 'تمت مزامنة كافة الإعلانات والمستخدمين سحابياً.', '全部物品与用户资料已同步至云端。'));
    } catch (e) {
      setBackendTestStatus('error');
      setBackendTestMsg(e.message);
    } finally {
      setIsPushingCloud(false);
    }
  };

  const handlePurgeDatabase = () => {
    if (purgeDatabase) {
      purgeDatabase();
      setIsPurgeModalOpen(false);
      setPurgeSuccessNotice(true);
      setTimeout(() => setPurgeSuccessNotice(false), 3000);
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
                Master Admin
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
            onClick={refreshApp}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#16152B] text-slate-700 dark:text-slate-200 hover:border-[#534AB7] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 text-[#534AB7] stroke-[2] ${isRefreshing ? 'animate-spin' : ''}`} />
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
          <span>{l('تمام داده‌های آزمایشی و کش داخلی پاکسازی و صفر شدند.', 'Local database and test data purged successfully.', 'تم مسح قاعدة البيانات المحلية بنجاح.', '本地数据库与测试缓存已成功清理并归零。')}</span>
        </div>
      )}

      {/* 1. Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="p-3.5 rounded-xl rentora-card space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block">{l('درآمد کل کارمزد پلتفرم', 'Total Platform Revenue', 'إجمالي دخل المنصة', '平台总收益')}</span>
          <div className="text-xl sm:text-2xl font-black text-[#0F6E56] dark:text-[#48D2A8] font-mono">
            {totalCommissionRevenue.toFixed(3)} π
          </div>
        </div>

        <div className="p-3.5 rounded-xl banner-purple space-y-1">
          <span className="text-[11px] font-semibold text-[#534AB7] dark:text-[#AFA9EC] block flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-[#534AB7]" />
            <span>{l('رزروهای ثبت‌شده', 'Total Bookings', 'إجمالي الحجوزات', '预订总数')}</span>
          </span>
          <div className="text-xl sm:text-2xl font-black text-[#26215C] dark:text-[#EEEDFE] font-mono">
            {rentals.length}
          </div>
        </div>

        <div className="p-3.5 rounded-xl rentora-card space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block">{t('ownerStatsListings')}</span>
          <div className="text-xl sm:text-2xl font-black text-[#26215C] dark:text-white font-mono">
            {items.length}
          </div>
        </div>

        <div className="p-3.5 rounded-xl badge-trust space-y-1">
          <span className="text-[11px] font-bold text-[#0F6E56] dark:text-[#48D2A8] block">{t('homeStatPioneers')}</span>
          <div className="text-xl sm:text-2xl font-black text-[#0F6E56] dark:text-[#48D2A8] font-mono">
            {allRealUsers.length}
          </div>
        </div>
      </div>

      {/* Admin Nav Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-150 dark:border-slate-800 pb-2 overflow-x-auto scrollbar-none">
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
                  ? 'bg-[#26215C] text-white dark:bg-[#534AB7]'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5 stroke-[1.8]" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Commission Control */}
      {activeTab === 'overview' && (
        <div className="p-4 sm:p-5 rounded-xl rentora-card space-y-5">
          <form onSubmit={handleSaveCommission} className="space-y-5 max-w-xl">
            
            {/* Platform Booking Commission */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1E1D33] border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200">
                <span>{l('درصد کارمزد پلتفرم رنتورا (از مستأجر)', 'Rentora Platform Commission (from Renter)', 'نسبة عمولة المنصة (من المستأجر)', 'Rentora 平台费率（由租客支付）')}</span>
                <span className="text-base font-black text-[#26215C] dark:text-[#EEEDFE] font-mono">{commissionPercent} ٪</span>
              </div>

              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(parseFloat(e.target.value) || 0)}
                className="w-full accent-[#26215C] dark:accent-[#534AB7] cursor-pointer"
              />
              <p className="text-[10px] text-slate-400">
                {l('کارمزد پلتفرم تنها وجهی است که از طریق Pi Payment رسمی دریافت می‌شود.', 'Platform commission is the only fee collected via official Pi Payment.', 'عمولة المنصة هي المبلغ الوحيد الذي يُدفع رسمياً عبر باي.', '平台服务费是唯一通过官方 Pi 钱包支付的费用。')}
              </p>
            </div>

            {/* Minimum Fee Floor */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1E1D33] border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
              <div className="font-bold flex items-center justify-between">
                <span>{t('adminFeeFloorLabel')}</span>
                <span className="font-mono font-black text-[#0F6E56] text-sm">{minFeeFloor} π</span>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary px-5 py-2.5 text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Save className="w-3.5 h-3.5 stroke-[2]" />
              <span>{t('adminSaveConfigBtn')}</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: Cloud Backend & Multi-Device Sync */}
      {activeTab === 'database' && (
        <div className="space-y-4">
          
          <div className="p-4 sm:p-5 rounded-2xl rentora-card space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-150 dark:border-slate-800">
              <Globe className="w-5 h-5 text-[#534AB7] stroke-[2]" />
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('adminCloudBackendTitle')}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {t('adminCloudBackendDesc')}
                </p>
              </div>
            </div>

            <div className="space-y-3 max-w-xl">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t('adminCloudBackendUrl')}
                </label>
                <div
                  className="w-full mt-1.5 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#121124] text-slate-700 dark:text-slate-200 font-mono flex items-center justify-between"
                  dir="ltr"
                >
                  <span>{backendUrlInput || 'https://rentora.mohsenjnext.workers.dev'}</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">● Active</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestBackendConnection}
                  disabled={backendTestStatus === 'testing'}
                  className="btn-primary px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>{t('adminTestConnectionBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePushAllToCloud}
                  disabled={isPushingCloud}
                  className="px-3.5 py-2 rounded-xl border border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isPushingCloud ? l('در حال ارسال...', 'Pushing...', 'جارٍ الإرسال...', '正在推送...') : l('همگام‌سازی با فضای ابری', 'Sync Data with Cloud', 'مزامنة الكل سحابياً', '一键同步全部数据至云端')}</span>
                </button>
              </div>

              {backendTestMsg && (
                <div className={`p-2.5 rounded-xl text-xs font-semibold animate-fadeIn ${
                  backendTestStatus === 'success' ? 'badge-trust' : 'badge-amber'
                }`}>
                  {backendTestMsg}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl rentora-card space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-150 dark:border-slate-800">
              <Database className="w-5 h-5 text-rose-600 stroke-[2]" />
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {t('adminPurgeTitle')}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {t('adminPurgeDesc')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition shadow-md"
              >
                <Trash2 className="w-4 h-4 stroke-[2]" />
                <span>{t('adminPurgeBtn')}</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: Real Users Directory */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl rentora-card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#534AB7]" />
                  <span>{t('adminTabUsers')} ({allRealUsers.length})</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={refreshApp}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1 text-[#534AB7] cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{l('بروزرسانی', 'Refresh', 'تحديث', '刷新')}</span>
              </button>
            </div>

            {allRealUsers.length === 0 ? (
              <EmptyState
                type="package"
                title={l('هنوز کاربری ثبت‌نام نکرده است', 'No pioneers registered yet', 'لم يسجل أي مستخدم بعد', '暂无先锋用户注册')}
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {allRealUsers.map((u, idx) => {
                  const isBlocked = u.status === 'banned';

                  return (
                    <div key={u.uid || idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                          alt=""
                          className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white font-mono" dir="ltr">
                              @{u.username}
                            </span>
                            {u.kycStatus === 'verified' ? (
                              <span className="text-[9px] badge-trust px-1.5 py-0.2 rounded font-bold">
                                KYC ✓
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 font-medium">
                                Unverified
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleUserStatus(u.uid)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition ${
                            isBlocked
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40'
                          }`}
                        >
                          {isBlocked ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                          <span>{isBlocked ? l('رفع مسدودی', 'Unblock', 'إلغاء الحظر', '解封') : l('مسدودسازی', 'Block', 'حظر', '封禁')}</span>
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

      {/* TAB 4: Items Moderation */}
      {activeTab === 'moderation' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl rentora-card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#534AB7]" />
                  <span>{t('adminTabModeration')} ({items.length})</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={refreshApp}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1 text-[#534AB7] cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{l('بروزرسانی', 'Refresh', 'تحديث', '刷新')}</span>
              </button>
            </div>

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
                            <span className="font-mono text-[#0F6E56] font-bold">{it.pricePerDay} π / روز</span>
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
                          onClick={() => toggleItemStatus(it.id)}
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
                        <span className="font-bold text-rose-600 dark:text-rose-400">{rep.reason || 'گزارش تخلف'}</span>
                        <span className="text-[10px] text-slate-400 font-mono">@{rep.reporterUsername}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mt-1">{rep.description || 'توضیحاتی ثبت نشده است.'}</p>
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
                {transactions.map((tx, idx) => (
                  <div key={tx.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">{tx.itemTitle || 'تراکنش پای'}</span>
                      <span className="text-[10px] text-slate-400 font-mono" dir="ltr">{tx.piTxRef || tx.txid || tx.id}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-[#0F6E56] font-mono text-xs block">+{tx.platformFee || tx.amount || 0.0001} π</span>
                      <span className="text-[9px] text-slate-400">{tx.timestamp ? new Date(tx.timestamp).toLocaleDateString('fa-IR') : 'تاییدشده'}</span>
                    </div>
                  </div>
                ))}
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
