/**
 * Rentora UI-01 navigation contract.
 *
 * These are top-level destinations only. Detail/edit/modal states are
 * intentionally not tabs because they are deeper in the information
 * hierarchy.
 */
export const primaryNavigation = [
  { id: 'home', labelKey: 'navHome' },
  { id: 'discover', labelKey: 'navDiscover' },
  { id: 'activity', labelKey: 'navActivity' },
  { id: 'profile', labelKey: 'navProfile' },
];

export const secondaryNavigation = [
  { id: 'owner-hub', labelKey: 'navOwnerHub' },
  { id: 'settings', labelKey: 'navSettings' },
];

export const detailRoutes = new Set([
  'item-detail',
  'public-profile',
  'list-item',
]);

export const navigationRegistry = {
  primary: primaryNavigation,
  secondary: secondaryNavigation,
  details: detailRoutes,
};
