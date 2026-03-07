"use client";

import { useMemo, useState } from "react";
import { Title, Label, Input, PrimaryButton } from "../ui/Fields";

type PvzItem = {
  code: string;
  name?: string;
  address: string;
  city?: string;
  workTime?: string;
};

type PickupState = {
  addressCity: string;
  pvzCode: string;
  pvzAddress: string;
  pvzName: string;
  addressComment: string;
};

export default function AddressClient({
  initial,
}: {
  initial: PickupState;
}) {
  const [s, setS] = useState<PickupState>(initial);

  const [loadingPvz, setLoadingPvz] = useState(false);
  const [pvzList, setPvzList] = useState<PvzItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function setField<K extends keyof PickupState>(key: K, value: string) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  async function loadPvz() {
    const city = s.addressCity.trim();

    setOk(null);
    setErr(null);

    if (!city) {
      setErr("Введите город");
      return;
    }

    setLoadingPvz(true);
    setPvzList([]);

    try {
      const res = await fetch(`/api/cdek/pvz?city=${encodeURIComponent(city)}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();
      console.log("PVZ response:", data);

      if (!res.ok) {
        throw new Error(data?.error || "Не удалось загрузить пункты выдачи");
      }

      const raw = Array.isArray(data?.points)
        ? data.points
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.pvz)
        ? data.pvz
        : Array.isArray(data)
        ? data
        : [];

      const items: PvzItem[] = raw
        .map((x: any) => ({
          code: String(x?.code ?? ""),
          name: String(x?.name ?? "ПВЗ"),
          address: String(x?.address ?? x?.location?.address_full ?? ""),
          city: String(x?.city ?? data?.city ?? s.addressCity ?? ""),
          workTime: String(x?.workTime ?? x?.work_time ?? ""),
        }))
        .filter((x: { code: any; address: any; }) => x.code && x.address);

      setPvzList(items);

      if (!items.length) {
        setErr("Пункты выдачи не найдены");
      } else {
        setErr(null);
      }
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки ПВЗ");
    } finally {
      setLoadingPvz(false);
    }
  }

  function selectPvz(pvz: PvzItem) {
    setS((prev) => ({
      ...prev,
      pvzCode: pvz.code,
      pvzAddress: pvz.address,
      pvzName: pvz.name || "",
      addressCity: pvz.city || prev.addressCity,
    }));

    setOk(null);
    setErr(null);
  }

  async function save() {
    setSaving(true);
    setOk(null);
    setErr(null);

    try {
      if (!s.addressCity.trim()) {
        throw new Error("Укажите город");
      }

      if (!s.pvzCode.trim() || !s.pvzAddress.trim()) {
        throw new Error("Выберите пункт выдачи");
      }

      const payload = {
        deliveryType: "pickup",
        addressCity: s.addressCity,
        pvzCode: s.pvzCode,
        pvzAddress: s.pvzAddress,
        pvzName: s.pvzName,
        addressComment: s.addressComment,
      };

      const res = await fetch("/api/account/address", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Не удалось сохранить");
      }

      setOk("Пункт выдачи сохранён ✅");
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
    } finally {
      setSaving(false);
    }
  }

  const selectedLabel = useMemo(() => {
    if (!s.pvzCode && !s.pvzAddress) return "";
    return `${s.pvzCode}${s.pvzAddress ? ` — ${s.pvzAddress}` : ""}`;
  }, [s.pvzCode, s.pvzAddress]);

  return (
    <div className="w-full">
      <Title>Пункт выдачи</Title>

      <div className="mt-[20px] flex flex-col items-center gap-[14px] px-[14px] sm:px-0">
        <div className="w-full max-w-[330px] flex flex-col gap-[14px]">
          <label className="block w-full">
            <Label>Город</Label>
            <Input
              value={s.addressCity}
              onChange={(v) => setField("addressCity", v)}
            />
          </label>

          <PrimaryButton
            disabled={loadingPvz}
            onClick={loadPvz}
            className="h-[35px] w-full"
          >
            {loadingPvz ? "Загрузка..." : "Показать пункты выдачи"}
          </PrimaryButton>

          {pvzList.length > 0 ? (
            <div className="flex flex-col gap-[8px]">
              <Label>Выберите пункт выдачи</Label>

              <div className="max-h-[260px] overflow-auto border border-black/15">
                {pvzList.map((pvz) => {
                  const active = s.pvzCode === pvz.code;

                  return (
                    <button
                      key={pvz.code}
                      type="button"
                      onClick={() => selectPvz(pvz)}
                      className={[
                        "w-full border-b border-black/10 px-[10px] py-[10px] text-left transition",
                        active
                          ? "bg-black text-white"
                          : "bg-white hover:bg-black/[0.04]",
                      ].join(" ")}
                    >
                      <div className="text-[12px] font-semibold">
                        {pvz.name || `ПВЗ ${pvz.code}`}
                      </div>

                      <div className="mt-[2px] text-[11px] opacity-80">
                        {pvz.address}
                      </div>

                      {pvz.workTime ? (
                        <div className="mt-[4px] text-[10px] opacity-70">
                          {pvz.workTime}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <label className="block w-full">
            <Label>Выбранный пункт</Label>
            <textarea
              value={selectedLabel}
              readOnly
              rows={2}
              className="w-full border border-black/15 bg-black/[0.03] px-[10px] py-[6px] font-semibold text-[12px] outline-none resize-none leading-[16px]"
              placeholder="Пункт выдачи не выбран"
            />
          </label>

          <div className="pt-[6px]">
            <PrimaryButton
              disabled={saving}
              onClick={save}
              className="h-[35px] w-full"
            >
              {saving ? "Сохранение..." : "Сохранить пункт выдачи"}
            </PrimaryButton>
          </div>

          {ok ? <div className="text-[11px] text-black/70">{ok}</div> : null}
          {err ? <div className="text-[11px] text-[#B60404]">{err}</div> : null}
        </div>
      </div>
    </div>
  );
}