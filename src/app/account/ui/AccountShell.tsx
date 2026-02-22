import Link from "next/link";

function NavItem({
  href,
  children,
  active = false,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "uppercase tracking-[0.02em] transition",
        "text-[11px] sm:text-[12px] whitespace-nowrap",
        active ? "text-black font-bold" : "text-black/45 hover:text-black/80",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function LogoutButton() {
  return (
    <form action="/auth/logout" method="POST">
      <button
        type="submit"
        className="uppercase tracking-[0.02em] transition text-black/45 hover:text-black/80 text-[12px]"
      >
        ВЫХОД
      </button>
    </form>
  );
}

export default function AccountShell({
  active,
  children,
}: {
  active: "orders" | "profile" | "address" | "subscriptions";
  children: React.ReactNode;
}) {
  return (
    <div
      className="
        mx-auto max-w-[1440px]
        px-[14px] sm:px-[24px] md:px-[65px]
        pt-[22px] sm:pt-[32px] md:pt-[60px]
        pb-[80px] sm:pb-[110px] md:pb-[140px]
      "
    >
      <div className="flex flex-col md:flex-row items-start gap-[18px] md:gap-[50px]">
        {/* LEFT NAV */}
        <aside
          className="
            w-full md:w-[210px]
            pt-0 md:pt-[160px]
          "
        >
          <div
            className="
              flex md:flex-col
              gap-[14px] md:gap-[12px]
              overflow-x-auto md:overflow-visible
              py-[10px] ml-[3px]
              border-b border-black/10 md:border-0
              -mx-[14px] px-[14px]
              sm:-mx-[24px] sm:px-[24px]
              md:mx-0 md:px-0
            "
          >
            <NavItem href="/account/orders" active={active === "orders"}>
              ЗАКАЗЫ
            </NavItem>
            <NavItem href="/account/profile" active={active === "profile"}>
              ЛИЧНЫЕ ДАННЫЕ
            </NavItem>
            <NavItem href="/account/address" active={active === "address"}>
              АДРЕС ДОСТАВКИ
            </NavItem>
            <NavItem href="/account/subscriptions" active={active === "subscriptions"}>
              ПОДПИСКИ
            </NavItem>

            {/* ❌ Скрыто на мобилке */}
            <div className="hidden md:block pt-[10px]">
              <LogoutButton />
            </div>
          </div>
        </aside>

        {/* RIGHT */}
        <section className="w-full flex-1 pt-[14px] sm:pt-[18px] md:pt-[80px]">
          <div className="mx-auto w-full max-w-[720px]">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
