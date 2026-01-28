import { NextFunction, Request, Response } from 'express';

class IndexController {
  public index(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(500).json({ message: 'Internal Server Error! 🙁' });
    } catch (error) {
      next(error);
    }
  }
}

export default IndexController;
