import type { Role } from '@/types/domain';

export {};

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: Role;
    }

    interface Locals {
      pagination?: {
        page: number;
        limit: number;
        skip: number;
      };
    }
  }
}
