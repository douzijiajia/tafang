/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, RotateCcw, Info, Globe } from 'lucide-react';

// --- Constants & Types ---

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const WIN_SCORE = 5000;
const POINTS_PER_KILL = 20;
const AMMO_BONUS = 2;
const CITY_BONUS = 100;

const TURRET_CONFIGS = [
  { id: 0, x: 50, ammo: 20, maxAmmo: 20, label: 'L1' },
  { id: 1, x: 225, ammo: 20, maxAmmo: 20, label: 'L2' },
  { id: 2, x: 400, ammo: 40, maxAmmo: 40, label: 'C' },
  { id: 3, x: 575, ammo: 20, maxAmmo: 20, label: 'R2' },
  { id: 4, x: 750, ammo: 20, maxAmmo: 20, label: 'R1' },
];

const CITY_POSITIONS = [135, 310, 490, 665];

type Entity = {
  id: string;
  x: number;
  y: number;
  active: boolean;
};

type Rocket = Entity & {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  speed: number;
  progress: number;
};

type Missile = Entity & {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  speed: number;
  progress: number;
};

type Explosion = Entity & {
  radius: number;
  maxRadius: number;
  growing: boolean;
};

type Turret = {
  id: number;
  x: number;
  y: number;
  ammo: number;
  maxAmmo: number;
  destroyed: boolean;
};

type City = {
  id: number;
  x: number;
  y: number;
  destroyed: boolean;
};

