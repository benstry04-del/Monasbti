import React, { useState } from 'react';
import { branding, defaultBrand, defaultLatin, logoDefaults } from './branding.mjs';
import { Btn, Field } from './main';

const images = [
  ['brandLogo', 'logo', 'الشعار الكامل للفوتر والدخول والوثائق'],
  ['brandEmblem', 'emblem', 'رمز العلامة للقوائم والشاشات'],
  ['brandIcon', 'icon', 'أيقونة تبويب المتصفح'],
] as const;

export function BrandSettings({ settings, act }: any) {
  const [draft, setDraft] = useState<any>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const preview = branding({ ...settings, ...draft });
  const update = (key: string, value: string | null) =>
    setDraft((current: any) => ({ ...current, [key]: value }));

  async function upload(key: string, file?: File) {
    if (!file) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 102400) {
      setError('اختر صورة PNG أو JPEG أو WebP بحجم لا يتجاوز 100 كيلوبايت.');
      return;
    }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => { update(key, String(reader.result)); setBusy(false); };
    reader.onerror = () => { setError('تعذرت قراءة الصورة.'); setBusy(false); };
    reader.readAsDataURL(file);
  }

  return <form className="card settings-form section" onSubmit={async event => {
    event.preventDefault();
    setBusy(true);
    try {
      if (await act('SETTINGS', draft, 'تم حفظ الهوية في النظام')) setDraft({});
    } finally {
      setBusy(false);
    }
  }}>
    <h2>هوية العلامة</h2>
    <p>اترك الاسم فارغًا لإخفائه. يمكن رفع كل صورة أو حذفها بصورة مستقلة. عند تغيير الهوية تظهر شاشة البداية المحدثة بدل الفيلم الأصلي، لأن الهوية الأصلية مدمجة في الفيديو.</p>
    <Field label="اسم العلامة بالعربية">
      <input maxLength={100} value={preview.name} onChange={e => update('brand', e.target.value)} />
    </Field>
    <Field label="الاسم اللاتيني">
      <input maxLength={100} dir="auto" value={preview.latin} onChange={e => update('brandLatin', e.target.value)} />
    </Field>
    {images.map(([key, slot, label]) => <fieldset className="card" key={key}>
      <legend>{label}</legend>
      {preview[slot] && <img src={preview[slot]} alt={label} style={{ width: 112, height: 76, objectFit: 'contain' }} />}
      <input type="file" accept="image/png,image/jpeg,image/webp" aria-label={label} disabled={busy}
        onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void upload(key, file); }} />
      <div className="button-row">
        <Btn type="button" variant="outline" onClick={() => update(key, null)}>حذف الصورة</Btn>
        <Btn type="button" variant="text" onClick={() => update(key, logoDefaults[slot])}>استعادة الصورة الأصلية</Btn>
      </div>
    </fieldset>)}
    {error && <p role="alert">{error}</p>}
    <div className="button-row">
      <Btn type="submit" disabled={busy || !Object.keys(draft).length}>حفظ الهوية</Btn>
      <Btn type="button" variant="outline" onClick={() => setDraft({ brand: "", brandLatin: "", brandLogo: null, brandEmblem: null, brandIcon: null })}>إخفاء الهوية بالكامل</Btn>
      <Btn type="button" variant="text" onClick={() => setDraft({
        brand: defaultBrand, brandLatin: defaultLatin,
        brandLogo: logoDefaults.logo, brandEmblem: logoDefaults.emblem, brandIcon: logoDefaults.icon,
      })}>استعادة الهوية الأصلية</Btn>
    </div>
  </form>;
}
