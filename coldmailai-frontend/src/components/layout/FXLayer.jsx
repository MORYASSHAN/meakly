import { useEffect, useRef } from 'react';

const hexToRgb = (hex) => {
  const value = hex.replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
};

const clampVelocity = (particle) => {
  const speed = Math.hypot(particle.vx, particle.vy);
  if (speed > 1.2) {
    particle.vx = (particle.vx / speed) * 1.2;
    particle.vy = (particle.vy / speed) * 1.2;
  }
};

export default function FXLayer() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const cursorDot = document.createElement('div');
    const cursorRing = document.createElement('div');
    const targetPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ringPos = { ...targetPos };
    let rafId = 0;

    Object.assign(cursorDot.style, {
      width: '6px',
      height: '6px',
      background: 'var(--mint)',
      borderRadius: '50%',
      position: 'fixed',
      left: '0px',
      top: '0px',
      pointerEvents: 'none',
      zIndex: '10000',
      transition: 'transform 0.1s',
    });
    Object.assign(cursorRing.style, {
      width: '28px',
      height: '28px',
      border: '1.5px solid rgba(16,255,176,0.5)',
      borderRadius: '50%',
      position: 'fixed',
      left: '0px',
      top: '0px',
      pointerEvents: 'none',
      zIndex: '9999',
      transition: 'transform 0.15s, border-color 0.15s',
    });

    document.body.appendChild(cursorDot);
    document.body.appendChild(cursorRing);

    const onMouseMove = (event) => {
      targetPos.x = event.clientX;
      targetPos.y = event.clientY;
      cursorDot.style.left = `${event.clientX - 3}px`;
      cursorDot.style.top = `${event.clientY - 3}px`;
    };
    const onPointerOver = (event) => {
      if (event.target.closest?.('a, button, [role=button]')) {
        cursorRing.style.transform = 'scale(2)';
        cursorRing.style.borderColor = 'var(--blue)';
      }
    };
    const onPointerOut = (event) => {
      if (event.target.closest?.('a, button, [role=button]')) {
        cursorRing.style.transform = 'scale(1)';
        cursorRing.style.borderColor = 'rgba(16,255,176,0.5)';
      }
    };
    const onMouseDown = () => {
      cursorDot.style.transform = 'scale(0.5)';
    };
    const onMouseUp = () => {
      cursorDot.style.transform = 'scale(1)';
    };
    const onClick = (event) => {
      for (let i = 0; i < 6; i += 1) {
        const particle = document.createElement('div');
        const angle = Math.random() * Math.PI * 2;
        const distance = 18 + Math.random() * 28;
        Object.assign(particle.style, {
          position: 'fixed',
          left: `${event.clientX - 2}px`,
          top: `${event.clientY - 2}px`,
          width: '4px',
          height: '4px',
          borderRadius: '50%',
          background: Math.random() > 0.5 ? 'var(--blue)' : 'var(--mint)',
          pointerEvents: 'none',
          zIndex: '10000',
          opacity: '0.9',
          transform: 'translate(0, 0)',
          transition: 'transform 400ms ease-out, opacity 400ms ease-out',
        });
        document.body.appendChild(particle);
        requestAnimationFrame(() => {
          particle.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
          particle.style.opacity = '0';
        });
        window.setTimeout(() => particle.remove(), 430);
      }
    };

    const animateCursor = () => {
      ringPos.x += (targetPos.x - ringPos.x) * 0.12;
      ringPos.y += (targetPos.y - ringPos.y) * 0.12;
      cursorRing.style.left = `${ringPos.x - 14}px`;
      cursorRing.style.top = `${ringPos.y - 14}px`;
      rafId = requestAnimationFrame(animateCursor);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('pointerout', onPointerOut);
    document.addEventListener('click', onClick);
    rafId = requestAnimationFrame(animateCursor);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('pointerout', onPointerOut);
      document.removeEventListener('click', onClick);
      cancelAnimationFrame(rafId);
      cursorDot.remove();
      cursorRing.remove();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const mouse = { x: -9999, y: -9999 };
    let particles = [];
    let frameId = 0;
    let disposed = false;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    const createParticles = () => {
      particles = Array.from({ length: 80 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.2 + 0.6,
        life: Math.random(),
        color: Math.random() > 0.4 ? '#3B82F6' : '#10FFB0',
        opacity: Math.random() * 0.15 + 0.05,
      }));
    };
    const onMouseMove = (event) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };
    const resizeObserver = new ResizeObserver(() => {
      resize();
      createParticles();
    });

    resize();
    createParticles();
    resizeObserver.observe(document.documentElement);
    window.addEventListener('mousemove', onMouseMove);

    const draw = () => {
      if (disposed) return;
      ctx.fillStyle = '#08090C';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle, index) => {
        const dxMouse = particle.x - mouse.x;
        const dyMouse = particle.y - mouse.y;
        const mouseDist = Math.hypot(dxMouse, dyMouse);
        if (mouseDist > 0 && mouseDist < 120) {
          particle.vx += (dxMouse / mouseDist) * 0.015;
          particle.vy += (dyMouse / mouseDist) * 0.015;
        }
        clampVelocity(particle);

        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        const rgb = hexToRgb(particle.color);
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${particle.opacity})`;
        ctx.fill();

        for (let j = index + 1; j < particles.length; j += 1) {
          const other = particles[j];
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${(1 - dist / 100) * 0.08})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      });

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      window.removeEventListener('mousemove', onMouseMove);
      resizeObserver.disconnect();
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
