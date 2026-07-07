# monoBoard — Ultra Detaylı Kullanım Kılavuzu

**Belge amacı:** Bu kılavuz, monoBoard'u (platformun kod içindeki teknik adı **Madmonos**'tur — ekranlarda logo ve marka adı olarak **madmonos** görürsünüz, aynı üründür) hiçbir teknik bilgiye ihtiyaç duymadan, adım adım kullanabilmeniz için hazırlanmıştır. Her adımda **"şuraya tıklayın"**, **"şu ekran açılır"**, **"bu düğme şunu yapar"** mantığıyla ilerlenir. Genel ürün tanıtımı için [MADMONOS-KULLANICI-KILAVUZU.md](./MADMONOS-KULLANICI-KILAVUZU.md) dosyasına da bakabilirsiniz; bu belge onun **çok daha detaylı, operasyonel** versiyonudur ve iki ana cilt halinde yapılandırılmıştır:

- **CİLT 1:** Giriş ve Güvenli Erişim Prosedürü
- **CİLT 2:** Tenant Playground (Müşteri) Kullanım Rehberi

---

# CİLT 1 — GİRİŞ VE GÜVENLİ ERİŞİM PROSEDÜRÜ

## 1.1 Davet Linki İle Giriş

monoBoard'a bir kullanıcı olarak eklendiğinizde (ajansınız veya marka yöneticiniz sizi sisteme davet ettiğinde), e-posta adresinize otomatik bir **davet e-postası** gelir. Bu e-posta, sistemin kimlik doğrulama altyapısı (Supabase Auth) tarafından gönderilir.

### Adım adım ne olur?

1. **E-postayı açın.** Gönderen adres sisteminizin kimlik doğrulama sağlayıcısına ait olacaktır; konu satırı davet/onay bildirimi içerir.
2. **E-postadaki bağlantıya tıklayın.** Bu bağlantı sizi önce güvenlik doğrulaması için kısa bir aracı adrese, ardından **otomatik olarak sizin firmanıza ait alt alan adına** (örnek: `firmaismi.madmonos.com/login`) yönlendirir. Bu yönlendirme, davetin hangi kiracıya (tenant) ait olduğu sistemde önceden tanımlı olduğu için **tamamen otomatiktir** — siz herhangi bir adres yazmazsınız.
3. **`firmaismi.madmonos.com/login` adresinde giriş ekranı açılır.** Ekranda **E-posta** ve **Şifre** alanları, ortada **madmonos** logosu ve **"Marka panonuza giriş yapın"** alt başlığı görürsünüz.

> ⚠️ **Önemli — şifrenizi ilk defa oluşturma:** Bu sürümde, davet e-postasına tıkladığınızda ekranda otomatik bir **"şifre belirle"** formu **açılmaz**; giriş ekranı doğrudan e-posta + şifre bekler. Bu nedenle **ilk şifrenizi almak için sizi davet eden ajans/marka yöneticinizle** iletişime geçmeniz gerekir — onlar size ilk giriş şifrenizi ayrı bir kanaldan (telefon, mesaj vb.) iletecektir. Şifrenizi aldıktan sonra giriş yapıp, aşağıdaki **1.3 Şifre Değiştirme** adımlarıyla kendi belirlediğiniz bir şifreyle değiştirebilirsiniz.
>
> Eğer davet e-postası size hiç ulaşmadıysa veya bağlantı süresi dolduysa, ajans yöneticinizden daveti tekrar göndermesini isteyin — mevcut davet otomatik olarak sizin firmanıza özel alt alan adına yönlendirmeye devam edecektir.

### Neden bu adrese yönlendirildim?

Sisteme her tıkladığınızda, tarayıcınızdaki adres çubuğunda **`www.madmonos.com`** değil, **`{firma-kodunuz}.madmonos.com`** göreceksiniz. Bunun nedeni bir sonraki bölümde (1.2) açıklanmıştır.

---

## 1.2 Subdomain (Alt Alan Adı) Mantığı

monoBoard, **çok kiracılı (multi-tenant)** bir sistemdir: her marka/müşteri kendi izole "kutusunda" çalışır ve bu kutuya erişim, tarayıcınızın adres çubuğundaki **alt alan adı (subdomain)** üzerinden belirlenir.

### Neden `firmaismi.madmonos.com` adresindesiniz?

