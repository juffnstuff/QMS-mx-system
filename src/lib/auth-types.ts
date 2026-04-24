import "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    isSuperAdmin?: boolean;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      isSuperAdmin: boolean;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: string;
    id?: string;
    isSuperAdmin?: boolean;
  }
}
