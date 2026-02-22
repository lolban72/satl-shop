import MarqueeForm from "./ui/MarqueeForm";

export default function AdminMarqueePage() {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-lg font-semibold">Бегущая строка</div>
      <div className="mt-1 text-sm text-gray-600">
        Измени текст, скорость и включение.
      </div>

      <MarqueeForm />
    </div>
  );
}
