import ProductCreateForm from "../ui/ProductCreateForm";

export default function NewProductPage() {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-lg font-semibold">Добавить товар</div>
      <ProductCreateForm />
      <p className="mt-3 text-sm text-gray-600">
        Создаётся товар + один вариант (one/default). Фото загружается с устройства через /api/upload.
      </p>
    </div>
  );
}
