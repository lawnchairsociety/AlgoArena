import { useMemo } from 'react';

interface Candle {
  id: number;
  left: string;
  animDuration: string;
  animDelay: string;
  color: string;
  height: number;
  wickHeight: number;
  blur: string;
  opacity: number;
}

export function FloatingCandles() {
  const candles = useMemo<Candle[]>(() => {
    return Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: `${5 + Math.random() * 90}%`,
      animDuration: `${12 + Math.random() * 18}s`,
      animDelay: `${-Math.random() * 20}s`,
      color: Math.random() > 0.5 ? '#7ceaa4' : 'hsl(0, 70%, 60%)',
      height: 30 + Math.random() * 60,
      wickHeight: 10 + Math.random() * 20,
      blur: `${Math.random() * 2}px`,
      opacity: 0.08 + Math.random() * 0.12,
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <style>{`
        @keyframes float-up {
          0% { transform: translateY(110vh) rotate(0deg); }
          100% { transform: translateY(-10vh) rotate(3deg); }
        }
      `}</style>
      {candles.map((c) => (
        <div
          key={c.id}
          className="absolute"
          style={{
            left: c.left,
            animation: `float-up ${c.animDuration} linear ${c.animDelay} infinite`,
            filter: `blur(${c.blur})`,
            opacity: c.opacity,
          }}
        >
          {/* Wick top */}
          <div
            style={{
              width: 2,
              height: c.wickHeight,
              backgroundColor: c.color,
              margin: '0 auto',
            }}
          />
          {/* Body */}
          <div
            style={{
              width: 12,
              height: c.height,
              backgroundColor: c.color,
              borderRadius: 2,
            }}
          />
          {/* Wick bottom */}
          <div
            style={{
              width: 2,
              height: c.wickHeight * 0.7,
              backgroundColor: c.color,
              margin: '0 auto',
            }}
          />
        </div>
      ))}
    </div>
  );
}
