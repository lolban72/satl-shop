import { redirect } from "next/navigation";

export const metadata = {
  title: "Каталог | SATL",
};

export default function CatalogRedirect() {
  redirect("/#catalog");
}
