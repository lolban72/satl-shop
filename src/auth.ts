import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
async authorize(credentials) {
  const email = credentials?.email?.toString().toLowerCase().trim();
  const password = credentials?.password?.toString();
  console.log("[auth] login attempt", { email });

  if (!email || !password) return null;

  const user = await prisma.user.findUnique({ where: { email } });
  console.log("[auth] user found?", !!user);
  if (!user) return null;

  const ok = await bcrypt.compare(password, user.password);
  console.log("[auth] password ok?", ok);
  if (!ok) return null;

  return { id: user.id, email: user.email, name: user.name ?? null };
}

    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // user есть только при логине
      if (user) {
        token.id = (user as any).id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      // добавим id в session.user
      if (session.user) {
        (session.user as any).id = token.id;
        session.user.email = token.email as string;
        session.user.name = (token.name as string) ?? null;
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth/login",
  },
});
