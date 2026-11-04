import { experienceStateService } from "./experienceStateService";
export const mediaAssets = {
  logo: "/brand-motion/logo/habb-logo-v1.webp",
  poster: "/brand-motion/posters/intro-poster-v1.webp",
  sprites: "/brand-motion/objects/event-objects-v1.webp",
};
export function selectFilmSources() {
  const flags = experienceStateService.getDiagnostics();
  if (flags.media === "failed" || flags.network === "offline")
    return [
      { src: "/brand-motion/video/unavailable-demo.mp4", type: "video/mp4" },
    ];
  const connection = (navigator as any).connection;
  const mobile =
    innerWidth < 768 ||
    connection?.saveData ||
    /2g/.test(connection?.effectiveType || "") ||
    flags.network === "slow4g";
  const variant = mobile ? "mobile" : "desktop";
  return [
    { src: `/brand-motion/video/intro-v1-${variant}.mp4`, type: "video/mp4" },
    { src: `/brand-motion/video/intro-v1-${variant}.webm`, type: "video/webm" },
  ];
}
export function warmBrandAssets() {
  return Promise.allSettled(
    [mediaAssets.logo, mediaAssets.sprites].map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src;
          if (img.complete) resolve();
        }),
    ),
  );
}
let audio: AudioContext | null = null;
export function primeSignatureSound() {
  try {
    audio ||= new AudioContext();
    audio.resume().catch(() => {});
  } catch {}
}
export function playSignatureSound() {
  if (experienceStateService.getMuted() || !audio || audio.state !== "running")
    return;
  const now = audio.currentTime;
  for (const [i, f] of [440, 659.25, 880].entries()) {
    const oscillator = audio.createOscillator(),
      gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = f;
    gain.gain.setValueAtTime(0, now + i * 0.07);
    gain.gain.linearRampToValueAtTime(0.025, now + i * 0.07 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now + i * 0.07);
    oscillator.stop(now + 0.9);
  }
}
