import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export type VideoHandle = {
  seek: (ms: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  getElement: () => HTMLVideoElement | null;
};

type Props = {
  src: string | null;
  onTimeUpdate?: (ms: number) => void;
};

export const VideoPlayer = forwardRef<VideoHandle, Props>(function VideoPlayer(
  { src, onTimeUpdate },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => ({
    seek: (ms) => {
      if (videoRef.current) videoRef.current.currentTime = ms / 1000;
    },
    play: () => { void videoRef.current?.play(); },
    pause: () => { videoRef.current?.pause(); },
    togglePlay: () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) void v.play();
      else v.pause();
    },
    getElement: () => videoRef.current,
  }));

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !onTimeUpdate) return;
    const handler = () => onTimeUpdate(Math.round(v.currentTime * 1000));
    v.addEventListener('timeupdate', handler);
    v.addEventListener('seeked', handler);
    return () => {
      v.removeEventListener('timeupdate', handler);
      v.removeEventListener('seeked', handler);
    };
  }, [onTimeUpdate]);

  if (!src) {
    return <div className="video-placeholder">動画ファイルを読み込んでください</div>;
  }

  return <video ref={videoRef} src={src} controls preload="metadata" />;
});
