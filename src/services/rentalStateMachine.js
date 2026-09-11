/**
 * Rentora Authoritative Rental State Machine (v4.0)
 * 
 * Target Lifecycle:
 * [REQUESTED] ───> [ACCEPTED] ───> [PAYMENT_PENDING] ───> [CONFIRMED] ───> [ACTIVE] ───> [COMPLETED]
 *      │               │                   │                     │             │
 *      ▼               ▼                   ▼                     ▼             ▼
 *  [REJECTED]     [CANCELLED]         [CANCELLED]           [CANCELLED]    [DISPUTED]
 *                                                                │             │
 *                                                                ▼             ▼
 *                                                           [DISPUTED]   [COMPLETED]
 */

export const RENTAL_STATES = {
  REQUESTED: 'requested',
  ACCEPTED: 'accepted',
  PAYMENT_PENDING: 'payment_pending',
  CONFIRMED: 'confirmed',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed'
};

export const ALLOWED_TRANSITIONS = {
  [RENTAL_STATES.REQUESTED]: [
    RENTAL_STATES.ACCEPTED,
    RENTAL_STATES.PAYMENT_PENDING, // For instant booking
    RENTAL_STATES.CONFIRMED,       // For 0% fee instant booking
    RENTAL_STATES.REJECTED,
    RENTAL_STATES.CANCELLED
  ],
  [RENTAL_STATES.ACCEPTED]: [
    RENTAL_STATES.PAYMENT_PENDING,
    RENTAL_STATES.CONFIRMED,       // If fee is 0 Pi
    RENTAL_STATES.CANCELLED
  ],
  [RENTAL_STATES.PAYMENT_PENDING]: [
    RENTAL_STATES.CONFIRMED,       // Only after Pi API verification
    RENTAL_STATES.ACCEPTED,        // On retry
    RENTAL_STATES.CANCELLED
  ],
  [RENTAL_STATES.CONFIRMED]: [
    RENTAL_STATES.ACTIVE,          // Handover verified
    RENTAL_STATES.CANCELLED,       // Cancel before handover
    RENTAL_STATES.DISPUTED
  ],
  [RENTAL_STATES.ACTIVE]: [
    RENTAL_STATES.COMPLETED,       // Item returned
    RENTAL_STATES.DISPUTED
  ],
  [RENTAL_STATES.COMPLETED]: [],   // Terminal
  [RENTAL_STATES.REJECTED]: [],    // Terminal
  [RENTAL_STATES.CANCELLED]: [],   // Terminal
  [RENTAL_STATES.DISPUTED]: [
    RENTAL_STATES.COMPLETED,
    RENTAL_STATES.CANCELLED
  ]
};

export class RentalStateMachine {
  /**
   * Validate if a transition from currentState to nextState is legally allowed
   */
  static canTransition(currentState, nextState) {
    if (!currentState || !nextState) return false;
    const normCurrent = String(currentState).toLowerCase();
    const normNext = String(nextState).toLowerCase();
    if (normCurrent === normNext) return true;

    const allowed = ALLOWED_TRANSITIONS[normCurrent] || [];
    return allowed.includes(normNext);
  }

  /**
   * Enforce transition rules and check actor authorization
   */
  static validateTransition({
    rental,
    nextState,
    actorRole = 'user', // 'renter' | 'owner' | 'admin' | 'system'
    actorUid
  }) {
    if (!rental) {
      throw new Error("Rental booking not found.");
    }

    const currentState = String(rental.status || RENTAL_STATES.REQUESTED).toLowerCase();
    const targetState = String(nextState).toLowerCase();

    if (!this.canTransition(currentState, targetState)) {
      throw new Error(
        `Illegal state transition: Cannot transition booking from "${currentState}" to "${targetState}".`
      );
    }

    if (actorRole === 'admin' || actorRole === 'system') {
      return true;
    }

    // Handover check
    if (targetState === RENTAL_STATES.ACTIVE) {
      if (rental.ownerUid && actorUid && rental.ownerUid !== actorUid && rental.renterUid !== actorUid) {
        throw new Error("Unauthorized: Only the item owner or renter can confirm handover.");
      }
    }

    // Return check
    if (targetState === RENTAL_STATES.COMPLETED) {
      if (rental.ownerUid && actorUid && rental.ownerUid !== actorUid) {
        throw new Error("Unauthorized: Only the item owner can confirm safe return of the item.");
      }
    }

    // Cancellation check
    if (targetState === RENTAL_STATES.CANCELLED) {
      if (currentState === RENTAL_STATES.ACTIVE || currentState === RENTAL_STATES.COMPLETED) {
        throw new Error("Cannot cancel an active or completed rental. Please raise a dispute if needed.");
      }
    }

    return true;
  }

  /**
   * Get localized status badge details
   */
  static getStatusMeta(status, l = (fa, en) => fa) {
    const s = String(status || '').toLowerCase();
    switch (s) {
      case 'requested':
        return {
          label: l('درخواست شده', 'Requested', 'مطلوب', '已请求'),
          color: 'amber',
          bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
        };
      case 'accepted':
        return {
          label: l('تایید مالک', 'Accepted', 'مقبول', '物主已接受'),
          color: 'indigo',
          bg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
        };
      case 'payment_pending':
        return {
          label: l('در انتظار پرداخت کارمزد پای', 'Fee Payment Pending', 'بانتظار دفع العمولة', '待支付 Pi 平台费'),
          color: 'amber',
          bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
        };
      case 'confirmed':
        return {
          label: l('رزرو تایید شده (آماده تحویل)', 'Booking Confirmed', 'مؤكد (جاهز للتسليم)', '预订已确认（待交付）'),
          color: 'emerald',
          bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
        };
      case 'active':
        return {
          label: l('در حال استفاده (فعال)', 'Active / In Use', 'قيد الاستخدام', '租赁中（使用中）'),
          color: 'purple',
          bg: 'bg-[#EEEDFE] text-[#26215C] dark:bg-[#26215C] dark:text-[#EEEDFE]'
        };
      case 'completed':
        return {
          label: l('پایان یافته و عودت داده شد', 'Completed', 'مكتمل ومسترجع', '已完结归还'),
          color: 'emerald',
          bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
        };
      case 'cancelled':
        return {
          label: l('لغو شده', 'Cancelled', 'ملغي', '已取消'),
          color: 'slate',
          bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
        };
      case 'rejected':
        return {
          label: l('رد شده توسط مالک', 'Rejected', 'مرفوض', '物主已拒绝'),
          color: 'rose',
          bg: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
        };
      case 'disputed':
        return {
          label: l('در حال بررسی اختلاف', 'Disputed', 'نزاع قيد المراجعة', '争议处理中'),
          color: 'rose',
          bg: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
        };
      default:
        return {
          label: status || 'Pending',
          color: 'slate',
          bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
        };
    }
  }
}
