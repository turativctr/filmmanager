import type { Role, Tema } from "@prisma/client";
import type { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      tema: Tema;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: Role;
    tema: Tema;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    tema: Tema;
  }
}
