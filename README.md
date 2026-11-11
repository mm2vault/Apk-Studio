# APK Studio Mobile

APK Studio, Android uygulamaları için mobil öncelikli bir geliştirme ve paketleme çalışma alanıdır. Proje React, TypeScript, Vite, Express, Capacitor ve JSZip kullanır.

- Android uygulama kimliği: com.mm2vault.apkstudio
- Uygulama adı: APK Studio
- Depo: https://github.com/mm2vault/Apk-Studio

## Projenin amacı

Kullanıcıların özellikle telefondan proje dosyalarını içe aktarması, kodlarını düzenlemesi, Android ayarlarını yapması, projeyi doğrulaması, dışa aktarması ve GitHub Actions üzerinden APK derlemesi başlatması.

Önemli: APK Studio'nun kendi Android APK'sını üretmek ile kullanıcının içe aktardığı herhangi bir projeyi APK'ya dönüştürmek farklı işlemlerdir. HTML/CSS/JS projeleri WebView tabanlı Android projesine dönüştürülebilir. Native Android projeleri mevcut Gradle yapılarını korumalıdır. Lua ve Python dosyaları tek başına otomatik olarak APK'ya dönüşmez; uygun motor/runtime gerekir.

## APK Studio Android uygulamasını derleme

1. GitHub deposunda Actions sekmesini aç.
2. APK Studio - Build Android APK iş akışını seç.
3. Run workflow ile derlemeyi başlat.
4. İşlem tamamlandığında başarılı run içindeki APK dosyasını indir.

Debug APK test amaçlıdır. Release APK imzalama anahtarları ayarlanmamışsa imzasız olabilir ve Play Store'a yüklenmeye hazır değildir.

## Geliştirme

- Kurulum: npm install
- Geliştirme sunucusu: npm run dev
- Üretim derlemesi: npm run build
- Sunucuyu başlatma: npm start
- Tür denetimi: npm run lint

## Güvenlik ve yapılandırma

Cloud Build sunucusu için gereken değişkenler sunucu ortamında tutulmalıdır:

- GITHUB_REPOSITORY=owner/repository
- GITHUB_TOKEN=Actions write yetkili sunucu tokeni
- GITHUB_BUILD_REF=main
- APK_STUDIO_BUILD_API_KEY=uzun ve rastgele gizli anahtar

GitHub tokeni veya başka gizli anahtarlar hiçbir zaman React/Vite istemci koduna, APK içine, README'ye, loglara ya da Git geçmişine eklenmemelidir. İstemciye yalnızca gerekli API adresi ve kullanıcıya gösterilebilecek durum bilgileri gönderilmelidir.

Yerel derleme, yüklenen Gradle betiklerini çalıştırabildiği için varsayılan olarak kapalıdır. Güvenilmeyen/public sunucularda açılmamalıdır.

---

# Claude için geliştirme görevleri (handoff)

Bu bölüm, projeyi devralan Claude veya başka bir kodlama asistanı için görev tanımıdır. README'yi baştan sona oku, ardından mevcut kaynak kodunu incele. Görevleri mevcut mimariyi ve çalışan özellikleri koruyarak, küçük ve test edilebilir adımlarla uygula.

## Çalışma kuralları

1. Önce mevcut dosyaları ve akışı incele; dosyaları okumadan büyük çaplı yeniden yazım yapma.
2. Çalışan özellikleri kaldırma veya sahte/işlevsiz butonlar ekleme.
3. React + TypeScript + Vite + Express + Capacitor mimarisini koru. Yeni bağımlılık eklemeden önce gerekliliğini değerlendir.
4. Telefon ekranını birincil hedef kabul et; tablet ve masaüstünde de düzgün çalışmasını sağla.
5. Kullanıcı arayüzü metinlerini Türkçe ve anlaşılır tut.
6. Her görevden sonra npm run lint ve npm run build çalıştır; hataları düzeltmeden görevi tamamlandı sayma.
7. Değişiklikleri küçük, anlamlı commit'lere ayır ve yapılanları özetle.
8. Kullanıcı verilerini ve yerel projeleri koru. Depolama biçimi değişirse geriye dönük uyumluluk veya güvenli migration ekle.
9. Gizli anahtarları kaynak koda, istemci paketine veya loglara koyma. Sunucu ortam değişkenlerini kullan.
10. Gerçek cihazda denenmeyen özellikleri test edilmiş gibi sunma.

## Öncelik 1 — Mobil tasarım ve kullanılabilirlik

- Genel görünümü tutarlı, modern ve profesyonel bir Android geliştirme stüdyosu seviyesine getir.
- Koyu temayı ve mevcut mor/mavi vurguları koru; gereksiz parıltı, kalabalık kart ve aşırı kenarlık kullanımını azalt.
- Panel, Dosyalar, Editör, Yapılandırma, Derle, Dışa Aktar ve Güncellemeler ekranlarının aralıklarını, başlıklarını ve kart hiyerarşisini tutarlı hale getir.
- Dar telefon ekranlarında yatay taşma, kesilen metin, üst üste binen buton ve okunamayacak kadar küçük etiketleri düzelt.
- Alt gezinme çubuğunun güvenli alan (safe area) ve klavye açıldığında davranışını kontrol et.
- Uzun dosya adları, paket kimlikleri, kod satırları ve hata mesajları taşmadan gösterilsin; kod alanlarında gerekli yatay kaydırmayı koru.
- Dokunma hedeflerini rahat kullanılacak boyutta yap; kontrast, odak ve buton durumlarını iyileştir.
- Boş durumlar, yükleniyor durumları, hata mesajları ve başarı bildirimleri için tutarlı tasarım oluştur.
- Gereksiz animasyonlardan kaçın; düşük güçlü telefonlarda akıcılığı önceliklendir.

