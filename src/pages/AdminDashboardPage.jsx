import React, { useState, useEffect, useMemo } from 'react';
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
  Edit3,
  Loader2
} from 'lucide-react';

export default function AdminDashboardPage({ onNavigate, onOpenPublicProfile, onEditItem }) {
  const { lang, dir, t, l } = useLanguage();
  const { isAdmin, currentUser, toggleUserStatus, moderateListingStatus } = usePiAuth();
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

  const loadAdminServerData = async () => {
    setLoadingAdminData(true);
    setAdminAuthError(false);
    try {
      const [overviewData, usersData] = await Promise.all([
        cloudSyncService.fetchAdminOverview().catch(() => null),
        cloudSyncService.fetchAdminUsers().catch(() => [])
      ]);
      if (overviewData) setAdminOverview(overviewData);
      if (Array.isArray(usersData)) setAdminUsers(usersData);
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
      loadAdminServerData();
    }
  }, [isAdmin]);

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

  const allRealUsers = adminUsers.length > 0 ? adminUsers : (currentUser ? [currentUser] : []);
  const totalCommissionRevenue = adminOverview?.totalPlatformRevenue !== undefined
    ? adminOverview.totalPlatformRevenue
    : (transactions || []).reduce((sum, tx) => sum + (tx.platformFee || tx.amount || 0), 0);

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
            {Number(totalCommissionRevenue).toFixed(4)} π
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

      {/* TAB 1: Commission Config */}
      {activeTab === 'overview' && (
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
                              <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-[#26215C] text-white">Admin</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                            <span className={isUserActive ? 'text-[#0F6E56] font-bold' : 'text-rose-500 font-bold'}>
                              {isUserActive ? l('فعال', 'Active', 'نشط', '正常') : l('مسدود', 'Suspended', 'محظور', '已冻结')}
                            </span>
                            <span>•</span>
                            <span>{u.kycStatus === 'verified' ? 'KYC Verified' : 'Unverified'}</span>
                          </div>
                        </div>
                      </div>

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
                        <span className="font-bold text-rose-600 dark:text-rose-400">{rep.reason || 'گزارش تخلف'}</span>
                        <span className="text-[10px] text-slate-400 font-mono">@{rep.reporterUsername}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mt-1">{rep.description || rep.details || 'توضیحاتی ثبت نشده است.'}</p>
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
                      <span className="text-[9px] text-slate-400">{tx.timestamp ? new Date(tx.timestamp).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US') : 'تاییدشده'}</span>
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