| Adres | Ne olur? |
|---|---|
| `firmaismi.madmonos.com` | Sizin firmanıza (tenant'ınıza) özel veri, kullanıcılar ve panolar yüklenir |
| `baskafirma.madmonos.com` | Başka bir müşterinin verisidir — sizin hesabınızla giriş yapabilseniz bile bu adres **size ait değildir** |
| `admin.madmonos.com` | Yalnızca platform ekibinin (süper admin) kullandığı, tüm firmaları yöneten iç panel |
| `madmonos.com` (alt alan adı olmadan) | Genel/köşe adres; kiracıya özgü panolar burada **açılmaz** |

Sistem, her istekte tarayıcının gönderdiği **host bilgisini** okuyarak hangi firmanın verisinin gösterileceğine karar verir. Bu sayede:

- **Veri karışması imkânsızdır** — her firmanın verisi, veritabanı seviyesinde de (satır bazlı güvenlik ile) birbirinden izole edilmiştir.
- Sizin oturumunuz yalnızca **kendi firmanızın** subdomain'inde geçerlidir.

### Yanlış adrese giderseniz ne olur?

1. Kendi firmanıza ait olmayan bir `başkafirma.madmonos.com` adresine, **kendi hesabınızla giriş yapmış haldeyken** giderseniz, sistem bu talebi **reddeder**. Kendi tenant kimliğiniz ile ziyaret ettiğiniz adresin tenant kimliği eşleşmediği için sayfa **açılmaz** ve erişim engellenir (bir hata ekranı görürsünüz).
2. `admin.madmonos.com` adresine, **süper admin yetkiniz olmadan** girmeye çalışırsanız, sistem sizi otomatik olarak **"Yetkisiz Erişim"** (`/unauthorized`) sayfasına yönlendirir.
3. Oturum açmadan herhangi bir korumalı sayfaya (`/dashboard`, `/creative` vb.) gitmeye çalışırsanız, sistem sizi otomatik olarak **`/login`** ekranına yönlendirir; giriş yaptıktan sonra kaldığınız sayfaya geri döner.

> 💡 **Pratik ipucu:** Doğru adresi unutmayın diye, `firmaismi.madmonos.com/login` sayfasını tarayıcınızın **yer imlerine (bookmarks)** ekleyin. Her zaman kendi firmanızın adresinden giriş yapın.

---

## 1.3 Oturum Yönetimi

### Çıkış yapma (Logout)

1. Ekranın **sağ üst köşesindeki** kullanıcı çipine (avatarınız + adınız + rol rozetiniz) tıklayın.
2. Açılan menüde iki seçenek görürsünüz:
   - **"Profil ayarları"** — sizi `/profile` sayfasına götürür.
   - **"Çıkış yap"** (kırmızı renkli) — oturumunuzu kapatır.
3. **"Çıkış yap"a tıkladığınızda** oturumunuz anında sonlandırılır ve otomatik olarak **`/login`** ekranına yönlendirilirsiniz.

> ⚠️ **Paylaşımlı cihaz kullanıyorsanız** işiniz bittiğinde mutlaka çıkış yapın — özellikle mobil/PWA modunda tarayıcı sekmesini kapatmak oturumu otomatik sonlandırmaz.

### Şifre değiştirme

1. Sağ üstteki kullanıcı menüsünden veya sağdaki dişli/ayarlar simgesinden **"Profil ayarları"**na (`/profile`) girin.
2. Sayfada **"Şifre değiştir"** başlıklı bir bölüm bulunur; burada sırasıyla üç alan vardır:
   - **Mevcut şifre**
   - **Yeni şifre**
   - **Yeni şifre (tekrar)**
3. Üç alanı da doldurup **"Şifreyi güncelle"** düğmesine basın.
   - Yeni şifre ile tekrar alanı **birbiriyle uyuşmuyorsa**, sistem sizi uyarır ve işlemi tamamlamaz.
   - Yeni şifre **çok kısaysa**, sistem yine bir uyarı gösterir ve işlemi durdurur.
   - Her şey doğruysa yeşil bir **"başarılı"** bildirimi görürsünüz.

> ⚠️ **Not:** Bu ekran, şifrenizi değiştirmek için **mevcut şifrenizi bilmenizi** gerektirir. Eğer hiç şifreniz yoksa veya şifrenizi tamamen unuttuysanız, kendi kendinize sıfırlama seçeneği şu anda arayüzde bulunmuyor — bu durumda ajans/marka yöneticinizden (sistemde `management.users` yetkisine sahip biri) yeni bir davet göndermesini veya size geçici bir şifre iletmesini isteyin.

---

# CİLT 2 — TENANT PLAYGROUND (MÜŞTERİ) KULLANIM REHBERİ

Giriş yaptıktan sonra karşınıza çıkan tüm ekranlar, sizin firmanıza özel **"oyun alanınız" (playground)** niteliğindedir. Bu bölüm, her sayfayı en ince ayrıntısına kadar anlatır.

## 2.1 Dashboard & Gamification (Yönetici Özeti + Oyunlaştırma)

`/dashboard` sayfası, giriş yaptığınızda karşınıza çıkan ana ekrandır.

### Grafikler ne sıklıkla güncellenir?

- Dashboard'daki **Executive Trend** (harcama/gelir) grafiği ve KPI kartları, veritabanında **o an kayıtlı olan en güncel senkronize veriyi** anında gösterir — yani **sayfayı her açtığınızda** ekrandaki sayılar günceldir.
- Ancak bu sayıların **kaynağı** olan reklam platformu verileri (Meta/Google/TikTok harcama-gösterim-tıklama rakamları), arka planda **periyodik bir senkronizasyon işlemiyle** (otomatik zamanlanmış görev) çekilir. Yani "canlı" olan **ekranın kendisidir**; "canlı" olmayan, **bir senkron turu ile bir sonraki senkron turu arasındaki** ham platform verisidir. Pratikte bu, günün içinde birkaç kez tazelenen bir veri akışı olarak düşünülmelidir.
- **SEO/organik** veriler ayrı bir senkronla (Google Search Console bağlantısı üzerinden) gelir; aynı mantık geçerlidir.

> 💡 En güncel rakamı görmek istediğinizde sayfayı yenilemeniz yeterlidir; elle "senkronize et" tetiklemeniz gerekmez (bağlı hesaplar otomatik olarak zamanı geldiğinde yeniden senkronize edilir).

### Sol/sağ alttaki "XP, Seviye, Başarı Rozetleri" ve "Streak" nedir?

Dashboard'ın bir köşesinde kişisel **oyunlaştırma (gamification)** kartınızı görürsünüz. Bu kart şunları gösterir:

| Öğe | Anlamı |
|---|---|
| **Seviye numarası + unvan** | Toplam XP'nize göre hesaplanan seviyeniz (örnek unvanlar: *Yeni Üye, Aktif Kullanıcı, Uzman, Usta, Brand Mimarı, Efsane*) |
| **XP çubuğu** | Bir sonraki seviyeye ne kadar kaldığını gösteren yatay ilerleme çubuğu |
| **Rozet sayısı** | O ana kadar kazandığınız başarı rozeti adedi |
| **Streak (seri) 🔥** | Kesintisiz aktif gün sayınız |

Bu kart aynı zamanda **kenar çubuğunda (Sidebar)** ve **Mastery (`/mastery`)** sayfasında da (daha büyük ve detaylı halde) görünür.

### XP nasıl kazanılır?

XP, **belirli eylemleri gerçekleştirdiğinizde** otomatik olarak hesabınıza eklenir. Puanlar sabit ve önceden tanımlıdır:

| Eylem | Kazanılan XP |
|---|---|
| Sisteme giriş yapmak (günde bir kez sayılır) | 8 XP |
| Bir kreatifi (görsel/video/carousel) onaylamak | 22 XP |
| Bir kreatif yüklemek | 14 XP (birden fazla dosya yüklerseniz, dosya sayısıyla çarpılır) |
| Bir revizyon/yorum eklemek | 10 XP |
| MonoAI'ya bir mesaj göndermek | 5 XP |
| mono Report PDF'i oluşturmak/indirmek | 36 XP |
| Brand Vault'a marka varlığı (logo, PDF, palet, font) yüklemek | 16 XP |
| Takvime yeni bir etkinlik eklemek | 18 XP |

Bunun üzerine, belirli **"ilkler"** ve **eşikler** için ekstra **başarı rozeti (achievement)** XP'si de kazanırsınız — örnek: ilk giriş (+50 XP), ilk kreatif onayı (+100 XP), 24 saat içinde hızlı onay (+150 XP), 3/7/30 günlük seri (+100/+250/+1000 XP), 50+ AI mesajı (+300 XP) gibi. Toplamda platformda **20 farklı rozet** bulunur; hepsini toplarsanız yaklaşık **4.350 ek XP** kazanmış olursunuz.

### Seviye 5 — "Brand Mimarı" ne işe yarar?

**2.000 XP**'ye ulaştığınızda **Seviye 5 (Brand Mimarı)** unvanını kazanırsınız. Bu seviyenin özel bir kilidi vardır: **Brand Vault'tan bir logoyu "ana logo / white-label" olarak işaretleme** yetkisi bu seviyede açılır (detay için bkz. **2.5 Brand Vault**). Bu seviyenin altındaki kullanıcılar bu işlemi yapamaz; süper admin rolündeki kullanıcılar bu kısıtlamadan her zaman muaftır.

### Streak (Seri) kontrolü nasıl çalışır?

- Her gün sisteme giriş yaptığınızda seri sayacınız **bir artar**.
- **Bir gün bile** giriş yapmazsanız, seri sayacınız **1'e sıfırlanır** (bir sonraki girişinizde yeniden 1'den başlar).
- En uzun seriniz ("longest streak") ayrıca ayrı kaydedilir ve asla azalmaz — rekorunuz olarak kalır.
- Seri sayısı; Dashboard'daki profil kartında, kenar çubuğunda ve liderlik tablosunda **alev ikonu 🔥** (3+ gün) veya **elmas ikonu 💎** (30+ gün) ile gösterilir.

