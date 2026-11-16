import { z } from 'zod';

const flowSchema = z.object({
  pulses: z.number().int().min(0).max(1_000_000),
  frequencyHz: z.number().finite().min(0).max(500),
  flowLpm: z.number().finite().min(0).max(120),
  totalLiters: z.number().finite().min(0).max(1_000_000),
}).strict();

const baseSchema = z.object({
  schemaVersion: z.literal(1),
  deviceId: z.string().trim().min(1).max(100),
  nodeId: z.enum(['node-1', 'node-2']),
  villageId: z.string().trim().min(1).max(100),
  dataSource: z.enum(['measured', 'simulated']),
  capturedAt: z.string().datetime({ offset: true }),
  flow: flowSchema,
}).strict();

const nodeOneSchema = baseSchema.extend({
  nodeId: z.literal('node-1'),
  waterLevel: z.object({
    distanceCm: z.number().finite().min(2).max(400),
    levelCm: z.number().finite().min(0).max(400),
  }).strict(),
});

const nodeTwoSchema = baseSchema.extend({
  nodeId: z.literal('node-2'),
  waterLevel: z.never().optional(),
});

export const NodeTelemetrySchema = z.discriminatedUnion('nodeId', [nodeOneSchema, nodeTwoSchema]);
export type NodeTelemetryInput = z.infer<typeof NodeTelemetrySchema>;

export type NodeTelemetryRecord = NodeTelemetryInput & {
  id: string;
  receivedAt: string;
};
