/**
 * Rentora Centralized Financial Calculation Engine (v3.0 - GCV & Micro-Fee Ready)
 * Handles In-App Wallet Balances, Platform Fees, and P2P Settlements with fractional Pi support.
 */

export class FinancialEngine {
  /**
   * Round a number safely to 4 decimal places for micro-transactions
   */
  static round4(val) {
    const num = Number(val);
    if (isNaN(num)) return 0;
    return Math.round((num + Number.EPSILON) * 10000) / 10000;
  }

  static round2(val) {
    const num = Number(val);
    if (isNaN(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calculate rental duration in days between two ISO date strings
   */
  static calculateDays(startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return 1;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    
    // Normalize to midnight UTC
    const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    
    const diffMs = endUTC - startUTC;
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, isNaN(days) ? 1 : days);
  }

  /**
   * Calculate booking financials
   */
  static calculateBookingFinancials({
    dailyRate,
    startDate,
    endDate,
    platformFeePercentage = 5,
    securityDeposit = 0,
    ownerIsPro = false
  }) {
    const rate = Math.max(0, this.round4(dailyRate));
    const daysCount = this.calculateDays(startDate, endDate);
    const feePercent = ownerIsPro ? 0 : Math.max(0, Math.min(50, this.round4(platformFeePercentage)));
    const deposit = Math.max(0, this.round4(securityDeposit));

    // Base rental amount (paid to owner)
    const baseRentalAmount = this.round4(rate * daysCount);

    // Platform booking commission (charged via Pi SDK) - Floor 0.0001 Pi for GCV micro-fees
    let totalPlatformFee = 0;
    if (!ownerIsPro) {
      const calcFee = this.round4((baseRentalAmount * feePercent) / 100);
      totalPlatformFee = Math.max(0.0001, calcFee);
    }

    const renterCommissionShare = totalPlatformFee;
    const ownerCommissionShare = 0;
    const ownerDirectPayAtPickup = baseRentalAmount;

    return {
      daysCount,
      dailyRate: rate,
      baseRentalAmount,
      platformFeePercentage: feePercent,
      platformFee: totalPlatformFee,
      totalPlatformFee,
      renterCommissionShare,
      ownerCommissionShare,
      securityDeposit: deposit,
      ownerDirectPayAtPickup,
      totalRenterChargedNow: totalPlatformFee,
      ownerIsPro,
      calculatedAt: new Date().toISOString()
    };
  }
}
