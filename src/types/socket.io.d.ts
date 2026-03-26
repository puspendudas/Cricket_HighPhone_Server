import type { Admin } from '@interfaces/admin.interface';
import type { UserDocument } from '@interfaces/users.interface';

declare module 'socket.io' {
  interface SocketData {
    principal?:
      | { type: 'admin'; admin: Admin }
      | { type: 'user'; user: UserDocument };
  }
}
