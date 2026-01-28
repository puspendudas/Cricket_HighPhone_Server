import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@interfaces/auth.interface';
import path from 'path';
import fs from 'fs';
const maintenanceFilePath = path.join(__dirname, '..', '/assets/maintenance.json');

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

export default checkMaintenanceMode;
