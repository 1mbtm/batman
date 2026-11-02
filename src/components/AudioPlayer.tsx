import type { FC } from 'react';
import { useEffect, useRef } from 'react';

const TARGET_VOLUME = 0.75;

export const AudioPlayer: FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const hasStartedRef = useRef<boolean>(false);
  const fadeIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // 1. Initialize Audio Element with audible base volume
    const audio = new Audio('/soundtrack.mp3');
    audio.loop = false;
    audio.volume = 0.15; // Start at audible baseline immediately
    audio.preload = 'auto';
    audioRef.current = audio;

    // 2. AudioContext initialization for instant hardware unlock
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      try {
        audioContextRef.current = new AudioCtx();
      } catch {
        // Fallback to standard HTML5 Audio
      }
    }

    // 3. Guaranteed smooth volume ramp (from 0.15 to TARGET_VOLUME over 1.2s)
    const startVolumeRamp = () => {
      const currentAudio = audioRef.current;
      if (!currentAudio) return;

      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }

      let currentVol = currentAudio.volume;
      const step = 0.04;

      fadeIntervalRef.current = window.setInterval(() => {
        if (!audioRef.current || audioRef.current.paused) {
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          return;
        }

        currentVol += step;
        if (currentVol >= TARGET_VOLUME) {
          audioRef.current.volume = TARGET_VOLUME;
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        } else {
          audioRef.current.volume = currentVol;
        }
      }, 50);
    };

    const unlockAndPlay = () => {
      if (hasStartedRef.current || !audioRef.current) return;

      // Resume AudioContext if suspended
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }

      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            hasStartedRef.current = true;
            removeListeners();
            startVolumeRamp();
          })
          .catch(() => {
            // Browser autoplay gate required a gesture; keep listeners active
          });
      }
    };

    // Clean stop on audio end
    audio.onended = () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.volume = 0;
      }
    };

    const addListeners = () => {
      // 1. Scroll & Wheel (Desktop & Trackpad)
      window.addEventListener('scroll', unlockAndPlay, { passive: true });
      window.addEventListener('wheel', unlockAndPlay, { passive: true });
      document.addEventListener('scroll', unlockAndPlay, { passive: true });
      document.addEventListener('wheel', unlockAndPlay, { passive: true });

      // 2. Mobile Touch Gestures
      window.addEventListener('touchstart', unlockAndPlay, { passive: true });
      window.addEventListener('touchmove', unlockAndPlay, { passive: true });
      window.addEventListener('touchend', unlockAndPlay, { passive: true });
      document.addEventListener('touchstart', unlockAndPlay, { passive: true });
      document.addEventListener('touchmove', unlockAndPlay, { passive: true });
      document.addEventListener('touchend', unlockAndPlay, { passive: true });

      // 3. Pointer & Mouse Gestures
      window.addEventListener('pointerdown', unlockAndPlay, { passive: true });
      window.addEventListener('pointermove', unlockAndPlay, { passive: true, once: false });
      window.addEventListener('mousedown', unlockAndPlay, { passive: true });
      window.addEventListener('click', unlockAndPlay, { passive: true });
      document.addEventListener('pointerdown', unlockAndPlay, { passive: true });
      document.addEventListener('click', unlockAndPlay, { passive: true });

      // 4. Keyboard Navigation
      window.addEventListener('keydown', unlockAndPlay, { passive: true });
      document.addEventListener('keydown', unlockAndPlay, { passive: true });
    };

    const removeListeners = () => {
      window.removeEventListener('scroll', unlockAndPlay);
      window.removeEventListener('wheel', unlockAndPlay);
      document.removeEventListener('scroll', unlockAndPlay);
      document.removeEventListener('wheel', unlockAndPlay);

      window.removeEventListener('touchstart', unlockAndPlay);
      window.removeEventListener('touchmove', unlockAndPlay);
      window.removeEventListener('touchend', unlockAndPlay);
      document.removeEventListener('touchstart', unlockAndPlay);
      document.removeEventListener('touchmove', unlockAndPlay);
      document.removeEventListener('touchend', unlockAndPlay);

      window.removeEventListener('pointerdown', unlockAndPlay);
      window.removeEventListener('pointermove', unlockAndPlay);
      window.removeEventListener('mousedown', unlockAndPlay);
      window.removeEventListener('click', unlockAndPlay);
      document.removeEventListener('pointerdown', unlockAndPlay);
      document.removeEventListener('click', unlockAndPlay);

      window.removeEventListener('keydown', unlockAndPlay);
      document.removeEventListener('keydown', unlockAndPlay);
    };

    addListeners();

    return () => {
      removeListeners();
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  // Invisible background audio engine
  return null;
};
