import { kanitBold } from "@/app/layout";

export const metadata = {
  title: "Согласие на использование файлов cookie | SATL",
};

export default function CookieConsentPage() {
  return (
    <div className="bg-white text-black">
      <main
        className={[
          kanitBold.className,
          "mx-auto max-w-[1440px] font-bold",
          "px-[14px] pt-[22px] pb-[70px]",
          "md:px-[65px] md:pt-[65px] md:pb-[120px]",
        ].join(" ")}
      >
        {/* TITLE */}
        <h1 className="doc-h1 uppercase">
          Согласие на использование файлов cookie
        </h1>

        {/* BODY */}
        <div
          className={[
            "mt-[18px] max-w-[720px]",
            "md:mt-[26px] md:max-w-[920px]",
            "doc-text",
          ].join(" ")}
        >
          {/* 1 */}
          <section className="mt-[14px] md:mt-[16px]">
            <div className="doc-h2">1. Общие положения</div>

            <p className="mt-[10px] doc-h3">
              1.1. Продолжая использование сайта https://satl.shop, я выражаю
              своё согласие Индивидуальному предпринимателю Тунян Левон
              Григорьевич (ИНН 231138920399, ОГРНИП 325237500408428) на
              использование файлов cookie и иных аналогичных технологий.
            </p>
          </section>

          {/* 2 */}
          <section className="mt-[16px] md:mt-[18px]">
            <div className="doc-h2">
              2. Цели использования файлов cookie
            </div>

            <p className="mt-[10px] doc-h3">
              2.1. Файлы cookie используются в следующих целях:
            </p>

            <ul className="mt-[8px] list-disc pl-[18px] space-y-[6px] doc-h3">
              <li>обеспечения корректной работы сайта;</li>
              <li>улучшения пользовательского опыта;</li>
              <li>
                анализа поведения пользователей и статистики посещаемости сайта;
              </li>
              <li>
                обеспечения безопасности и стабильности работы сайта.
              </li>
            </ul>
          </section>

          {/* 3 */}
          <section className="mt-[16px] md:mt-[18px]">
            <div className="doc-h2">3. Виды используемых cookie</div>

            <p className="mt-[10px] doc-h3">
              3.1. Сайт может использовать как обязательные (технические)
              cookie, так и аналитические cookie, в том числе используемые
              сервисами веб-аналитики.
            </p>
          </section>

          {/* 4 */}
          <section className="mt-[16px] md:mt-[18px]">
            <div className="doc-h2">4. Права пользователя</div>

            <p className="mt-[10px] doc-h3">
              4.1. Я проинформирован(а), что могу в любое время:
            </p>

            <ul className="mt-[8px] list-disc pl-[18px] space-y-[6px] doc-h3">
              <li>изменить настройки cookie в браузере;</li>
              <li>отключить сохранение cookie;</li>
              <li>удалить ранее сохранённые cookie.</li>
            </ul>

            <p className="mt-[12px] doc-h3">
              4.2. Ограничение использования cookie может повлиять на
              работоспособность отдельных функций сайта.
            </p>
          </section>

          {/* 5 */}
          <section className="mt-[16px] md:mt-[18px]">
            <div className="doc-h2">5. Дополнительная информация</div>

            <p className="mt-[10px] doc-h3">
              5.1. Подробнее об использовании файлов cookie можно ознакомиться
              в Политике обработки персональных данных, размещённой на сайте
              https://satl.shop.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}