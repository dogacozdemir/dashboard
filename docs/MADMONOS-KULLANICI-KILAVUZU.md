# Madmonos — Kullanıcı Kılavuzu

**Sürüm:** 1.0 · **Hedef kitle:** Ajans ve marka ekipleri · **Felsefe:** Marketing Command Center

---

## İçindekiler

1. [Giriş ve vizyon](#1-giriş-ve-vizyon)
2. [Onboarding: İlk adımlar](#2-onboarding-ilk-adımlar)
3. [Dashboard: Yönetici özeti](#3-dashboard-yönetici-özeti)
4. [Performance Hub: Birleşik kokpit](#4-performance-hub-birleşik-kokpit)
5. [Creative Studio: Kreatif yaşam döngüsü](#5-creative-studio-kreatif-yaşam-döngüsü)
6. [Mastery Hall: Başarı ve seviye](#6-mastery-hall-başarı-ve-seviye)
7. [Brand Vault ve white-label](#7-brand-vault-ve-white-label)
8. [Mono AI: Stratejik partner](#8-mono-ai-stratejik-partner)
9. [PWA ve mobil deneyim](#9-pwa-ve-mobil-deneyim)
10. [Güvenlik ve veri bütünlüğü](#10-güvenlik-ve-veri-bütünlüğü)
11. [Diğer modüller (tam kapsam)](#11-diğer-modüller-tam-kapsam)

---

## 1. Giriş ve vizyon

### Madmonos nedir?

**Madmonos**, Meta, Google, TikTok ve organik arama (Search Console) sinyallerini tek çatı altında toplayan, **yapay zekâ destekli birleşik pazarlama komuta merkezidir.** Amaç; dağınık panelleri kaldırıp, ajans ile markanın aynı “cam kokpit” üzerinden karar almasını sağlamaktır.

| Odak | Açıklama |
|------|----------|
| **Birleşik kokpit** | Harcama, gelir, ROAS, SEO ve kreatif onay akışı tek deneyimde |
| **monoAI katmanı** | Marka bağlamına duyarlı stratejik sohbet ve rapor özeti |
| **Mastery** | Eylem bazlı XP, rozetler ve seviye ile “oyunlaştırılmış operasyon” |

### “Liquid Glass” tasarım felsefesi

Arayüzde **cam benzeri yüzeyler** (`backdrop-blur`, ince ışık kenarları, yumuşak gölgeler) kullanılır. Bu yaklaşım yalnızca estetik değildir:

- **Netlik:** Yoğun veriyi panellerde “katmanlara” ayırarak okunabilir kılar.
- **Premium his:** Üst segment SaaS beklentisiyle uyumlu, dikkat dağıtmayan bir zemin sunar.
- **Odak:** Önemli KPI ve eylemler, arka plana göre öne çıkar; “gürültü” azalır.

> **Pro-Tip:** Gece modu ve düşük kontrastlı metinler göz yorgunluğunu azaltır; uzun inceleme seanslarında Performance Hub ve Dashboard’u üst üste kullanırken yan menüdeki **Mastery** ve **XP çubuğunu** motivasyon olarak kullanın.

---

## 2. Onboarding: İlk adımlar

### Çok kiracılı yapı (multi-tenancy / alt alan adları)

Her marka veya müşteri **kendi kiracı (tenant) alanında** çalışır. Üretimde bu genellikle **`marka.madmonos.com`** gibi bir alt alan adıyla eşleşir; geliştirme ortamında ise oturumdaki kiracı ile yerel adres eşleştirmesi kullanılabilir.

| Kavram | Anlamı |
|--------|--------|
| **Tenant** | Veri, kullanıcılar ve marka ayarları izole bir “kutu” içindedir |
| **Subdomain** | Tarayıcıdaki host, hangi kiracının yükleneceğini belirler |
| **Oturum** | Kullanıcı yalnızca bağlı olduğu kiracının verisine erişir (rol izinleriyle sınırlı) |

### İlk giriş deneyimi (üç katman)

1. **Boş kiracı (fresh start):** Henüz kampanya, reklam hesabı, kreatif veya marka varlığı yoksa sistem **MonoAI karşılama** akışını gösterebilir — markaya özel kısa bir metin ve yönlendirme.
2. **Magic Onboarding (`?magic=1`):** OAuth veya özel bağlantı sonrası açılabilen **marka denetimi + hedef seçimi** sihirbazı. Burada **dashboard_goal** (aşağıda) kaydedilir.
3. **MagicTour:** Apple tarzı, **4 adımlı** hafif tam ekran turu — Dashboard, Performance, Creative ve Mastery’yi tanıtır.

### MagicTour — ne işe yarar?

- **Otomatik:** İlk ziyarette, tarayıcıda tur daha önce tamamlanmadıysa açılır (tamamlanma tarayıcıda saklanır).
- **Adımlar:** Komuta merkezi (KPI’lar) → Birleşik kokpit → Kreatif onay akışı → XP / seviye sistemi.
- **Kapatma / atlama:** “Atla” veya dışarı tıklama ile tur kapanır ve bir daha otomatik çıkmaz.

### Turu yeniden başlatma

1. **Profil & Ayarlar** sayfasına gidin (`/profile`).
2. **Ürün turu** kartında **“Turu yeniden başlat”** düğmesine basın.
3. Sayfa yenilenir; MagicTour yeniden gösterilir.

> **Pro-Tip:** Yeni ekip üyesi eklediğinizde, turu bir kez birlikte açıp ekran paylaşımıyla gezin — MagicTour metinleri hem eğitim hem satış demosu için uygundur.

---

## 3. Dashboard: Yönetici özeti

Dashboard, **yöneticinin sabah baktığı tek sayfadır:** trend, KPI kartları, liderlik tablosu ve son aktivite.

### Executive Trend (Yönetici nabzı)

**Executive Trend** grafiği, seçilen zaman aralığı ve kokpite göre **harcama (spend)** ile **gelir (revenue)** eğrilerini üst üste gösterir (her ikisi de para birimi eksenleriyle okunur). İki eksenli yapı sayesinde “harcama artarken gelir ne yapıyor?” sorusu bir bakışta yanıtlanır. **Dönüşüm eğrisi** bu grafikte değil; dönüşüm metrikleri **KPI kartları** ve kampanya tablosunda takip edilir.

- Kokpit **“SEO”** modundayken bu grafik **ücretli kanallara özel** olduğu için gösterilmez; organik performans Performance Hub içinde **GSC matrisi** ile takip edilir.

### KPI kartları ve `dashboard_goal`

Magic Onboarding’de seçilen **büyüme hedefi** (`dashboard_goal`), kartların **sırasını** ve dolayısıyla **vurguyu** değiştirir:

| Hedef | Odak | Kart sırasına etkisi (özet) |
|-------|------|------------------------------|
| **Satış (sales)** | ROAS, gelir, CPA | ROAS ve gelir öne alınır |
| **Bilinirlik (awareness)** | Gösterim, CTR, tıklama | Gösterim ve etkileşim öne alınır |
| **Maliyet (cost)** | CPA, harcama verimliliği | CPA ve harcama optimizasyonu öne alınır |

Kartlar; harcama, gelir, ROAS, CPA, tıklama, CTR, gösterim, dönüşüm oranı gibi metrikleri **kokpite göre filtrelenmiş** toplamlarla gösterir.

### Kokpit araç çubuğu (Dashboard’ta da geçerli)

Üst bölümde **zaman aralığı** (günlük / haftalık / aylık) ve **platform seçici** bulunur. Ayrıca buradan **mono Report** PDF dışa aktarımına erişilir (detay bölüm 4’te).

> **Pro-Tip:** Command Center (**Cmd+K** / **Ctrl+K**) açıkken belirli bir metriğe odaklanırsanız, Dashboard’taki **spotlight** ile uyumlu vurgular devreye girebilir — hızlı “tek metrik” incelemesi için idealdir.

---

## 4. Performance Hub: Birleşik kokpit

Performance Hub, **kanal derinliği** isteyen kullanıcılar içindir: aynı veri modeli, Dashboard ile tutarlıdır ancak daha fazla tablo ve matris içerir.

### Platform Switcher (Kokpit seçici)

URL üzerinden `?platform=` parametresi ile yönetilir; arayüzde sekmeler:

| Kokpit | Kapsam |
|--------|--------|
| **Tümü (all)** | Meta + Google + TikTok birleşik |
| **meta** | Yalnız Meta |
| **google** | Yalnız Google Ads |
| **tiktok** | Yalnız TikTok |
| **seo** | Organik / Search Console odaklı görünüm |

**SEO** seçildiğinde kampanya tablosu **gösterilmez** (ücretli kampanya satırları bu moda uygun değildir); bunun yerine **GSC matrisi** ve ilgili SEO bileşenleri öne çıkar.

### GSC matrisi (SEO sinyalleri)

Google Search Console bağlıysa matriste özetler görünür. Başlıca alanlar:

| Alan | İş değeri |
|------|-----------|
| **Gösterim / tıklama** | Genel organik görünürlük ve trafik çekme |
| **Marka dışı gösterim (non-brand)** | *Hizmet bazlı görünürlük* — marka adı aramalarından bağımsız, talep yaratan sorgulardan gelen görünürlük |
| **Ortalama pozisyon** | SERP’teki yerleşim kalitesi (veri gelene kadar “kalibrasyon” rozeti görülebilir) |
| **CTR** | Listede tıklanma oranı; veri yokken “bekleniyor” rozeti |
| **Dizinleme sorunları** | Search Console Indexing API hattı üzerinden sayı (henüz bağlı değilse arayüz boru hattı notu gösterir) |
| **Deneyim metrikleri (CWV)** | **LCP** (saniye), alt satırda **CLS** ve **FID (ms)** — Core Web Vitals özeti; veri yokken “bekleniyor” durumu |

Veri henüz senkron değilse arayüz **“GSC senkron”** tarzı sıvı rozetlerle durumu şeffaf gösterir.

### Birleşik kampanya tablosu

Tablo, kiracınızdaki **Meta / Google / Tiktok** kampanyalarını tek listede birleştirir. Listeye dahil edilen satırlar pratikte **son dönemde sinyal üreten** kampanyalardır: **harcama, gösterim, tıklama veya dönüşümden en az biri sıfırdan büyük** olanlar önceliklendirilir; böylece tablo “hayalet” kampanyalarla dolmaz. Liste uzunluğu üst sınırla kısıtlanır (yoğun hesaplarda en güncel ve anlamlı özet).

### mono Report — premium PDF

1. **Dashboard** veya **Performance Hub** üst araç çubuğunda **mono Report indir** (veya eşdeğeri) düğmesine basın.
2. Seçili **zaman aralığı** ve **kokpit** PDF’e yansır.
3. Rapor; KPI özetleri, harcama trendinin tablo özeti ve **monoAI** stratejik paragrafı içerir (yapılandırılmış AI anahtarı yoksa statik profesyonel özet kullanılır).

> **Pro-Tip:** Müşteri yönetim kuruluna gitmeden önce aynı aralık ve kokpite göre PDF alıp ek olarak **Mono AI** sohbetinde aynı dönemi sorgulayın — slayt ve canlı demo birbirini tamamlar.

---

## 5. Creative Studio: Kreatif yaşam döngüsü

Creative Studio, **dosya yüklemeden yayına / takvime** giden tüm kreatif yaşam döngüsünü yönetir.

### Yükleme akışı

1. Sürükle-bırak veya dosya seçimi ile kreatif ekleyin.
2. Sosyal gönderi olarak yüklüyorsanız **başlık, platform, açıklama, plan tarihi** gibi alanlar açılır (Ops Takvimi ile uyumlu akış).
3. Dosya güvenli şekilde depolanır ve kiracıya bağlı kayıt oluşturulur.

### Onay / revizyon akışı

| Durum | Anlamı |
|-------|--------|
| **İncelemede (pending)** | Ajans veya ekip incelemesi bekliyor |
| **Revizyon** | Geri bildirim verildi, düzeltme bekleniyor |
| **Onaylandı (approved)** | Marka onayı tamam; yayın/takvim tarafına hazır |

Revizyon iletişimi **yorum / thread** üzerinden yürür; onaylandığında:

- **Gamification:** Onay eylemi XP ve başarılarla ödüllendirilir.
- **Görsel ödül:** Başarı ve seviye bildirimleri için **konfeti / altın toz** animasyonları kullanılır (Celebration katmanı).
- **Takvim köprüsü:** Uygun şekilde planlanmış bir kreatif onaylandığında, **Ops Takvimine otomatik sosyal gönderi etkinliği** oluşturulabilir (tek seferlik bağlantı).

### Ajans–müşteri iş birliği

- Ajans kreatifi yükler ve durumu **pending** bırakır.
- Müşteri **inceleme** veya **revizyon** talebi gönderir.
- Onay sonrası takvim ve raporlama tarafı beslenir; böylece “onay = operasyonel gerçek” olur.

> **Pro-Tip:** Onaydan önce **plan tarihi** doldurmak, onay anında takvim köprüsünün devreye girmesini kolaylaştırır.

---

## 6. Mastery Hall: Başarı ve seviye

### XP sistemi

XP **eyleme dayalıdır:** giriş, mesaj, senkron, PDF üretimi, kreatif onayı, marka varlığı ekleme gibi tanımlı eylemler puan kazandırır. Bu, “süs rozet” değil **operasyonel disiplin** ödülüdür.

### Seviyeler

Seviye eşikleri toplam XP’ye göre belirlenir. Örneğin **Seviye 5 — Brand Mimarı (Brand Architect)**, **Brand Vault’tan ana logo** atanarak **white-label kabuk** (kenar çubuğu, üst bar, mobil dock) için gereken eşiği temsil eder; `super_admin` rolleri kurallara göre muaf tutulabilir.

### Mastery sayfası — silüet mantığı

- Tüm başarım tanımları **ızgara** halinde listelenir.
- **Kazanılmamış** rozetler **gri silüet + kilit** ile gösterilir; üzerine gelince **nasıl açılacağına dair ipucu** görünür.
- **Kazanılmış** rozetler renkli gradyan ile parlar ve **+XP** etiketi gösterilir.
- Üstte **dairesel seviye halkası** bir sonraki seviyeye kalan XP’yi gösterir.

### Command Center entegrasyonu

**Cmd+K / Ctrl+K** ile açılan Command Center alt bilgisinde **XP ve seviye** özeti (`XP: … · Lv.…`) görüntülenir; kullanıcı arama yaparken bile motivasyon verisi elinin altında kalır.

---

## 7. Brand Vault ve white-label

### Marka varlıkları

Brand Vault’ta **logo, renk, font, rehber PDF** vb. varlıklar saklanır. Her öğe kiracıya özeldir; public / private görünürlük ayarlarına göre paylaşım kontrol edilir.

### Ana logo ve white-label

1. **Logo** tipinde bir varlık yükleyin veya mevcut logoyu kullanın.
2. **Shell primary / Ana logo olarak işaretle** (yetki ve seviye koşulları sağlanıyorsa) ile `tenants.brand_logo_url` güncellenir.
3. Sonuç: **Kenar çubuğu, üst bar (mobil çip), mobil dock merkez orb** ve karşılama ekranı gibi kabuk alanlarında **markanızın logosu** Madmonos yerine gösterilir.

> **Pro-Tip:** Uzaktan logo URL’si kullanıldığında tarayıcı güvenliği için `referrerPolicy` gibi önlemler uygulanır; CDN veya S3 URL’nizin **HTTPS** olması beklenir.

---

## 8. Mono AI: Stratejik partner

**Mono AI** sayfası (`/mono-ai`), markanızın kiracı bağlamı içinde çalışan sohbet arayüzüdür.

| Yetenek | Değer |
|---------|--------|
| **Bağlamlı yanıtlar** | Performans ve marka verisiyle uyumlu öneriler |
| **Doğal dil** | “Bu ay ROAS neden düştü?” gibi sorular |
| **Operasyon** | Command Center ile birlikte hızlı gezinme |

> **Pro-Tip:** Aynı soruyu hem Mono AI’da hem mono Report PDF özetinde karşılaştırın — biri diyalog, diğeri arşivlenebilir belge üretir.

---

## 9. PWA ve mobil deneyim

### Segmentli alt dock ve “Daha fazla” orb

Mobilde **alt navigasyon çubuğu** segmentlidir: ana rotalar hızlı erişimdedir; **ortadaki orb (gem)** üzerine basıldığında **ek sayfalar / “daha fazla”** menüsü açılır. Orb içinde **kiracı logosu** (white-label varsa) görünür.

### PWA olarak kurulum

- `manifest.json` ile uygulama **Ana Ekrana Ekle** / **Install** davranışı desteklenir.
- `standalone` görünüm, adres çubuğunu azaltarak **native yakın** his verir.
- Tema rengi ve ikonlar koyu premium çizgiye uygundur.

**iOS (Safari):** Paylaş → Ana Ekrana Ekle.  
**Android (Chrome):** Menü → Uygulamayı yükle / Ana ekrana ekle.

> **Pro-Tip:** PWA’da güvenlik için oturum çerezleri sunucu tarafında yönetilir; cihazı paylaşıyorsanız **Profil → Çıkış** ile oturumu kapatın (çıkış üst çubuktaki kullanıcı menüsündedir).

---

## 10. Güvenlik ve veri bütünlüğü

| Konu | Yaklaşım |
|------|----------|
| **Kiracı izolasyonu** | Middleware / kiracı bağlamı ile istekler doğru tenant’a yönlendirilir |
| **Veritabanı** | Supabase **RLS (Row Level Security)** ile satırlar `tenant_id` üzerinden kısıtlanır |
| **API ve sunucu eylemleri** | Kiracı doğrulaması (`requireTenantAction` vb.) ile çift kontrol |
| **Oturum** | NextAuth / Auth.js JWT oturumu; üretimde güvenli çerez politikaları |

> **Pro-Tip:** “God Mode” (super admin) ve kimlik taklidi yalnızca platform ekibi içindir; müşteri kiracılarında normal kullanıcılar birbirinin verisini göremez.

---

## 11. Diğer modüller (tam kapsam)

Aşağıdaki sayfalar da ürünün parçasıdır ve sol menü veya komut paleti ile erişilir:

| Rota | Modül | Kısa açıklama |
|------|--------|----------------|
| `/dashboard` | Overview | Yönetici özeti, trend, KPI, liderlik, aktivite |
| `/mastery` | Mastery Hall | XP halkası, rozet ızgarası, ipuçları |
| `/performance` | Performance Hub | Kokpit, GSC, kampanyalar, mono Report |
| `/creative` | Creative Studio | Yükleme, filtreler, onay / revizyon |
| `/strategy` | SEO & GEO Report | Arama görünürlüğü, teknik / GEO odaklı kartlar |
| `/brand-vault` | Brand Vault | Varlıklar, sağlık skoru, ana logo / white-label |
| `/chat` | Team Chat | Ekip içi mesajlaşma (izinlere bağlı) |
| `/mono-ai` | Mono AI | Stratejik sohbet |
| `/calendar` | Ops Calendar | Kilometre taşları, çağrılar, sosyal yayın planı |
| `/profile` | Profil & ayarlar | Hesap, şifre, **ürün turunu yeniden başlatma** |
| `/settings/team` | Kullanıcı & ekip | Yetkili roller için ekip yönetimi |

**Command Center:** `Cmd+K` / `Ctrl+K` — sayfa arama, hızlı eylemler, AI yorum satırı, XP özeti.

**Bildirimler:** Üst çubukta (izin varsa) kiracıya özel bildirim akışı.

---

## Hızlı referans tablosu

| İhtiyaç | Nerede? |
|---------|---------|
| Günlük özet | Dashboard |
| Kanal derinliği | Performance Hub |
| Dosya onayı | Creative Studio |
| Rozet / seviye | Mastery |
| Marka dosyası + logo | Brand Vault |
| Sohbet ile strateji | Mono AI |
| Yayın takvimi | Ops Calendar |
| Ürün turu | Otomatik ilk ziyaret · Profil’den yeniden başlat |
| PDF rapor | Dashboard / Performance araç çubuğu |

---

## Son söz

Madmonos; **veri, kreatif ve yapay zekâyı** aynı “komuta merkezi” çatısında toplar. Liquid Glass arayüzü bu yoğunluğu **sakin ve prestijli** bir zemine taşır; siz işinize — büyümeye, onaya ve seviye atlamaya — odaklanırsınız.

---

*Bu belge Madmonos ürün kod tabanına uyumlu olacak şekilde hazırlanmıştır. Özellik bayrakları veya pilot özellikler kiracı bazında değişebilir.*
