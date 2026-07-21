# monoBoard — Web App & PWA Mimari Analizi ve Hareket Planı

**Hazırlayan bakış açısı:** Kıdemli yazılım mimarı
**Kapsam:** `madmonos` panelinin tarayıcı (web app) ve telefona kurulan uygulama (PWA) katmanlarının paritesi, kalitesi ve "gerçek uygulama" hissi.
**Durum:** Analiz + hareket planı (bu belgede kod değişikliği yapılmadı).

---

## 1. Yönetici Özeti

Uygulama, tarayıcıda **olgun bir web app**; ancak PWA tarafı **yarım kalmış** durumda. Üç somut şikâyet, tek bir kök gerçeğe işaret ediyor: **manifest + ikon + navigasyon üçlüsü, masaüstü deneyimiyle eşitlenmemiş ve Service Worker hiç yok.** Yani teknik olarak "manifest'i olan bir web sitesi" var; "kurulabilir, dayanıklı, native hissi veren bir PWA" yok.

| Şikâyet | Kök neden | Faz |
|---|---|---|
| 1 — Kurunca logo farklı | İkonlar doğru (gorilla) ama `purpose: "any maskable"` + safe-zone'suz tam-taşan tasarım (Android kırpıyor); apple-touch-icon şeffaf (iOS'ta siyah zemin) | **Faz 1** |
| 2 — PWA menüsü iyi değil | Mobil dock'ta menü tetikleyicisi logo-gem; keşfedilebilirlik zayıf, etiketsiz, i18n karışık (hardcoded EN/TR) | **Faz 3** |
| 3 — Web app'teki her şey PWA'da yok | Mobil navigasyonda `/instagram` **hiç yok**, `/settings/team` yok; parite kırık | **Faz 3** |

Bunların ötesinde, gerçek bir PWA için eksik olan **mimari temel katmanlar** (Service Worker, offline, kurulum akışı, push, splash) da bu planda ele alınıyor.

---

## 2. Mevcut Durum — Teşhis

### 2.1 Web App katmanı (sağlam)
- **Kök layout** ([app/layout.tsx](../app/layout.tsx)) meta/manifest/viewport'u doğru kurmuş; `appleWebApp`, `icons`, `themeColor` tanımlı.
- **Kabuk** ([DashboardShell.tsx](../components/layout/DashboardShell.tsx)) masaüstünde Sidebar + TopBar + içerik + CommandCenter; sayfa geçişlerinde `framer-motion`.
- **Safe-area altyapısı hazır** ([globals.css:427-440](../app/globals.css)): `px-safe`, `pt-safe`, `pb-mobile-dock` vb. mevcut — iyi bir temel.
- **Masaüstü Sidebar** ([Sidebar.tsx](../components/layout/Sidebar.tsx)) **10 ana rota** + koşullu takım ayarları + (TopBar üzerinden) profil sunar.
- Mobil için hazır bir **`MobileFirstSheet`** deseni var ([settings/team](<../app/(tenant)/settings/team/TeamSettingsView.tsx>) ve [profile](<../app/(tenant)/profile/ProfileSettingsShell.tsx>) bunu kullanıyor).

### 2.2 PWA katmanı (yarım)
- **manifest.json** ([public/manifest.json](../public/manifest.json)): `standalone`, ikon 192/512, `theme_color/background_color = #07070E`.
- **İkonlar:** `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — hepsi **madmonos gorilla** görselinin varyasyonları (yani "yanlış logo" değil).
- **Service Worker: YOK.** `next-pwa`/`serwist`/`workbox` yüklü değil, `public/sw.js` yok.
- **Offline desteği YOK**, **kurulum istemi (beforeinstallprompt) YOK**, **standalone algılama YOK**, **web push YOK**.

### 2.3 Üç şikâyetin kök-neden analizi

**① "Kurunca logo farklı" — kırpma ve şeffaflık sorunu**
- manifest ikonları `"purpose": "any maskable"` ile işaretli. **Maskable** ikonlar Android'de daire/squircle maskesiyle kırpılır ve ikonun kenar %20'lik "güvenli alanı" dışına taşan her şey **kesilir**. Gorilla görseli **kenardan kenara (tam-taşan)** olduğu için kulaklar/üst/yanlar kırpılır → yakınlaşmış, "farklı" bir logo.
- `apple-touch-icon.png` **şeffaf arka planlı**; iOS şeffaflığı desteklemez → ana ekranda **siyah zemin** basar → uygulama içindeki logodan farklı görünür.
- Ayrı bir **maskable ikon (padding'li, opak zeminli)** yok; tek görsel her amaç için kullanılıyor.
- Bonus tutarsızlık: manifest zemini `#07070E` iken uygulamanın gerçek zemini/viewport `#0c070c` → açılış/splash renk uyumsuzluğu.

