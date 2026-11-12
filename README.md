# APK Studio Mobile

APK Studio, Android uygulamaları için mobil öncelikli bir geliştirme ve paketleme çalışma alanıdır. Proje React, TypeScript, Vite, Express, Capacitor ve JSZip kullanır.

- Android uygulama kimliği: com.mm2vault.apkstudio
- Uygulama adı: APK Studio
- Depo: https://github.com/mm2vault/Apk-Studio

## Projenin amacı

Kullanıcıların özellikle telefondan proje dosyalarını içe aktarması, kodlarını düzenlemesi, Android ayarlarını yapması, projeyi doğrulaması, dışa aktarması ve GitHub Actions üzerinden APK derlemesi başlatması.

Önemli: APK Studio'nun kendi Android APK'sını üretmek ile kullanıcının içe aktardığı herhangi bir projeyi APK'ya dönüştürmek farklı işlemlerdir. HTML/CSS/JS projeleri WebView tabanlı Android projesine dönüştürülebilir. Native Android projeleri mevcut Gradle yapılarını korumalıdır. Lua ve Python dosyaları tek başına otomatik olarak APK'ya dönüşmez; uygun motor/runtime gerekir.

Statik HTML/CSS/JS uygulamaları ve hazırlanmış PWA/web build çıktıları Android WebView içine paketlenir; yerel dosyalar `WebViewAssetLoader` üzerinden güvenli bir uygulama kaynağı olarak sunulur. React/Vue/Vite/Angular/Next gibi kaynak projeleri önce kendi araçlarıyla derleyip `dist/` veya `build/` çıktısını içe aktarın. Node.js sunucusu, API rotaları ve SSR özellikleri statik WebView APK içine otomatik eklenmez. Lua/Python dosyaları içe aktarılıp düzenlenebilir; ancak LÖVE2D, Kivy/Buildozer veya Chaquopy gibi bir Android runtime entegrasyonu olmadan doğrudan APK üretilmez.

WebView için kamera, mikrofon, konum ve HTML dosya seçici gibi native köprüler henüz tamamlanmadı. Yapılandırma ekranındaki manifest izinleri bu özelliklerin Android runtime izinlerini otomatik olarak istemez; derleme öncesi uyarılar gösterilir.

## APK Studio Android uygulamasını derleme

1. GitHub deposunda Actions sekmesini aç.
2. APK Studio - Build Android APK iş akışını seç.
3. Run workflow ile derlemeyi başlat.
4. İşlem tamamlandığında başarılı run içindeki APK dosyasını indir.

Debug APK test amaçlıdır. Release APK imzalama anahtarları ayarlanmamışsa imzasız olabilir ve Play Store'a yüklenmeye hazır değildir.

## Debug ve imzalı Release APK

- Depoya `main` dalına push yapıldığında otomatik olarak Debug APK derlenir.
- Release APK için Actions > **APK Studio - Build Android APK** > **Run workflow** yolunu açıp `release` seç.
- Release derlemesi için aşağıdaki dört GitHub Actions secret'ı önceden tanımlanmalıdır:
  - `ANDROID_KEYSTORE_BASE64`: JKS/keystore dosyasının Base64 içeriği
  - `ANDROID_KEYSTORE_PASSWORD`: keystore parolası
  - `ANDROID_KEY_ALIAS`: anahtar takma adı
  - `ANDROID_KEY_PASSWORD`: anahtar parolası

### İmzalama anahtarını bir kez oluşturma

Güvenilir ve özel bir cihazda JDK `keytool` ile bir kez keystore oluştur. Örnek:

```bash
keytool -genkeypair -v -keystore apk-studio-release.jks -alias apkstudio -keyalg RSA -keysize 2048 -validity 10000
base64 -w 0 apk-studio-release.jks
```

İkinci komutun çıktısını `ANDROID_KEYSTORE_BASE64` secret'ına koy; oluştururken belirlediğin parolayı ve alias'ı diğer üç secret'a gir. Android/Termux ortamında `base64 -w 0` desteklenmiyorsa `base64 apk-studio-release.jks | tr -d '\\n'` kullan.

**ÇOK ÖNEMLİ:** Keystore dosyasını, parolaları veya Base64 çıktısını GitHub deposuna, kaynak koda, sohbete ya da APK içine koyma. Keystore dosyasının şifreli ve çevrimdışı bir yedeğini güvenli yerde sakla. Bu anahtar kaybolursa aynı uygulama kimliğiyle mevcut kullanıcılara normal güncelleme vermek mümkün olmayabilir. Anahtarı her sürümde yeniden oluşturma.

