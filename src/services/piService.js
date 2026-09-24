import { getApiBaseUrl } from './apiConfig';

class PiNetworkService {
  constructor() {
    this.isInitialized = false;
    this.isSandbox = false;
    this.isSdkAuthenticated = false;
    this.authPromise = null;
  }

  hasPiSdk() {
    return typeof window !== 'undefined' && !!window.Pi && typeof window.Pi.authenticate === 'function';
  }

  async waitForSdk(timeoutMs = 12000) {
    if (this.hasPiSdk()) return true;
    if (typeof window === 'undefined') return false;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (this.hasPiSdk()) return true;
    }
    return false;
  }

  setSandboxMode() {
    this.isSandbox = false;
    this.isInitialized = false;
    return this.init();
  }

  async init() {
    this.isSandbox = false;
    if (!this.hasPiSdk() || typeof window.Pi.init !== 'function') return false;
    if (this.isInitialized || window.__PI_INITIALIZED__) {
      this.isInitialized = true;
      return true;
    }
    try {
      window.Pi.init({ version: '2.0', sandbox: false });
      this.isInitialized = true;
      window.__PI_INITIALIZED__ = true;
      return true;
    } catch (_) {
      this.isInitialized = true;
      window.__PI_INITIALIZED__ = true;
      return true;
    }
  }

  async ensureSdkAuthenticated(customIncompleteHandler = null) {
    if (this.isSdkAuthenticated) return true;
    if (!this.hasPiSdk()) {
      throw new Error('NOT_IN_PI_BROWSER');
    }
    await this.authenticate(customIncompleteHandler);
    return true;
  }

  async requestWalletScope() {
    if (!this.hasPiSdk()) throw new Error('NOT_IN_PI_BROWSER');
    this.isSdkAuthenticated = false;
    return await this.authenticate(null, ['payments', 'username', 'wallet_address']);
  }

  async handleIncompletePayment(payment) {
    if (!payment?.identifier) return;
    const apiBase = getApiBaseUrl();
    if (!apiBase) return;
    try {
      await fetch(`${apiBase}/api/payments/incomplete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment, paymentId: payment.identifier, txid: payment.transaction?.txid })
      });
    } catch (e) {
      console.warn('Incomplete payment handling error:', e);
    }
  }

  async authenticate(customIncompleteHandler = null, scopes = ['payments', 'username', 'wallet_address']) {
    if (!(await this.waitForSdk())) throw new Error('NOT_IN_PI_BROWSER');
    if (this.authPromise) return this.authPromise;

    this.authPromise = (async () => {
      try {
        await this.init();
        const apiBase = getApiBaseUrl();
        if (!apiBase) throw new Error('آدرس سرور رنتورا تنظیم نشده است.');
        const onIncompletePaymentFound = customIncompleteHandler || ((payment) => this.handleIncompletePayment(payment));

        const authResult = await Promise.race([
          window.Pi.authenticate(scopes, onIncompletePaymentFound),
          new Promise((_, reject) => setTimeout(() => reject(new Error('پاسخی از Pi Browser دریافت نشد. لطفاً مجدداً تلاش کنید.')), 35000))
        ]);

        const accessToken = authResult?.accessToken;
        const sdkUser = authResult?.user;
        if (!accessToken || !sdkUser?.uid || !sdkUser?.username) throw new Error('اطلاعات معتبر از Pi Browser دریافت نشد.');

        this.isSdkAuthenticated = true;

        const isUserKyc = Boolean(
          sdkUser?.kyc_status === true ||
          sdkUser?.kyc_status === 'verified' ||
          sdkUser?.is_kyc === true ||
          sdkUser?.kyc === true ||
          sdkUser?.credentials?.kyc === true ||
          (Array.isArray(sdkUser?.roles) && (
            sdkUser.roles.includes('kyc') ||
            sdkUser.roles.includes('kyced') ||
            sdkUser.roles.includes('pioneer_kyc')
          ))
        );

        const response = await fetch(`${apiBase}/api/auth/pi-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessToken,
            user: sdkUser,
            kycStatus: isUserKyc ? 'verified' : 'unverified'
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.user?.uid) throw new Error(data?.error || 'احراز هویت Pi در سرور رد شد.');
        return {
          accessToken,
          uid: data.user.uid,
          username: data.user.username,
          isOfficialSdk: true,
          kycStatus: data.user.kycStatus === 'verified' ? 'verified' : 'unverified',
          user: data.user
        };
      } finally {
        this.authPromise = null;
      }
    })();

    return this.authPromise;
  }

  getSessionHeaders() {
    return { 'Content-Type': 'application/json', credentials: 'include' };
  }

  async ensurePaymentIntent(paymentIntentId, rentalId) {
    if (!rentalId) throw new Error('شناسه رزرو برای ساخت Payment Intent لازم است.');
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('آدرس سرور رنتورا تنظیم نشده است.');
    const response = await fetch(`${apiBase}/api/payments/intent`, { method: 'POST', headers: this.getSessionHeaders(), body: JSON.stringify({ rentalId, paymentIntentId: paymentIntentId || undefined }) });
    const data = await response.json().catch(() => ({}));
    const intentId = data?.paymentIntentId || data?.id;
    if (!response.ok || !intentId || !Number.isFinite(Number(data?.amount)) || !data?.memo) {
      const errDetail = data?.error || data?.message || (response.status === 502 ? 'عدم امکان اتصال به سرور Pi' : 'ساخت Payment Intent ناموفق بود.');
      throw new Error(errDetail);
    }
    if (paymentIntentId && intentId !== paymentIntentId) throw new Error('Payment Intent با رزرو جاری منطبق نیست.');
    return { id: intentId, amount: Number(data.amount), memo: String(data.memo) };
  }

  async approvePaymentOnServer(paymentId, paymentIntentId) {
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('آدرس سرور رنتورا تنظیم نشده است.');
    const response = await fetch(`${apiBase}/api/payments/approve`, { method: 'POST', headers: this.getSessionHeaders(), body: JSON.stringify({ paymentId, paymentIntentId }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.approved !== true) {
      const errDetail = data?.error || data?.message || data?.error_message || (response.status === 502 ? 'خطا در تایید پرداخت در شبکه Pi' : 'تایید پرداخت در سرور ناموفق بود.');
      throw new Error(errDetail);
    }
    return data;
  }

  async completePaymentOnServer(paymentId, txid, paymentIntentId) {
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('آدرس سرور رنتورا تنظیم نشده است.');
    const response = await fetch(`${apiBase}/api/payments/complete`, { method: 'POST', headers: this.getSessionHeaders(), body: JSON.stringify({ paymentId, txid, paymentIntentId }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.completed !== true) {
      const errDetail = data?.error || data?.message || data?.error_message || (response.status === 502 ? 'خطا در نهایی‌سازی پرداخت در شبکه Pi' : 'تکمیل پرداخت در سرور ناموفق بود.');
      throw new Error(errDetail);
    }
    return data;
  }

  async createPayment({ paymentData, callbacks, paymentIntentId }) {
    if (!(await this.waitForSdk()) || typeof window.Pi.createPayment !== 'function') throw new Error('پرداخت Pi فقط در Pi Browser رسمی امکان‌پذیر است.');
    await this.init();

    const serverIntent = await this.ensurePaymentIntent(paymentIntentId, paymentData?.metadata?.rentalId);
    const amount = serverIntent.amount;
    const memo = serverIntent.memo;
    const { onReadyForServerApproval, onReadyForServerCompletion, onCancel, onError } = callbacks || {};

    const executeNativePayment = () => {
      return new Promise((resolve, reject) => {
        let settled = false;
        const fail = (error) => {
          if (settled) return;
          settled = true;
          reject(error instanceof Error ? error : new Error(String(error?.message || error || 'پرداخت ناموفق بود.')));
        };

        try {
          const paymentMetadata = {
            ...(serverIntent.metadata || {}),
            paymentIntentId: serverIntent.id,
            rentalId: serverIntent.metadata?.rentalId || paymentData?.metadata?.rentalId
          };

          window.Pi.createPayment(
            { amount, memo, metadata: paymentMetadata },
            {
              onReadyForServerApproval: async (paymentId) => {
                try {
                  await this.approvePaymentOnServer(paymentId, serverIntent.id);
                  await onReadyForServerApproval?.(paymentId);
                } catch (error) {
                  fail(error);
                }
              },
              onReadyForServerCompletion: async (paymentId, txid) => {
                try {
                  const result = await this.completePaymentOnServer(paymentId, txid, serverIntent.id);
                  await onReadyForServerCompletion?.(paymentId, txid, result);
                  if (!settled) {
                    settled = true;
                    resolve({ paymentId, txid, status: 'completed', isNativePiSdk: true, serverResult: result });
                  }
                } catch (error) {
                  fail(error);
                }
              },
              onCancel: (paymentId) => {
                onCancel?.(paymentId);
                fail(new Error('پرداخت توسط شما لغو شد.'));
              },
              onError: (error, payment) => {
                onError?.(error, payment);
                fail(new Error(error?.message || 'تراکنش Pi با خطا متوقف شد.'));
              }
            }
          );
        } catch (error) {
          fail(error);
        }
      });
    };

    try {
      return await executeNativePayment();
    } catch (err) {
      const errMsg = String(err?.message || '').toLowerCase();
      if (errMsg.includes('scope') || errMsg.includes('payment') || errMsg.includes('authenticate')) {
        this.isSdkAuthenticated = false;
        await this.authenticate();
        return await executeNativePayment();
      }
      throw err;
    }
  }
}

export const piService = new PiNetworkService();
