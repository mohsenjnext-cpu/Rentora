/**
 * Rentora Authoritative Financial Calculation Engine (v4.0 - P2P Marketplace Model)
 * 
 * Integer-based micro-unit arithmetic (10,000 micro-units = 1 Pi) to eliminate floating-point drift.
 * 
 * Model Rules:
 * - Rentora is a P2P Booking Marketplace, NOT an Escrow or Wallet.
 * - Rental & Deposit are settled directly between Owner and Renter (Direct P2P).
 * - Only the Rentora platform fee (5% of rental) is collected via official Pi Payment.
 */

export class FinancialEngine {
  // Precision scale: 10,000 integer units = 1.0000 Pi (supports up to 4 decimal places)
  static SCALE = 10000;

  /**
   * Convert Pi decimal float or string to integer micro-units
   */
  static toMicroUnits(piAmount) {
    const num = Number(piAmount);
    if (isNaN(num) || num <= 0) return 0;
    return Math.round((num + Number.EPSILON) * this.SCALE);
  }

  /**
   * Convert integer micro-units back to formatted decimal float
   */
  static fromMicroUnits(microUnits) {
    if (!microUnits || isNaN(microUnits) || microUnits <= 0) return 0;
    return Math.round(microUnits) / this.SCALE;
  }

  /**
   * Safe 4-decimal rounding helper
   */
  static round4(val) {
    return this.fromMicroUnits(this.toMicroUnits(val));
  }

  /**
   * Calculate rental duration in days between two ISO date strings (minimum 1 day)
   */
  static calculateDays(startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) return 1;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;

    // Normalize to UTC midnight to avoid DST or timezone drifts
    const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

    const diffMs = endUTC - startUTC;
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, isNaN(days) ? 1 : days);
  }

  /**
   * Calculate full booking quote and financials
   * 
   * @param {Object} params
   * @param {number|string} params.dailyRate - Daily price in Pi
   * @param {string} params.startDate - Start date ISO/YYYY-MM-DD
   * @param {string} params.endDate - End date ISO/YYYY-MM-DD
   * @param {number} [params.daysCount] - Explicit days count if dates omitted
   * @param {number|string} [params.securityDeposit=0] - Refundable security deposit in Pi
   * @param {number} [params.platformFeePercentage=5] - Default 5%
   * @param {boolean} [params.ownerIsPro=false] - If true, 0% fee applied
   * @returns {Object} Structured Financial Quote
   */
  static calculateBookingFinancials({
    dailyRate,
    startDate,
    endDate,
    daysCount = null,
    securityDeposit = 0,
    platformFeePercentage = 5,
    ownerIsPro = false
  }) {
    // 1. Calculate duration in days
    const days = daysCount ? Math.max(1, parseInt(daysCount, 10)) : this.calculateDays(startDate, endDate);

    // 2. Integer micro-units for inputs
    const dailyRateUnits = this.toMicroUnits(dailyRate);
    const depositUnits = this.toMicroUnits(securityDeposit);
    const feePercentage = ownerIsPro ? 0 : Math.max(0, Math.min(50, Number(platformFeePercentage) || 5));

    // 3. Rental Total = dailyRate * days (in micro-units)
    const rentalTotalUnits = dailyRateUnits * days;

    // 4. Rentora Platform Fee = 5% of rental total (floor of 1 micro-unit = 0.0001 Pi)
    let rentoraFeeUnits = 0;
    if (!ownerIsPro && feePercentage > 0 && rentalTotalUnits > 0) {
      const rawFeeUnits = Math.round((rentalTotalUnits * feePercentage) / 100);
      rentoraFeeUnits = Math.max(1, rawFeeUnits); // Floor 0.0001 Pi for official Pi SDK
    }

    // 5. Direct P2P amounts (settled between owner and renter, NOT held by Rentora)
    const ownerDirectRentalUnits = rentalTotalUnits;
    const ownerDirectDepositUnits = depositUnits;
    const totalRentalObligationUnits = rentalTotalUnits + depositUnits;

    // 6. Convert to standard decimal Pi outputs
    const dailyRatePi = this.fromMicroUnits(dailyRateUnits);
    const rentalTotalPi = this.fromMicroUnits(rentalTotalUnits);
    const depositPi = this.fromMicroUnits(depositUnits);
    const rentoraFeePi = this.fromMicroUnits(rentoraFeeUnits);
    const ownerDirectRentalPi = this.fromMicroUnits(ownerDirectRentalUnits);
    const ownerDirectDepositPi = this.fromMicroUnits(ownerDirectDepositUnits);
    const totalRentalObligationPi = this.fromMicroUnits(totalRentalObligationUnits);

    return {
      // Days & Rates
      daysCount: days,
      dailyRate: dailyRatePi,

      // Core P2P Financials (settled directly in person)
      rentalTotal: rentalTotalPi,
      baseRentalAmount: rentalTotalPi,
      deposit: depositPi,
      securityDeposit: depositPi,
      totalRentalObligation: totalRentalObligationPi,

      // Direct P2P Settlement Flags
      ownerDirectRentalAmount: ownerDirectRentalPi,
      ownerDirectDeposit: ownerDirectDepositPi,
      ownerDirectPayAtPickup: ownerDirectRentalPi,

      // Rentora Platform Fee (The ONLY amount processed via Pi SDK)
      rentoraFee: rentoraFeePi,
      totalPlatformFee: rentoraFeePi,
      paymentDueToRentora: rentoraFeePi,
      platformFeePercentage: feePercentage,
      renterCommissionShare: rentoraFeePi,
      ownerCommissionShare: 0,
      totalRenterChargedNow: rentoraFeePi,

      // Status info
      ownerIsPro: Boolean(ownerIsPro),
      isEscrowApplied: false, // Explicitly false: Rentora does not hold escrow
      settlementType: 'direct_p2p_with_pi_platform_fee',
      calculatedAt: new Date().toISOString()
    };
  }
}
