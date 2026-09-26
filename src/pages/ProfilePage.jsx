import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { getUserReputationSummary } from '../services/reputationService';
import { cloudSyncService } from '../services/cloudSyncService';
import { User, ShieldCheck, Star, Settings, Globe, LogOut, Edit3, Camera, Save, Package, CheckCircle2, AlertCircle, CalendarDays } from 'lucide-react';

function Avatar({ src, username, className = 'w-20 h-20' }) {
  return src ? <img src={src} alt="" className={className + ' rounded-2xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'} /> :
    <div className={className + ' rounded-2xl bg-[#EEEDFE] dark:bg-[#26215C] text-[#534AB7] dark:text-[#EEEDFE] flex items-center justify-center font-bold text-2xl border border-slate-200 dark:border-slate-700'}>{(username || 'P').charAt(0).toUpperCase()}</div>;
}

export default function ProfilePage({ onNavigate, onSelectItem, onOpenPublicProfile }) {
  const { t, l } = useLanguage();
  const { currentUser, isAuthenticated, setAuthModalOpen, logout, updateProfile, updateUserProfile } = usePiAuth();
  const { items = [], rentals = [], fetchUserReviews } = useRentora();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [userReviewsData, setUserReviewsData] = useState(null);
  const [reviewLoadError, setReviewLoadError] = useState('');
  const [reviewRetryNonce, setReviewRetryNonce] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.username) return;
    let mounted = true;
    setReviewLoadError('');
    fetchUserReviews(currentUser.username)
      .then(data => {
        if (!mounted) return;
        if (data) setUserReviewsData(data);
        else setReviewLoadError(l('داده‌های اعتبار کاربر دریافت نشد.', 'Unable to load reputation data.', 'تعذر تحميل بيانات السمعة.', '无法加载信誉数据。'));
      })
      .catch(err => {
        if (!mounted) return;
        setReviewLoadError(err?.message || l('خطا در بارگذاری اعتبار کاربر.', 'Failed to load reputation data.', 'فشل تحميل بيانات السمعة.', '加载信誉数据失败。'));
      });
    return () => { mounted = false; };
  }, [currentUser?.username, fetchUserReviews, reviewRetryNonce]);

  useEffect(() => {
    setDisplayName(currentUser?.displayName || currentUser?.username || '');
    setBio(currentUser?.bio || '');
    setAvatar(currentUser?.avatar || '');
  }, [currentUser?.displayName, currentUser?.username, currentUser?.bio, currentUser?.avatar]);

  const myItems = useMemo(() => (items || []).filter(i =>
    i.ownerUid === currentUser?.uid || i.ownerUsername?.toLowerCase() === currentUser?.username?.toLowerCase()
  ), [items, currentUser?.uid, currentUser?.username]);
  const myRentals = useMemo(() => (rentals || []).filter(r =>
    r.renterUsername?.toLowerCase() === currentUser?.username?.toLowerCase()
  ), [rentals, currentUser?.username]);

  const rentalHistoryCount = useMemo(() => (myRentals || []).filter(r =>
    ['completed', 'cancelled', 'rejected', 'disputed'].includes(String(r.status || '').toLowerCase())
  ).length, [myRentals]);

  const activeRentalCount = useMemo(() => (myRentals || []).filter(r =>
    ['draft', 'pending_payment', 'payment_approved', 'confirmed', 'active', 'requested', 'accepted'].includes(String(r.status || '').toLowerCase())
  ).length, [myRentals]);