### Rozet/seviye kutlaması ekranda nasıl görünür?

Bir eylem sonrası yeni bir rozet kazanır veya seviye atlarsanız:

1. Ekranın **sağ altında** bir **"Yeni Başarı!"** bildirimi belirir (rozet ikonu + açıklama + kazanılan XP), yaklaşık **4-5 saniye** ekranda kalıp kendiliğinden kapanır.
2. Birden fazla rozet aynı anda kazanıldıysa, bildirimler **art arda** (yaklaşık 0.8 saniye arayla) sırayla gösterilir.
3. Eğer bu eylem sizi bir **üst seviyeye** taşıdıysa, tüm rozet bildirimleri bittikten sonra ekranın **üst-orta kısmında** büyük, altın renkli bir **"SEVİYE ATLADIN"** afişi belirir ve ekranda **altın toz / konfeti** animasyonu oynar.

---

## 2.2 Kreatif Stüdyo (`/creative`) — ONAY VE REVİZYON AKIŞI (Ultra Detaylı)

Creative Studio, ajansınızın sizin için hazırladığı görsel/video içeriklerin **incelendiği, onaylandığı ve revize edildiği** ana ekrandır.

### Sayfanın genel görünümü

Sayfanın en üstünde üç sayaç kartı bulunur: **İncelemede**, **Onaylandı**, **Revizyon gerekli** — her biri o statüdeki kreatif sayısını gösterir. Altında, ajansın yüklediği tüm kreatifler **kart ızgarası (grid)** halinde listelenir.

