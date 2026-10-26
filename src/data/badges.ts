// src/data/badges.ts

export interface Badge {
  level: number;    // unlocked at this level
  icon: string;
  name: string;
  description: string;
}

export const BADGES: Badge[] = [
  { level: 5,   icon: '🥊', name: 'Iron Fist',          description: 'Survived the first 5 levels' },
  { level: 10,  icon: '🏃', name: 'Endurance Runner',   description: 'Built unstoppable momentum' },
  { level: 15,  icon: '💪', name: 'Muscle Initiate',    description: 'Your gains are showing' },
  { level: 20,  icon: '🔥', name: 'On Fire',            description: 'You\'re heating up' },
  { level: 25,  icon: '⚡', name: 'Lightning',          description: 'Fast & relentless' },
  { level: 30,  icon: '🛡️', name: 'Iron Will',          description: '30 levels of pure discipline' },
  { level: 35,  icon: '🧗', name: 'Climber',            description: 'Scaling new heights' },
  { level: 40,  icon: '🦅', name: 'Eagle Eye',          description: 'Precision and focus' },
  { level: 45,  icon: '🏋️', name: 'Power Lifter',       description: 'Strength beyond measure' },
  { level: 50,  icon: '🌟', name: 'Star Athlete',       description: 'Halfway to the top' },
  { level: 55,  icon: '🧠', name: 'Mind & Body',        description: 'The mental game is yours' },
  { level: 60,  icon: '🐉', name: 'Dragon Force',       description: 'Legendary endurance' },
  { level: 65,  icon: '🏆', name: 'Champion',           description: 'A true competitor' },
  { level: 70,  icon: '🌊', name: 'Flow State',         description: 'In the zone, always' },
  { level: 75,  icon: '💎', name: 'Diamond Core',       description: 'Unbreakable' },
  { level: 80,  icon: '🚀', name: 'Launch Sequence',    description: 'Breaking through limits' },
  { level: 85,  icon: '🌙', name: 'Night Grinder',      description: 'Never stops grinding' },
  { level: 90,  icon: '☀️', name: 'Solar Warrior',      description: 'Radiating peak performance' },
  { level: 95,  icon: '👑', name: 'King/Queen',         description: 'Elite. Almost there.' },
  { level: 100, icon: '🏅', name: 'Legend',             description: 'Max level. All badges earned.' },
];
