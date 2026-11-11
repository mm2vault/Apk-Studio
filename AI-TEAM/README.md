# APK Studio — AI çalışma ekibi

Her asistan kendi klasöründeki `REPORT.md` dosyasını günceller. Başka bir asistanın raporunu değiştirmeyin.

## Ekip rolleri

| Asistan | Sorumluluk | Rapor |
|---|---|---|
| ChatGPT | Çekirdek sistem, APK derleme hattı, entegrasyon ve sürüm kontrolü | [CHATGPT/REPORT.md](./CHATGPT/REPORT.md) |
| Claude | Arayüz, mobil kullanılabilirlik ve UI/UX | [CLAUDE/REPORT.md](./CLAUDE/REPORT.md) |
| Manus | Bağımsız QA, güvenlik, performans ve test raporu | [MANUS/REPORT.md](./MANUS/REPORT.md) |
| Grok | Ürün araştırması, özellik önerileri ve yol haritası | [GROK/REPORT.md](./GROK/REPORT.md) |

## Çalışma kuralları

1. Kod değiştirmeden önce güncel `main` dalını ve açık PR'ları inceleyin.
2. Aynı dosyada eşzamanlı değişiklik yapmayın; çakışma varsa önce haber verin.
3. Her işi küçük ve anlamlı commit'lere ayırın.
4. İlgili testleri çalıştırın; çalıştırılmayan testleri başarılı göstermeyin.
5. Gerçek Android cihazda denenmeyen davranışları cihazda test edilmiş gibi raporlamayın.
6. Token, parola, imzalama anahtarı veya başka sırları kaynak koda, rapora ya da APK'ya eklemeyin.
7. Her teslimatta değişen dosyaları, commit/PR bağlantısını, test sonuçlarını, bilinen sorunları ve entegrasyon notlarını ilgili rapora yazın.
8. Yalnızca kendi klasörünüzdeki raporu düzenleyin. ChatGPT ekip raporlarını okuyup entegrasyonu koordine eder.

## Teslimat durumu

- **ChatGPT:** Entegrasyon raporu ana dala eklendi.
- **Claude:** UI/UX teslimatı PR #2 içinde; CI başarılı, PR henüz birleştirilmedi.
- **Manus:** Bağımsız QA raporu bekleniyor.
- **Grok:** Ürün araştırması ve yol haritası raporu ana dala eklendi.
