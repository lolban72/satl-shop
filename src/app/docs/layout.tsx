
export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white text-black">

      <main className="mx-auto max-w-[1440px] px-[65px] pt-[90px] pb-[120px]">
        {children}
      </main>

    </div>
  );
}
