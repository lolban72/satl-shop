"use client";

import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart-store";
import { useRouter } from "next/navigation";
import Link from "next/link";
import YaPayButton from "@/app/pay/[id]/YaPayButton";

export const metadata = {
  title: "Оформление заказа | SATL",
};

function moneyRub(cents: number) {
  return `${(cents / 100).toFixed(0)}р`;
}

export default function CheckoutForm(props: {
  initial: {
    name: string;
    phone: string;
    address: string;
    tgChatId?: string | null; // ✅ добавили (передай с сервера)
  };
}) {
  const router = useRouter();
  const { items } = useCart();

  const total = useMemo(
    () => items.reduce((s, i) => s + i.price * i.qty, 0),
    [items]
  );
  const itemsCount = useMemo(
    () => items.reduce((s, i) => s + i.qty, 0),
    [items]
  );

  const [name, setName] = useState(props.initial.name);
  const [phone, setPhone] = useState(props.initial.phone);
  const [address, setAddress] = useState(props.initial.address);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ draftId -> показываем Яндекс Pay кнопку прямо тут
  const [draftId, setDraftId] = useState<string | null>(null);

  // ✅ если адрес в ЛК не заполнен — запрещаем оформление и просим заполнить
  const isProfileAddressEmpty = !props.initial.address?.trim();

  // ✅ если Telegram не привязан — показываем блок и запрещаем оформление
  const isTelegramNotLinked = !String(props.initial.tgChatId ?? "").trim();

  async function createDraft() {
    setErr(null);

    if (isTelegramNotLinked) {
      return setErr("Привяжите Telegram перед оформлением заказа.");
    }

    if (isProfileAddressEmpty) {
      return setErr("Заполните адрес доставки в личном кабинете.");
    }

    if (items.length === 0) return setErr("Корзина пуста.");
    if (!name.trim()) return setErr("Укажите имя.");
    if (!phone.trim()) return setErr("Укажите телефон.");
    if (!address.trim()) return setErr("Укажите адрес.");

    setLoading(true);
    try {
      // ✅ создаём только PaymentDraft
      const res = await fetch("/api/pay/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          items: items.map((i: any) => ({
            productId: i.productId,
            variantId: i.variantId ?? null,
            title: i.title,
            price: i.price, // ✅ в копейках
            qty: i.qty,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Не удалось начать оплату");

      const id = String(data?.draftId || "");
      if (!id) throw new Error("Не удалось получить draftId");

      // ✅ показываем кнопку Яндекс Pay прямо на checkout
      setDraftId(id);
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] px-[65px] pt-[70px] pb-[140px] text-black bg-white">
      {/* HEADER */}
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
        {/* LEFT: FORM */}
        <div className="border border-black/10 p-[18px] md:p-[22px]">
          <div className="text-[18px] font-semibold tracking-[-0.01em]">
            Данные получателя
          </div>

          {/* ✅ TG NOT LINKED BLOCK (ПРИОРИТЕТ) */}
          {isTelegramNotLinked ? (
            <>
              <div className="mt-[12px] text-[12px] text-black/55 leading-[1.5]">
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
                  className="mt-[14px] h-[42px] w-full bg-black text-white
                             text-[10px] font-bold uppercase tracking-[0.12em]
                             hover:bg-black/85 transition"
                >
                  Привязать телеграм
                </button>
              </div>
            </>
          ) : isProfileAddressEmpty ? (
            <>
              <div className="mt-[12px] text-[12px] text-black/55 leading-[1.5]">
                Для оформления заказа необходимо заполнить адрес доставки в
                личном кабинете.
              </div>

              <div className="mt-[18px] border border-black/20 p-[16px]">
                <div className="text-[10px] uppercase tracking-[0.12em] text-black/55 mb-[6px]">
                  Внимание
                </div>

                <div className="text-[12px] text-black/75">
                  Перейдите в раздел «Мои данные» и заполните поле адреса.
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/account/address")}
                  className="mt-[14px] h-[42px] w-full bg-black text-white
                             text-[10px] font-bold uppercase tracking-[0.12em]
                             hover:bg-black/85 transition"
                >
                  Перейти в личный кабинет
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-[6px] text-[12px] text-black/55">
                Мы используем эти данные для доставки.
              </div>

              <div className="mt-[18px] grid gap-[16px]">
                {/* NAME */}
                <label className="grid gap-[4px]">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-black/55">
                    Имя
                  </span>
                  <input
                    className="h-[46px] border border-black/15 px-[14px] text-[14px] outline-none
                               focus:border-black transition bg-white"
                    value={name}
                    style={{ fontFamily: "Brygada" }}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (draftId) setDraftId(null);
                    }}
                    placeholder="Ваше имя"
                  />
                </label>

                {/* PHONE */}
                <label className="grid gap-[4px]">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-black/55">
                    Телефон
                  </span>
                  <input
                    className="h-[46px] border border-black/15 px-[14px] text-[14px] outline-none
                               focus:border-black transition bg-white"
                    value={phone}
                    style={{ fontFamily: "Brygada" }}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (draftId) setDraftId(null);
                    }}
                    placeholder="+7 (___) ___-__-__"
                  />
                </label>

                {/* ADDRESS */}
                <label className="grid gap-[4px]">
                  <span className="text-[9px] uppercase tracking-[0.12em] text-black/55">
                    Адрес
                  </span>
                  <input
                    className="h-[46px] border border-black/15 px-[14px] text-[14px] outline-none
                               focus:border-black transition bg-white"
                    value={address}
                    style={{ fontFamily: "Brygada" }}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      if (draftId) setDraftId(null);
                    }}
                    placeholder="Город, улица, дом, квартира"
                  />
                </label>

                {/* CTA */}
                {draftId ? (
                  <div className="mt-[6px]">
                    <div className="text-[9px] uppercase tracking-[0.12em] text-black/55 mb-[8px]">
                      Оплата
                    </div>

                    <div className="border border-black/15 p-[12px]">
                      <YaPayButton draftId={draftId} />
                    </div>

                    <button
                      type="button"
                      className="mt-[10px] h-[42px] w-full border border-black/20 text-[10px] font-bold uppercase tracking-[0.12em]
                                 hover:bg-black hover:text-white transition"
                      onClick={() => setDraftId(null)}
                      disabled={loading}
                    >
                      Изменить данные / создать оплату заново
                    </button>

                    <div className="mt-[8px] text-[11px] italic leading-[1.25] text-black/45">
                      После оплаты заказ создастся автоматически. Статус
                      появится в{" "}
                      <Link
                        href="/account/orders"
                        className="underline hover:text-black transition"
                      >
                        «Мои заказы»
                      </Link>
                      .
                    </div>

                    {/* fallback ссылка (на всякий) */}
                    <div className="mt-[6px] text-[11px] text-black/45">
                      Если что-то пошло не так, можно открыть оплату отдельно:{" "}
                      <Link
                        href={`/pay/${encodeURIComponent(draftId)}`}
                        className="underline hover:text-black transition"
                      >
                        /pay/{draftId}
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      className="mt-[6px] flex h-[46px] w-full items-center justify-center bg-black text-white
                                text-[10px] font-bold uppercase tracking-[0.12em] hover:bg-black/85 transition
                                disabled:opacity-50 disabled:hover:bg-black"
                      disabled={loading || items.length === 0}
                      onClick={createDraft}
                      type="button"
                    >
                      {loading ? "Подготовка оплаты..." : "Перейти к оплате"}
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
            </>
          )}
        </div>

        {/* RIGHT: SUMMARY */}
        <aside className="border border-black/10 p-[18px] lg:sticky lg:top-[110px] bg-white">
          <div className="flex items-end justify-between">
            <div className="text-[20px] font-semibold">Ваш заказ</div>
            <div
              style={{ fontFamily: "Brygada" }}
              className="text-[12px] text-black/55"
            >
              {itemsCount} шт.
            </div>
          </div>

          {/* items */}
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
                      <span>
                        Размер: {i.size ? String(i.size).toUpperCase() : "—"}
                      </span>
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

          {/* totals */}
          <div className="space-y-[10px] text-[12px] text-black/65">
            <div className="flex items-center justify-between">
              <span>Товары</span>
              <span style={{ fontFamily: "Brygada" }} className="text-black">
                {moneyRub(total)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Доставка</span>
              <span style={{ fontFamily: "Brygada" }} className="text-black/45">
                Рассчитается позже
              </span>
            </div>

            <div className="h-[1px] bg-black/10 my-[12px]" />

            <div className="flex items-center justify-between">
              <span className="text-black/70">К оплате</span>
              <span
                style={{ fontFamily: "Brygada" }}
                className="text-[16px] font-semibold text-black"
              >
                {moneyRub(total)}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}