**② "PWA menüsü iyi değil" — keşfedilebilirlik ve tutarlılık**
- Mobil dock ([MobileBottomNav.tsx](../components/layout/MobileBottomNav.tsx)) 2 sol + 2 sağ ikon + ortada **logo-gem** düğmesi; gem'e basınca 5'li "cephanelik" açılıyor.
- Sorunlar:
  - Menü tetikleyicisinin **logo** olması sezgisel değil; ancak tek seferlik "More'da tüm sayfalar" ipucuyla anlaşılıyor (o metin de **hardcoded**, i18n değil).
  - Bar ikonları **etiketsiz** (yalnızca ikon) → tanınırlık düşük.
  - Stack alt başlıkları **hardcoded İngilizce** ("Jungle Engine", "SEO & GEO cockpit", "Brand Mono assets", "Ops calendar") — TR arayüzle çelişiyor.
  - Gem açılınca **45° dönüyor** (X gibi) ama görsel logo → kafa karıştırıcı.
  - Aktiflik yalnız renkle; metinsel bağlam yok.

**③ "Web app'teki her şey PWA'da yok" — parite kırık**
- Masaüstü Sidebar'da **10 rota** var; mobil navigasyon toplam **9** gösteriyor.
- **`/instagram` (Instagram Önizleme) mobilde HİÇ yok** — ne barda ne stack'te. (Masaüstünde var.)
- **`/settings/team`** mobil navigasyonda yok (yalnızca TopBar'daki dişli `hidden sm:block` ile gizli; profil ise avatar menüsünden erişilebiliyor).
- Sonuç: telefonda kullanıcı, tarayıcıda gördüğü bazı sayfalara **hiç ulaşamıyor**.

### 2.4 Mimari boşluklar (architect gözüyle, şikâyetlerin ötesinde)
1. **Service Worker yok** → offline yok, kabuk önbelleği yok, güncelleme akışı yok, arka plan yok. En büyük eksik.
2. **Kurulum akışı yok** → `beforeinstallprompt` yakalanmıyor; kullanıcı tarayıcı menüsünü kendi bulmalı. iOS için "Ana Ekrana Ekle" rehberi yok.
3. **Splash/başlangıç görselleri yok** (iOS `apple-touch-startup-image`) → açılışta beyaz/siyah flaş.
4. **manifest zenginliği düşük:** `id` yok, `shortcuts` (uzun-bas kısayolları) yok, `screenshots` boş (Android'de zengin kurulum kartı kaçıyor).
5. **White-label PWA boşluğu:** manifest statik; markası olan (brand_logo_url'li) tenant bile telefona **"Madmonos" gorilla** olarak kuruluyor. Kurumsal müşteri kendi logosunu bekliyor.
6. **Web Push yok:** gerçek zamanlı bildirim ([NotificationCenter](../app/components/layout/NotificationCenter.tsx)) var ama uygulama kapalıyken push gelmiyor.
7. **`maximumScale: 1`** kullanıcı yakınlaştırmayı kapatıyor (erişilebilirlik notu).

---

## 3. Hareket Planı (Fazlara Bölünmüş)

> İlke: Her faz **tek başına yayınlanabilir** ve bir öncekinin üzerine kurulur. Faz 1–3 kullanıcının üç şikâyetini doğrudan kapatır; Faz 4–5 "gerçek native his" için mimari derinlik ekler.

### FAZ 0 — Ölçüm & temel (yarım gün)
**Amaç:** Değişiklikleri kanıta bağlamak.
- Lighthouse (mobil) + "Installability" denetimi ile **başlangıç skoru** al (baseline).
- Gerçek cihazda (iOS Safari + Android Chrome) kurulum ekran görüntülerini kaydet.
- **Kabul:** Baseline rapor + "önce" ekran görüntüleri arşivlendi.

### FAZ 1 — İkon & manifest kimliği (Şikâyet ①) (1 gün)
**Amaç:** Kurulu ikon her platformda madmonos logosuyla birebir aynı görünsün.
- **Ayrı ikon setleri üret:**
  - `icon-any-192/512.png` → şeffaf, tam logo (`purpose: "any"`).
  - `icon-maskable-192/512.png` → logo **%20 güvenli alan padding'i** + **opak marka zemini** (`purpose: "maskable"`).
  - `apple-touch-icon.png` → **opak zeminli** (şeffaflık yok), 180×180, ~%10 padding.
- **manifest.json güncelle:** ikonları `any` ve `maskable` olarak **ayrı** listele; `theme_color`/`background_color`'ı uygulama zeminiyle (`#0c070c`) **eşitle**; `id`, `lang`, `dir` ekle.
- **Kök layout meta:** apple-touch-icon ve `apple-mobile-web-app-title` tutarlılığını doğrula.
- **Dosyalar:** [public/manifest.json](../public/manifest.json), yeni `public/icon-*.png`, [app/layout.tsx](../app/layout.tsx).
- **Kabul:** Android'de maskeli ikon kırpılmıyor; iOS ana ekranında zemin siyah değil; her ikisi uygulama içi logoyla aynı.

### FAZ 2 — Splash & görsel kimlik (0.5 gün)
- Android splash (manifest name + `#0c070c` + 512 ikon) doğrula.
- iOS için `apple-touch-startup-image` setini (başlıca cihaz boyutları) ekle → açılış flaşını gider.
- `manifest.screenshots` doldur (mobil dashboard, performance) → Android zengin kurulum kartı.
- **Kabul:** Açılışta beyaz/siyah flaş yok; kurulum kartı marka görselli.

### FAZ 3 — Navigasyon paritesi + menü yeniden tasarımı (Şikâyet ② + ③) (1.5 gün)
**Amaç:** Telefonda masaüstündeki her sayfaya net biçimde erişilsin ve menü sezgisel olsun.
- **Tek doğruluk kaynağı:** Sidebar ve MobileBottomNav'ın kullandığı **ortak `NAV_DEF`** listesi oluştur (rota kopyası bitsin) → yeni sayfa eklenince ikisine de otomatik yansır.
- **`/instagram` ve `/settings/team`'i mobil navigasyona ekle** (stack veya "Tümü" görünümü).
- **Menü yeniden tasarımı:**
  - Bar ikonlarına **kısa etiket** ekle (erişilebilirlik + tanınırlık).
  - Gem düğmesini net bir **"Menü/Tümü"** göstergesiyle destekle (ikon veya "Tümü" etiketi); dönme davranışını gözden geçir.
  - Stack alt başlıklarını **i18n**'e taşı (hardcoded EN/TR temizliği); "More'da tüm sayfalar" metnini çeviri anahtarına al.
  - Stack'i mevcut **`MobileFirstSheet`** desenine yaklaştırarak tutarlılık sağla.
- **Dosyalar:** [MobileBottomNav.tsx](../components/layout/MobileBottomNav.tsx), [Sidebar.tsx](../components/layout/Sidebar.tsx), yeni `lib/navigation/nav-def.ts`, [messages/tr.json](../messages/tr.json) + [en.json](../messages/en.json).
- **Kabul:** Masaüstündeki 10+ rotanın tamamı mobilde erişilebilir; menü etiketli ve tek dilde; yeni sayfa eklemek tek yerden yapılıyor.

### FAZ 4 — Service Worker, offline & kurulum akışı (gerçek PWA) (2–3 gün)
**Amaç:** "Web sitesi kabuğu"ndan "dayanıklı uygulama"ya geçiş.
- **Service Worker ekle** (`serwist`/`next-pwa` veya elde yazılmış minimal SW):
  - **App-shell + statik varlık** önbelleği (stale-while-revalidate).
  - **Offline fallback** sayfası (bağlantı yokken markalı ekran).
  - **Güncelleme akışı:** yeni sürüm hazırken "Güncelle" bildirimi.
  - Kimlik/veri uçlarını (Supabase, auth) **önbelleğe almama** (güvenlik) — yalnızca kabuk.
- **Kurulum bileşeni:** `beforeinstallprompt` yakalayıp özel **"Uygulamayı Yükle"** düğmesi; iOS için **"Ana Ekrana Ekle" rehber sayfası** (iOS bu olayı tetiklemez).
- **standalone algılama:** kurulu modda tarayıcıya özgü öğeleri gizle / davranış ayarla.
- **Dosyalar:** SW yapılandırması ([next.config.ts](../next.config.ts)), yeni `public/sw.js` (veya derleme çıktısı), yeni `components/pwa/InstallPrompt.tsx`, offline route.
- **Kabul:** Uçak modunda kabuk açılıyor; Lighthouse "Installable + PWA optimized" yeşil; güncelleme akışı çalışıyor.

### FAZ 5 — White-label PWA + Web Push + cila (2–3 gün, opsiyonel-ileri)
- **White-label manifest:** tenant subdomain'ine göre **dinamik manifest** (`app/manifest.ts` route) → markalı tenant kendi logosu/adıyla kurulur.
- **Web Push:** VAPID + push aboneliği; kritik bildirimleri (yeni revizyon, onay) uygulama kapalıyken ilet.
- **Erişilebilirlik:** `maximumScale` politikasını gözden geçir; dokunma hedefleri (min 44px) denetimi.
- **Kabul:** Kurumsal tenant kendi markasıyla kuruluyor; push testleri geçiyor; erişilebilirlik denetimi temiz.

### FAZ 6 — QA & çapraz-cihaz doğrulama (0.5 gün)
- iOS Safari + Android Chrome + masaüstü Chrome/Edge'de kurulum, offline, menü, ikon, splash matris testi.
- Lighthouse PWA/Perf/A11y skorlarının **"önce/sonra"** karşılaştırması.
- **Kabul:** Tüm hedef cihazlarda parite + kurulabilirlik + offline doğrulandı.

---

## 4. Öncelik Önerisi (mimar tavsiyesi)

Kullanıcının üç somut şikâyetini en hızlı kapatan sıralama:

1. **Faz 1 (ikon/manifest)** — Şikâyet ①'i doğrudan çözer, en yüksek görünür etki, en düşük risk.
2. **Faz 3 (navigasyon paritesi + menü)** — Şikâyet ② + ③'ü kapatır.
3. **Faz 4 (Service Worker + kurulum)** — "gerçek uygulama" hissini kuran omurga.
4. Faz 2 → 5 → 6, cila ve dayanıklılık.

> Not: Faz 1 + Faz 3 birlikte, kullanıcının bildirdiği **üç sorunun tamamını** kapatır ve tek bir sürümde teslim edilebilir. Faz 4, ürünü "kurulabilir web sitesi"nden "PWA"ya yükseltir.

---

## 5. Risk & Bağımlılıklar
- **İkon üretimi** tasarım varlığı gerektirir (maskable padding + opak zemin) — mevcut vektör/PNG'den türetilebilir.
- **Service Worker** yanlış önbellekleme yaparsa "eski sürüm takılması" riski taşır → yalnızca kabuk önbelleklenmeli, veri/auth uçları asla.
- **Dinamik manifest** (Faz 5) subdomain-bazlı; mevcut tenant çözümleme ([tenant-guard](../lib/auth/tenant-guard.ts)) ile hizalanmalı.
- Değişiklikler **gerçek cihazda** doğrulanmalı; tarayıcı DevTools tek başına yetmez (özellikle iOS).