İş akışı Android `versionCode` değerini GitHub Actions run numarasından üretir ve Release APK'yı aynı imzalama anahtarıyla imzalar. Böylece sonraki derlemelerde sürüm kodu artar. Debug ve Release APK farklı imzalandığı için birinden diğerine doğrudan güncelleme yapılamayabilir; Release kanalına geçerken eski Debug uygulamasını kaldırıp imzalı Release APK'yı kurmak gerekebilir.

## Geliştirme

- Kurulum: npm install
- Geliştirme sunucusu: npm run dev
- Üretim derlemesi: npm run build
- Sunucuyu başlatma: npm start
- Tür denetimi: npm run lint
- WebView Android scaffold gerçek Gradle smoke testi: npm run test:web-apk

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

**Güncel ve ayrıntılı arayüz görevi:** [`AI-TEAM/CLAUDE/UI-REDESIGN.md`](AI-TEAM/CLAUDE/UI-REDESIGN.md). Claude önce bu dosyadaki UI/UX görevini tamamlamalı; özellikle ekranları sadeleştirmeli, navigasyonu netleştirmeli ve mobilde üst üste binme/yatay taşma sorunlarını gidermelidir. Demo veya örnek proje eklememelidir.

İlk olarak tüm proje yapısını incele. Öncelik 1'i uygula: mobil görünümü ve ekranlar arası tasarım tutarlılığını düzelt. Ardından Öncelik 2 ve 3 için mevcut kodun durumunu raporla ve güvenli, küçük adımlarla geliştirmeye başla. Build/derleme altyapısını değiştirmeden önce mevcut GitHub Actions iş akışını ve server.ts API davranışını incele.

## Bilinen sınırlamalar

- Lua ve Python kaynak dosyalarını içe aktarmak, bunları otomatik olarak Android uygulamasına dönüştürmez.
- Cloud Build API'si ayrı ve güvenli şekilde yapılandırılmış bir Express sunucusu gerektirir.
- Android uygulama yükleme işlemi Android'in güvenlik onaylarına tabidir.
- Release APK'nın dağıtıma hazır olması için uygun Android imzalama yapılandırması gerekir.


## AI çalışma ekibi ve görev paylaşımı

Bu bölüm, aynı depoda çalışan yardımcıların birbiriyle çakışmadan ilerlemesi içindir. Bu araçlar APK Studio uygulamasının kullanıcıya dönük özellikleri değildir; yalnızca geliştirme sürecinde kullanılır.

### ChatGPT — ana sistem ve entegrasyon
- Uygulama mimarisi, React/TypeScript akışları, servisler ve Android paketleme altyapısını geliştirir.
- Claude ve Manus tarafından önerilen değişiklikleri mevcut mimariye göre değerlendirir.
- Birleştirme öncesinde güvenlik, geriye dönük uyumluluk ve derleme sonuçlarını kontrol eder.

### Claude — arayüz ve kullanıcı deneyimi
- Öncelikle mobil tasarım, ekranlar arası tutarlılık ve erişilebilirlik üzerinde çalışır.
- Ardından dosya yönetimi ve kod editöründeki kullanılabilirlik eksiklerini giderir.
- Büyük mimari veya GitHub Actions değişikliklerini önceden raporlar; ana sistem akışını izinsiz yeniden yazmaz.

### Manus — bağımsız test ve kalite kontrol
- Depoyu salt-okunur biçimde inceleyerek hata, güvenlik, performans ve mobil uyumluluk raporu hazırlar.
- APK derleme iş akışını, güncelleme kontrolünü, dosya içe/dışa aktarma ve proje kaydetme akışlarını test eder.
- Her bulguda etkilenen dosyayı, mümkünse satır/işlev adını, yeniden üretme adımlarını, beklenen/gerçek sonucu ve önem derecesini belirtir.
- İlk aşamada doğrudan ana dala kod yazmaz. Önce rapor ve önceliklendirilmiş düzeltme planı sunar.
- Düzeltme istenirse değişiklikleri ayrı bir dal veya pull request üzerinde, küçük ve incelenebilir commit'lerle yapar.

### Ortak çalışma protokolü
1. Aynı dosyada eşzamanlı düzenleme yapmayın. Bir dosyayı değiştirmeden önce son halini ana daldan yeniden okuyun.
2. Manus'un bulguları önce ChatGPT tarafından doğrulanır; Claude tasarım görevlerine, ChatGPT sistem görevlerine odaklanır.
3. Her değişiklikten sonra `npm run lint` ve `npm run build` çalıştırılır.
4. Android APK'nın gerçekten üretildiği GitHub Actions sonucu görülmeden başarılı APK üretildiği iddia edilmez.
5. Test edilmemiş gerçek cihaz davranışları açıkça "cihazda doğrulanmadı" olarak işaretlenir.
6. Token, parola, imzalama anahtarı ve kişisel erişim anahtarı hiçbir asistana veya README'ye eklenmez.
