import React, { useState, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { usePiAuth } from '../context/PiAuthContext';
import { 
  X, 
  Camera, 
  Upload, 
  Sparkles, 
  Check, 
  Image as ImageIcon,
  RefreshCw,
  User
} from 'lucide-react';

const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=avina60',
  'https://api.dicebear.com/7.x/bottts/svg?seed=mohsenjnext',
  'https://api.dicebear.com/7.x/bottts/svg?seed=pioneer_gold',
  'https://api.dicebear.com/7.x/bottts/svg?seed=alpha_tech',
  'https://api.dicebear.com/7.x/bottts/svg?seed=cyber_pi',
  'https://api.dicebear.com/7.x/bottts/svg?seed=matrix_lens',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Sarah',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Alex',
  'https://api.dicebear.com/7.x/lorelei/svg?seed=Sam',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=PioneerIran',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/fun-emoji/svg?seed=PiNetwork'
];

export default function AvatarModal({ isOpen, onClose }) {
  const { dir } = useLanguage();
  const { currentUser, updateUserProfile } = usePiAuth();

  const [selectedAvatar, setSelectedAvatar] = useState(currentUser?.avatar || PRESET_AVATARS[0]);
  const [customUrl, setCustomUrl] = useState('');
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'presets' | 'url'
  const fileInputRef = useRef(null);

  if (!isOpen || !currentUser) return null;

  // Handle local image file upload & compression
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('لطفاً یک فایل تصویری معتبر انتخاب کنید.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress & resize to 256x256 max using canvas
        const canvas = document.createElement('canvas');
        const maxSize = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setSelectedAvatar(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = (e) => {
    e.preventDefault();
    if (customUrl.trim()) {
      setSelectedAvatar(customUrl.trim());
    }
  };

  const handleGenerateRandom = () => {
    const randomSeed = 'pi_' + Math.random().toString(36).substring(2, 8);
    setSelectedAvatar(`https://api.dicebear.com/7.x/bottts/svg?seed=${randomSeed}`);
  };

  const handleSave = () => {
    updateUserProfile({ avatar: selectedAvatar });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn select-none">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
      />

      {/* Modal Card */}
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="relative w-full max-w-md bg-white dark:bg-[#121124] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#EEEDFE] dark:bg-[#26215C] text-[#26215C] dark:text-[#EEEDFE] flex items-center justify-center">
              <Camera className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">تنظیم عکس پروفایل</h3>
              <p className="text-[11px] text-slate-400">تصویر شما در سراسر رنتورا و گفتگوها نمایش داده می‌شود</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current / Preview Avatar */}
        <div className="flex flex-col items-center justify-center py-2 gap-2">
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-[#534AB7] shadow-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <img
                src={selectedAvatar}
                alt="Profile Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.username}`;
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 p-1.5 bg-[#26215C] text-white rounded-lg shadow cursor-pointer hover:bg-[#534AB7] transition"
              title="آپلود عکس"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300" dir="ltr">
            @{currentUser.username}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#1A1930] rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'upload' 
                ? 'bg-white dark:bg-[#26215C] text-[#26215C] dark:text-white shadow-xs' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>آپلود از گالری</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'presets' 
                ? 'bg-white dark:bg-[#26215C] text-[#26215C] dark:text-white shadow-xs' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>آواتارهای پای</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'url' 
                ? 'bg-white dark:bg-[#26215C] text-[#26215C] dark:text-white shadow-xs' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>لینک مستقیم</span>
          </button>
        </div>

        {/* Tab 1: Upload from local storage */}
        {activeTab === 'upload' && (
          <div className="space-y-3 pt-1 animate-fadeIn">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#534AB7] rounded-xl p-6 text-center cursor-pointer transition bg-slate-50/50 dark:bg-[#16152B]/40 space-y-2"
            >
              <div className="w-10 h-10 mx-auto rounded-full bg-[#EEEDFE] dark:bg-[#1E1B3D] text-[#534AB7] flex items-center justify-center">
                <Upload className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                برای انتخاب تصویر از گوشی یا کامپیوتر کلیک کنید
              </div>
              <p className="text-[10px] text-slate-400">
                پشتیبانی از فرمت‌های JPG، PNG و WebP (حداکثر ۵ مگابایت)
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Preset Pi Avatars */}
        {activeTab === 'presets' && (
          <div className="space-y-3 pt-1 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">یکی از آواتارهای پیش‌فرض را انتخاب کنید:</span>
              <button
                type="button"
                onClick={handleGenerateRandom}
                className="text-[11px] font-bold text-[#534AB7] dark:text-[#AFA9EC] flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>تصادفی جدید</span>
              </button>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1">
              {PRESET_AVATARS.map((avatarUrl, idx) => {
                const isCurrent = selectedAvatar === avatarUrl;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedAvatar(avatarUrl)}
                    className={`relative rounded-xl overflow-hidden aspect-square border-2 transition cursor-pointer bg-slate-100 dark:bg-slate-800 ${
                      isCurrent 
                        ? 'border-[#534AB7] ring-2 ring-[#534AB7]/30 scale-105' 
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-400'
                    }`}
                  >
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    {isCurrent && (
                      <div className="absolute inset-0 bg-[#26215C]/40 flex items-center justify-center text-white">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Custom URL */}
        {activeTab === 'url' && (
          <form onSubmit={handleApplyUrl} className="space-y-3 pt-1 animate-fadeIn">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">آدرس اینترنتی تصویر (Image URL):</label>
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://example.com/my-photo.jpg"
                className="w-full mt-1.5 p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121124] text-slate-900 dark:text-white"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={!customUrl.trim()}
              className="btn-secondary w-full py-2 text-xs font-bold cursor-pointer disabled:opacity-40"
            >
              پیش‌نمایش تصویر
            </button>
          </form>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 btn-primary py-2.5 text-xs font-bold cursor-pointer shadow-xs"
          >
            ذخیره و اعمال تصویر
          </button>
        </div>

      </div>
    </div>
  );
}
