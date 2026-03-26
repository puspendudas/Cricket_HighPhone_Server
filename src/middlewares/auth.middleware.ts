import { NextFunction, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { APP_SECRET_KEY } from '@/config';
import { HttpException } from '@exceptions/HttpException';
import { DataStoredInToken, RequestWithUser } from '@interfaces/auth.interface';
import User from '@/models/user.model';


const authMiddleware = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const Authorization = req.cookies['Authorization'] || (req.header('Authorization') ? req.header('Authorization').split('Bearer ')[1] : null);

    if (Authorization) {
      const secretKey: string = APP_SECRET_KEY;
      const verificationResponse = verify(Authorization, secretKey) as DataStoredInToken;
      const userId = verificationResponse.id;
      const findUser = await User.findById(userId).select('+session_token');

      if (findUser) {
        const tokenSession = verificationResponse.sessionToken;
        if (!tokenSession || !findUser.session_token || tokenSession !== findUser.session_token) {
          console.warn('[auth.middleware] Session token mismatch', { userId, path: req.originalUrl });
          next(new HttpException(401, 'Session expired'));
          return;
        }
        req.user = findUser;
        next();
      } else {
        console.warn('[auth.middleware] Token verified but user not found', { userId, path: req.originalUrl });
        next(new HttpException(401, 'Wrong authentication token'));
      }
    } else {
      console.warn('[auth.middleware] Missing token', { path: req.originalUrl });
      next(new HttpException(404, 'Authentication token missing'));
    }
  } catch (error) {
    console.warn('[auth.middleware] Token verification failed', { path: req.originalUrl, error: error?.message || error });
    next(new HttpException(440, 'Wrong authentication token Error'));
  }
};

export default authMiddleware;
