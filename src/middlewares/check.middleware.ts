import { NextFunction, Response } from 'express';
import { RequestWithUser } from '@interfaces/auth.interface';

// In-memory maintenance state
let maintenanceMode = false;
let maintenanceMsg = 'under maintainence';

export const setMaintenanceMode = (enabled: boolean, msg?: string) => {
    maintenanceMode = enabled;
    if (msg) maintenanceMsg = msg;
};

export const getMaintenanceStatus = () => ({
    maintainence: maintenanceMode,
    maintainence_msg: maintenanceMsg,
});

const checkMaintenanceMode = (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (maintenanceMode && req.url !== '/maintenance') {
        return res.status(503).json({
            message: 'The system is under maintenance. Please try again later.',
            maintenanceData: { maintainence: maintenanceMode, maintainence_msg: maintenanceMsg }
        });
    }
    next();
};

export default checkMaintenanceMode;