### Bir gönderi (post) veya carousel (kaydırmalı gönderi) ekranda nasıl görünür?

Her kart şunları gösterir:

- **Kapak görseli/videosu** (carousel'de ilk slayt; video ise otomatik oynatılmayan bir önizleme).
- Kartın **sol üst köşesinde** durum rozeti: *İncelemede* (mor), *Onaylandı* (yeşil), *Revizyon* (kırmızı-pembe).
- Eğer gönderi **birden fazla slayttan oluşan bir carousel ise**, kartın **sağ üst köşesinde** "1 / N" formatında bir **slayt sayacı rozeti** görünür (katman ikonu ile).
- Kartın altında **başlık**, **planlanan yayın tarihi/saati** (varsa) ve **yüklenme zamanı** (örn. "3 saat önce") yazar.
- Bir karta **fare ile gelindiğinde (hover)**, üzerinde mor tonlu bir **"İncele"** rozeti belirir.

Kartın **üstündeki filtre çubuğundan**: durum (Tümü/İncelemede/Onaylandı/Revizyon), plan aralığı (Tüm tarihler/Planlanmamış) ve **ay seçici** ile listeyi daraltabilirsiniz.

### Bir karta tıklayınca ne olur?

Karta tıkladığınızda ekranın **sağından kayarak** büyük bir **inceleme paneli (drawer)** açılır. Bu panelde yukarıdan aşağıya:

1. **Başlık ve onay rozeti.**
2. **Varlık önizleme (Asset Preview):** Kreatif carousel ise, slaytlar arasında **sağa/sola ok düğmeleri** veya **parmakla/fare ile kaydırma (swipe/drag)** ile gezinebileceğiniz büyük bir önizleme kutusu. Altındaki noktalar hangi slaytta olduğunuzu gösterir.
3. **"Tam boyutlu varlığı aç"** bağlantısı — orijinal dosyayı yeni sekmede açar.
4. **Revizyon akışı (yorum geçmişi)** — panelin ortasında.
5. En altta **yorum/revizyon yazma kutusu (composer)** ve **"Onayla"** düğmesi.

### Onaylama adımı — "Onayla" butonuna basınca ne olur?

1. Panelin sağ alt köşesindeki **altın renkli "Onayla"** düğmesine basın (bu düğme yalnızca onay yetkiniz varsa görünür).
2. Ekranda bir **onay teyidi penceresi** açılır: *"Onayı onaylıyor musunuz?"* ve altında şu uyarı yazar: *"Onaylandığında bu kreatif, yükleme sırasında girilen tarih/saatte Ops Takvimine bir Sosyal Gönderi olarak otomatik eklenir."*
3. **"Evet, onayla"** düğmesine bastığınızda:
   - Kreatifin durumu anında **"Onaylandı" (approved)** olarak değişir; kartın rozeti yeşile döner.
   - Eğer kreatif için bir **plan tarihi** girilmişse ve daha önce takvime bağlanmamışsa, sistem otomatik olarak **Ops Takvimi'nde** o tarihe bir **"Sosyal Gönderi"** etkinliği oluşturur ve kreatifi bu etkinliğe bağlar (tek seferlik, kalıcı bir bağlantıdır).
   - Siz ekranda **konfeti animasyonu** ve (yeni rozet/seviye kazandıysanız) **2.1'de anlatılan kutlama bildirimlerini** görürsünüz (onay eylemi size **+22 XP** kazandırır).
   - Panel otomatik kapanır ve kart listesi güncellenir.

> ⚠️ **Önemli:** "Onayla" düğmesi yalnızca **inceleme/onay yetkisi olan** kullanıcılara (örn. marka yöneticisi, süper admin) görünür; sıradan bir ekip üyesi bu düğmeyi göremeyebilir — bu durumda yalnızca revizyon isteyebilir.

### Revizyon verme adımı — bir slaytı beğenmediğinizde ne yapmalısınız?

1. İnceleme panelinin altındaki **yorum kutusuna** metninizi yazın (örn. *"Arka planı biraz koyulaştırın"*).
2. **Carousel'de birden fazla slayt varsa**, yorum kutusunun üstünde **"Şu slayta yorum yap"** açılır menüsü belirir: *"Tüm gönderi"* veya *"Slayt 1, Slayt 2…"* seçeneklerinden birini seçebilirsiniz. Bir slayt seçtiğinizde, önizleme otomatik olarak o slayta kayar ve yorumunuz **yalnızca o slayta** etiketlenir.
3. **Daha yapılandırılmış geri bildirim** istiyorsanız, composer'ın solundaki **kaydırıcı (slider) ikonlu düğmeye** basarak **"Detaylar"** panelini açın:
   - **Görsel kreatiflerde** altı farklı eksen seçebilirsiniz: *Genel, Renk & ton, Metin & tipografi, Kompozisyon, Arka plan, Özne.* Her eksen için ayrı bir not yazabilirsiniz (biri boş bırakılırsa revizyona dahil edilmez).
   - **Görselin üzerine doğrudan işaret (pin) bırakmak** için önizlemenin üstündeki **"Görsele pin koy"** düğmesine basın; bu modda görselin **istediğiniz noktasına tıkladığınızda** numaralı bir işaret (1, 2, 3…) düşer. Her pin için ayrı bir açıklama kutusu belirir — "Burada ne değişmeli?" yazarak tam olarak hangi bölgeyi kastettiğinizi belirtebilirsiniz.
   - **Video kreatiflerde** beş farklı revizyon tipi seçebilirsiniz: *Tüm video, Zaman aralığı, Ses/müzik, Alt yazı/metin, Renk/grade.* **"Zaman aralığı"** seçtiğinizde başlangıç/bitiş saniyelerini elle yazabilir **veya** videoyu oynatıp istediğiniz ana geldiğinizde **"Başlangıcı oynatıcıdan al"** / **"Sonu oynatıcıdan al"** düğmelerine basarak videonun o anki saniyesini otomatik doldurabilirsiniz.
   - İsteğe bağlı olarak **en fazla 3 referans bağlantısı** (YouTube, Instagram, TikTok vb. örnek linkler) ekleyebilirsiniz.
4. Her şeyi doldurduktan sonra **"Revizyon gönder"** düğmesine basın.
   - Kreatifin durumu otomatik olarak **"Revizyon" (revision)** olur; kartın rozeti kırmızı-pembeye döner.
   - Yorumunuz, altındaki **revizyon akışı (thread)** listesinde, adınız + zaman damgasıyla birlikte anında görünür.
   - Eğer görsele pin bıraktıysanız, kartta görselin küçük bir önizlemesi ve üzerinde **numaralı işaretleriniz + notlarınız** listelenir.

### Ajans revizyonu yapıp yeni görsel yükleyince süreç nasıl ilerler?

- Ajans tarafı, sizin bıraktığınız yorum/pinleri görüp gerekli değişikliği yapar ve **güncellenmiş görseli aynı gönderiye yeni bir slayt/versiyon olarak** ekler (yükleme ajans ekibi tarafından yapılır).
- Siz aynı kartı tekrar açtığınızda, **revizyon geçmişinin tamamını** (kendi yorumlarınız dahil) kronolojik olarak görürsünüz; ekip bir revizyonu **"Çözüldü"** olarak işaretlerse, o revizyon soluk bir görünüme geçer ve üzerinde **yeşil "Çözüldü" rozeti** belirir (kim çözdüğü de yazar).
- Değişiklik sizi tatmin ettiyse, aynı panelden tekrar **"Onayla"** diyerek süreci kapatabilir, tatmin etmediyse **yeni bir revizyon** daha bırakabilirsiniz. Süreç, siz onaylayana kadar bu döngüde devam eder.
- **Kendi yazdığınız bir yorumu** daha sonra düzenlemek veya silmek isterseniz, o yorumun üstündeki **kalem (düzenle)** veya **çöp kutusu (sil)** ikonlarına basabilirsiniz — bu, yalnızca sizin yazdığınız yorumlar için görünür.
- Bu ekran **gerçek zamanlıdır**: ajans tarafında biri yorum eklerse veya bir revizyonu çözüldü işaretlerse, siz panelinizi kapatıp açmadan **anında** güncellenmiş halini görürsünüz.

> ⚠️ **Kalıcı silme uyarısı:** Panelde bazı kullanıcılar (yalnızca platform süper admin'i) için kırmızı bir **"Tehlikeli Bölge"** kutusu ve **"Kreatifi sil"** düğmesi görünebilir. Bu işlem, kreatifi **veritabanından ve depodan kalıcı olarak** siler ve **geri alınamaz** — normal marka kullanıcıları bu düğmeyi görmez.

---

## 2.3 Instagram Akış Önizleme (Simülasyon Ekranı)

`/instagram` sayfası, henüz yayınlanmamış veya planlanmış Instagram içeriklerinizin, **gerçek Instagram uygulamasında nasıl görüneceğini önceden simüle etmenizi** sağlar.

### "Meta Hesabını Bağla" ile resmi entegrasyon nasıl yapılır?

Önemli bir ayrım yapalım:

1. **Reklam hesabı bağlantısı (Performance Hub üzerinden):** `/performance` sayfasındaki **"Bağlı Hesaplar"** şeridinde Meta, Google, TikTok için birer simge görürsünüz. Henüz bağlı değilse simgeye tıkladığınızda **Facebook'un resmi giriş/izin ekranına** yönlendirilirsiniz; izinleri onayladıktan sonra sistem sizi otomatik olarak panele geri getirir ve **"Bağlandı: meta"** gibi yeşil bir bildirim şeridi üstte belirir. Bu bağlantı; **harcama, ROAS, gösterim** gibi reklam metriklerini besler.
2. **Instagram profili canlı verisi (bu sayfadaki telefon mockup'ının üstündeki avatar/takipçi/gönderi sayıları):** Bu veri, ajansınızın/Madmonos ekibinin arka planda kurduğu bir **Instagram İşletme Hesabı bağlantısına** dayanır. Bu bağlantı şu anda **kendi kendinize (self-servis) yapabileceğiniz bir düğme değildir** — sizin için bu entegrasyonu ajans/platform ekibi kurar. Bağlantı kurulmadan önce dahi bu sayfa **çalışmaya devam eder**; sadece üstteki profil bilgileri (takipçi sayısı vb.) boş görünür, gönderi ızgarası ise **planlanmış/onaylı kreatiflerinizle** normal şekilde dolar.

> ⚠️ **Önkoşul:** Canlı profil verisinin görünmesi için hesabınızın bir **Instagram İşletme (Business) veya Yaratıcı (Creator) Hesabı** olması ve bir Facebook Sayfasına bağlı olması gerekir — bu, Meta'nın kendi kuralıdır.

### Ekrandaki büyük iPhone mockup'ı ne işe yarar?

Sayfanın ortasında/solunda gördüğünüz büyük **telefon çerçevesi**, sizin Instagram profilinizin **birebir görsel simülasyonudur**:

- En üstte durum çubuğu (saat, sinyal, pil ikonları) ve gerçek Instagram uygulamasındaki gibi bir üst bar (kullanıcı adınız + kilit ikonu + menü).
- Altında **profil fotoğrafınız**, **gönderi/takipçi/takip sayılarınız**, **biyografi metniniz** ve varsa **web sitesi bağlantınız**.
- Onun altında **öne çıkanlar (highlights)** balonları — bu balonlar, en yeni onaylı gönderilerinizin kapak görsellerinden **otomatik** oluşturulur.
- Ardından **üç sekme**: *Gönderi ızgarası*, *Reels*, *Etiketlenen*.
- En altta gerçek Instagram'daki gibi statik bir **alt gezinme çubuğu** (Ana sayfa, Ara, Oluştur, Reels, Profil ikonları).

Bu mockup, ajansınızın hazırladığı içeriğin **yayına çıkmadan önce gerçek profilinizde nasıl duracağını** görmenizi sağlayan bir "prova" ekranıdır.

### Carousel ve Reel ikonları neyi ifade eder?

Gönderi ızgarasındaki küçük kapak görsellerinin **sağ üst köşesinde**:

- **Katman (kare üstüne kare) ikonu** → bu gönderi bir **carousel** (birden fazla slayttan oluşan kaydırmalı gönderi).
- **Klaket (film) ikonu** → bu gönderi bir **Reel** (kısa video).
- Hiçbir ikon yoksa → tekli bir **fotoğraf/görsel gönderi**.

### Zaman Yolculuğu (Simülasyon Zaman Çizelgesi) nasıl kullanılır?

Sağ tarafta (masaüstünde) veya alt tarafta (mobilde) **"Simülasyon zaman çizelgesi"** başlıklı bir kutu bulunur; içinde iki alan vardır:

- **Simüle tarih** (bir takvim seçici)
- **Simüle saat** (bir saat seçici)

**Nasıl çalışır?**

1. **Sayfa ilk açıldığında**, tarih ve saat **otomatik olarak "şu an"a** (bugünün tarihi, 12:00 varsayılan saat) ayarlıdır. Bu durumda ızgarada, **o ana kadar zaten yayınlanmış** (canlı) gönderiler **ve** planlanan tarih/saati geçmiş **onaylı** kreatifler birlikte görünür.
2. **Tarihi 5 gün ileriye aldığınızda:** Sistem, planlanmış/onaylanmış her kreatifin **kendi plan tarihi ve saatini** simülasyon tarihi ile karşılaştırır. Eğer bir kreatifin plan tarihi, seçtiğiniz simülasyon tarih/saatinden **önce veya eşitse**, o kreatif ızgarada **görünür** hale gelir — sanki gerçekten o gün yayınlanmış gibi. Simülasyon tarihi kreatifin plan tarihinden **sonraysa** hâlâ görünür kalır (geçmişte kalır); **önceyse** henüz görünmez.
3. Böylece, "5 gün sonra profilim nasıl görünecek?" sorusunu, **gerçek yayın beklemeden** görebilirsiniz — gelecekteki onaylı kreatifler, sanki geçmişte zaten paylaşılmış canlı gönderilerin **arasına doğru kronolojik sırayla** yerleşir (en yeni tarihli olan en üstte/başta).
4. Kutunun altında **"Bu zaman diliminde N gönderi görünür"** yazan bir bilgi satırı, o anki toplam görünür gönderi sayısını gösterir.

> 💡 Bu özellik yalnızca **görsel bir önizlemedir** — gerçek Instagram hesabınıza herhangi bir gönderi göndermez veya yayınlamaz; tamamen size özel, izole bir simülasyondur.

### Bir posta tıklayınca açılan detay paneli nasıl okunur?

Izgaradaki bir gönderiye tıkladığınızda, ekranın ortasında büyük bir **detay penceresi** açılır:

- **Solda** (veya üstte, mobilde): gönderinin büyük önizlemesi. Carousel ise sağ/sol oklarla veya alttaki noktalarla slaytlar arası gezinebilirsiniz; video ise oynatma kontrolleriyle birlikte gösterilir.
- **Sağda** bir bilgi paneli bulunur:
  - **Başlık** ve **planlanan tarih/saat**.
  - **"Caption" (Metin)** bölümü: gönderinin altına yazılacak açıklama metninin tamamı burada okunur; metin girilmemişse *"Açıklama eklenmemiş"* yazar.
  - **Format**: gönderi/carousel/reel/story bilgisi.
  - **Slayt sayısı**: carousel'deki toplam görsel/video adedi.
- Pencereyi kapatmak için sağ üstteki **X** düğmesine basın veya pencerenin dışına (karartılmış alana) tıklayın.

---

## 2.4 MonoAI (Akıllı Asistan)

`/mono-ai` sayfası, markanızın verilerine erişimi olan bir **sohbet asistanı** sunar.

### Asistanla nasıl konuşulur?

1. Sayfa açıldığında, boş bir sohbet ekranında **karşılama mesajı** ve altında **4 adet örnek başlangıç sorusu** (2x2 düzeninde düğmeler) görürsünüz — bunlardan birine tıklayarak hızlıca başlayabilirsiniz.
2. Ekranın altındaki **metin kutusuna** sorunuzu yazın (örn. *"Bu ay ROAS neden düştü?"*) ve **gönder** düğmesine basın veya **Enter**'a basın (yeni satır için **Shift+Enter** kullanın).
3. Mesajınız sağ tarafta altın/mor gradyanlı bir balonda, asistanın cevabı ise sol tarafta buzlu-cam görünümlü bir balonda belirir.
4. Asistan cevap hazırlarken, nefes alır gibi yanıp sönen bir **"düşünüyor"** göstergesi görünür; eğer bir araç (örneğin web sayfası okuma) çalışıyorsa, ilgili ikon ve **"Sayfa okunuyor…"** gibi bir etiket belirir.

### "Web Sitesi Tarama (Web Crawl)" özelliği nasıl tetiklenir?

Bu özellik **özel bir düğmeyle değil**, doğrudan **yazdığınız mesajın içeriğiyle** tetiklenir:

1. Mesajınızın içine **bir web adresi (URL) yapıştırın** (örnek: *"şu rakibimizin sitesine bak: https://ornek-site.com"*) **veya** *"rakip"* / *"siteyi tara"* gibi ifadeler kullanın.
2. Sistem, mesajınızdaki bağlantıyı **otomatik olarak algılar** ve siz göndermeden hemen önce, arka planda o adresi **kazımaya (crawl)** başlar — bunun için ayrıca bir düğmeye basmanıza gerek yoktur.
3. Sohbette **"Sayfa okunuyor…"** göstergesini görürsünüz.
4. Tarama tamamlandığında, sistem o sayfadan çektiği metni **özetleyerek asistanın cevabına dahil eder** ve tarama içeriğinin işlendiğine dair bir onay notu ekler.

### Arka planda ne olur (RAG'a ekleme süreci)?

Siz bir URL paylaştığınızda, kullanıcı arayüzünde göremeseniz de arka planda şu adımlar **otomatik** işler:

1. Sistem o web sayfasına gerçek bir istek atıp **HTML içeriğini indirir** (yaklaşık 14 saniyelik bir zaman sınırıyla).
2. Sayfadan gereksiz kod/menü/altbilgi kısımları temizlenip **düz metin** çıkarılır (en fazla ~12.000 karakter).
3. Bu metin, **~1200 karakterlik parçalara (chunk)** bölünür.
4. Her parça, yapay zekâ tarafından okunabilir bir sayısal forma (**embedding/vektör**) dönüştürülür.
5. Bu vektörler, sizin firmanıza özel bir **"harici bilgi" veritabanı tablosuna** kalıcı olarak kaydedilir.
6. **Sonuç:** Bundan sonraki sohbetlerinizde, o siteyle ilgili bir soru sorduğunuzda, asistan bu kayıtlı bilgiyi **hatırlayıp** cevabına dahil edebilir — yani bir kez taranan site, asistanın "hafızasına" kalıcı olarak eklenmiş olur.

> 💡 Herhangi bir alan/rol kısıtlaması yoktur — sohbete erişimi olan herkes bir URL paylaşarak tarama başlatabilir; taranan site, sizin markanıza (tenant'ınıza) özel olarak saklanır, başka firmalarla paylaşılmaz.

---

## 2.5 Brand Vault & SEO/GEO

### Marka dökümanı (PDF) nasıl yüklenir?

1. `/brand-vault` sayfasına gidin.
2. **Yükleme paneli** üzerinden dosyanızı **sürükleyip bırakın** veya tıklayarak dosya seçin (aynı anda en fazla 20 dosya).
3. İsteğe bağlı olarak yükleme türünü seçin: *Otomatik (dosyadan algıla), Logo, Marka rehberi (PDF), Marka renkleri/palet, Font, Diğer.*
4. Kabul edilen dosya türleri: **görseller** (logo), **PDF** (marka kitabı/rehberi), **font dosyaları** (TTF/OTF/WOFF), **metin/markdown** dosyaları. Dosya başına üst boyut sınırı **15 MB**'dır.
5. Yükleme tamamlandığında dosya anında **listeye** eklenir; ek bir onay beklemenize gerek yoktur.

### Yüklenen döküman asistanın hafızasını nasıl etkiler?

1. Yüklediğiniz dosya önce güvenli depoya kaydedilir ve veritabanında **"işleme bekliyor" (pending)** durumunda bir kayıt oluşturulur.
2. Arka planda **otomatik olarak** (siz beklemeden, sayfa yanıt verdikten hemen sonra) şu işlenir:
   - **PDF ise** içindeki metin çıkarılır (görsel/font dosyalarında bu adım atlanır — onlar metne dönüştürülmez).
   - Çıkarılan metin **~1200 karakterlik parçalara** bölünür.
   - Her parça sayısal bir vektöre (**embedding**) dönüştürülür ve markanıza özel bir **"marka bilgisi" veritabanı tablosuna** kaydedilir.
3. İşlem bittiğinde kaydın durumu **"hazır" (ready)** olur; bir sorun olursa **"başarısız" (failed)** olarak işaretlenir ve hata nedeni saklanır. Görsel/font gibi metin içermeyen dosyalar **"atlandı" (skipped)** olarak işaretlenir — bunlar zaten metinsel bilgi taşımadığı için asistanın hafızasına metin olarak eklenmez.
4. Bundan sonra **MonoAI sohbetinde** marka, renk, tasarım gibi konularla ilgili bir soru sorduğunuzda, sistem önce sorunuzu vektöre çevirir, ardından yüklediğiniz dökümanlardan **en alakalı ~8 parçayı** bulur ve asistanın cevabını **yalnızca bu gerçek içeriğe dayandırarak** üretir (uydurma bilgi vermemesi için sistem özellikle bu şekilde yönlendirilmiştir).

> 💡 Yükleme sonrası ekranda ilerleme çubuğu göstermez; işleme genellikle çok hızlı tamamlanır ve dosya kartındaki durum etiketinden (hazır / işleniyor / başarısız) takip edebilirsiniz.

### Ana logo / white-label

**Seviye 5 (Brand Mimarı)**'a ulaştıysanız (bkz. 2.1), Brand Vault'taki bir **logo** varlığını **"Ana logo olarak işaretle"** diyerek seçebilirsiniz. Bu işlemden sonra kenar çubuğu, üst bar ve mobil gezinme çubuğunda **Madmonos logosu yerine sizin logonuz** görünür.

### SEO panelindeki "Dizin sorunları" sayacı neyi ifade eder?

`/performance` sayfasındaki **SEO ve Search Console matrisi** kartlarından biri **"Dizin sorunları"**dır:

- Bu sayaç, **Google'ın sitenizde okuyamadığı / dizine alamadığı sayfa sayısını** göstermeyi hedefler (Search Console'un URL denetimi verisine dayanır).
- Bu veri hattı şu anda **henüz tam olarak beslenmediği** için çoğu hesapta bu alan **"0"** veya **"dizin zekâsı hattında"** rozetiyle görünür — bu, sitenizde mutlaka sıfır sorun olduğu anlamına gelmez, veri akışının henüz tam kurulmadığının bir göstergesidir.
- Kartın hemen altında yer alan diğer alanlar (**Gösterim, Marka dışı gösterim, Ortalama sıralama, CTR, Deneyim metrikleri/CWV**) ise Google hesabınız bağlıysa **gerçek, güncel Search Console verisine** dayanır ve düzenli olarak senkronize edilir.

> ⚠️ Bu matrisin görünmesi için Google hesabınızın Search Console yetkisiyle bağlı olması gerekir; bağlı değilse kart *"Google bağlayıp GSC senkronu tamamlayınca matris dolacak"* şeklinde boş bir bilgilendirme gösterir.

---

## Hızlı Başvuru — Bu Kılavuzda Neredeyim?

| Sorunuz | Bölüm |
|---|---|
| Davet e-postası geldi, ne yapmalıyım? | Cilt 1 → 1.1 |
| Neden `firma.madmonos.com` adresindeyim? | Cilt 1 → 1.2 |
| Şifremi nasıl değiştiririm / çıkış nasıl yaparım? | Cilt 1 → 1.3 |
| XP/seviye/streak nasıl işliyor? | Cilt 2 → 2.1 |
| Bir kreatifi nasıl onaylarım / revizyon nasıl bırakırım? | Cilt 2 → 2.2 |
| Instagram önizlemesindeki zaman çizelgesi nasıl çalışır? | Cilt 2 → 2.3 |
| MonoAI'a nasıl soru sorarım, site taraması nasıl olur? | Cilt 2 → 2.4 |
| Marka dosyası nasıl yüklenir, SEO dizin sayacı ne demek? | Cilt 2 → 2.5 |

---
