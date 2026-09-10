/**
 * Rentora Authoritative Rental State Machine
 * 
 * Strict lifecycle transition matrix:
 * 
 * [requested] ──────> [awaiting_payment] ───> [payment_pending] ───> [confirmed] ───> [active] ───> [completed]
 *      │                       │                      │                    │              │
 *      ▼                       ▼                      ▼                    ▼              ▼
 *  [cancelled]             [cancelled]            [failed]             [disputed]     [disputed]
 *                                                                          │              │
 *                                                                          ▼              ▼
 *                                                                     [refunded]    [resolved_owner]
 */

export const RENTAL_STATES = {
  REQUESTED: 'requested',
  AWAITING_PAYMENT: 'awaiting_payment',
  PAYMENT_PENDING: 'payment_pending',
  CONFIRMED: 'confirmed',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
  REFUNDED: 'refunded'
};

export const ALLOWED_TRANSITIONS = {
  [RENTAL_STATES.REQUESTED]: [
    RENTAL_STATES.AWAITING_PAYMENT,
    RENTAL_STATES.CONFIRMED, // if instant book
    RENTAL_STATES.CANCELLED
  ],
  [RENTAL_STATES.AWAITING_PAYMENT]: [
    RENTAL_STATES.PAYMENT_PENDING,
    RENTAL_STATES.CANCELLED
  ],
  [RENTAL_STATES.PAYMENT_PENDING]: [
    RENTAL_STATES.CONFIRMED,
    RENTAL_STATES.AWAITING_PAYMENT // on payment retry
  ],
  [RENTAL_STATES.CONFIRMED]: [
    RENTAL_STATES.ACTIVE,
    RENTAL_STATES.CANCELLED,
    RENTAL_STATES.DISPUTED
  ],
  [RENTAL_STATES.ACTIVE]: [
    RENTAL_STATES.COMPLETED,
    RENTAL_STATES.DISPUTED
  ],
  [RENTAL_STATES.COMPLETED]: [], // Terminal state
  [RENTAL_STATES.CANCELLED]: [], // Terminal state
  [RENTAL_STATES.DISPUTED]: [
    RENTAL_STATES.COMPLETED, // Admin resolves to owner
    RENTAL_STATES.REFUNDED   // Admin resolves to renter
  ],
  [RENTAL_STATES.REFUNDED]: [] // Terminal state
};

export class RentalStateMachine {
  /**
   * Validate if a transition from currentState to nextState is legally allowed
   */
  static canTransition(currentState, nextState) {
    const allowed = ALLOWED_TRANSITIONS[currentState] || [];
    return allowed.includes(nextState);
  }

  /**
   * Enforce transition rules and check actor permissions
   */
  static validateTransition({
    rental,
    nextState,
    actorRole, // 'renter' | 'owner' | 'admin' | 'system'
    actorUid
  }) {
    if (!rental) {
      throw new Error("Rental not found.");
    }

    const currentState = rental.status;

    if (!this.canTransition(currentState, nextState)) {
      throw new Error(
        `Illegal state transition: Cannot transition rental from "${currentState}" to "${nextState}".`
      );
    }

    // Role-based authorization rules
    if (actorRole === 'admin' || actorRole === 'system') {
      return true; // Admin and system hooks can execute all legal transitions
    }

    if (nextState === RENTAL_STATES.ACTIVE) {
      // Only owner can confirm handover to activate rental
      if (rental.ownerUid !== actorUid) {
        throw new Error("Unauthorized: Only the item owner can verify handover and activate rental.");
      }
    }

    if (nextState === RENTAL_STATES.COMPLETED) {
      // Only owner or admin can mark as completed upon return
      if (rental.ownerUid !== actorUid) {
        throw new Error("Unauthorized: Only the item owner can confirm item return.");
      }
    }

    if (nextState === RENTAL_STATES.CANCELLED) {
      // Both renter and owner can cancel prior to handover, or admin
      if (rental.renterUid !== actorUid && rental.ownerUid !== actorUid) {
        throw new Error("Unauthorized: Only the renter or owner can cancel this booking.");
      }
      if (currentState === RENTAL_STATES.ACTIVE || currentState === RENTAL_STATES.COMPLETED) {
        throw new Error("Cannot cancel an active or completed rental. Open a dispute instead.");
      }
    }

    if (nextState === RENTAL_STATES.DISPUTED) {
      if (rental.renterUid !== actorUid && rental.ownerUid !== actorUid) {
        throw new Error("Unauthorized: Only participants in this rental can raise a dispute.");
      }
    }

    return true;
  }
}
