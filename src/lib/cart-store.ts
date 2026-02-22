import { create } from "zustand";

export type CartItem = {
  productId: string;
  variantId?: string;
  size?: string; // ✅ ДОБАВИЛИ
  title: string;
  price: number;
  image?: string;
  qty: number;
};


type CartState = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId?: string) => void;
  setQty: (productId: string, variantId: string | undefined, qty: number) => void;
  hydrate: () => void;
  clear: () => void;
};

const key = "brand_cart_v1";

export const useCart = create<CartState>((set, get) => ({
  items: [],
  hydrate: () => {
    if (typeof window === "undefined") return;
    try {
      const items = JSON.parse(localStorage.getItem(key) || "[]");
      set({ items });
    } catch {}
  },
  addItem: (item) => {
    const items = [...get().items];
    const idx = items.findIndex(
      (x) => x.productId === item.productId && x.variantId === item.variantId
    );
    if (idx >= 0) items[idx] = { ...items[idx], qty: items[idx].qty + item.qty };
    else items.push(item);

    localStorage.setItem(key, JSON.stringify(items));
    set({ items });
  },
  removeItem: (productId, variantId) => {
    const items = get().items.filter(
      (x) => !(x.productId === productId && x.variantId === variantId)
    );
    localStorage.setItem(key, JSON.stringify(items));
    set({ items });
  },
  setQty: (productId, variantId, qty) => {
    const items = get().items.map((x) =>
      x.productId === productId && x.variantId === variantId
        ? { ...x, qty: Math.max(1, qty) }
        : x
    );
    localStorage.setItem(key, JSON.stringify(items));
    set({ items });
  },
  clear: () => {
    localStorage.setItem(key, "[]");
    set({ items: [] });
  },
}));
