/**
 * Rentora P2P Rental Marketplace - Clean Production Configuration & Categories
 * Official Pi Network Ecosystem Integration (Zero Mock Data)
 */

export const INITIAL_PLATFORM_CONFIG = {
  platformFeePercentage: 5, // 5% Booking Platform Fee for standard users
  proFeePercentage: 0, // 0% Booking Fee for Pro VIP Golden Owners (Configurable)
  minFeePi: 0.0001, // GCV & Micro-transaction ready floor (0.0001 π)
  maxFeePi: 50.0,
  commissionSplitModel: 'renter_pays_fee',
  disputeFeePi: 0.001,
  platformFeeRecipient: 'rentora_foundation_treasury'
};

export const CATEGORIES_LIST = [
  { id: "all", labelFa: "همه", labelEn: "All", icon: "Layers" },
  { id: "tools", labelFa: "ابزارآلات", labelEn: "Tools", icon: "Wrench" },
  { id: "cameras", labelFa: "عکاسی و دیجیتال", labelEn: "Cameras", icon: "Tv" },
  { id: "camping", labelFa: "کمپینگ و سفر", labelEn: "Camping", icon: "Tent" },
  { id: "sports", labelFa: "ورزش", labelEn: "Sports", icon: "Dumbbell" },
  { id: "vehicles", labelFa: "خودرو", labelEn: "Vehicles", icon: "Car" },
  { id: "events", labelFa: "مهمانی", labelEn: "Events", icon: "PartyPopper" },
  { id: "home", labelFa: "خانه", labelEn: "Home", icon: "Home" }
];

// Clean Production Initial State (100% Real - No Mock Data)
export const INITIAL_ITEMS = [];
export const INITIAL_RENTALS = [];
export const INITIAL_TRANSACTIONS = [];
export const INITIAL_REPORTS = [];
export const INITIAL_REVIEWS = [];
export const INITIAL_NOTIFICATIONS = [];
export const INITIAL_CHATS = [];

export const INITIAL_USERS = [
  {
    uid: "pi_usr_avina60",
    username: "avina60",
    displayName: "avina60",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=avina60",
    bio: "Rentora Founder & Pioneer Administrator",
    location: "ایران",
    role: "admin",
    kycStatus: "verified",
    reputation: 5.0,
    totalRentals: 0,
    piWalletConnected: true,
    joinedDate: "2024-03-14",
    phoneMasked: "+98 912 ••• ••••",
    status: "active"
  },
  {
    uid: "pi_usr_mohsenjnext",
    username: "mohsenjnext",
    displayName: "mohsenjnext",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=mohsenjnext",
    bio: "توسعه‌دهنده سیستم و پیشگام ارشد پای",
    location: "ایران",
    role: "admin",
    kycStatus: "verified",
    reputation: 5.0,
    totalRentals: 0,
    piWalletConnected: true,
    joinedDate: "2024-04-01",
    phoneMasked: "+98 915 ••• ••••",
    status: "active"
  }
];

export const MOCK_ITEMS = INITIAL_ITEMS;
export const MOCK_RENTALS = INITIAL_RENTALS;
export const MOCK_NOTIFICATIONS = INITIAL_NOTIFICATIONS;
export const MOCK_TRANSACTIONS = INITIAL_TRANSACTIONS;
export const MOCK_CATEGORIES = CATEGORIES_LIST;
export const MOCK_REVIEWS = INITIAL_REVIEWS;
export const MOCK_DISPUTES = INITIAL_REPORTS;
