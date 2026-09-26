import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { useRentora } from '../context/RentoraContext';
import { cloudSyncService } from '../services/cloudSyncService';
import BookingModal from '../components/BookingModal';
import ReportModal from '../components/ReportModal';
import {
  ArrowRight, MapPin, Star, Heart, Share2, ShieldCheck, Coins, Flag,
  Check, MessageSquare, Edit3, Loader2, Lock, ChevronLeft, ChevronRight, Maximize2, X
} from 'lucide-react';

export default function ItemDetailPage({
  item: initialItem,
  itemId,
  onBack,
  onBookingSuccess,
  onOpenChat,
  onOpenPublicProfile,
  onNavigateToOwnerHub,
  onEditItem,
  onSelectItem
}) {
  const { lang, dir, t, l } = useLanguage();
  const { currentUser } = usePiAuth();
  const { favorites, items, toggleFavorite, fetchListingReviews } = useRentora();

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [reviewsData, setReviewsData] = useState({
    stats: { totalReviews: 0, averageRating: null, isNew: true },
    reviews: []
  });
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [reviewRetryNonce, setReviewRetryNonce] = useState(0);
  const [detailItem, setDetailItem] = useState(initialItem || null);
  const [detailLoading, setDetailLoading] = useState(!initialItem && !!itemId);
  const [detailError, setDetailError] = useState('');
  const imagesList = Array.isArray(detailItem?.images) ? item.images.filter(Boolean) : [];
  const hasGallery = imagesList.length > 0;
  const localized = (fa, en, ar, zh) => l(fa, en, ar, zh);

  useEffect(() => {
    setDetailItem(initialItem || null);
    if (initialItem) {
      setDetailLoading(false);
      setDetailError('');
    }
  }, [initialItem]);

  useEffect(() => {
    if (initialItem || !itemId) {
      setDetailLoading(false);
      return undefined;
    }
    let mounted = true;
    setDetailLoading(true);
    setDetailError('');
    cloudSyncService.fetchListingById(itemId)
      .then((loadedItem) => {
        if (!mounted) return;
        setDetailItem(loadedItem);
        setDetailLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setDetailLoading(false);
        setDetailError(err?.status === 404
          ? l('این آگهی دیگر وجود ندارد یا در دسترس نیست.', 'This listing no longer exists or is unavailable.', 'هذا الإعلان لم يعد موجوداً أو متاحاً.', '此商品已不存在或不可用。')
          : l('بارگذاری آگهی ناموفق بود. لطفاً دوباره تلاش کنید.', 'Unable to load this listing. Please try again.', 'تعذر تحميل الإعلان. يرجى المحاولة مرة أخرى.', '商品加载失败，请重试。'));
      });
    return () => { mounted = false; };
  }, [initialItem, itemId, l]);

  useEffect(() => {
    if (!detailItem?.id) return;
    let mounted = true;
    setLoadingReviews(true);
    setReviewsError('');
    fetchListingReviews(detailItem.id)
      .then((data) => {
        if (mounted && data) setReviewsData(data);
      })
      .catch(() => {
        if (mounted) setReviewsError(l('بارگذاری نظرات ناموفق بود.', 'Unable to load reviews.', 'تعذر تحميل التقييمات.', '评价加载失败。'));
      })
      .finally(() => {
        if (mounted) setLoadingReviews(false);
      });
    return () => { mounted = false; };
  }, [detailItem?.id, fetchListingReviews, reviewRetryNonce]);

  useEffect(() => {
    setActiveImageIndex(0);
    setGalleryOpen(false);
  }, [detailItem?.id]);

  useEffect(() => {
    if (!galleryOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setGalleryOpen(false);
      if (event.key === 'ArrowLeft') moveImage(-1);
      if (event.key === 'ArrowRight') moveImage(1);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';