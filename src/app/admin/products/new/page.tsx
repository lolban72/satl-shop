import ProductCreateForm from "../ui/ProductCreateForm";

export const metadata = {
  title: "Добавить товар | SATL-админ",
};

export default function NewProductPage() {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-lg font-semibold">Добавить товар</div>
      <ProductCreateForm />
    </div>
  );
}
