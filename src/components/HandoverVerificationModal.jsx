import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRentora } from '../context/RentoraContext';
import { KeyRound, X, CheckCircle2, AlertCircle } from 'lucide-react';

export default function HandoverVerificationModal({ rental, type = 'handover', isOpen, onClose, onSuccess }) {
  const { t } = useLanguage();
  const { confirmHandover, confirmReturn } = useRentora();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !rental) return null;

  const isHandover = type === 'handover';
  const title = isHandover ? t('btnConfirmHandover') : t('btnConfirmReturn');
  const desc = isHandover ? t('handoverCodeDesc') : t('returnCodeDesc');
  const targetCode = isHandover ? rental.handoverCode : rental.returnCode;

  const handleVerify = (e) => {
    e.preventDefault();
    setError('');

    const res = isHandover
      ? confirmHandover(rental.id, code)
      : confirmReturn(rental.id, code);

    if (res.success) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setCode('');
        onClose();
        if (onSuccess) onSuccess();
      }, 1200);
    } else {
      setError(res.error || "Incorrect verification code. Please check with the renter.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white dark:bg-[#131722] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl p-6 sm:p-7">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#6D5DF5]/10 text-[#6D5DF5] flex items-center justify-center">
            <KeyRound className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {desc}
          </p>
        </div>

        {/* Demo Helper Hint */}
        <div className="mb-4 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 text-center text-xs text-purple-700 dark:text-purple-300">
          <span>Target Verification Code: </span>
          <span className="font-mono font-bold tracking-widest">{targetCode}</span>
        </div>

        {isSuccess ? (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-center font-bold text-sm flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>Verification Successful!</span>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <input
                type="text"
                maxLength="4"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 4-digit code"
                autoFocus
                className="w-full text-center text-2xl font-mono tracking-widest py-3 px-4 rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6D5DF5]"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={code.length !== 4}
              className="w-full py-3.5 px-6 rounded-2xl brand-gradient text-white font-bold text-sm shadow-md hover:opacity-95 disabled:opacity-50 transition"
            >
              {t('confirm')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
