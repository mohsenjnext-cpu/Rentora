/**
 * Pi Network Native Ads Service Abstraction
 * Compliant with official Pi Network Ads SDK specification.
 * Feature-flagged (disabled by default, ready for activation).
 */

export const PI_ADS_CONFIG = {
  enabled: false, // Feature flag: Pi Ads abstraction ready, live rendering off until production campaign activation
  adTypes: {
    REWARDED: 'rewarded',
    INTERSTITIAL: 'interstitial'
  }
};

class PiAdsService {
  constructor() {
    this.isEnabled = PI_ADS_CONFIG.enabled;
  }

  hasAdsSdk() {
    return typeof window !== 'undefined' && !!window.Pi && !!window.Pi.Ads;
  }

  /**
   * Check if an ad unit of specified type is loaded and ready to display
   * @param {'rewarded' | 'interstitial'} adType
   * @returns {Promise<boolean>}
   */
  async isAdReady(adType = PI_ADS_CONFIG.adTypes.REWARDED) {
    if (!this.isEnabled || !this.hasAdsSdk()) return false;
    try {
      if (typeof window.Pi.Ads.isAdReady === 'function') {
        const response = await window.Pi.Ads.isAdReady(adType);
        return Boolean(response?.ready);
      }
      return false;
    } catch (e) {
      console.warn('[Pi Ads] isAdReady check failed:', e?.message);
      return false;
    }
  }

  /**
   * Request / Preload an ad unit from Pi Ad Network
   * @param {'rewarded' | 'interstitial'} adType
   * @returns {Promise<boolean>}
   */
  async requestAd(adType = PI_ADS_CONFIG.adTypes.REWARDED) {
    if (!this.isEnabled || !this.hasAdsSdk()) return false;
    try {
      if (typeof window.Pi.Ads.requestAd === 'function') {
        const response = await window.Pi.Ads.requestAd(adType);
        return Boolean(response?.result === 'AD_LOADED' || response?.ready);
      }
      return false;
    } catch (e) {
      console.warn('[Pi Ads] requestAd failed:', e?.message);
      return false;
    }
  }

  /**
   * Show an ad unit to the user
   * @param {'rewarded' | 'interstitial'} adType
   * @returns {Promise<{ shown: boolean, rewarded: boolean }>}
   */
  async showAd(adType = PI_ADS_CONFIG.adTypes.REWARDED) {
    if (!this.isEnabled || !this.hasAdsSdk()) {
      return { shown: false, rewarded: false, reason: 'ADS_DISABLED' };
    }
    try {
      if (typeof window.Pi.Ads.showAd === 'function') {
        const response = await window.Pi.Ads.showAd(adType);
        return {
          shown: Boolean(response?.result === 'AD_CLOSED' || response?.result === 'AD_REWARDED'),
          rewarded: Boolean(response?.result === 'AD_REWARDED')
        };
      }
      return { shown: false, rewarded: false, reason: 'SDK_UNAVAILABLE' };
    } catch (e) {
      console.warn('[Pi Ads] showAd failed:', e?.message);
      return { shown: false, rewarded: false, error: e?.message };
    }
  }
}

export const piAdsService = new PiAdsService();
