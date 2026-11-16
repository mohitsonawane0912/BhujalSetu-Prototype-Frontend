import { z } from 'zod';

export const TelemetryInputSchema = z.object({
  deviceId: z.string().trim().min(1).max(100),
  villageId: z.string().trim().min(1).max(100),
  timestamp: z.string().datetime({ offset: true }).optional(),
  dataSource: z.enum(['measured', 'simulated']),
  tankLevelPercent: z.number().finite().min(0).max(100),
  tankDistanceCm: z.number().finite().min(1).max(400),
  flowInLpm: z.number().finite().min(0).max(120),
  flowOutLpm: z.number().finite().min(0).max(120),
  flowInLitersTotal: z.number().finite().min(0).max(1_000_000),
  flowOutLitersTotal: z.number().finite().min(0).max(1_000_000),
  pumpEnabled: z.boolean().default(false),
}).strict();

export type ValidatedTelemetry = z.infer<typeof TelemetryInputSchema>;
