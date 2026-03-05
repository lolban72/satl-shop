// ✅ src/app/checkout/ui/CheckoutForm.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { useCart } from "@/lib/cart-store";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PvzPickerYmaps from "@/components/PvzPickerYmaps";

export const metadata = {
  title: "Оформление заказа | SATL",
};

function moneyRub(cents: number) {
  return `${(cents / 100).toFixed(0)}р`;
}

function clsx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export default function CheckoutForm(props: {
  initial: {
    name: string;
    phone: string;
    address: string;
    tgChatId?: string | null;
    city?: string;
  };
}) {
  const router = useRouter();
  const { items } = useCart();

  const itemsTotal = useMemo(
    () => items.reduce((s, i) => s + i.price * i.qty, 0),
    [items]
  );

  const itemsCount = useMemo(
    () => items.reduce((s, i) => s + i.qty, 0),
    [items]
  );

  const [name, setName] = useState(props.initial.name);
  const [phone, setPhone] = useState(props.initial.phone);

  // address = адрес ПВЗ (readonly)
  const [address, setAddress] = useState(props.initial.address);

  // ✅ город выбирается ЕДИНОЖДЫ — внутри PvzPickerYmaps (мы убрали отдельный инпут города)
  const [city, setCity] = useState(props.initial.city ?? "");
  const [pvz, setPvz] = useState<{ code: string; address: string } | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [delivery, setDelivery] = useState<{
    priceCents: number;
    daysMin: number | null;
    daysMax: number | null;
  } | null>(null);

  const [deliveryLoading, setDeliveryLoading] = useState(false);

  const isTelegramNotLinked = !String(props.initial.tgChatId ?? "").trim();
  const payTotal = itemsTotal + (delivery?.priceCents ?? 0);

  const deliveryAbortRef = useRef<AbortController | null>(null);

  async function recalcDelivery(
    nextCity: string,
    nextPvz: { code: string; address: string } | null
  ) {
    setErr(null);
    setDelivery(null);

    const c = String(nextCity ?? "").trim();
    if (!c || !nextPvz?.code) return;

    deliveryAbortRef.current?.abort();
    const ac = new AbortController();
    deliveryAbortRef.current = ac;

    setDeliveryLoading(true);
    try {
      const res = await fetch("/api/cdek/calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          city: c,
          pvzCode: nextPvz.code,
          items: items.map((i: any) => ({ productId: i.productId, qty: i.qty })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Не удалось рассчитать доставку");

      const best = data?.best;
      const priceRub = Number(best?.delivery_sum);
      if (!Number.isFinite(priceRub)) throw new Error("СДЭК не вернул цену доставки");

      const priceCents = Math.round(priceRub * 100);

      const dMin = best?.period_min != null ? Number(best.period_min) : null;
      const dMax = best?.period_max != null ? Number(best.period_max) : null;

      setDelivery({
        priceCents,
        daysMin: Number.isFinite(dMin as any) ? dMin : null,
        daysMax: Number.isFinite(dMax as any) ? dMax : null,
      });
    } catch (e: any) {
      if (String(e?.name) === "AbortError") return;
      setErr(e?.message || "Ошибка расчёта доставки");
      setDelivery(null);
    } finally {
      setDeliveryLoading(false);
    }
  }

  async function submit() {
    setErr(null);

    if (isTelegramNotLinked) return setErr("Привяжите Telegram перед оформлением заказа.");
    if (items.length === 0) return setErr("Корзина пуста.");
    if (!name.trim()) return setErr("Укажите имя.");
    if (!phone.trim()) return setErr("Укажите телефон.");

    const cityTrim = String(city ?? "").trim();
    if (!cityTrim) return setErr("Выберите город в выборе ПВЗ.");
    if (!pvz?.code || !pvz?.address) return setErr("Выберите ПВЗ СДЭК на карте.");

    if (deliveryLoading) return setErr("Считаем доставку... подождите.");
    if (!delivery) return setErr("Не удалось рассчитать доставку. Выберите ПВЗ ещё раз.");

    setLoading(true);
    try {
      const res = await fetch("/api/pay/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),

          address: pvz.address,

          city: cityTrim,
          pvzCode: pvz.code,
          pvzAddress: pvz.address,

          deliveryPrice: delivery.priceCents,
          deliveryDays: delivery.daysMax ?? delivery.daysMin ?? null,

          items: items.map((i: any) => ({
            productId: i.productId,
            variantId: i.variantId ?? null,
            title: i.title,
            price: i.price,
            qty: i.qty,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Не удалось начать оплату");

      const draftId = String(data?.draftId || "");
      if (!draftId) throw new Error("Не удалось получить draftId");

      router.push(`/pay/${encodeURIComponent(draftId)}`);
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  const card = "border border-black/10 bg-white";
  const input =
    "h-[46px] border border-black/15 px-[14px] text-[14px] outline-none focus:border-black transition bg-white";
  const label = "text-[9px] uppercase tracking-[0.12em] text-black/55";
  const hint = "text-[12px] text-black/55 leading-[1.5]";
  const btn =
    "flex h-[46px] w-full items-center justify-center bg-black text-white text-[10px] font-bold uppercase tracking-[0.12em] hover:bg-black/85 transition disabled:opacity-50 disabled:hover:bg-black";

  return (
    <div className="mx-auto max-w-[1440px] px-[65px] pt-[70px] pb-[140px] text-black bg-white">
      {/* HEADER */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[26px] font-semibold tracking-[-0.02em]">Оформление</div>
        </div>

        <button
          onClick={() => router.push("/cart")}
          className="text-[11px] uppercase tracking-[0.08em] text-black/55 hover:text-black transition"
          type="button"
        >
          Вернуться в корзину
        </button>
      </div>

      {/* ERROR */}
      {err ? (
        <div className="mt-[22px] border border-black/20 bg-white p-[14px] text-[12px] text-black">
          <div className="font-semibold uppercase tracking-[0.08em] text-[10px] mb-[6px]">
            Ошибка
          </div>
          {err}
        </div>
      ) : null}

      <div className="mt-[36px] grid gap-[28px] lg:grid-cols-[1fr_420px] lg:items-start">
        {/* LEFT */}
        <div className={clsx(card, "p-[18px] md:p-[22px]")}>
          <div className="text-[18px] font-semibold tracking-[-0.01em]">Данные получателя</div>

          {isTelegramNotLinked ? (
            <>
              <div className={clsx("mt-[12px] mb-[12px]", hint)}>
                Для оформления заказа нужно привязать телеграм — туда будут приходить
                уведомления о заказе и восстановление пароля.
              </div>

              <div className="mt-[18px] border border-black/20 p-[16px]">
                <div className="text-[10px] uppercase tracking-[0.12em] text-black/55 mb-[6px]">
                  Важно
                </div>
                <div className="text-[12px] text-black/75">
                  Перейдите в профиль и нажмите «Привязать телеграм». Это займёт 10–20 секунд.
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/auth/verify")}
                  className="mt-[14px] h-[42px] w-full bg-black text-white text-[10px] font-bold uppercase tracking-[0.12em] hover:bg-black/85 transition"
                >
                  Привязать телеграм
                </button>
              </div>
            </>
          ) : (
            <>

              <div className="mt-[18px] grid gap-[16px]">
                {/* NAME */}
                <label className="grid gap-[4px]">
                  <span className={label}>Имя</span>
                  <input
                    className={input}
                    value={name}
                    style={{ fontFamily: "Brygada" }}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ваше имя"
                  />
                </label>

                {/* PHONE */}
                <label className="grid gap-[4px]">
                  <span className={label}>Телефон</span>
                  <input
                    className={input}
                    value={phone}
                    style={{ fontFamily: "Brygada" }}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (___) ___-__-__"
                  />
                </label>

                {/* DELIVERY */}
                  <div className="grid gap-[4px]">
                    {/* MAP WRAPPER */}
                    <span className={label}>Адрес пункт выдачи</span>
                    <PvzPickerYmaps
                      // ✅ город вводится только внутри компонента (один раз)
                      hideCityInput={false}
                      autoLoad={false}
                      onSelect={(p: { code: string; address: string; city: string }) => {
                        const pickedCity = String(p?.city ?? "").trim();

                        const next = {
                          code: String(p?.code ?? "").trim(),
                          address: String(p?.address ?? "").trim(),
                        };

                        if (!pickedCity) {
                          setErr("Не удалось определить город. Введите город и выберите ПВЗ ещё раз.");
                          return;
                        }

                        if (!next.code || !next.address) {
                          setErr("Не удалось прочитать выбранный ПВЗ (нет code/address)");
                          return;
                        }

                        // ✅ сохраняем выбранный город (единожды)
                        setCity(pickedCity);

                        setPvz(next);
                        setAddress(next.address);

                        // ✅ пересчёт доставки
                        recalcDelivery(pickedCity, next);
                        }}
                      />
                    </div>
                </div>

                {/* CTA */}
                <button
                  className={btn}
                  disabled={loading || items.length === 0 || deliveryLoading}
                  onClick={submit}
                  type="button"
                >
                  {loading
                    ? "Переходим к оплате..."
                    : deliveryLoading
                    ? "Считаем доставку..."
                    : "Перейти к оплате"}
                </button>

                <div className="text-[11px] italic leading-[1.25] text-black/45 mt-[6px]">
                  Нажимая кнопку, вы соглашаетесь с{" "}
                  <Link
                    href="https://satl.shop/docs/public-offer"
                    target="_blank"
                    className="underline hover:text-black transition"
                  >
                    публичной офертой
                  </Link>
                </div>
            </>
          )}
        </div>

        {/* RIGHT */}
        <aside className={clsx(card, "p-[18px] lg:sticky lg:top-[110px]")}>
          <div className="flex items-end justify-between">
            <div className="text-[20px] font-semibold">Ваш заказ</div>
            <div style={{ fontFamily: "Brygada" }} className="text-[12px] text-black/55">
              {itemsCount} шт.
            </div>
          </div>

          <div className="mt-[16px] grid gap-[12px]">
            {items.length === 0 ? (
              <div className="border border-black/10 p-[14px] text-[12px] text-black/55">
                В корзине нет товаров.
              </div>
            ) : (
              items.map((i: any) => (
                <div key={`${i.productId}-${i.variantId ?? "na"}`} className="flex gap-[12px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={i.image ?? "https://picsum.photos/seed/cart/140/140"}
                    alt={i.title}
                    className="h-[70px] w-[70px] object-cover border border-black/10"
                    draggable={false}
                  />

                  <div className="min-w-0 flex-1">
                    <div
                      style={{ fontFamily: "Brygada" }}
                      className="truncate text-[12px] font-semibold uppercase tracking-[0.06em]"
                    >
                      {String(i.title ?? "")}
                    </div>

                    <div
                      style={{ fontFamily: "Brygada" }}
                      className="mt-[6px] flex flex-wrap items-center gap-[10px] text-[11px] text-black/60"
                    >
                      <span>{moneyRub(i.price)}</span>
                      <span aria-hidden="true">•</span>
                      <span>Кол-во: {i.qty}</span>
                      <span aria-hidden="true">•</span>
                      <span>Размер: {i.size ? String(i.size).toUpperCase() : "—"}</span>
                    </div>
                  </div>

                  <div style={{ fontFamily: "Brygada" }} className="text-[12px] font-semibold whitespace-nowrap">
                    {moneyRub(i.price * i.qty)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="h-[1px] bg-black/10 my-[16px]" />

          <div className="space-y-[10px] text-[12px] text-black/65">
            <div className="flex items-center justify-between">
              <span>Товары</span>
              <span style={{ fontFamily: "Brygada" }} className="text-black">
                {moneyRub(itemsTotal)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Доставка</span>
              {deliveryLoading ? (
                <span style={{ fontFamily: "Brygada" }} className="text-black/45">
                  Считаем...
                </span>
              ) : delivery ? (
                <span style={{ fontFamily: "Brygada" }} className="text-black">
                  {moneyRub(delivery.priceCents)}
                  {delivery.daysMin || delivery.daysMax
                    ? ` (${delivery.daysMin ?? "?"}-${delivery.daysMax ?? "?"} дн.)`
                    : ""}
                </span>
              ) : (
                <span style={{ fontFamily: "Brygada" }} className="text-black/45">
                  Выберите ПВЗ
                </span>
              )}
            </div>

            <div className="h-[1px] bg-black/10 my-[12px]" />

            <div className="flex items-center justify-between">
              <span className="text-black/70">К оплате</span>
              <span style={{ fontFamily: "Brygada" }} className="text-[16px] font-semibold text-black">
                {moneyRub(payTotal)}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}