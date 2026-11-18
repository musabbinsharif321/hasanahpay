'use client';

import React, { useEffect, useRef } from 'react';

interface Auth3DBackgroundProps {
  isDark: boolean;
  prefersReducedMotion?: boolean;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
  phase: number;
}

interface RingNode {
  angle: number;
  radius: number;
  tiltX: number;
  tiltY: number;
  speed: number;
  color: string;
}

export function Auth3DBackground({
  isDark,
  prefersReducedMotion = false,
}: Auth3DBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e: MouseEvent) => {
      pointerRef.current.targetX = (e.clientX / width - 0.5) * 2;
      pointerRef.current.targetY = (e.clientY / height - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    // 3D particle cloud (spread across the full viewport)
    const paletteDark = ['#38BDF8', '#1D6E8C', '#E5A93B', '#60A5FA'];
    const paletteLight = ['#1D6E8C', '#0B2447', '#D4941F', '#0284C7'];
    const palette = isDark ? paletteDark : paletteLight;

    const pointCount = width < 640 ? 48 : 84;
    const points: Point3D[] = Array.from({ length: pointCount }, (_, i) => ({
      x: (Math.random() - 0.5) * 1400,
      y: (Math.random() - 0.5) * 900,
      z: (Math.random() - 0.5) * 900,
      size: 1.5 + Math.random() * 2.4,
      color: palette[i % palette.length],
      phase: Math.random() * Math.PI * 2,
    }));

    // 3D orbital rings
    const rings: RingNode[] = [
      { angle: 0, radius: 340, tiltX: 0.65, tiltY: 0.35, speed: 0.0022, color: palette[0] },
      { angle: 1.2, radius: 460, tiltX: -0.5, tiltY: 0.55, speed: -0.0016, color: palette[2] },
      { angle: 2.4, radius: 260, tiltX: 0.9, tiltY: -0.4, speed: 0.0028, color: palette[1] },
    ];

    const fov = 700;
    let time = 0;

    const project = (x: number, y: number, z: number, rotX: number, rotY: number) => {
      // Rotate around Y
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const x1 = x * cosY - z * sinY;
      const z1 = z * cosY + x * sinY;

      // Rotate around X
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const y2 = y * cosX - z1 * sinX;
      const z2 = z1 * cosX + y * sinX;

      const depth = fov + z2 + 350;
      if (depth <= 20) return null;
      const scale = fov / depth;
      return {
        sx: width / 2 + x1 * scale,
        sy: height / 2 + y2 * scale,
        scale,
        z: z2,
      };
    };

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth pointer parallax
      pointerRef.current.x += (pointerRef.current.targetX - pointerRef.current.x) * 0.05;
      pointerRef.current.y += (pointerRef.current.targetY - pointerRef.current.y) * 0.05;

      const baseRotY = time * 0.16 + pointerRef.current.x * 0.28;
      const baseRotX = Math.sin(time * 0.25) * 0.12 - pointerRef.current.y * 0.22;

      // 1. Draw 3D orbital wireframe rings
      for (const ring of rings) {
        const segments = 56;
        ctx.beginPath();
        let started = false;
        for (let s = 0; s <= segments; s++) {
          const theta = (s / segments) * Math.PI * 2 + time * ring.speed * 180;
          const rx = Math.cos(theta) * ring.radius;
          const ry = Math.sin(theta) * ring.radius * Math.cos(ring.tiltX);
          const rz = Math.sin(theta) * ring.radius * Math.sin(ring.tiltX);

          // Secondary tilt around Y
          const tx = rx * Math.cos(ring.tiltY) - rz * Math.sin(ring.tiltY);
          const tz = rz * Math.cos(ring.tiltY) + rx * Math.sin(ring.tiltY);

          const p = project(tx, ry, tz, baseRotX, baseRotY);
          if (!p) continue;
          if (!started) {
            ctx.moveTo(p.sx, p.sy);
            started = true;
          } else {
            ctx.lineTo(p.sx, p.sy);
          }
        }
        ctx.strokeStyle = isDark ? `${ring.color}33` : `${ring.color}26`;
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }

      // 2. Project 3D particle nodes
      const projected: { sx: number; sy: number; scale: number; z: number; size: number; color: string }[] = [];
      for (const pt of points) {
        const floatY = pt.y + Math.sin(time * 0.9 + pt.phase) * 18;
        const p = project(pt.x, floatY, pt.z, baseRotX, baseRotY);
        if (!p) continue;
        projected.push({
          ...p,
          size: pt.size,
          color: pt.color,
        });
      }

      // 3. Draw 3D constellation connections between nearby nodes
      const maxDist = width < 640 ? 120 : 155;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const a = projected[i];
          const b = projected[j];
          const dx = a.sx - b.sx;
          const dy = a.sy - b.sy;
          const dist = Math.hypot(dx, dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * (isDark ? 0.22 : 0.14);
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.strokeStyle = isDark
              ? `rgba(56, 189, 248, ${alpha.toFixed(3)})`
              : `rgba(29, 110, 140, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.85;
            ctx.stroke();
          }
        }
      }

      // 4. Draw depth-sorted 3D glowing spheres
      projected.sort((a, b) => b.z - a.z);
      for (const p of projected) {
        const r = Math.max(0.8, p.size * p.scale * 1.25);
        const alpha = Math.min(0.9, Math.max(0.2, p.scale * 0.8));

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r * 2.4, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? `${p.color}22` : `${p.color}18`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (!prefersReducedMotion) {
        time += 0.012;
        animId = window.requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();

    return () => {
      window.cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [isDark, prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