type GameState = 'START' | 'PLAYING' | 'WON' | 'LOST';
type Difficulty = 'EASY' | 'NORMAL' | 'HARD';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [wave, setWave] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [isWaveTransition, setIsWaveTransition] = useState(false);
  
  // Game Objects Refs
  const scoreRef = useRef(0);
  const waveRef = useRef(1);
  const difficultyRef = useRef<Difficulty>('NORMAL');
  const isWaveTransitionRef = useRef(false);
  const gameStateRef = useRef<GameState>('START');
  
  const rocketsRef = useRef<Rocket[]>([]);
  const missilesRef = useRef<Missile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const turretsRef = useRef<Turret[]>([]);
  const citiesRef = useRef<City[]>([]);
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const rocketsSpawnedInWaveRef = useRef<number>(0);
  const totalRocketsInWaveRef = useRef<number>(10);
  const waveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const starsRef = useRef<{x: number, y: number, size: number, opacity: number}[]>([]);

  // Initialize stars once
  useEffect(() => {
    const stars = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: Math.random() * 1.5,
        opacity: Math.random()
      });
    }
    starsRef.current = stars;
  }, []);

  const t = {
    zh: {
      title: '新星防御',
      start: '开始游戏',
      win: '恭喜！你成功保卫了新星',
      loss: '防线崩溃，城市陷落',
      score: '得分',
      ammo: '弹药',
      wave: '波次',
      nextWave: '下一波',
      restart: '再玩一次',
      instructions: '点击屏幕发射拦截导弹。预判敌方火箭轨迹，利用爆炸范围摧毁它们。',
      winTarget: '达到 1000 分获胜',
      waveComplete: '波次完成！弹药已补充',
      difficulty: '难度',
      easy: '简单',
      normal: '普通',
      hard: '困难',
    },
    en: {
      title: 'Nova Defense',
      start: 'Start Game',
      win: 'Victory! You defended Nova',
      loss: 'Defense Breached, City Fallen',
      score: 'Score',
      ammo: 'Ammo',
      wave: 'Wave',
      nextWave: 'Next Wave',
      restart: 'Play Again',
      instructions: 'Click anywhere to fire interceptors. Predict rocket paths and use explosions to destroy them.',
      winTarget: 'Reach 1000 points to win',
      waveComplete: 'Wave Complete! Ammo Refilled',
      difficulty: 'Difficulty',
      easy: 'Easy',
      normal: 'Normal',
      hard: 'Hard',
    }
  }[lang];

  const initGame = useCallback(() => {
    // Clear any pending wave transitions
    if (waveTimeoutRef.current) {
      clearTimeout(waveTimeoutRef.current);
      waveTimeoutRef.current = null;
    }

    rocketsRef.current = [];
    missilesRef.current = [];
    explosionsRef.current = [];
    turretsRef.current = TURRET_CONFIGS.map(config => ({
      ...config,
      y: GAME_HEIGHT - 30,
      destroyed: false
    }));
    citiesRef.current = CITY_POSITIONS.map((x, i) => ({
      id: i,
      x,
      y: GAME_HEIGHT - 20,
      destroyed: false
    }));
    
    scoreRef.current = 0;
    setScore(0);
    waveRef.current = 1;
    setWave(1);
    
    // Set refs first to ensure loop sees correct state immediately
    isWaveTransitionRef.current = false;
    gameStateRef.current = 'PLAYING';
    
    // Then update state to trigger re-renders/effects
    setGameState('PLAYING');
    setIsWaveTransition(false);
    
    lastTimeRef.current = performance.now();
    spawnTimerRef.current = 0;
    rocketsSpawnedInWaveRef.current = 0;
    
    // Difficulty modifiers
    const baseRockets = difficulty === 'EASY' ? 10 : difficulty === 'NORMAL' ? 15 : 20;
    totalRocketsInWaveRef.current = baseRockets;
  }, [difficulty]);

  const startNextWave = () => {
    // Refill ammo
    turretsRef.current.forEach(t => {
      if (!t.destroyed) {
        // Bonus points for remaining ammo
        const bonus = t.ammo * AMMO_BONUS;
        scoreRef.current += bonus;
        setScore(scoreRef.current);
        t.ammo = t.maxAmmo;
      }
    });

    // Bonus for cities
    citiesRef.current.forEach(c => {
      if (!c.destroyed) {
        scoreRef.current += CITY_BONUS;
        setScore(scoreRef.current);
      }
    });

    waveRef.current += 1;
    setWave(waveRef.current);
    rocketsSpawnedInWaveRef.current = 0;
    
    const waveIncrement = difficulty === 'EASY' ? 5 : difficulty === 'NORMAL' ? 8 : 12;
    totalRocketsInWaveRef.current = totalRocketsInWaveRef.current + waveIncrement;
    
    isWaveTransitionRef.current = false;
    setIsWaveTransition(false);
  };

  const fireMissile = (targetX: number, targetY: number) => {
    if (gameState !== 'PLAYING' || isWaveTransition) return;

    // Find closest turret with ammo
    let bestTurret: Turret | null = null;
    let minDist = Infinity;

    turretsRef.current.forEach(turret => {
      if (!turret.destroyed && turret.ammo > 0) {
        const dist = Math.abs(turret.x - targetX);
        if (dist < minDist) {
          minDist = dist;
          bestTurret = turret;
        }
      }
    });

    if (bestTurret) {
      (bestTurret as Turret).ammo--;
      missilesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        startX: (bestTurret as Turret).x,
        startY: (bestTurret as Turret).y,
        x: (bestTurret as Turret).x,
        y: (bestTurret as Turret).y,
        targetX,
        targetY,
        speed: 0.04, // Increased from 0.02
        progress: 0,
        active: true
      });
    }
  };

  const spawnRocket = () => {
    const startX = Math.random() * GAME_WIDTH;
    const targets = [...citiesRef.current, ...turretsRef.current].filter(t => !t.destroyed);
    if (targets.length === 0) return;
    
    const target = targets[Math.floor(Math.random() * targets.length)];
    
    const speedModifier = difficulty === 'EASY' ? 0.7 : difficulty === 'NORMAL' ? 1 : 1.3;
    // Faster balanced speed
    const baseSpeed = 0.0015; // Increased from 0.001
    const waveScaling = wave * 0.00015; // Increased from 0.0001
    
    rocketsRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      startX,
      startY: 0,
      x: startX,
      y: 0,
      targetX: target.x,
      targetY: target.y,
      speed: (baseSpeed + waveScaling) * speedModifier,
      progress: 0,
      active: true
    });
  };

  useEffect(() => {
    difficultyRef.current = difficulty;
  }, [difficulty]);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = (time: number) => {
      const dt = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // Update
      if (!isWaveTransitionRef.current) {
        spawnTimerRef.current += dt;
        const difficultyIntervalModifier = difficultyRef.current === 'EASY' ? 1.2 : difficultyRef.current === 'NORMAL' ? 1 : 0.8;
        const spawnInterval = Math.max(400, (1500 - (waveRef.current * 100)) * difficultyIntervalModifier);
        
        if (spawnTimerRef.current > spawnInterval && rocketsSpawnedInWaveRef.current < totalRocketsInWaveRef.current) {
          spawnRocket();
          rocketsSpawnedInWaveRef.current++;
          spawnTimerRef.current = 0;
        }

        // Check for wave completion
        if (rocketsSpawnedInWaveRef.current >= totalRocketsInWaveRef.current && rocketsRef.current.length === 0) {
          isWaveTransitionRef.current = true;
          setIsWaveTransition(true);
          
          if (waveTimeoutRef.current) clearTimeout(waveTimeoutRef.current);
          waveTimeoutRef.current = setTimeout(() => {
            if (gameStateRef.current === 'PLAYING') {
              startNextWave();
            }
            waveTimeoutRef.current = null;
          }, 2000);
        }
      }

      // Update Rockets
      rocketsRef.current.forEach(rocket => {
        rocket.progress += rocket.speed * (dt / 16);
        rocket.x = rocket.startX + (rocket.targetX - rocket.startX) * rocket.progress;
        rocket.y = rocket.startY + (rocket.targetY - rocket.startY) * rocket.progress;

        if (rocket.progress >= 1) {
          rocket.active = false;
          // Hit target
          const targetCity = citiesRef.current.find(c => c.x === rocket.targetX && c.y === rocket.targetY);
          if (targetCity) targetCity.destroyed = true;
          const targetTurret = turretsRef.current.find(t => t.x === rocket.targetX && t.y === rocket.targetY);
          if (targetTurret) targetTurret.destroyed = true;
          
          // Create impact explosion
          explosionsRef.current.push({
            id: Math.random().toString(36).substr(2, 9),
            x: rocket.x,
            y: rocket.y,
            radius: 0,
            maxRadius: 30,
            growing: true,
            active: true
          });
        }
      });

      // Update Missiles
      missilesRef.current.forEach(missile => {
        missile.progress += missile.speed * (dt / 16);
        missile.x = missile.startX + (missile.targetX - missile.startX) * missile.progress;
        missile.y = missile.startY + (missile.targetY - missile.startY) * missile.progress;

        if (missile.progress >= 1) {
          missile.active = false;
          explosionsRef.current.push({
            id: Math.random().toString(36).substr(2, 9),
            x: missile.targetX,
            y: missile.targetY,
            radius: 0,
            maxRadius: 50,
            growing: true,
            active: true
          });
        }
      });

      // Update Explosions
      explosionsRef.current.forEach(exp => {
        if (exp.growing) {
          exp.radius += 2 * (dt / 16);
          if (exp.radius >= exp.maxRadius) exp.growing = false;
        } else {
          exp.radius -= 1 * (dt / 16);
          if (exp.radius <= 0) exp.active = false;
        }

        // Check collision with rockets
        rocketsRef.current.forEach(rocket => {
          if (rocket.active) {
            const dx = rocket.x - exp.x;
            const dy = rocket.y - exp.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < exp.radius) {
              rocket.active = false;
              scoreRef.current += POINTS_PER_KILL;
              setScore(scoreRef.current);
              // Chain explosion
              explosionsRef.current.push({
                id: Math.random().toString(36).substr(2, 9),
                x: rocket.x,
                y: rocket.y,
                radius: 0,
                maxRadius: 40,
                growing: true,
                active: true
              });
            }
          }
        });
      });

      // Cleanup
      rocketsRef.current = rocketsRef.current.filter(r => r.active);
      missilesRef.current = missilesRef.current.filter(m => m.active);
      explosionsRef.current = explosionsRef.current.filter(e => e.active);

      // Check Win/Loss
      if (scoreRef.current >= WIN_SCORE) {
        gameStateRef.current = 'WON';
        setGameState('WON');
      }
      if (turretsRef.current.every(t => t.destroyed)) {
        gameStateRef.current = 'LOST';
        setGameState('LOST');
      }

      // Draw
      ctx.fillStyle = '#05050a';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Draw Nebula/Galaxy Effect
      const nebulaGradient = ctx.createRadialGradient(GAME_WIDTH/2, GAME_HEIGHT/2, 0, GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH);
      nebulaGradient.addColorStop(0, 'rgba(40, 20, 80, 0.15)');
      nebulaGradient.addColorStop(0.5, 'rgba(20, 10, 40, 0.05)');
      nebulaGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebulaGradient;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Draw Moon
      ctx.save();
      ctx.shadowBlur = 30;
      ctx.shadowColor = 'rgba(200, 200, 255, 0.4)';
      ctx.fillStyle = '#e0e0e0';
      ctx.beginPath();
      ctx.arc(650, 100, 45, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Moon Craters
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      const craters = [[630, 85, 8], [670, 110, 12], [645, 120, 6], [660, 80, 5]];
      craters.forEach(([cx, cy, cr]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // Draw Stars
      starsRef.current.forEach(star => {
        ctx.fillStyle = `rgba(${star.opacity > 0.8 ? '255,255,255' : '200,220,255'}, ${0.4 + star.opacity * 0.6})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 1.3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Ground
      ctx.fillStyle = '#0a0a15';
      ctx.fillRect(0, GAME_HEIGHT - 20, GAME_WIDTH, 20);

      // Draw Cities
      citiesRef.current.forEach(city => {
        if (!city.destroyed) {
          ctx.fillStyle = '#4ecca3';
          ctx.fillRect(city.x - 15, city.y - 15, 30, 15);
          ctx.fillStyle = '#45b293';
          ctx.fillRect(city.x - 10, city.y - 25, 20, 10);
          // Windows
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.fillRect(city.x - 12, city.y - 12, 4, 4);
          ctx.fillRect(city.x + 8, city.y - 12, 4, 4);
        } else {
          ctx.fillStyle = '#222';
          ctx.fillRect(city.x - 15, city.y - 5, 30, 5);
        }
      });

      // Draw Turrets
      turretsRef.current.forEach(turret => {
        if (!turret.destroyed) {
          ctx.fillStyle = '#3498db';
          ctx.beginPath();
          ctx.moveTo(turret.x - 20, turret.y + 10);
          ctx.lineTo(turret.x + 20, turret.y + 10);
          ctx.lineTo(turret.x, turret.y - 20);
          ctx.closePath();
          ctx.fill();
          
          // Turret barrel
          ctx.strokeStyle = '#2980b9';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(turret.x, turret.y - 10);
          ctx.lineTo(turret.x, turret.y - 28);
          ctx.stroke();

          // Ammo count
          ctx.fillStyle = 'white';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(turret.ammo.toString(), turret.x, turret.y + 25);
        } else {
          ctx.fillStyle = '#922b21';
          ctx.fillRect(turret.x - 12, turret.y - 5, 24, 15);
        }
      });

      // Draw Rockets (Enemy)
      rocketsRef.current.forEach(rocket => {
        // Trail
        ctx.strokeStyle = 'rgba(255, 80, 80, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(rocket.startX, rocket.startY);
        ctx.lineTo(rocket.x, rocket.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Rocket Head (Larger and Clearer)
        const dx = rocket.targetX - rocket.startX;
        const dy = rocket.targetY - rocket.startY;
        const angle = Math.atan2(dy, dx);

        ctx.save();
        ctx.translate(rocket.x, rocket.y);
        ctx.rotate(angle);
        
        // Enemy Rocket Body (Larger)
        ctx.fillStyle = '#ff4d4d';
        ctx.fillRect(-7, -3, 14, 6);
        // Nose cone (Larger)
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.moveTo(7, -3);
        ctx.lineTo(13, 0);
        ctx.lineTo(7, 3);
        ctx.fill();
        // Fins
        ctx.fillStyle = '#990000';
        ctx.fillRect(-7, -5, 3, 10);
        
        // Fire tail (More dynamic)
        const fireSize = 15 + Math.sin(time / 50) * 5;
        const fireGrad = ctx.createLinearGradient(-7, 0, -7 - fireSize, 0);
        fireGrad.addColorStop(0, '#ffcc00');
        fireGrad.addColorStop(0.5, '#ff6600');
        fireGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = fireGrad;
        ctx.beginPath();
        ctx.moveTo(-7, 0);
        ctx.lineTo(-7 - fireSize, -4);
        ctx.lineTo(-7 - fireSize * 0.8, 0);
        ctx.lineTo(-7 - fireSize, 4);
        ctx.fill();
        
        ctx.restore();
      });

      // Draw Missiles
      missilesRef.current.forEach(missile => {
        // Trail
        ctx.strokeStyle = 'rgba(52, 152, 219, 0.4)';
        ctx.lineWidth = 3; // Thicker trail
        ctx.beginPath();
        ctx.moveTo(missile.startX, missile.startY);
        ctx.lineTo(missile.x, missile.y);
        ctx.stroke();

        // Missile Body
        const dx = missile.targetX - missile.startX;
        const dy = missile.targetY - missile.startY;
        const angle = Math.atan2(dy, dx);

        ctx.save();
        ctx.translate(missile.x, missile.y);
        ctx.rotate(angle);
        
        // Missile shape
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(-6, -2, 12, 4); // Thicker body
        ctx.fillStyle = '#3498db';
        ctx.beginPath();
        ctx.moveTo(6, -2);
        ctx.lineTo(10, 0);
        ctx.lineTo(6, 2);
        ctx.fill();
        
        // Engine glow
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(-7, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();

        // Target X
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(missile.targetX - 5, missile.targetY - 5);
        ctx.lineTo(missile.targetX + 5, missile.targetY + 5);
        ctx.moveTo(missile.targetX + 5, missile.targetY - 5);
        ctx.lineTo(missile.targetX - 5, missile.targetY + 5);
        ctx.stroke();
      });

      // Draw Explosions
      explosionsRef.current.forEach(exp => {
        const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
        gradient.addColorStop(0, 'white');
        gradient.addColorStop(0.4, 'rgba(241, 196, 15, 0.8)');
        gradient.addColorStop(1, 'rgba(231, 76, 60, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      if (gameStateRef.current === 'PLAYING') {
        requestAnimationFrame(loop);
      }
    };

    const frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [gameState]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    fireMissile(x, y);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-emerald-500/30 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-[800px] flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-emerald-400" />
          <h1 className="text-2xl font-bold tracking-tight uppercase italic font-serif">
            {t.title}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white/5 border border-white/10 px-4 py-1 rounded-full flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" />
            <span className="font-mono text-sm">{t.wave}: {wave}</span>
          </div>
          <div className="bg-white/5 border border-white/10 px-4 py-1 rounded-full flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="font-mono text-sm">{t.score}: {score}</span>
          </div>
          <button 
            onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <Globe className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative w-full max-w-[800px] aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/5">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          onClick={handleCanvasClick}
          className="w-full h-full cursor-crosshair"
        />

        {/* Overlays */}
        <AnimatePresence>
          {isWaveTransition && gameState === 'PLAYING' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40"
            >
              <div className="bg-emerald-500 text-black px-6 py-2 rounded-full font-bold text-xl shadow-lg">
                {t.waveComplete}
              </div>
            </motion.div>
          )}
          {gameState === 'START' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center z-50"
            >
              <motion.h2 
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className="text-5xl font-bold mb-6 italic font-serif"
              >
                {t.title}
              </motion.h2>
              <p className="max-w-md text-gray-400 mb-8 leading-relaxed">
                {t.instructions}
                <br />
                <span className="text-emerald-400 mt-2 block font-medium">{t.winTarget}</span>
              </p>

              {/* Difficulty Selection */}
              <div className="flex flex-col gap-4 mb-10">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{t.difficulty}</span>
                <div className="flex gap-2 p-1 bg-white/5 rounded-full border border-white/10">
                  {(['EASY', 'NORMAL', 'HARD'] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDifficulty(d);
                      }}
                      className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                        difficulty === d 
                          ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' 
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {t[d.toLowerCase() as keyof typeof t.zh]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  initGame();
                }}
                className="group relative px-12 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-3 text-lg"
              >
                <Target className="w-6 h-6" />
                {t.start}
              </button>
            </motion.div>
          )}

          {(gameState === 'WON' || gameState === 'LOST') && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center z-50"
            >
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${gameState === 'WON' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                {gameState === 'WON' ? <Trophy className="w-10 h-10" /> : <Shield className="w-10 h-10" />}
              </div>
              <h2 className="text-4xl font-bold mb-2 italic font-serif">
                {gameState === 'WON' ? t.win : t.loss}
              </h2>
              <div className="text-2xl font-mono mb-8 text-gray-400">
                {t.score}: {score}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  initGame();
                }}
                className="px-8 py-3 bg-white text-black font-bold rounded-full transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                {t.restart}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* HUD Overlay (Ammo) */}
        {gameState === 'PLAYING' && (
          <div className="absolute bottom-6 left-0 right-0 px-8 flex justify-between pointer-events-none">
            {turretsRef.current.map(turret => (
              <div key={turret.id} className="flex flex-col items-center">
                <div className={`h-1 w-12 rounded-full mb-1 ${turret.destroyed ? 'bg-red-900' : 'bg-blue-900'}`}>
                  <motion.div 
                    className={`h-full rounded-full ${turret.destroyed ? 'bg-red-500' : 'bg-blue-400'}`}
                    initial={{ width: '100%' }}
                    animate={{ width: `${(turret.ammo / turret.maxAmmo) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-[800px]">
        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-2 text-emerald-400">
            <Info className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">How to Play</span>
          </div>
          <p className="text-sm text-gray-400 leading-snug">
            {t.instructions}
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-2 text-blue-400">
            <Target className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Ammo Management</span>
          </div>
          <p className="text-sm text-gray-400 leading-snug">
            Left: 20 | Center: 40 | Right: 20. Use them wisely!
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-2 text-yellow-400">
            <Trophy className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Objective</span>
          </div>
          <p className="text-sm text-gray-400 leading-snug">
            {t.winTarget}. Each kill is 20 points.
          </p>
        </div>
      </div>
    </div>
  );
}
