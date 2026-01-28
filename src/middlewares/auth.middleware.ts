import { NextFunction, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { APP_SECRET_KEY } from '@/config';
import { HttpException } from '@exceptions/HttpException';
import { DataStoredInToken, RequestWithUser } from '@interfaces/auth.interface';
import User from '@/models/user.model';
import path from 'path';
import fs from 'fs';
const maintenanceFilePath = path.join(__dirname,'..','..', 'maintenance.json');


const authMiddleware = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const Authorization = req.cookies['Authorization'] || (req.header('Authorization') ? req.header('Authorization').split('Bearer ')[1] : null);

    if (Authorization) {
      const secretKey: string = APP_SECRET_KEY;
      const verificationResponse = verify(Authorization, secretKey) as DataStoredInToken;
      const userId = verificationResponse.id;
      const findUser = await User.findById(userId);

      if (findUser) {
        req.user = findUser;
        next();
      } else {
        next(new HttpException(401, 'Wrong authentication token'));
      }
    } else {
      next(new HttpException(404, 'Authentication token missing'));
    }
  } catch (error) {
    next(new HttpException(440, 'Wrong authentication token Error'));
  }
};

const checkMaintenanceMode = (req: RequestWithUser, res: Response, next: NextFunction) => {
  fs.readFile(maintenanceFilePath, 'utf8', (err, data) => {
      if (err) {
          return res.status(500).json({ message: 'Unable to read maintenance file' });
      }

      const maintenanceData = JSON.parse(data);
      if (maintenanceData.sanitizedData.maintainence && req.url !== '/maintenance') {
          return res.status(503).json({ message: 'The system is under maintenance. Please try again later.', maintenanceData: maintenanceData.sanitizedData });
      }
      // if (maintenanceData.sanitizedData.app_version_req && req.url !== '/maintenance') {
      //     return res.status(426).json({ message: 'This APP version is not supported. Please try again later.', maintenanceData: maintenanceData.sanitizedData });
      // }
      next();
  });
};

export default authMiddleware; checkMaintenanceMode;
