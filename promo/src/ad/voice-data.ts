// Otomatik üretildi: scripts/make-voice.mjs — elle düzenlemeyin
export type VoiceLine = { src: string; from: number; frames: number; text: string };
export const VOICE: Record<"30" | "15", VoiceLine[]> = {
  "15": [
    {
      "src": "voice/ad15-1.wav",
      "from": 3,
      "frames": 71,
      "text": "Şarkın için, her ay otuz liriks video."
    },
    {
      "src": "voice/ad15-2.wav",
      "from": 78,
      "frames": 111,
      "text": "Film edit, minimal ya da klip. Hepsi gerçek editörlerden."
    },
    {
      "src": "voice/ad15-3.wav",
      "from": 200,
      "frames": 114,
      "text": "Üç bin iki yüz liradan başlayan paketler. Tek seferlik ödeme."
    },
    {
      "src": "voice/ad15-4.wav",
      "from": 320,
      "frames": 34,
      "text": "Her ay düzenli teslim."
    },
    {
      "src": "voice/ad15-5.wav",
      "from": 380,
      "frames": 66,
      "text": "Ed Liriks. İlk paketini şimdi seç."
    }
  ],
  "30": [
    {
      "src": "voice/ad30-1.wav",
      "from": 4,
      "frames": 71,
      "text": "Şarkın için, her ay otuz liriks video."
    },
    {
      "src": "voice/ad30-2.wav",
      "from": 98,
      "frames": 155,
      "text": "Film edit, minimal ya da klip üzerine sözler. Hepsi, gerçek editörlerin elinden."
    },
    {
      "src": "voice/ad30-3.wav",
      "from": 274,
      "frames": 114,
      "text": "Paketini seç, şarkını gönder. Gerisini ekibimiz halleder."
    },
    {
      "src": "voice/ad30-4.wav",
      "from": 394,
      "frames": 165,
      "text": "Paketler, üç bin iki yüz liradan başlıyor. Tek seferlik ödeme, otomatik yenileme yok."
    },
    {
      "src": "voice/ad30-5.wav",
      "from": 574,
      "frames": 79,
      "text": "Videoların, her ay düzenli olarak teslim edilir."
    },
    {
      "src": "voice/ad30-6.wav",
      "from": 694,
      "frames": 78,
      "text": "Tüm teslimlerin ve mesajların, tek bir panelde."
    },
    {
      "src": "voice/ad30-7.wav",
      "from": 814,
      "frames": 73,
      "text": "Ed Liriks. İlk paketini şimdi seç."
    }
  ]
};
