export const defaultBrand = 'هَبّ السعد';
export const defaultLatin = 'HABB ALSAAD';
export const logoDefaults = {
  logo: '/assets/habb-alsaad-logo-clean.png',
  emblem: '/assets/habb-alsaad-emblem.png',
  icon: '/assets/habb-alsaad-icon.png',
};

export function branding(settings = {}) {
  const name = settings.brand ?? defaultBrand;
  const latin = settings.brandLatin ?? defaultLatin;
  const originalNames = name === defaultBrand && latin === defaultLatin;
  const logo = settings.brandLogo === undefined
    ? (originalNames ? logoDefaults.logo : null)
    : settings.brandLogo;
  const emblem = settings.brandEmblem === undefined ? logoDefaults.emblem : settings.brandEmblem;
  const icon = settings.brandIcon === undefined ? logoDefaults.icon : settings.brandIcon;
  return {
    name, latin, logo, emblem, icon,
    title: [name, latin].filter(Boolean).join(' | '),
    originalFilm: originalNames && logo === logoDefaults.logo && emblem === logoDefaults.emblem,
  };
}
