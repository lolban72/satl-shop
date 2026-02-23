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

        // ✅ Лучше сразу select нужные поля
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            tgChatId: true, // ✅ важно для проверки привязки
            // phone: true,   // (опционально)
            // lastName: true // (опционально)
          },
        });

        console.log("[auth] user found?", !!user);
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.password);
        console.log("[auth] password ok?", ok);
        if (!ok) return null;

        // ✅ Возвращаем все поля, которые хотим видеть в token/session
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          tgChatId: user.tgChatId ?? null,
          // phone: user.phone ?? null,
          // lastName: user.lastName ?? null,
        } as any;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // user есть только при логине
      if (user) {
        token.id = (user as any).id;
        token.email = (user as any).email;
        token.name = (user as any).name;

        // ✅ прокидываем tgChatId
        token.tgChatId = (user as any).tgChatId ?? null;

        // (опционально)
        // token.phone = (user as any).phone ?? null;
        // token.lastName = (user as any).lastName ?? null;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        session.user.email = token.email as string;
        session.user.name = (token.name as string) ?? null;

        // ✅ прокидываем tgChatId в session.user
        (session.user as any).tgChatId = (token as any).tgChatId ?? null;

        // (опционально)
        // (session.user as any).phone = (token as any).phone ?? null;
        // (session.user as any).lastName = (token as any).lastName ?? null;
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth/login",
  },
});