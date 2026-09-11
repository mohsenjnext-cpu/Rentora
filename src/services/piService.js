import { getApiBaseUrl } from './apiConfig';

class PiNetworkService {
  constructor() { this.isInitialized = false; this.isSandbox = true; }
  hasPiSdk() { return typeof window !== 'undefined' && !!window.Pi && typeof window.Pi.authenticate === 'function'; }
  setSandboxMode(enabled = true) { this.isSandbox = Boolean(enabled); this.isInitialized = false; return this.init(); }
  async init(sandbox = null) {
    if (sandbox !== null) this.isSandbox = Boolean(sandbox);
    if (!this.hasPiSdk() || typeof window.Pi.init !== 'function') return false;
    try { window.Pi.init({ version: '2.0', sandbox: this.isSandbox }); this.isInitialized = true; return true; }
    catch (_) { this.isInitialized = false; throw new Error('راه‌اندازی Pi SDK ناموفق بود.'); }
  }
  async authenticate(customIncompleteHandler = null) {
    if (!this.hasPiSdk()) throw new Error('NOT_IN_PI_BROWSER');
    await this.init();
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('آدرس سرور رنتورا تنظیم نشده است.');
    const onIncompletePayment = customIncompleteHandler || (async (payment) => {
      if (!payment?.identifier) return;
      try { await fetch(`${apiBase}/api/payments/incomplete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment }) }); } catch (_) {}
    });
    const authResult = await Promise.race([
      window.Pi.authenticate(['payments', 'username'], onIncompletePayment),
      new Promise((_, reject) => setTimeout(() => reject(new Error('پاسخی از Pi Browser دریافت نشد.')), 35000))
    ]);
    const accessToken = authResult?.accessToken;
    const sdkUser = authResult?.user;
    if (!accessToken || !sdkUser?.uid || !sdkUser?.username) throw new Error('اطلاعات معتبر از Pi Browser دریافت نشد.');
    const response = await fetch(`${apiBase}/api/auth/pi-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.sessionToken || !data?.user?.uid) throw new Error(data?.error || 'احراز هویت Pi در سرور رد شد.');
    return { accessToken, uid: data.user.uid, username: data.user.username, sessionToken: data.sessionToken, isOfficialSdk: true, kycStatus: data.user.kycStatus || 'unknown', user: data.user };
  }
  getSessionHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try { const raw = localStorage.getItem('rentora_live_v1_session'); const session = raw ? JSON.parse(raw) : null; if (session?.sessionToken) headers.Authorization = `Bearer ${session.sessionToken}`; } catch (_) {}
    return headers;
  }
  async ensurePaymentIntent(paymentIntentId, rentalId) {
    if (paymentIntentId) throw new Error('Payment Intent قدیمی بدون مقدار سروری قابل استفاده نیست.');
    if (!rentalId) throw new Error('شناسه رزرو برای ساخت Payment Intent لازم است.');
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('آدرس سرور رنتورا تنظیم نشده است.');
    const response = await fetch(`${apiBase}/api/payments/intent`, { method: 'POST', headers: this.getSessionHeaders(), body: JSON.stringify({ rentalId }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.paymentIntentId || !Number.isFinite(Number(data?.amount)) || !data?.memo) throw new Error(data?.error || 'ساخت Payment Intent ناموفق بود.');
    return { id: data.paymentIntentId, amount: Number(data.amount), memo: String(data.memo) };
  }
  async approvePaymentOnServer(paymentId, paymentIntentId) {
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('آدرس سرور رنتورا تنظیم نشده است.');
    const response = await fetch(`${apiBase}/api/payments/approve`, { method: 'POST', headers: this.getSessionHeaders(), body: JSON.stringify({ paymentId, paymentIntentId }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.approved !== true) throw new Error(data?.error || 'تایید پرداخت در سرور ناموفق بود.');
    return data;
  }
  async completePaymentOnServer(paymentId, txid, paymentIntentId) {
    const apiBase = getApiBaseUrl();
    if (!apiBase) throw new Error('آدرس سرور رنتورا تنظیم نشده است.');
    const response = await fetch(`${apiBase}/api/payments/complete`, { method: 'POST', headers: this.getSessionHeaders(), body: JSON.stringify({ paymentId, txid, paymentIntentId }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.completed !== true) throw new Error(data?.error || 'تکمیل پرداخت در سرور ناموفق بود.');
    return data;
  }
  async createPayment({ paymentData, callbacks, paymentIntentId }) {
    await this.init();
    if (!this.hasPiSdk() || typeof window.Pi.createPayment !== 'function') throw new Error('پرداخت Pi فقط در Pi Browser رسمی امکان‌پذیر است.');
    const serverIntent = await this.ensurePaymentIntent(paymentIntentId, paymentData?.metadata?.rentalId);
    const amount = serverIntent.amount;
    const memo = serverIntent.memo;
    const { onReadyForServerApproval, onReadyForServerCompletion, onCancel, onError } = callbacks || {};
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (error) => { if (settled) return; settled = true; reject(error instanceof Error ? error : new Error(String(error || 'پرداخت ناموفق بود.'))); };
      try {
        window.Pi.createPayment(
          { amount, memo, metadata: { ...(paymentData?.metadata || {}), paymentIntentId: serverIntent.id } },
          {
            onReadyForServerApproval: async (paymentId) => { try { await this.approvePaymentOnServer(paymentId, serverIntent.id); await onReadyForServerApproval?.(paymentId); } catch (error) { fail(error); } },
            onReadyForServerCompletion: async (paymentId, txid) => {
              try {
                const result = await this.completePaymentOnServer(paymentId, txid, serverIntent.id);
                await onReadyForServerCompletion?.(paymentId, txid, result);
                if (!settled) { settled = true; resolve({ paymentId, txid, status: 'completed', isNativePiSdk: true, serverResult: result }); }
              } catch (error) { fail(error); }
            },
            onCancel: (paymentId) => { onCancel?.(paymentId); fail(new Error('پرداخت توسط شما لغو شد.')); },
            onError: (error, payment) => { onError?.(error, payment); fail(new Error(error?.message || 'تراکنش Pi با خطا متوقف شد.')); }
          }
        );
      } catch (error) { fail(error); }
    });
  }
}

export const piService = new PiNetworkService();
