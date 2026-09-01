/* eslint-disable @typescript-eslint/no-explicit-any */

type OpenCV = any;

let loadPromise: Promise<OpenCV> | null = null;

declare global {
  interface Window {
    cv?: OpenCV;
  }
}

export function isOpenCVReady(): boolean {
  return Boolean(window.cv?.Mat);
}

export function loadOpenCV(): Promise<OpenCV> {
  if (window.cv?.Mat) return Promise.resolve(window.cv);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const bestaand = document.querySelector('script[data-opencv="true"]');
    if (bestaand) {
      const wacht = () => {
        if (window.cv?.Mat) resolve(window.cv);
        else setTimeout(wacht, 100);
      };
      wacht();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.7.0/opencv.js";
    script.async = true;
    script.dataset.opencv = "true";
    script.onload = () => {
      const cv = window.cv;
      if (!cv) {
        reject(new Error("OpenCV kon niet worden geladen."));
        return;
      }
      if (cv.Mat) {
        resolve(cv);
        return;
      }
      cv.onRuntimeInitialized = () => resolve(cv);
    };
    script.onerror = () => reject(new Error("OpenCV kon niet worden geladen."));
    document.head.appendChild(script);
  });

  return loadPromise;
}
