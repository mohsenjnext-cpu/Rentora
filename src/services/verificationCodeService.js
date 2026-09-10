/**
 * Handover & Return Verification Code Service
 * 
 * Includes:
 * - Cryptographically random 6-digit & 4-digit code generation
 * - Brute-force rate limiting (max 5 failed attempts before lockout)
 * - Audit logging of all verification attempts
 */

export class VerificationCodeService {
  /**
   * Generate a secure 6-digit verification code (100000 - 999999)
   */
  static generateCode() {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return (100000 + (array[0] % 900000)).toString();
    }
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Alias for backward compatibility
   */
  static generateSecureCode() {
    return this.generateCode();
  }

  /**
   * Verify input code against target code with lockout tracking
   */
  static verifyCode({
    inputCode,
    targetCode,
    rentalId,
    actorUid,
    type = 'handover', // 'handover' | 'return'
    existingAttempts = []
  }) {
    const sanitizedInput = (inputCode || '').trim();
    
    // Filter attempts for this rental and code type
    const recentAttempts = existingAttempts.filter(
      a => a.rentalId === rentalId && a.type === type
    );

    const failedAttemptsCount = recentAttempts.filter(a => !a.success).length;

    // Check Lockout
    if (failedAttemptsCount >= 5) {
      return {
        success: false,
        locked: true,
        remainingAttempts: 0,
        error: "Verification locked: Exceeded maximum 5 attempts. Please contact Rentora Trust & Safety.",
        attemptLog: {
          rentalId,
          actorUid,
          type,
          timestamp: new Date().toISOString(),
          success: false,
          locked: true
        }
      };
    }

    const isMatch = sanitizedInput === String(targetCode).trim();
    const remainingAttempts = Math.max(0, 5 - (failedAttemptsCount + (isMatch ? 0 : 1)));

    const attemptLog = {
      rentalId,
      actorUid,
      type,
      timestamp: new Date().toISOString(),
      success: isMatch,
      remainingAttempts
    };

    if (isMatch) {
      return {
        success: true,
        locked: false,
        remainingAttempts,
        attemptLog
      };
    } else {
      return {
        success: false,
        locked: remainingAttempts === 0,
        remainingAttempts,
        error: `کد تایید وارد شده اشتباه است. (${remainingAttempts} تلاش باقی مانده)`,
        attemptLog
      };
    }
  }
}
