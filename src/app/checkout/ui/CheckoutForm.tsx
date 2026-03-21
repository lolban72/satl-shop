"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/lib/cart-store";
import { useRouter } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Оформление заказа | SATL",
};

function moneyRub(cents: number) {
  return `${(cents / 100).toFixed(0)}р`;
}

function clsx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

type PvzItem = {
  code: string;
  name?: string;
  address: string;
  city?: string;
  workTime?: string;
  type?: string;
};

type SelectedPvz = {
  code: string;
  address: string;
  name?: string;
};

export default function CheckoutForm(props: {
  initial: {
    name: string;
    phone: string;
    address: string;
    tgChatId?: string | null;
    city?: string;
    pvzCode?: string | null;
    pvzAddress?: string | null;
    pvzName?: string | null;
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

  const initialCity = String(props.initial.city ?? "").trim();
  const initialPvzCode = String(props.initial.pvzCode ?? "").trim();
  const initialPvzAddress = String(
    props.initial.pvzAddress ?? props.initial.address ?? ""
  ).trim();
  const initialPvzName = String(props.initial.pvzName ?? "").trim();

  const [address, setAddress] = useState(initialPvzAddress);
  const [city, setCity] = useState(initialCity);

  const [pvz, setPvz] = useState<SelectedPvz | null>(
    initialPvzCode && initialPvzAddress
      ? {
          code: initialPvzCode,
          address: initialPvzAddress,
          name: initialPvzName || undefined,
        }
      : null
  );

  const [pvzList, setPvzList] = useState<PvzItem[]>([]);
  const [pvzLoading, setPvzLoading] = useState(false);
  const [pvzQuery, setPvzQuery] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [delivery, setDelivery] = useState<{
    priceCents: number;
    daysMin: number | null;
    daysMax: number | null;
  } | null>(null);

  const [deliveryLoading, setDeliveryLoading] = useState(false);

  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount: number;
  } | null>(null);

  const isTelegramNotLinked = !String(props.initial.tgChatId ?? "").trim();

  const deliveryMarkupCents = delivery
    ? Math.round(delivery.priceCents * 0.1)
    : 0;

  const deliveryTotalCents = delivery
    ? delivery.priceCents + deliveryMarkupCents
    : 0;

  const promoDiscountCents = appliedPromo?.discount ?? 0;
  const payTotal = Math.max(itemsTotal - promoDiscountCents, 0) + deliveryTotalCents;

  const deliveryAbortRef = useRef<AbortController | null>(null);

  async function loadPvz(nextCity?: string) {
    const cityTrim = String(nextCity ?? city ?? "").trim();

    setErr(null);
    setPvzList([]);
    setPvzQuery("");
    setDelivery(null);
    setPvz(null);
    setAddress("");

    if (!cityTrim) {
      setErr("Укажите город.");
      return;
    }

    setPvzLoading(true);

    try {
      const res = await fetch(
        `/api/cdek/pvz?city=${encodeURIComponent(cityTrim)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const rawError = String(data?.error || "").toLowerCase();

        if (
          rawError.includes("city not found") ||
          rawError.includes("город не найден") ||
          rawError.includes("city or citycode required")
        ) {
          throw new Error("Город введен неверно");
        }

        throw new Error(data?.error || "Не удалось загрузить пункты выдачи");
      }

      const raw = Array.isArray(data?.points)
        ? data.points
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];

      const normalized: PvzItem[] = raw
        .map((x: any) => ({
          code: String(x?.code ?? "").trim(),
          name: String(x?.name ?? "ПВЗ").trim(),
          address: String(x?.address ?? "").trim(),
          city: String(x?.city ?? data?.city ?? cityTrim).trim(),
          workTime: String(x?.workTime ?? "").trim(),
          type: String(x?.type ?? "").trim(),
        }))
        .filter((x: { code: string; address: string }) => x.code && x.address);

      setPvzList(normalized);

      if (!normalized.length) {
        setErr("Пункты выдачи не найдены.");
      }
    } catch (e: any) {
      const msg = String(e?.message || "Ошибка загрузки ПВЗ");
      if (
        msg.toLowerCase().includes("city not found") ||
        msg.toLowerCase().includes("город не найден")
      ) {
        setErr("Город введен неверно");
      } else {
        setErr(msg);
      }
    } finally {
      setPvzLoading(false);
    }
  }

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
          items: items.map((i: any) => ({
            productId: i.productId,
            qty: i.qty,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Не удалось рассчитать доставку");
      }

      const best = data?.best;
      const priceRub = Number(best?.delivery_sum);

      if (!Number.isFinite(priceRub)) {
        throw new Error("СДЭК не вернул цену доставки");
      }

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

  async function applyPromo() {
    const normalized = promoCode.trim().toUpperCase();

    setPromoError(null);
    setErr(null);

    if (!normalized) {
      setAppliedPromo(null);
      return setPromoError("Введите промокод.");
    }

    if (itemsTotal <= 0) {
      setAppliedPromo(null);
      return setPromoError("Корзина пуста.");
    }

    try {
      setPromoLoading(true);

      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: normalized,
          orderTotal: itemsTotal,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Не удалось применить промокод");
      }

      const discount = Number(data?.discount ?? 0);

      setAppliedPromo({
        code: normalized,
        discount: Number.isFinite(discount) ? discount : 0,
      });
      setPromoCode(normalized);
    } catch (e: any) {
      setAppliedPromo(null);
      setPromoError(e?.message || "Ошибка применения промокода");
    } finally {
      setPromoLoading(false);
    }
  }

  function clearPromo() {
    setPromoCode("");
    setAppliedPromo(null);
    setPromoError(null);
  }

  function selectPvz(item: PvzItem) {
    const next = {
      code: item.code,
      address: item.address,
      name: item.name || "ПВЗ",
    };

    const nextCity = String(item.city || city).trim();

    setErr(null);
    setPvz(next);
    setAddress(item.address);
    setCity(nextCity);

    recalcDelivery(nextCity, {
      code: item.code,
      address: item.address,
    });
  }

  useEffect(() => {
    if (!pvz?.code || !pvz?.address) return;
    if (!city.trim()) return;
    recalcDelivery(city, { code: pvz.code, address: pvz.address });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persistPickupToAccount() {
    const cityTrim = String(city ?? "").trim();
    if (!cityTrim) return;
    if (!pvz?.code || !pvz?.address) return;

    try {
      await fetch("/api/account/address", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryType: "pickup",
          addressCity: cityTrim,
          pvzCode: pvz.code,
          pvzAddress: pvz.address,
          pvzName: pvz.name ?? "",
          addressComment: "",
        }),
      });
    } catch {
      // ignore
    }
  }

  async function submit() {
    setErr(null);

    if (isTelegramNotLinked) {
      return setErr("Привяжите Telegram перед оформлением заказа.");
    }

    if (items.length === 0) return setErr("Корзина пуста.");
    if (!name.trim()) return setErr("Укажите имя.");
    if (!phone.trim()) return setErr("Укажите телефон.");

    const cityTrim = String(city ?? "").trim();
    if (!cityTrim) return setErr("Укажите город.");
    if (!pvz?.code || !pvz?.address) {
      return setErr("Выберите пункт выдачи СДЭК.");
    }

    if (deliveryLoading) return setErr("Считаем доставку... подождите.");
    if (promoLoading) return setErr("Проверяем промокод... подождите.");
    if (!delivery) {
      return setErr(
        "Не удалось рассчитать доставку. Выберите ПВЗ ещё раз."
      );
    }

    setLoading(true);

    try {
      await persistPickupToAccount();

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
          pvzName: pvz.name ?? null,
          deliveryPrice: delivery.priceCents,
          deliveryDays: delivery.daysMax ?? delivery.daysMin ?? null,
          promoCode: appliedPromo?.code ?? null,
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
      if (!res.ok) {
        throw new Error(data?.error || "Не удалось начать оплату");
      }

      const draftId = String(data?.draftId || "");
      if (!draftId) throw new Error("Не удалось получить draftId");

      router.push(`/pay/${encodeURIComponent(draftId)}`);
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  const filteredPvz = useMemo(() => {
    const q = String(pvzQuery || "").trim().toLowerCase();
    if (!q) return pvzList;

    return pvzList.filter((item) => {
      const hay = [
        item.code,
        item.name,
        item.address,
        item.city,
        item.workTime,
        item.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [pvzList, pvzQuery]);

  const card = "border border-black/10 bg-white";
  const input =
    "h-[46px] border border-black/15 px-[14px] text-[14px] outline-none focus:border-black transition bg-white";
  const label = "text-[9px] uppercase tracking-[0.12em] text-black/55";
  const hint = "text-[12px] text-black/55 leading-[1.5]";
  const btn =
    "flex h-[46px] w-full items-center justify-center bg-black text-white text-[10px] font-bold uppercase tracking-[0.12em] hover:bg-black/85 transition disabled:opacity-50 disabled:hover:bg-black";

  return (
    <div className="mx-auto max-w-[1440px] px-[65px] pt-[70px] pb-[140px] text-black bg-white">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[26px] font-semibold tracking-[-0.02em]">
            Оформление
          </div>
        </div>

        <button
          onClick={() => router.push("/cart")}
          className="text-[11px] uppercase tracking-[0.08em] text-black/55 hover:text-black transition"
          type="button"
        >
          Вернуться в корзину
        </button>
      </div>

      {err ? (
        <div className="mt-[22px] border border-black/20 bg-white p-[14px] text-[12px] text-black">
          <div className="font-semibold uppercase tracking-[0.08em] text-[10px] mb-[6px]">
            Ошибка
          </div>
          {err}
        </div>
      ) : null}

      <div className="mt-[36px] grid gap-[28px] lg:grid-cols-[1fr_420px] lg:items-start">
        <div className={clsx(card, "p-[18px] md:p-[22px]")}>
          <div className="text-[18px] font-semibold tracking-[-0.01em]">
            Данные получателя
          </div>

          {isTelegramNotLinked ? (
            <>
              <div className={clsx("mt-[12px]", hint)}>
                Для оформления заказа нужно привязать телеграм — туда будут
                приходить уведомления о заказе и восстановление пароля.
              </div>

              <div className="mt-[18px] border border-black/20 p-[16px]">
                <div className="text-[10px] uppercase tracking-[0.12em] text-black/55 mb-[6px]">
                  Важно
                </div>
                <div className="text-[12px] text-black/75">
                  Перейдите в профиль и нажмите «Привязать телеграм». Это займёт
                  10–20 секунд.
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

                <div className="grid gap-[10px]">
                  <span className={label}>Промокод</span>

                  <div className="grid gap-[10px] sm:grid-cols-[1fr_180px]">
                    <input
                      className={input}
                      value={promoCode}
                      style={{ fontFamily: "Brygada" }}
                      onChange={(e) => {
                        setPromoCode(e.target.value.toUpperCase());
                        setPromoError(null);
                      }}
                      placeholder="Введите промокод"
                    />

                    <button
                      type="button"
                      onClick={applyPromo}
                      disabled={promoLoading || !promoCode.trim()}
                      className={btn}
                    >
                      {promoLoading ? "Проверяем..." : "Применить"}
                    </button>
                  </div>

                  {appliedPromo ? (
                    <div className="flex items-center justify-between border border-black/15 bg-black/[0.03] px-[14px] py-[12px] text-[12px]">
                      <div>
                        <div className="font-semibold uppercase tracking-[0.08em] text-[10px]">
                          Промокод применён
                        </div>
                        <div className="mt-[4px] text-black/70">
                          {appliedPromo.code} · скидка {moneyRub(appliedPromo.discount)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={clearPromo}
                        className="text-[10px] font-bold uppercase tracking-[0.12em] text-black/60 hover:text-black transition"
                      >
                        Убрать
                      </button>
                    </div>
                  ) : null}

                  {promoError ? (
                    <div className="text-[12px] text-black/60">{promoError}</div>
                  ) : null}
                </div>

                <div className="grid gap-[10px]">
                  <span className={label}>Пункт выдачи СДЭК</span>

                  <label className="grid gap-[4px]">
                    <span className="text-[11px] text-black/55">Город</span>
                    <input
                      className={input}
                      value={city}
                      style={{ fontFamily: "Brygada" }}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setPvzList([]);
                        setPvzQuery("");
                        setPvz(null);
                        setAddress("");
                        setDelivery(null);
                        setErr(null);
                      }}
                      placeholder="Например: Краснодар"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => loadPvz(city)}
                    disabled={pvzLoading || !city.trim()}
                    className={btn}
                  >
                    {pvzLoading
                      ? "Загружаем пункты выдачи..."
                      : "Показать пункты выдачи"}
                  </button>

                  {pvzList.length > 0 ? (
                    <>
                      <label className="grid gap-[4px]">
                        <span className="text-[11px] text-black/55">
                          Поиск пункта выдачи заказов
                        </span>
                        <input
                          className={input}
                          value={pvzQuery}
                          style={{ fontFamily: "Brygada" }}
                          onChange={(e) => setPvzQuery(e.target.value)}
                          placeholder="Например: Жигуленко 30"
                        />
                      </label>

                      <div className="border border-black/10">
                        <div className="max-h-[320px] overflow-auto">
                          {filteredPvz.length > 0 ? (
                            filteredPvz.map((item) => {
                              const active = pvz?.code === item.code;

                              return (
                                <button
                                  key={item.code}
                                  type="button"
                                  onClick={() => selectPvz(item)}
                                  className={clsx(
                                    "w-full border-b border-black/10 px-[14px] py-[12px] text-left transition last:border-b-0",
                                    active
                                      ? "bg-black text-white"
                                      : "bg-white hover:bg-black/[0.03]"
                                  )}
                                >
                                  <div className="text-[12px] font-semibold uppercase tracking-[0.04em]">
                                    {item.name || `ПВЗ ${item.code}`}
                                  </div>

                                  <div className="mt-[4px] text-[12px] leading-[1.45] opacity-80">
                                    {item.address}
                                  </div>

                                  {item.workTime ? (
                                    <div className="mt-[6px] text-[10px] uppercase tracking-[0.08em] opacity-60">
                                      {item.workTime}
                                    </div>
                                  ) : null}

                                  {item.type ? (
                                    <div className="mt-[4px] text-[10px] uppercase tracking-[0.08em] opacity-60">
                                      {item.type}
                                    </div>
                                  ) : null}
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-[14px] py-[12px] text-[12px] text-black/55">
                              Ничего не найдено. Попробуйте улицу, дом, часть
                              адреса или код ПВЗ.
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : null}

                  <label className="grid gap-[4px]">
                    <span className="text-[11px] text-black/55">
                      Выбранный пункт
                    </span>
                    <textarea
                      value={address}
                      readOnly
                      rows={3}
                      style={{ fontFamily: "Brygada" }}
                      className="w-full resize-none border border-black/15 bg-black/[0.03] px-[14px] py-[10px] text-[14px] leading-[1.45] outline-none"
                      placeholder="Пункт выдачи не выбран"
                    />
                  </label>
                </div>
              </div>

              <button
                className={clsx(btn, "mt-[18px]")}
                disabled={
                  loading ||
                  items.length === 0 ||
                  deliveryLoading ||
                  promoLoading
                }
                onClick={submit}
                type="button"
              >
                {loading
                  ? "Переходим к оплате..."
                  : deliveryLoading
                  ? "Считаем доставку..."
                  : promoLoading
                  ? "Проверяем промокод..."
                  : "Перейти к оплате"}
              </button>

              <div className="mt-[6px] text-[11px] italic leading-[1.25] text-black/45">
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

        <aside className={clsx(card, "p-[18px] lg:sticky lg:top-[110px]")}>
          <div className="flex items-end justify-between">
            <div className="text-[20px] font-semibold">Ваш заказ</div>
            <div
              style={{ fontFamily: "Brygada" }}
              className="text-[12px] text-black/55"
            >
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
                <div
                  key={`${i.productId}-${i.variantId ?? "na"}`}
                  className="flex gap-[12px]"
                >
                  <img
                    src={i.image ?? "https://picsum.photos/seed/cart/140/140"}
                    alt={i.title}
                    className="h-[70px] w-[70px] border border-black/10 object-cover"
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
                      <span>
                        Размер: {i.size ? String(i.size).toUpperCase() : "—"}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{ fontFamily: "Brygada" }}
                    className="whitespace-nowrap text-[12px] font-semibold"
                  >
                    {moneyRub(i.price * i.qty)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="my-[16px] h-[1px] bg-black/10" />

          <div className="space-y-[10px] text-[12px] text-black/65">
            <div className="flex items-center justify-between">
              <span>Товары</span>
              <span style={{ fontFamily: "Brygada" }} className="text-black">
                {moneyRub(itemsTotal)}
              </span>
            </div>

            {appliedPromo ? (
              <div className="flex items-center justify-between">
                <span>Промокод ({appliedPromo.code})</span>
                <span style={{ fontFamily: "Brygada" }} className="text-black">
                  −{moneyRub(appliedPromo.discount)}
                </span>
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <span>Доставка</span>
              {deliveryLoading ? (
                <span
                  style={{ fontFamily: "Brygada" }}
                  className="text-black/45"
                >
                  Считаем...
                </span>
              ) : delivery ? (
                <span style={{ fontFamily: "Brygada" }} className="text-black">
                  {moneyRub(deliveryTotalCents)}
                  {delivery.daysMin || delivery.daysMax
                    ? ` (${delivery.daysMin ?? "?"}-${
                        delivery.daysMax ?? "?"
                      } дн.)`
                    : ""}
                </span>
              ) : (
                <span
                  style={{ fontFamily: "Brygada" }}
                  className="text-black/45"
                >
                  Выберите ПВЗ
                </span>
              )}
            </div>

            <div className="my-[12px] h-[1px] bg-black/10" />

            <div className="flex items-center justify-between">
              <span className="text-black/70">К оплате</span>
              <span
                style={{ fontFamily: "Brygada" }}
                className="text-[16px] font-semibold text-black"
              >
                {moneyRub(payTotal)}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}