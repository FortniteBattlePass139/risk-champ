import type { Category, Dependency, Leg } from "./monteCarlo";

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  legs: Leg[];
  dependencies: Dependency[];
}

const leg = (
  id: string,
  name: string,
  category: Category,
  baseProbability: number,
  weeklyHoursCost: number,
  stressImpact: number,
  startWeek = 1,
  endWeek = 16,
): Leg => ({ id, name, category, baseProbability, weeklyHoursCost, stressImpact, startWeek, endWeek });

/** Illustrative demo assumptions — not calibrated to any real person. */
export const PRESETS: Preset[] = [
  {
    id: "ing",
    name: "Ingeniería + Side-Project + Gym",
    blurb: "5 legs · semestre con MVP y gimnasio",
    legs: [
      leg("calc", "Pasar Cálculo/Física (6h/sem)", "Academic", 0.55, 6, 7, 1, 16),
      leg("mvp", "Lanzar MVP funcional", "Tech/Infra", 0.65, 15, 6, 1, 10),
      leg("gym", "Rutina de fuerza 4x/sem", "Health", 0.75, 6, 3, 1, 16),
      leg("users", "Conseguir primeros usuarios", "Career", 0.35, 8, 6, 9, 16),
      leg("sleep", "Dormir 7h diarias", "Health", 0.4, 2, 4, 1, 16),
    ],
    dependencies: [
      { id: "d1", triggerLegId: "mvp", affectedLegId: "users", dependencyType: "failure_penalty", penaltyStrength: 0.25 },
    ],
  },
  {
    id: "indie",
    name: "Bootstrapper / Indie Hacker Launch",
    blurb: "4 legs · lanzamiento de producto",
    legs: [
      leg("dev", "Terminar desarrollo a tiempo", "Tech/Infra", 0.7, 25, 7, 1, 8),
      leg("uptime", "0 caídas de servidor en el lanzamiento", "Tech/Infra", 0.8, 6, 6, 8, 10),
      leg("conv", "Conversión a pago > 3%", "Finance", 0.3, 12, 6, 9, 16),
      leg("budget", "No quemar el presupuesto de API", "Finance", 0.85, 3, 4, 1, 16),
    ],
    dependencies: [
      { id: "d1", triggerLegId: "dev", affectedLegId: "uptime", dependencyType: "failure_penalty", penaltyStrength: 0.2 },
      { id: "d2", triggerLegId: "uptime", affectedLegId: "conv", dependencyType: "failure_penalty", penaltyStrength: 0.15 },
    ],
  },
  {
    id: "allin",
    name: "All-In Semestre Crítico",
    blurb: "4 legs pesados · dependencias encadenadas",
    legs: [
      leg("thesis", "Entregar tesis/proyecto final", "Academic", 0.6, 18, 9, 1, 14),
      leg("exams", "Aprobar 3 exámenes finales", "Academic", 0.55, 14, 8, 10, 16),
      leg("intern", "Conseguir pasantía", "Career", 0.4, 10, 7, 4, 12),
      leg("job", "Oferta de trabajo post-pasantía", "Career", 0.3, 8, 7, 12, 16),
    ],
    dependencies: [
      { id: "d1", triggerLegId: "thesis", affectedLegId: "exams", dependencyType: "failure_penalty", penaltyStrength: 0.2 },
      { id: "d2", triggerLegId: "intern", affectedLegId: "job", dependencyType: "hard_prerequisite", penaltyStrength: 1 },
      { id: "d3", triggerLegId: "exams", affectedLegId: "job", dependencyType: "failure_penalty", penaltyStrength: 0.15 },
    ],
  },
];

export const QUICK_LEGS: Record<Category, Omit<Leg, "id">> = {
  Career: { name: "Ship a career milestone", category: "Career", baseProbability: 0.5, weeklyHoursCost: 8, stressImpact: 6, startWeek: 1, endWeek: 16 },
  Academic: { name: "Pass a hard course", category: "Academic", baseProbability: 0.6, weeklyHoursCost: 8, stressImpact: 7, startWeek: 1, endWeek: 16 },
  "Tech/Infra": { name: "Deploy & keep it up", category: "Tech/Infra", baseProbability: 0.7, weeklyHoursCost: 10, stressImpact: 5, startWeek: 1, endWeek: 12 },
  Health: { name: "Train 3x/week", category: "Health", baseProbability: 0.7, weeklyHoursCost: 4, stressImpact: 2, startWeek: 1, endWeek: 16 },
  Finance: { name: "Stay under budget", category: "Finance", baseProbability: 0.75, weeklyHoursCost: 2, stressImpact: 4, startWeek: 1, endWeek: 16 },
};
