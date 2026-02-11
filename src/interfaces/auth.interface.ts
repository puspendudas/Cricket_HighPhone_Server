import { Request } from 'express';
import { UserDocument } from '@interfaces/users.interface';
import { Admin } from '@interfaces/admin.interface';

export interface DataStoredInToken {
  id: string;
  sessionToken?: string;
}

export interface TokenData {
  token: string;
  expiresIn: any;
}

export interface RequestWithUser extends Request {
  user: UserDocument;
  admin: Admin;
}
