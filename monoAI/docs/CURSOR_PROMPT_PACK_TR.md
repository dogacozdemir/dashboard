# Cursor Prompt Pack (Turkish)

Bu dosya, monoAI yetenek transferini diğer projede frictionless yaptırmak icin Cursor'a verilecek hazir prompt paketidir.

---

## 1) MASTER IMPLEMENTATION PROMPT (tek seferde ver)

Asagidaki promptu birebir Cursor Agent'e ver:

```text
Sen bir senior solutions architect + staff AI engineer olarak mevcut projeye monoAI capability migration uygulayacaksin.

HEDEF:
- Mevcut chatbot (monoAI) DeepSeek tabanli.
- Chatbot'a su yetenekleri ekle: PDF olusturma, dosya okuma/yazma/duzenleme, dosya arama/icerik arama, web fetch/search, MCP tool entegrasyonu.
- "ask/approval" UX gerekmiyor. Bot chatbot oldugu icin tool permission akisi interaktif onaya bagli olmayacak.
- Tenant security zaten uygulama katmaninda var; ancak tool runtime bununla uyumlu calissin.

KAYNAK:
- Desktop'ta hazirlanan migration paketi:
  - /Users/uygardogacozdemir/Desktop/monoAI/ai
  - /Users/uygardogacozdemir/Desktop/monoAI/docs/MIGRATION_PLAYBOOK.md

ZORUNLU KISITLAR:
1) Prompt/persona metinlerini kaynak projeden oldugu gibi kopyalama. Markaya uygun "monoAI" promptlarini sifirdan yaz.
2) Tool input validation, output size sinirlari, path safety kontrollerini koru.
3) "ask" davranisini runtime seviyesinde devre disi birak; permission mode non-interactive allow/bypass modunda calissin.
4) DeepSeek adapter zinciri tutarli olsun: model normalization -> client init -> retries/fallback -> telemetry.
5) Her adim sonunda calisan kod birak, derleme/test noktalarini raporla.

UYGULAMA PLANI (BUNU UYGULA):

FAZ 1 - DISCOVERY VE MAPPING
- Mevcut projede chatbot backend entrypointlerini bul.
- Tool call lifecycle nerde basliyor/nasil sonuclaniyor tespit et.
- Mevcut model provider katmanini (DeepSeek) incele.
- Kisa bir migration map cikart: "source dosya -> target dosya".

FAZ 2 - CORE TOOL RUNTIME ENTEGRASYONU
- Tool interface ve registryyi projeye adapte et.
- toolExecution pipeline'ini hedef proje mimarisine uyarlayip bagla.
- Permission context'i tenant security ile baglayip ask modalari olmadan allow-mode calistir.
- Minimal ama saglam bir "ToolRuntimeService" olustur (init, resolve, execute).

FAZ 3 - CAPABILITY TOOL SETI
- Sira ile su tool'lari entegre et:
  1) GeneratePdfTool
  2) FileReadTool
  3) FileWriteTool
  4) FileEditTool
  5) GlobTool
  6) GrepTool
  7) WebFetchTool
  8) WebSearchApiTool (veya mevcut web search abstractionina uygun varyant)
  9) MCPTool + ListMcpResourcesTool + ReadMcpResourceTool
- Her tool icin:
  - schema validasyonu
  - hata donusu formati
  - telemetry eventi
  - timeout/backpressure davranisi
  ekle.

FAZ 4 - PROMPT STACK
- monoAI icin yeni bir prompt composer yaz:
  - System section
  - Tool usage policy
  - Safety and non-hallucination policy
  - Web/research policy
  - Output style policy
- Marka disi ifadeleri temizle, dogrudan kaynak persona metni kopyalama.

FAZ 5 - MCP VE KONFIGURASYON
- MCP server config yukleme katmani ekle.
- En az 1 stdio veya HTTP MCP server ile smoke test yap.
- Auth gerekiyorsa graceful fail + log + user-friendly tool error formati ekle.

FAZ 6 - TEST + HARDENING
- Unit test: Tool registry, permission mode, en az 2 tool.
- Integration test: chat turn -> tool call -> result.
- Path traversal, invalid schema, timeout, MCP fail durumlarini test et.
- Finalde "what changed / risk / next steps" raporu ver.

TESLIMAT FORMATIN:
1) Degisen dosyalar listesi
2) Mimari notlar (kisa)
3) Test sonuclari
4) Kalan riskler
5) Istenirse sonraki iyilestirme backlog'u
```

---

## 2) PROMPT REWRITE PROMPT (monoAI promptlarini ayri yazdirmak icin)

```text
Mevcut projeye yeni bir "monoAI system prompt pack" yaz.

IHTIYAC:
- B2B ajans dashboard chatbotu.
- Kullanici is akislari: kreatif dokumanlar, approval/deny, planlama, sosyal medya operasyonu.
- AI bot yetenekli olmali: pdf/doc olusturma, web arastirma, dosya islemleri, MCP tabanli entegrasyonlar.

KISIT:
- Marka dili profesyonel, net, kisa.
- "as an AI" gibi ifadeler yok.
- Hallucination'a karsi: guncel ve dis dunya bilgileri icin once tool, sonra sentez.
- Tool kullanimi: uygun olan yerde dedicated tool; shell fallback son care.
- Gereksiz ask/approval mentionlari yok.

URET:
1) Base System Prompt
2) Tool Usage Policy Prompt
3) Research/Web Grounding Prompt
4) Error and Recovery Prompt
5) Concise Output Style Prompt
6) Safety/Compliance Prompt (tenant-aware, destructive actions mentionli ama chatbot pragmatizmine uygun)

Her promptu ayri baslikla ver, production'a direkt konabilecek sekilde final metin olarak yaz.
```

---

## 3) TOOL REGISTRY RECONCILIATION PROMPT

```text
Projede tool registry'yi tek kaynak haline getir.

HEDEF:
- Tool'lar daginik tanimlaniyorsa merkezde topla.
- Feature flag ve env bagimliliklarini netlestir.
- "enabled tools by tenant plan" mekanizmasi ekle.
- Kullanici mesajina gore tool secimi deterministic olsun.

YAP:
1) Mevcut registry yapisini cikar.
2) Yeni registry dosyasini olustur.
3) Tool metadata standardini ekle:
   - name
   - description
   - readOnly/destructive
   - timeout
   - maxResultSize
   - requiresExternalAccess
4) Unit test ekle.
```

---

## 4) MCP ENABLEMENT PROMPT

```text
Projede MCP entegrasyonunu production-ready hale getir.

YAP:
- MCP client lifecycle: init/connect/reconnect/disconnect
- Server config merge ve duplicate eliminasyonu
- Tool discovery ve dynamic registration
- Resource listing/reading
- Auth fail handling
- Telemetry (tool success/error/duration/server type)

CIKTI:
1) MCP architecture ozet
2) Degisen dosyalar
3) Smoke test adimlari
4) Bilinen riskler
```

---

## 5) QUICK VALIDATION PROMPT (en son)

```text
Bu migration'i bastan sona validate et.

CHECKLIST:
- Chatbot'tan PDF olusturma calisiyor mu?
- Dosya read/write/edit calisiyor mu?
- Glob/Grep ile arama calisiyor mu?
- Web fetch/search calisiyor mu?
- MCP list/read/call calisiyor mu?
- Hata durumlari user-friendly mi?
- Ask/approval akisi devre disi mi?
- Tenant security ile celisen bir nokta var mi?

Sonucu PASS/FAIL maddeleriyle raporla; fail maddeler icin net fix ver.
```
