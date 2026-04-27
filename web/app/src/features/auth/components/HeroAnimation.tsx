import { theme } from 'antd';
import React from 'react';

export function HeroAnimation() {
  const { token } = theme.useToken();
  
  return (
    <div
      style={{
        flex: 1,
        backgroundColor: token.colorBgLayout,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="hero-shape shape-1"
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: `radial-gradient(circle at center, ${token.colorPrimary}40 0%, transparent 70%)`,
          top: '-10%',
          left: '-10%',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="hero-shape shape-2"
        style={{
          position: 'absolute',
          width: '800px',
          height: '800px',
          borderRadius: '50%',
          background: `radial-gradient(circle at center, ${token.colorInfo}30 0%, transparent 70%)`,
          bottom: '-20%',
          right: '-10%',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="hero-shape shape-3"
        style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: `radial-gradient(circle at center, ${token.colorSuccess}20 0%, transparent 70%)`,
          top: '40%',
          left: '60%',
          filter: 'blur(30px)',
        }}
      />
      
      <div className="hero-text-block" style={{ zIndex: 1, textAlign: 'center', padding: `0 clamp(12px, 6vw, 80px)`, width: '100%', marginTop: '-15vh' }}>
        <div className="hero-tagline" aria-label="brand name and slogan">
          <div className="hero-text-line hero-title-line">1flowbase</div>
          <div className="hero-text-line hero-slogan-line">你的故事，从此开始</div>
        </div>
      </div>

      <style>
        {`
          .hero-text-block {
            animation: reveal 1.5s cubic-bezier(0.2, 0, 0, 1) forwards;
          }

          .hero-tagline {
            --hero-slogan-size: clamp(1rem, 2.8vw, 3rem);
            --hero-title-size: calc(var(--hero-slogan-size) * 7 / 3);
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            gap: clamp(0.1rem, 0.45vw, 0.6rem);
            line-height: 1.05;
            animation: reveal 1.5s cubic-bezier(0.2, 0, 0, 1) forwards;
            font-weight: 500;
          }

          .hero-text-line {
            background: linear-gradient(
              120deg,
              var(--hero-from-color) 40%,
              var(--hero-mid-color) 50%,
              var(--hero-to-color) 60%
            );
            background-size: 240% auto;
            color: transparent;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: shine 20s linear infinite;
            font-weight: 900;
            margin: 0;
            line-height: 1.05;
            letter-spacing: -0.02em;
            --hero-from-color: ${token.colorPrimary};
            --hero-mid-color: rgba(255, 255, 255, 1);
            --hero-to-color: rgba(105, 177, 255, 0.9);
          }

          .hero-title-line {
            font-size: var(--hero-title-size);
          }

          .hero-slogan-line {
            font-size: var(--hero-slogan-size);
            font-weight: 500;
            --hero-mid-color: rgba(255, 255, 255, 0.95);
            --hero-to-color: ${token.colorInfo};
          }

          @keyframes reveal {
            0% { clip-path: inset(0 100% 0 0); opacity: 0; }
            5% { opacity: 0.1; }
            100% { clip-path: inset(0 0 0 0); opacity: 0.7; }
          }

          @keyframes shine {
            0% { background-position: 200% center; }
            100% { background-position: -200% center; }
          }

          .hero-shape {
            animation: float 20s ease-in-out infinite alternate;
          }
          .shape-1 {
            animation-delay: 0s;
            animation-duration: 25s;
          }
          .shape-2 {
            animation-delay: -5s;
            animation-duration: 30s;
            animation-direction: alternate-reverse;
          }
          .shape-3 {
            animation-delay: -10s;
            animation-duration: 20s;
          }

          @keyframes float {
            0% {
              transform: translate(0, 0) scale(1);
            }
            33% {
              transform: translate(30px, -50px) scale(1.1);
            }
            66% {
              transform: translate(-20px, 20px) scale(0.9);
            }
            100% {
              transform: translate(0, 0) scale(1);
            }
          }
        `}
      </style>
    </div>
  );
}
