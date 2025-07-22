import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ParticlesProps {
  className?: string;
  quantity?: number;
  color?: string;
  radius?: number;
  ease?: number;
  refresh?: boolean;
  staticity?: number;
}

export const Particles: React.FC<ParticlesProps> = ({
  className,
  quantity = 70,
  color = "#3b82f6",
  radius = 1.5,
  ease = 50,
  refresh = false,
  staticity = 50,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const particles: Array<{
      x: number;
      y: number;
      translateX: number;
      translateY: number;
      size: number;
      targetX: number;
      targetY: number;
      opacity: number;
    }> = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const initializeParticles = () => {
      particles.length = 0;
      for (let i = 0; i < quantity; i++) {
        const particle = {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          translateX: 0,
          translateY: 0,
          size: Math.random() * radius + 0.5,
          targetX: Math.random() * canvas.width,
          targetY: Math.random() * canvas.height,
          opacity: Math.random() * 0.5 + 0.3,
        };
        particles.push(particle);
      }
    };

    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        const { x, y, translateX, translateY, size, opacity } = particle;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + translateX, y + translateY, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };

    const updateParticles = () => {
      particles.forEach((particle) => {
        const { targetX, targetY } = particle;
        
        // Smooth movement towards target
        particle.translateX += (targetX - particle.x - particle.translateX) / ease;
        particle.translateY += (targetY - particle.y - particle.translateY) / ease;

        // Add slight random movement for staticity
        if (Math.random() > staticity / 100) {
          particle.targetX = Math.random() * canvas.width;
          particle.targetY = Math.random() * canvas.height;
        }
      });
    };

    const animate = () => {
      updateParticles();
      drawParticles();
      animationId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      resizeCanvas();
      initializeParticles();
    };

    resizeCanvas();
    initializeParticles();
    animate();

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, [quantity, color, radius, ease, refresh, staticity]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none", className)}
      style={{ background: "transparent" }}
    />
  );
};