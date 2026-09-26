import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/ItemCard.jsx', 'utf8');

const assertions = [
  "aria-label={l(isFav ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'",
  "isFav ? 'Remove from favorites' : 'Add to favorites'",
  "isFav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'",
  "isFav ? '取消收藏' : '加入收藏'",
  "aria-label={l('مدیریت آگهی', 'Manage listing', 'إدارة الإعلان', '管理发布')}",
  "aria-label={l('رزرو این آگهی', 'Book this listing', 'حجز هذا الإعلان', '预订此发布')}",
  "l('موقعیت نامشخص', 'Location unavailable', 'الموقع غير متاح', '位置不可用')",
];

for (const assertion of assertions) {
  if (!source.includes(assertion)) {
    throw new Error('Missing ItemCard accessibility/localization assertion: ' + assertion);
  }
}

console.log('ItemCard accessibility/localization assertions passed');
