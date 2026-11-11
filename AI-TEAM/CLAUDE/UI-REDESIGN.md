# Claude — APK Studio arayüz yenileme görevi

**Durum:** Başlamaya hazır  
**Öncelik:** En yüksek — önce görünüm ve düzen  
**Hedef depo:** mm2vault/Apk-Studio  
**Ana dal:** main

## Amaç

APK Studio'yu telefonda rahat kullanılan, modern, profesyonel ve düzenli bir Android geliştirme çalışma alanına dönüştür. Şu anki temel sorun, çok fazla kontrolün ve bilginin aynı alanda toplanıp ekranı karmaşık göstermesi. Kullanıcı hangi bölümde olduğunu, sıradaki adımı ve hangi butonun ne yaptığını ilk bakışta anlayabilmeli.

Bu görev öncelikle **UI/UX ve görsel düzenleme** görevidir. Derleme altyapısını, servisleri veya proje saklama mantığını yeniden yazma.

## Tasarım yönü

- Koyu tema temel olarak korunsun.
- Mor/mavi vurgu renkleri ölçülü kullanılsın; her karta ayrı parlak renk veya neon efekti verilmesin.
- Sade, modern bir IDE / Android Studio hissi versin.
- Arka plan, kart, kenarlık, metin ve vurgu renkleri ortak tasarım token'ları üzerinden tutarlı olsun.
- Görsel hiyerarşi net olsun: sayfa başlığı, kısa açıklama, ana işlem, ikincil işlemler.
- Gereksiz kartları, tekrar eden başlıkları, aşırı boşlukları, kalın kenarlıkları ve dekoratif öğeleri azalt.
- İkonlar aynı çizgi stilinde ve anlamlı kullanılsın. İkon tek başına anlaşılmıyorsa kısa metin etiketi ekle.
- Butonlarda birincil / ikincil / tehlikeli işlem ayrımı açık olsun.

## Bilgi mimarisi — hiçbir şey birbirine girmesin

Ana alanları birbirinden ayır ve her ekranda yalnızca o bölümle ilgili kontrolleri göster:

1. **Panel:** Proje özeti, son açılan proje ve net başlangıç işlemleri.
2. **Projeler / Dosyalar:** Proje seçimi, dosya ağacı, klasör ve dosya işlemleri.
3. **Kod Editörü:** Seçili dosya ve kod alanı; ilgisiz derleme ayarları burada görünmesin.
4. **Yapılandırma:** Uygulama adı, package ID, sürüm, SDK ve izinler tek düzenli formda.
5. **Derleme:** Build türü, hedef, başlatma eylemi, gerçek durum ve loglar.
6. **Dışa Aktar:** Mevcut dışa aktarma seçenekleri ve sonuç dosyaları.
7. **Güncellemeler / Ayarlar:** Sürüm bilgisi ve uygulama tercihleri ayrı tutulmalı.

Mevcut navigasyon yapısını incele. Gerekirse sekme, alt navigasyon veya menü düzenini iyileştir; ancak aynı anda çok fazla sekme gösterme. Telefon ekranında ana gezinme kolay erişilebilir olmalı. Tablet ve masaüstünde alanı daha verimli kullan.

## Ekran ve bileşen kuralları

- Önce telefon genişliğini hedefle; 320–360 px ekranlarda yatay taşma olmasın.
- Uzun metinler, dosya adları ve package ID alanları taşmadan okunabilsin.
- Kartlar aynı işi tekrar etmesin. Bir kart = tek ana amaç.
- Form alanları mantıklı gruplara ayrılsın; etiketler alanın üstünde, hata mesajı alanın hemen altında olsun.
- Tehlikeli işlemler (silme, projeyi kaldırma vb.) görsel olarak ayrışsın ve onay istesin.
- Dosya ağacı, editör, alt gezinme ve açılır paneller birbirinin üzerine binmesin.
- Alt gezinme Android safe-area boşluğunu dikkate alsın.
- Klavye açıldığında form alanları ve ana eylemler erişilebilir kalsın.
- Boş durumlar kullanıcıya ne yapacağını söylesin: örneğin “Henüz proje yok — Yeni proje oluştur veya ZIP içe aktar.”
- Yükleniyor, başarılı, hata ve devre dışı durumlarının görünümü tutarlı olsun.
- Dokunma hedefleri rahat kullanılacak boyutta olsun; küçük ikon butonlarında erişilebilir etiket bulunsun.
- Animasyonlar kısa ve ölçülü olsun; performans pahasına efekt ekleme.

## Kesinlikle yapma

- Flappy Bird veya başka demo/sample proje ekleme.
- Kullanıcının kendi projesi yerine örnek içerik, sahte dosya veya sahte build sonucu gösterme.
- Çalışan özellikleri sırf tasarımı kolaylaştırmak için kaldırma.
- İşlevsiz buton, sahte progress yüzdesi veya gerçek olmayan başarı bildirimi ekleme.
- Servis, API, storage veya GitHub Actions mimarisini bu tasarım görevi kapsamında değiştirme.
- Büyük çaplı yeniden yazım yapma; mevcut bileşenleri mümkün olduğunca iyileştir.
- Masaüstü tasarımını küçültüp telefona sığdırmakla yetinme; mobil akışı gerçekten tasarla.

## Çalışma planı

1. README'yi ve kaynak kodunu oku. Özellikle ana layout, navigasyon, Dashboard, proje/dosya ekranları, editör ve ortak CSS/Tailwind stillerini incele.
2. Önce ekran haritasını çıkar: hangi ekran nereden açılıyor, hangi bileşen hangi sorumluluğa sahip?
3. Tek bir ortak tasarım dili belirle: renk token'ları, tipografi, boşluk, radius, kart ve buton stilleri.
4. Önce ana layout + navigasyonu düzenle.
5. Sonra Panel, Dosyalar, Editör, Yapılandırma ve Derleme ekranlarını aynı tasarım diline geçir.
6. Mevcut işlevleri koruyarak telefon, tablet ve masaüstü düzenlerini kontrol et.
7. `npm run lint` ve `npm run build` çalıştır; hataları düzelt.
8. Değişiklikleri küçük ve anlaşılır commit'lere ayır.

## Tamamlanma raporu

Bittiğinde şunları raporla:

- Değiştirdiğin dosyalar
- Navigasyon ve ekran düzeninde yaptığın değişiklikler
- Mobilde düzelttiğin taşma/çakışma sorunları
- Koruduğun mevcut işlevler
- `npm run lint` ve `npm run build` sonuçları
- Gerçek cihazda test edilip edilmediği
- Bilinen kalan sorunlar

**İlk teslim hedefi:** APK Studio açıldığında kullanıcı temiz bir Panel görmeli; Dosyalar, Editör, Yapılandırma ve Derleme birbirinden belirgin ayrılmalı. Kullanıcı hangi işi nerede yapacağını aramak zorunda kalmamalı.
