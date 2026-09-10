/**
 * Rentora Access Control & Authorization Boundaries
 * 
 * Enforces ownership and privileged action permissions:
 * - Renter can only access their own rental data
 * - Owner can only manage their own listings and rental agreements
 * - Admin requires role === 'admin'
 */

export class AccessControl {
  static canViewRental(user, rental) {
    if (!user || !rental) return false;
    if (user.role === 'admin') return true;
    return rental.renterUid === user.uid || rental.ownerUid === user.uid;
  }

  static canModifyListing(user, listing) {
    if (!user || !listing) return false;
    if (user.role === 'admin') return true;
    return listing.ownerUid === user.uid || listing.ownerUsername === user.username;
  }

  static canReviewRental(user, rental, existingReviews = []) {
    if (!user || !rental) return { allowed: false, reason: "Invalid request." };
    
    // Only renter can leave a review
    if (rental.renterUid !== user.uid && rental.renterUsername !== user.username) {
      return { allowed: false, reason: "Only the renter who completed the rental can leave a review." };
    }

    // Must be completed
    if (rental.status !== 'completed') {
      return { allowed: false, reason: "Reviews can only be submitted after the rental is successfully completed." };
    }

    // Prevent duplicate review
    const hasExisting = existingReviews.some(
      r => r.rentalId === rental.id || (r.itemId === rental.itemId && r.renterUid === user.uid)
    );
    if (hasExisting || rental.review) {
      return { allowed: false, reason: "A verified review has already been submitted for this rental." };
    }

    return { allowed: true };
  }

  static canExecuteAdminAction(user) {
    if (!user) return false;
    return user.role === 'admin';
  }
}
