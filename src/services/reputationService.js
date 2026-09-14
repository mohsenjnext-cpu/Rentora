/**
 * Reputation & Rating Calculation Service for Rentora Pioneers
 * 
 * Rules:
 * - New users start with NO rating (score: null / "جدید" - New Pioneer).
 * - Reputation increases dynamically as users receive genuine ratings from completed rentals.
 * - Minimum 1 completed review required before displaying a numeric average.
 */

export function getUserReputationSummary(username, reviews = [], rentals = []) {
  if (!username) {
    return {
      score: null,
      scoreDisplay: '—',
      formattedScore: 'جدید',
      label: 'نامشخص',
      reviewCount: 0,
      isNew: true,
      starsText: 'بدون بازخورد',
      badgeClass: 'badge-amber'
    };
  }

  const cleanUser = String(username).toLowerCase().replace('@', '').trim();

  // If reviews is an object from API response { stats, reviews }
  if (reviews && typeof reviews === 'object' && !Array.isArray(reviews) && reviews.stats) {
    const stats = reviews.stats;
    if (stats.isNew || stats.totalReviews === 0 || !stats.averageRating) {
      return {
        score: null,
        scoreDisplay: 'جدید',
        formattedScore: 'جدید',
        label: 'پیشگام جدید',
        reviewCount: 0,
        isNew: true,
        starsText: 'هنوز بازخوردی ثبت نشده است (پیشگام جدید)',
        badgeClass: 'badge-purple'
      };
    }
    const avg = Number(stats.averageRating).toFixed(1);
    const numericScore = parseFloat(avg);
    return {
      score: numericScore,
      scoreDisplay: avg,
      formattedScore: `${avg} ★`,
      label: `${avg} ★`,
      reviewCount: stats.totalReviews,
      isNew: false,
      starsText: `${avg} از ۵ ستاره (${stats.totalReviews} نظر ثبت‌شده)`,
      badgeClass: numericScore >= 4.5 ? 'badge-trust' : 'badge-amber'
    };
  }

  // Find reviews targeting this user or written for this owner's items
  const userReviews = (Array.isArray(reviews) ? reviews : []).filter(r => {
    const target = String(r.revieweeUsername || r.targetUsername || r.ownerUsername || '').toLowerCase().replace('@', '').trim();
    return target === cleanUser;
  });

  const count = userReviews.length;

  if (count === 0) {
    return {
      score: null,
      scoreDisplay: 'جدید',
      formattedScore: 'جدید',
      label: 'پیشگام جدید',
      reviewCount: 0,
      isNew: true,
      starsText: 'هنوز بازخوردی ثبت نشده است (پیشگام جدید)',
      badgeClass: 'badge-purple'
    };
  }

  const sum = userReviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
  const avg = (sum / count).toFixed(1);
  const numericScore = parseFloat(avg);

  return {
    score: numericScore,
    scoreDisplay: avg,
    formattedScore: `${avg} ★`,
    label: `${avg} ★`,
    reviewCount: count,
    isNew: false,
    starsText: `${avg} از ۵ ستاره (${count} نظر ثبت‌شده)`,
    badgeClass: numericScore >= 4.5 ? 'badge-trust' : 'badge-amber'
  };
}

export function getItemRatingSummary(item, reviews = []) {
  if (!item) {
    return {
      score: null,
      display: 'جدید',
      count: 0,
      isNew: true
    };
  }

  // If item already has aggregated rating from server
  if (item.averageRating && item.totalReviews > 0) {
    const avg = Number(item.averageRating).toFixed(1);
    return {
      score: parseFloat(avg),
      display: `${avg} ★`,
      count: item.totalReviews,
      isNew: false
    };
  }

  const itemReviews = (Array.isArray(reviews) ? reviews : []).filter(r => r.listingId === item.id || r.itemId === item.id);
  
  if (itemReviews.length === 0) {
    if (item.rating && item.rating > 0 && item.ratingCount > 0) {
      return {
        score: item.rating,
        display: `${item.rating} ★`,
        count: item.ratingCount,
        isNew: false
      };
    }
    return {
      score: null,
      display: 'جدید',
      count: 0,
      isNew: true
    };
  }

  const sum = itemReviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
  const avg = (sum / itemReviews.length).toFixed(1);

  return {
    score: parseFloat(avg),
    display: `${avg} ★`,
    count: itemReviews.length,
    isNew: false
  };
}
