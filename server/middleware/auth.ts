import { timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function requireDeviceAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const customHeader = req.headers['x-device-api-key'];

  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (typeof customHeader === 'string') {
    token = customHeader.trim();
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Missing device authentication header. Send Authorization: Bearer <DEVICE_API_KEY> or x-device-api-key header.',
    });
    return;
  }

  const provided = Buffer.from(token || '');
  const expected = Buffer.from(config.deviceApiKey);
  const valid = expected.length > 0 && provided.length === expected.length && timingSafeEqual(provided, expected);
  if (!valid) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: config.deviceApiKey ? 'Invalid device API key.' : 'Device API key is not configured on the backend.',
    });
    return;
  }

  next();
}

/** Node-specific keys are preferred so one leaked ESP32 key cannot impersonate its sibling. */
export function requireNodeDeviceAuth(req: Request, res: Response, next: NextFunction): void {
  const nodeId = req.body?.nodeId;
  const deviceId = req.body?.deviceId;
  const keyName = nodeId === 'node-1'
    ? 'NODE_1_DEVICE_API_KEY'
    : nodeId === 'node-2'
      ? 'NODE_2_DEVICE_API_KEY'
      : '';
  const expectedKey = keyName ? process.env[keyName] || config.deviceApiKey : '';
  const authHeader = req.headers.authorization;
  const customHeader = req.headers['x-device-api-key'];
  const providedToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : typeof customHeader === 'string' ? customHeader.trim() : '';
  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedKey);
  const valid = expected.length > 0 && provided.length === expected.length && timingSafeEqual(provided, expected);

  if (!valid || typeof deviceId !== 'string' || !nodeId) {
    res.status(401).json({ success: false, error: 'Unauthorized device or missing node identity.' });
    return;
  }
  next();
}
