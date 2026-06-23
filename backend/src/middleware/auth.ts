import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, resolveStaffAccess, StaffMember } from '../services/authService';

export interface AuthedRequest extends Request {
  staffMember?: StaffMember;
}

/**
 * Verifies the Supabase access token in the Authorization header and
 * resolves clinic-level staff access. Attaches req.staffMember on success.
 *
 * Falls back gracefully: if no Bearer token is present, this middleware
 * does nothing — the route can then check for the legacy PIN instead.
 * This lets both auth methods coexist during migration.
 */
export async function requireGoogleStaffAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const clinicId = req.params.clinicId;

  if (!authHeader?.startsWith('Bearer ')) {
    next(); // no token provided — let route fall back to PIN check
    return;
  }

  const token = authHeader.slice(7);
  const user = await verifyAccessToken(token);

  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    return;
  }

  const staffMember = await resolveStaffAccess(clinicId, user);

  if (!staffMember) {
    res.status(403).json({
      error: 'Your Google account is not authorized for this clinic. Ask an admin to invite you.',
      email: user.email,
    });
    return;
  }

  req.staffMember = staffMember;
  next();
}

/** Requires the resolved staff member to have the 'admin' role. */
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.staffMember) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.staffMember.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
