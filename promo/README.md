# AddLyrics tanıtım videosu

Sitenin özelliklerini anlatan 92 saniyelik motion design tanıtım videosu (1920×1080, 30 fps, H.264 MP4).
[Remotion](https://www.remotion.dev) ile React bileşenlerinden üretilir; renkler, fontlar, logo ve metinler sitedekiyle aynıdır.

**Çıktılar** (`out/`):

- `addlyrics-tanitim.mp4`: müzikli
- `addlyrics-tanitim-sessiz.mp4`: müziksiz (kendi müziğini veya seslendirmeni eklemek için)

## Sahneler

| Süre | Sahne | Anlatılan |
| --- | --- | --- |
| 0:00 | Giriş | Logo, "Şarkın İçin Lyrics Videolar. Tek Bir Yerden." |
| 0:06 | Mesaj | Gerçek editörler, şarkına özel tasarım, planlı aylık teslim |
| 0:12 | Video tarzları | Film Edit, Minimal, Music Video önizlemeleri; 9:16 · 16:9 · 1:1 |
| 0:24 | Nasıl çalışır | 4 adım (ekibin üretim öncesi soruları dahil) |
| 0:34 | Paketler | 3.200 / 6.200 / 9.400 TL, 30 / 60 / 90+15 video, video başına maliyet |
| 0:46 | Teslim planı | 30/30/45 aylık teslim, ayın 1–15'i kuralı |
| 0:56 | Sipariş sihirbazı | 5 adım: şarkı, tarz, format, dosyalar, özet |
| 1:06 | Müşteri paneli | Genel bakış, teslim edilen videolar, sipariş mesajları |
| 1:18 | Güven | Sitenin gerçek taahhütleri |
| 1:24 | Kapanış | "Şarkın İçin İlk Paketini Seç." |

## TikTok / Instagram Reels reklamları (9:16)

1080×1920, 30 fps, H.264 + AAC. `out/reklam/` altında:

| Dosya | İçerik |
| --- | --- |
| `addlyrics-reklam-30sn-9x16.mp4` | 30 sn, erkek seslendirme + müzik |
| `addlyrics-reklam-15sn-9x16.mp4` | 15 sn, erkek seslendirme + müzik |
| `*-muzikli.mp4` | seslendirmesiz, yalnızca müzik |
| `*-sessiz.mp4` | sessiz (platformun müzik kütüphanesinden ses eklemek için) |
| `kapak-*.png` | kapak görseli |

- İlk 1 saniyede ana mesaj ("Şarkın için her ay 30 lyrics video") ve logo görünür; sesi kapalı izleyen de her şeyi ekrandaki yazılardan anlar.
- Yazılar, TikTok ve Reels arayüzünün kapattığı alanların dışında tutulur (üstte 280 px, altta 680 px, sağda 130 px).
  Kontrol için: `npx remotion still src/index.ts Reklam30 kare.png --frame=500 --props='{"cut":"30","withMusic":false,"showSafe":true}'`
- Platformun CTA butonu ("Daha fazla bilgi", "Şimdi satın al") kapanıştaki aşağı oklarla gösterilen yere gelir.
- Kurgular `src/ad/AdPromo.tsx`, sahneler `src/ad/v-*.tsx` içindedir.

### Seslendirme

Metin `scripts/make-voice.mjs` içindedir; `npm run voice` her satırı Windows'un Türkçe erkek sesi **Microsoft Tolga** ile
üretir, sahnesine yerleştirir ve sığmazsa konuşma hızını artırır. Müzik konuşma sırasında otomatik kısılır.
Marka adı Türkçe okunuşa göre "Ed Liriks" diye yazılmıştır.

Tolga, Windows'la gelen eski tip (nöral olmayan) bir sestir; ücretli reklamda kullanmadan önce dinleyip karar ver.
Daha doğal bir ses için aynı metin ve zamanlama, lisanslı bir servisle (ör. Azure Speech `tr-TR-AhmetNeural`,
ElevenLabs) ya da bir seslendirme sanatçısının kaydıyla değiştirilebilir: dosyaları `public/voice/` altına aynı adlarla
koyup `src/ad/voice-data.ts` içindeki süreleri güncellemek yeterli.

## Yeniden üretme

```bash
npm install
npm run music     # public/music*.wav (koddan sentezlenen özgün müzik: tanıtım, 30 sn, 15 sn)
npm run voice     # public/voice/*.wav + src/ad/voice-data.ts (yalnızca Windows)
npm run studio    # tarayıcıda canlı önizleme ve düzenleme
npm run render -- --browser-executable="C:\Program Files\Google\Chrome\Application\chrome.exe" --chrome-mode=chrome-for-testing
npm run render:ad30 -- --browser-executable="C:\Program Files\Google\Chrome\Application\chrome.exe" --chrome-mode=chrome-for-testing
npm run render:ad15 -- --browser-executable="C:\Program Files\Google\Chrome\Application\chrome.exe" --chrome-mode=chrome-for-testing
```

`--browser-executable` verilmezse Remotion kendi Chrome Headless Shell sürümünü indirir.
Metin, fiyat veya süre değişirse ilgili sahne dosyasını (`src/scenes/*.tsx`) düzenleyip yeniden render et.
Sahne süreleri `src/Promo.tsx` içindedir ve ölçü (2 sn) cinsindendir; müzik aynı çizelgeyle üretildiği için süre
değiştirirsen `scripts/make-music.mjs` içindeki ölçü listelerini de güncelle.

## Notlar

- Telefonlardaki lyrics sahneleri sitedeki özgün örnek sözlerle hazırlanmış önizlemelerdir; gerçek müşteri işi
  veya başka hesaplara ait TikTok videoları videoda kullanılmaz.
- Müzik, bu klasördeki betikle sentezlenir; hazır bir şarkı veya örnek içermez.
- İkonlar sitedeki lucide setinden kopyalanır (ISC lisansı): `npm run icons`.
- Remotion, bireyler ve 3 kişiye kadar çalışanı olan şirketler için ücretsizdir; daha büyük ekipler şirket lisansı almalıdır
  (remotion.dev/license).
