import { NextFunction, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { AGENT_SECRET_KEY } from '@/config';
import Admin from "@models/admin.model";
import { HttpException } from '@exceptions/HttpException';
import { DataStoredInToken, RequestWithUser } from '@interfaces/auth.interface';

const agentMiddleware = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const Authorization = req.cookies['Authorization'] || (req.header('Authorization') ? req.header('Authorization').split('Bearer ')[1] : null);
    
    if (Authorization) {
      const secretKey: string = AGENT_SECRET_KEY;
      const verificationResponse = verify(Authorization, secretKey) as DataStoredInToken;
      const adminId = verificationResponse.id;
      const findAdmin = await Admin.findById(adminId);

      if (findAdmin) {
        if (!findAdmin.status && findAdmin.type === "agent") {
          next(new HttpException(403, 'Not authorized as admin'));
        }
        req.admin = findAdmin;
        next();
      } else {
        next(new HttpException(401, 'Wrong authentication token'));
      }
    } else {
      next(new HttpException(404, 'Authentication token missing'));
    }
  } catch (error) {
    next(new HttpException(401, 'Wrong authentication token Error'));
  }
};

export default agentMiddleware;
