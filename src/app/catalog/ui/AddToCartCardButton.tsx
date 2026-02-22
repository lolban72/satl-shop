"use client";

import { useRouter } from "next/navigation";
import { useCart } from "../../../lib/cart-store";

export default function AddToCartCardButton(props: {
  productId: string;
  slug: string;
  title: string;
  price: number;
  image?: string;
  variants: { id: string; stock: number }[];
}) {
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);

  const inStockVariants = props.variants.filter((v) => v.stock > 0);

  const disabled = inStockVariants.length === 0;

  function onClick(e: React.MouseEvent) {
    e.preventDefault(); // чтобы не сработал Link по карточке
    e.stopPropagation();

    // если вариантов > 1 — отправляем на страницу товара выбирать размер/цвет
    if (inStockVariants.length !== 1) {
      router.push(`/product/${props.slug}`);
      return;
    }

    // если вариант ровно один — кладём в корзину
    const v = inStockVariants[0];
    addItem({
      productId: props.productId,
      variantId: v.id,
      title: props.title,
      price: props.price,
      image: props.image,
      qty: 1,
    });
  }

  return (
    <button
      className="rounded-xl bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      title={
        disabled
          ? "Нет в наличии"
          : inStockVariants.length === 1
          ? "Добавить в корзину"
          : "Выбрать вариант"
      }
    >
      {disabled ? "Нет" : inStockVariants.length === 1 ? "В корзину" : "Выбрать"}
    </button>
  );
}
