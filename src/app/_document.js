// pages/_document.js
import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  render() {
    return (
      <Html lang="ru">
        <Head>
          {/* Вставка кода Яндекс.Метрики */}
          <script type="text/javascript">
            {`
              (function(m,e,t,r,i,k,a){
                  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
                  m[i].l=1*new Date();
                  for (var j = 0; j < document.scripts.length; j++) {
                      if (document.scripts[j].src === r) { return; }
                  }
                  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
              })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=107021293', 'ym');

              ym(107021293, 'init', {
                  ssr:true,
                  webvisor:true, 
                  clickmap:true, 
                  ecommerce:"dataLayer", 
                  referrer: document.referrer, 
                  url: location.href, 
                  accurateTrackBounce:true, 
                  trackLinks:true
              });
            `}
          </script>
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;