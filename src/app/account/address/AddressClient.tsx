"use client";

import { useState } from "react";
import { Title, Label, Input, PrimaryButton } from "../ui/Fields";

type AddressState = {
  addressCountry: string;
  addressRegion: string;
  addressCity: string;
  addressStreet: string;
  addressHouse: string;
  addressApartment: string;
  addressPostcode: string;
  addressComment: string;
};

export default function AddressClient({ initial }: { initial: AddressState }) {
  const [s, setS] = useState<AddressState>(initial);

  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function setField<K extends keyof AddressState>(key: K, value: string) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setOk(null);
    setErr(null);
    try {
      const res = await fetch("/api/account/address", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Не удалось сохранить");
      setOk("Сохранено ✅");
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full">
      <Title>Адрес доставки</Title>

      <div className="mt-[20px] flex flex-col items-center gap-[14px] px-[14px] sm:px-0">
        <div className="w-full max-w-[330px] flex flex-col gap-[14px]">
          <label className="block w-full">
            <Label>Страна</Label>
            <Input value={s.addressCountry} onChange={(v) => setField("addressCountry", v)} />
          </label>

          <label className="block w-full">
            <Label>Регион / Область</Label>
            <Input value={s.addressRegion} onChange={(v) => setField("addressRegion", v)} />
          </label>

          <label className="block w-full">
            <Label>Город</Label>
            <Input value={s.addressCity} onChange={(v) => setField("addressCity", v)} />
          </label>

          <label className="block w-full">
            <Label>Улица</Label>
            <Input value={s.addressStreet} onChange={(v) => setField("addressStreet", v)} />
          </label>

          <div className="flex flex-col sm:flex-row w-full gap-[10px]">
            <label className="block w-full sm:flex-1">
              <Label>Дом</Label>
              <input
                value={s.addressHouse}
                onChange={(e) => setField("addressHouse", e.target.value)}
                className="h-[35px] w-full border border-black/15 px-[10px] font-semibold text-[12px] outline-none focus:border-black/40"
              />
            </label>

            <label className="block w-full sm:flex-1">
              <Label>Квартира</Label>
              <input
                value={s.addressApartment}
                onChange={(e) => setField("addressApartment", e.target.value)}
                className="h-[35px] w-full border border-black/15 px-[10px] font-semibold text-[12px] outline-none focus:border-black/40"
              />
            </label>
          </div>

          <label className="block w-full">
            <Label>Индекс</Label>
            <Input value={s.addressPostcode} onChange={(v) => setField("addressPostcode", v)} />
          </label>

          <label className="block w-full">
            <Label>Комментарий курьеру</Label>
            <input
              value={s.addressComment}
              onChange={(e) => setField("addressComment", e.target.value)}
              className="h-[35px] w-full border border-black/15 px-[10px] font-semibold text-[12px] outline-none focus:border-black/40"
            />
          </label>

          {/* ✅ Кнопка как "Выход" по размеру */}
          <div className="pt-[6px]">
            <PrimaryButton
              disabled={saving}
              onClick={save}
              className="h-[35px] w-full"
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </PrimaryButton>
          </div>

          {ok ? <div className="text-[11px] text-black/70">{ok}</div> : null}
          {err ? <div className="text-[11px] text-[#B60404]">{err}</div> : null}
        </div>
      </div>
    </div>
  );
}
