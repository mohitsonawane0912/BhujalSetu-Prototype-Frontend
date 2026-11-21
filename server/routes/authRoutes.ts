import { Router, Request, Response } from 'express';
import { AuthService } from '../authService';
import { requireActiveCommunityMembership } from '../middleware/communityAuth';

const router = Router();

/**
 * GET /api/auth/community
 * Returns the single registered prototype community, or null if none.
 */
router.get('/community', async (_req: Request, res: Response) => {
  try {
    const community = await AuthService.getPrototypeCommunity();
    res.json({
      success: true,
      community,
      registered: Boolean(community),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/auth/authorized-communities
 * Returns strictly the community profiles the authenticated user is actively authorized to access.
 * Protected: Requires active community membership. Unrelated communities are never returned.
 */
router.get('/authorized-communities', requireActiveCommunityMembership, async (req: Request, res: Response) => {
  try {
    const verifiedCommunityId = (req as any).communityId || (req as any).user?.communityId;
    if (!verifiedCommunityId) {
      res.status(403).json({ success: false, error: 'Active community membership required.' });
      return;
    }

    let comm = await AuthService.getCommunityById(verifiedCommunityId);
    if (!comm) {
      comm = await AuthService.getPrototypeCommunity();
    }

    if (!comm) {
      return res.json({ success: true, communities: [] });
    }

    return res.json({
      success: true,
      communities: [
        {
          id: comm.id,
          name: comm.name,
          district: comm.district || 'Pune',
          state: comm.state || 'Maharashtra',
          aquiferType: 'Basaltic Deccan Trap with alluvial pockets',
          participatingHouseholds: 215,
          totalBorewellsTracked: 12,
          activeRechargeStructures: 5,
          totalRechargedThisSeasonLiters: 980000,
          latitude: comm.latitude,
          longitude: comm.longitude,
        },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/register-community
 * Registers the prototype community and its primary account.
 * Membership status starts as 'pending' until Node 1 and Node 2 check in.
 */
router.post('/register-community', async (req: Request, res: Response) => {
  try {
    const { communityName, villageId, district, state, latitude, longitude, email, password, displayName } = req.body || {};
    if (!communityName || !email || !password || !displayName) {
      res.status(400).json({
        success: false,
        error: 'Community name, email, password, and full name are required.',
      });
      return;
    }

    let parsedLat: number | null = null;
    let parsedLon: number | null = null;
    if (latitude !== undefined && latitude !== null && latitude !== '') {
      const num = Number(latitude);
      if (isNaN(num) || num < -90 || num > 90) {
        res.status(400).json({ success: false, error: 'Latitude must be a valid number between -90 and 90 degrees.' });
        return;
      }
      parsedLat = num;
    }
    if (longitude !== undefined && longitude !== null && longitude !== '') {
      const num = Number(longitude);
      if (isNaN(num) || num < -180 || num > 180) {
        res.status(400).json({ success: false, error: 'Longitude must be a valid number between -180 and 180 degrees.' });
        return;
      }
      parsedLon = num;
    }
    if ((parsedLat === null) !== (parsedLon === null)) {
      res.status(400).json({
        success: false,
        error: 'Both latitude and longitude must be provided together, or leave both empty for unconfigured weather.',
      });
      return;
    }

    const result = await AuthService.registerPrototypeCommunityAndUser({
      communityName,
      villageId,
      district,
      state,
      latitude: parsedLat,
      longitude: parsedLon,
      email,
      password,
      displayName,
    });

    res.status(201).json({
      success: true,
      user: result.user,
      token: result.token,
      membershipStatus: result.membershipStatus,
      community: result.community,
      message: 'Prototype community registered. Membership is pending verification of Node 1 and Node 2 hardware packets.',
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Community registration failed.',
    });
  }
});

/**
 * POST /api/auth/register
 * Self-registration for resident accounts to the registered community.
 * Membership status starts as 'pending'.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName, villageId } = req.body || {};
    if (!email || !password || !displayName) {
      res.status(400).json({
        success: false,
        error: 'Email, password, and full name are required.',
      });
      return;
    }

    const result = await AuthService.registerUser({
      email,
      password,
      displayName,
      villageId,
    });

    res.status(201).json({
      success: true,
      user: result.user,
      token: result.token,
      membershipStatus: result.membershipStatus,
      message: 'Account registered. Community membership is pending verification of Node 1 and Node 2 hardware packets.',
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Registration failed.',
    });
  }
});

/**
 * POST /api/auth/login
 * Verifies credentials and returns current membership status.
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required.',
      });
      return;
    }

    const { user, token, membershipStatus } = await AuthService.loginUser({
      email,
      password,
    });

    res.json({
      success: true,
      user,
      token,
      membershipStatus,
    });
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: err.message || 'Invalid credentials.',
    });
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile and membership status.
 */
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.header('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    res.status(401).json({ success: false, error: 'Authorization token required.' });
    return;
  }

  const payload = AuthService.verifyToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    return;
  }

  const membershipStatus = await AuthService.getMembershipStatus(payload.userId, payload.communityId);

  res.json({
    success: true,
    user: {
      id: payload.userId,
      email: payload.email,
      displayName: payload.displayName,
      role: payload.role,
      communityId: payload.communityId,
    },
    membershipStatus,
  });
});

/**
 * GET /api/auth/setup-status
 * Plain-language setup status for the prototype community, user account, Node 1, and Node 2.
 */
router.get('/setup-status', async (req: Request, res: Response) => {
  try {
    const community = await AuthService.getPrototypeCommunity();
    const villageId = community?.id || 'village-rampur-04';

    const { node1, node2, bothNodesVerified } = await AuthService.getNodeStatusForCommunity(villageId);

    // Check optional authenticated user
    const authHeader = req.header('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    let membershipStatus: 'active' | 'pending' | 'none' = 'none';

    if (token) {
      const payload = AuthService.verifyToken(token);
      if (payload) {
        membershipStatus = await AuthService.getMembershipStatus(payload.userId, villageId);
        // If both nodes are verified and user is pending, auto-activate
        if (bothNodesVerified && membershipStatus === 'pending') {
          await AuthService.checkAndActivateNodes(villageId);
          membershipStatus = 'active';
        }
      }
    }

    res.json({
      success: true,
      communityRegistered: Boolean(community),
      community,
      node1,
      node2,
      bothNodesVerified,
      membershipStatus,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/auth/verify-nodes
 * Checks telemetry for Node 1 and Node 2. If both verified, activates pending memberships.
 */
router.post('/verify-nodes', async (req: Request, res: Response) => {
  try {
    const community = await AuthService.getPrototypeCommunity();
    const villageId = (typeof req.body?.villageId === 'string' && req.body.villageId) || community?.id || 'village-rampur-04';

    const result = await AuthService.checkAndActivateNodes(villageId);

    res.json({
      success: true,
      ...result,
      message: result.bothNodesVerified
        ? 'Both Node 1 and Node 2 packets verified. Community membership is active.'
        : 'Waiting for both Node 1 and Node 2 packets. Ensure both nodes are powered on and transmitting over local Wi-Fi.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/auth/community/location & PUT /api/auth/community/location
 * Securely updates geographic coordinates for the existing verified community.
 * Protected: Requires active community membership.
 * Community ID is derived strictly server-side from verified user credentials.
 */
const handleLocationUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
    const verifiedCommunityId = (req as any).communityId || (req as any).user?.communityId;
    if (!verifiedCommunityId) {
      res.status(403).json({ success: false, error: 'Active community membership required.' });
      return;
    }

    const { latitude, longitude } = req.body || {};
    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({ success: false, error: 'Both latitude and longitude are required.' });
      return;
    }

    let parsedLat: number | null = null;
    let parsedLon: number | null = null;
    if (latitude !== null && latitude !== '') {
      const num = Number(latitude);
      if (isNaN(num) || num < -90 || num > 90) {
        res.status(400).json({ success: false, error: 'Latitude must be a valid number between -90 and 90 degrees.' });
        return;
      }
      parsedLat = num;
    }
    if (longitude !== null && longitude !== '') {
      const num = Number(longitude);
      if (isNaN(num) || num < -180 || num > 180) {
        res.status(400).json({ success: false, error: 'Longitude must be a valid number between -180 and 180 degrees.' });
        return;
      }
      parsedLon = num;
    }
    if ((parsedLat === null) !== (parsedLon === null)) {
      res.status(400).json({
        success: false,
        error: 'Both latitude and longitude must be provided together, or leave both null to clear.',
      });
      return;
    }

    const updated = await AuthService.updateCommunityLocation(verifiedCommunityId, parsedLat, parsedLon);
    res.json({
      success: true,
      community: updated,
      message: parsedLat !== null ? 'Community coordinates updated successfully.' : 'Community coordinates cleared.',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to update community location.' });
  }
};

router.patch('/community/location', requireActiveCommunityMembership, handleLocationUpdate);
router.put('/community/location', requireActiveCommunityMembership, handleLocationUpdate);

/**
 * PATCH /api/auth/community/name & PUT /api/auth/community/name
 * Securely updates the community name for the existing verified community.
 * Protected: Requires active community membership.
 * Community ID is derived strictly server-side from verified user credentials.
 */
const handleCommunityNameUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
    const verifiedCommunityId = (req as any).communityId || (req as any).user?.communityId;
    if (!verifiedCommunityId) {
      res.status(403).json({ success: false, error: 'Active community membership required.' });
      return;
    }

    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 128) {
      res.status(400).json({
        success: false,
        error: 'A valid community name between 2 and 128 characters is required.',
      });
      return;
    }

    const updated = await AuthService.updateCommunityName(verifiedCommunityId, name.trim());
    res.json({
      success: true,
      community: updated,
      message: 'Community name updated successfully.',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to update community name.' });
  }
};

router.patch('/community/name', requireActiveCommunityMembership, handleCommunityNameUpdate);
router.put('/community/name', requireActiveCommunityMembership, handleCommunityNameUpdate);
router.patch('/community', requireActiveCommunityMembership, async (req: Request, res: Response) => {
  if (req.body?.name !== undefined) {
    return handleCommunityNameUpdate(req, res);
  }
  if (req.body?.latitude !== undefined || req.body?.longitude !== undefined) {
    return handleLocationUpdate(req, res);
  }
  res.status(400).json({ success: false, error: 'No valid community fields provided to update.' });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Signed out successfully.' });
});

export default router;