## Öncelik 2 — Proje ve dosya yönetimi

- ZIP/dosya içe aktarma akışını telefon kullanımına uygun hale getir.
- Dosya ağacında klasör açma/kapama, dosya seçme, arama ve anlaşılır dosya türü ikonlarını iyileştir.
- Dosya ekleme, yeniden adlandırma, silme ve kaydetme işlemlerinde gerekli onayı al.
- Büyük dosyalarda performansı koru; ikili dosyaları metin editöründe yanlışlıkla bozma.
- Kaydedilmemiş değişiklikleri göster ve ekran değişiminde veri kaybını önle.
- LocalStorage/StorageService sınırlarını incele; depolama hatalarında anlaşılır uyarı ver.

## Öncelik 3 — Kod editörü

- Editörde dosya adı ve uzantısını, kaydedilmemiş değişiklik durumunu ve okunabilir kod alanını göster.
- Mobil klavyede kod yazmayı kolaylaştıracak temel araçları değerlendir (girinti, parantez, sık kullanılan karakterler).
- Kod arama ve dosya içinde bulma özelliklerini ekle veya mevcutsa güvenilir hale getir.
- Uzun satırlar ve büyük dosyalarda yatay/dikey kaydırmayı doğru yönet.
- Desteklenmeyen dosya türlerinde açık uyarı göster; desteklenmeyen dil için kod renklendirmesi varmış gibi davranma.

## Öncelik 4 — Yapılandırma ve APK derleme akışı

- Uygulama adı, package ID, version code/name, min SDK, target SDK, izinler ve yön ayarlarının doğrulamasını iyileştir.
- Hataları derleme başlatılmadan önce alanın yanında göster.
- Local Build özelliğinin yalnızca uygun ve güvenli yerel sunucu ortamında çalıştığını açıkça belirt.
- Cloud Build'in ayrı bir sunucu yapılandırması gerektirdiğini kullanıcıya net biçimde açıkla.
- GitHub tokenini hiçbir zaman tarayıcıya/uygulamaya gönderme.
- Derleme başlatıldı, sırada, başarılı ve başarısız durumlarını ayır. Gerçek veri yoksa sahte canlı ilerleme yüzdesi gösterme.
- APK indirme bağlantısını yalnızca gerçek bir dosya/asset mevcut olduğunda etkinleştir.
- Debug ve imzalı Release APK farkını açıkça anlat.
- Üretilen Android scaffold ve dışa aktarma iş akışını gerçek proje gereksinimleriyle uyumlu tut; JDK/Gradle sürümlerini ana GitHub Actions iş akışıyla çeliştirme.

## Öncelik 5 — Güncelleme ve hata yönetimi

- Güncelleme ekranının gerçek GitHub Release verisini kullandığını doğrula.
- Uygulama sürümünü build sırasında verilen sürümle eşleştir; sabit ve yanlış sürüm metni kullanma.
- İndirilecek APK'nın doğru asset olduğundan emin ol; release notlarını ve sürüm numarasını göster.
- İndirme/kurulumun Android kullanıcı onayı gerektirdiğini açıkla. Sessiz kurulum yapılıyormuş gibi davranma.
- Ağ yokken, GitHub API sınırına ulaşıldığında veya release bulunamadığında düzgün hata/boş durum göster.

## Öncelik 6 — Test, kalite ve dokümantasyon

- npm run lint ve npm run build kontrollerini geçir.
- Önemli ekranlarda telefon, tablet ve masaüstü boyutlarını kontrol et.
- İçe aktarma, düzenleme, kaydetme, dışa aktarma ve güncelleme akışlarını test et.
- Sunucu API'si yokken kullanıcıya net mesaj ver; backend varmış gibi davranma.
- README'deki komutları, değişkenleri ve gerçek iş akışı adlarını kaynak kodla karşılaştırıp güncel tut.
- Yeni ortam değişkeni veya kurulum adımı eklenirse burada belgele.

## Tamamlanma ölçütleri

Bir görev ancak şu koşullarda tamamlanmıştır:

- Mevcut temel özellikler çalışmaya devam ediyor.
- Telefon ekranında yatay taşma ve kritik kullanılabilirlik sorunu yok.
- npm run lint başarılı.
- npm run build başarılı.
- Güvenlik sırları istemciye sızmıyor.
- Gerçek olmayan özellik veya test sonucu iddia edilmiyor.
- Değişiklikler ve bilinen sınırlamalar kısa bir özetle raporlanıyor.

## Claude'dan ilk istenen çalışma

İlk olarak tüm proje yapısını incele. Öncelik 1'i uygula: mobil görünümü ve ekranlar arası tasarım tutarlılığını düzelt. Ardından Öncelik 2 ve 3 için mevcut kodun durumunu raporla ve güvenli, küçük adımlarla geliştirmeye başla. Build/derleme altyapısını değiştirmeden önce mevcut GitHub Actions iş akışını ve server.ts API davranışını incele.

## Bilinen sınırlamalar

- Lua ve Python kaynak dosyalarını içe aktarmak, bunları otomatik olarak Android uygulamasına dönüştürmez.
- Cloud Build API'si ayrı ve güvenli şekilde yapılandırılmış bir Express sunucusu gerektirir.
- Android uygulama yükleme işlemi Android'in güvenlik onaylarına tabidir.
- Release APK'nın dağıtıma hazır olması için uygun Android imzalama yapılandırması gerekir.
