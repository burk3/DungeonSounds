import { Router, Request, Response, NextFunction } from 'express';
import { getUserInfo } from '@replit/repl-auth';
import { Session } from 'express-session';

// Define the user type based on Replit Auth's UserInfo interface
interface User {
  id?: string;
  name?: string;
  bio?: string;
  url?: string;
  profileImage?: string;
  roles?: Array<string>;
  teams?: Array<string>;
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Extend the session
declare module 'express-session' {
  interface SessionData {
    user?: User;
  }
}

export const authRouter = Router();

// Middleware to check if user is authenticated and set user info to request
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Try to get user from session first
    if (req.session.user) {
      req.user = req.session.user;
      return next();
    }
    
    // Try to get user from Replit auth
    const user = getUserInfo(req);
    if (user) {
      req.user = user;
      req.session.user = user; // Save to session
    }
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    next();
  }
};

// Route to check if user is authenticated
authRouter.get('/user', authMiddleware, (req: Request, res: Response) => {
  if (req.user) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

// Login route that redirects to Replit auth
authRouter.get('/login', (req: Request, res: Response) => {
  const redirectUrl = req.query.redirect || '/';
  res.redirect(`https://replit.com/auth_with_repl_site?domain=${req.get('host')}&redirect=${redirectUrl}`);
});

// Logout route
authRouter.get('/logout', (req: Request, res: Response) => {
  const redirectUrl = req.query.redirect || '/';
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect(redirectUrl as string);
  });
});

// Protected route helper
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};