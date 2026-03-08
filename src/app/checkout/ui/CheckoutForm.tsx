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
};

type SelectedPvz = {
  code: string;
  address: string;
  name?: string;
};

type CitySuggest = {
  code: number;
  city: string;
  region?: string;
  country?: string;
  full: string;
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
  const [cityQuery, setCityQuery] = useState(initialCity);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggest[]>([]);
  const [citySuggestLoading, setCitySuggestLoading] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);

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

  const isTelegramNotLinked = !String(props.initial.tgChatId ?? "").trim();
  const payTotal = itemsTotal + (delivery?.priceCents ?? 0);

  const deliveryAbortRef = useRef<AbortController | null>(null);
  const cityAbortRef = useRef<AbortController | null>(null);
  const cityBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!cityBoxRef.current) return;
      if (!cityBoxRef.current.contains(e.target as Node)) {
        setCityDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const q = String(cityQuery || "").trim();

    if (q.length < 2) {
      setCitySuggestions([]);
      setCitySuggestLoading(false);
      return;
    }

    const t = setTimeout(async () => {
      cityAbortRef.current?.abort();
      const ac = new AbortController();
      cityAbortRef.current = ac;

      setCitySuggestLoading(true);

      try {
        const res = await fetch(`/api/cdek/cities?query=${encodeURIComponent(q)}`, {
          method: "GET",
          cache: "no-store",
          signal: ac.signal,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Не удалось загрузить города");

        const items = Array.isArray(data?.items) ? data.items : [];
        setCitySuggestions(items);
        setCityDropdownOpen(true);
      } catch (e: any) {
        if (String(e?.name) === "AbortError") return;
        setCitySuggestions([]);
      } finally {
        setCitySuggestLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [cityQuery]);

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
      const res = await fetch(`/api/cdek/pvz?city=${encodeURIComponent(cityTrim)}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
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
        }))
        .filter((x: { code: string; address: string }) => x.code && x.address);

      setPvzList(normalized);

      if (!normalized.length) {
        setErr("Пункты выдачи не найдены.");
      }
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки ПВЗ");
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
    setCityQuery(nextCity);

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
    } catch {}
  }

  async function submit() {
    setErr(null);

    if (isTelegramNotLinked) return setErr("Привяжите Telegram перед оформлением заказа.");
    if (items.length === 0) return setErr("Корзина пуста.");
    if (!name.trim()) return setErr("Укажите имя.");
    if (!phone.trim()) return setErr("Укажите телефон.");

    const cityTrim = String(city ?? "").trim();
    if (!cityTrim) return setErr("Укажите город.");
    if (!pvz?.code || !pvz?.address) return setErr("Выберите пункт выдачи СДЭК.");

    if (deliveryLoading) return setErr("Считаем доставку... подождите.");
    if (!delivery) return setErr("Не удалось рассчитать доставку. Выберите ПВЗ ещё раз.");

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
                  <span className={label}>Пункт выдачи СДЭК</span>

                  <div className="grid gap-[4px]" ref={cityBoxRef}>
                    <span className="text-[11px] text-black/55">Город</span>
                    <div className="relative">
                      <input
                        className={input}
                        value={cityQuery}
                        style={{ fontFamily: "Brygada" }}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCityQuery(v);
                          setCity(v);
                          setCityDropdownOpen(true);
                        }}
                        onFocus={() => {
                          if (citySuggestions.length > 0) setCityDropdownOpen(true);
                        }}
                        placeholder="Начните вводить город"
                      />

                      {cityDropdownOpen && (citySuggestions.length > 0 || citySuggestLoading) ? (
                        <div className="absolute z-20 mt-[6px] w-full border border-black/10 bg-white shadow-sm max-h-[260px] overflow-auto">
                          {citySuggestLoading ? (
                            <div className="px-[14px] py-[12px] text-[12px] text-black/55">
                              Ищем города...
                            </div>
                          ) : (
                            citySuggestions.map((item) => (
                              <button
                                key={`${item.code}-${item.city}`}
                                type="button"
                                onClick={() => {
                                  setCity(item.city);
                                  setCityQuery(item.city);
                                  setCityDropdownOpen(false);
                                  loadPvz(item.city);
                                }}
                                className="block w-full border-b border-black/10 px-[14px] py-[12px] text-left last:border-b-0 hover:bg-black/[0.03]"
                              >
                                <div className="text-[12px] font-semibold">
                                  {item.city}
                                </div>
                                <div className="mt-[2px] text-[11px] text-black/55">
                                  {item.full}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => loadPvz()}
                    disabled={pvzLoading || !city.trim()}
                    className={btn}
                  >
                    {pvzLoading ? "Загружаем пункты выдачи..." : "Показать пункты выдачи"}
                  </button>

                  {pvzList.length > 0 ? (
                    <>
                      <label className="grid gap-[4px]">
                        <span className="text-[11px] text-black/55">
                          Поиск ПВЗ по улице, дому, адресу или коду
                        </span>
                        <input
                          className={input}
                          value={pvzQuery}
                          style={{ fontFamily: "Brygada" }}
                          onChange={(e) => setPvzQuery(e.target.value)}
                          placeholder="Например: Карнацевича 6"
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
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-[14px] py-[12px] text-[12px] text-black/55">
                              Ничего не найдено. Попробуйте улицу, дом, часть адреса или код ПВЗ.
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : null}

                  <label className="grid gap-[4px]">
                    <span className="text-[11px] text-black/55">Выбранный пункт</span>
                    <textarea
                      value={address}
                      readOnly
                      rows={3}
                      style={{ fontFamily: "Brygada" }}
                      className="w-full border border-black/15 px-[14px] py-[10px] text-[14px] outline-none bg-black/[0.03] resize-none leading-[1.45]"
                      placeholder="Пункт выдачи не выбран"
                    />
                  </label>
                </div>
              </div>

              <button
                className={clsx(btn, "mt-[18px]")}
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

                  <div
                    style={{ fontFamily: "Brygada" }}
                    className="text-[12px] font-semibold whitespace-nowrap"
                  >
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