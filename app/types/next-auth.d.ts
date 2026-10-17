import { DefaultSession } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

export interface UserRole {
  id: string;
  codigo: string;
  nombre: string;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      nombre: string;
      correo: string;
      rol: UserRole;
      permisos: string[];
      empleadoId?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    nombre: string;
    correo: string;
    rol: UserRole;
    permisos: string[];
    empleadoId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    nombre?: string;
    correo?: string;
    rol?: UserRole;
    permisos?: string[];
    empleadoId?: string | null;
  }
}