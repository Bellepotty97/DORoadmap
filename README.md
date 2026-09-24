# Digital Organization Roadmap

PRECISE Corporate Group — **แผนกลยุทธ์ระยะที่ 2 › Subsystems Functions 4**
Digital Organization to Agentic Transformation

เอกสารกลยุทธ์แบบ interactive HTML — ไม่มี build step เปิดด้วยเบราว์เซอร์ได้ทันที

---

## โครงสร้าง

```
.
├── digital-organization.html     # ฉบับเดิม — 5Ps Pyramid 7 Layers + PF Modals
├── digital-organization-r8.html  # ฉบับปรับปรุง R.8 — Odoo / PMIS-II Roadmap
├── index.html                    # redirect ไป digital-organization.html (สำหรับ URL ราก)
├── edit-mode.js                  # โหมดแก้ไขข้อความในหน้า (ใช้ร่วมกันทั้งสองหน้า)
├── assets/                       # รูปประกอบ 7 ไฟล์
├── .nojekyll                     # ปิด Jekyll processing บน GitHub Pages
└── README.md
```

สองฉบับลิงก์หากันผ่านปุ่มบนแถบนำทาง:
`ฉบับเดิม —[R.8 ดูฉบับปรับปรุง ↗]→ R.8` และ `R.8 —[← ฉบับเดิม]→ ฉบับเดิม`

## การเปิดใช้งาน

เปิด `digital-organization.html` ด้วยเบราว์เซอร์ได้เลย — ทดสอบแล้วทั้ง `file://` และผ่าน HTTP server

```bash
npx http-server -p 8080
# เปิด http://127.0.0.1:8080/   (index.html จะ redirect ให้เอง)
```

### GitHub Pages

`Settings → Pages → Source: Deploy from a branch` แล้วเลือก branch นี้ + `/ (root)`

URL ราก (`https://<user>.github.io/DORoadmap/`) จะ redirect ไปหน้าจริงอัตโนมัติ

---

## โหมดแก้ไขข้อความ (`edit-mode.js`)

ทั้งสองหน้ามีปุ่ม **✏️ แก้ไขข้อความ** ลอยอยู่มุมขวาล่าง

1. กดปุ่ม → ทุกข้อความในหน้าขึ้นกรอบประ คลิกแล้วพิมพ์ทับได้เลย
2. กด **💾 บันทึกเป็นไฟล์** → ได้ไฟล์ HTML ใหม่ที่มีข้อความที่แก้แล้ว
3. เอาไฟล์นั้นวางทับใน repo (มีปุ่มพาไปหน้าอัปโหลดของ GitHub ให้)

> ⚠️ **กดบันทึกแล้วหน้าเว็บจริงยังไม่เปลี่ยน**
> GitHub Pages เป็น static hosting ไม่มี backend ให้เขียนไฟล์กลับ และการฝัง
> GitHub token ไว้ในหน้าเพื่อ commit เองคือการเปิดเผย credential บน repo
> สาธารณะ จึงใช้วิธีดาวน์โหลดไฟล์แล้ว commit แทน

รายละเอียดการทำงาน:

- แก้ได้เฉพาะ element ที่เป็น**ใบสุดท้ายของข้อความ** (ไม่มี block element ซ้อนข้างใน)
  เพื่อกันการลบโครงสร้างหน้าเสียหายโดยไม่ตั้งใจ — รูปและ SVG ไม่ถูกแตะ
- ไฟล์ที่ได้**สะอาด** — ถอด `contenteditable`, แถบเครื่องมือ และ CSS ของโหมดแก้ไขออกหมด
  แต่ยังมี `edit-mode.js` ติดไป จึงแก้ต่อได้เรื่อยๆ
- มี `beforeunload` เตือนถ้าปิดหน้าทั้งที่ยังไม่บันทึก
- ปุ่ม **↩ เลิกทำทั้งหมด** ย้อนกลับเป็นข้อความเดิมได้
- ถ้าไม่อยากให้คนทั่วไปเห็นปุ่ม → ตั้ง `SHOW_ALWAYS = false` ใน `edit-mode.js`
  ปุ่มจะโผล่เฉพาะตอนเปิด URL แบบ `?edit=1`

---

## เนื้อหาในหน้า

### 5Ps Pyramid — 7 Layers

| Layer | ระดับ | เนื้อหา |
|---|---|---|
| 1 | Objective | Digital Organization to Agentic Transformation |
| 2 | Project Functions | PF1–PF4 (คลิกได้ → เปิด Document/Roadmap) |
| 3 | Major Systems Functions | MS1.1 – MS4.2 |
| 4 | Subsystems | SS1.1 – SS4.3 |
| 5 | Sub-Subsystems Functions | SSS รายการย่อย |
| 6 | Tasks Functions | T1.1 – T4.5 |
| 7 | Work Packages Functions | WP1.1 – WP4.5 |

### 4 Project Functions (คลิกเพื่อเปิด modal)

| | หัวข้อ | เนื้อหาใน modal |
|---|---|---|
| **PF1** | Digital Business Process & Operations | WBS Master 2569–2572 (PCF 13 Categories) |
| **PF2** | Digital Technology & Platform Ecosystem | Factory 4.0 — 3 slides (Overview / 4 แกนหลัก + Roadmap / Business Impact) |
| **PF3** | Digital Infrastructure | Decision Level Paradigm + Infrastructure Roadmap 4 Phase |
| **PF4** | Intellectual Capital & Agentic Transformation | แผน 3 ระยะ Digital → Full Agentic + กลยุทธ์ 4 แนวทาง |

---

## Assets

| ไฟล์ | ใช้ที่ | เนื้อหา |
|---|---|---|
| `do-digital-vs-agentic.jpg` | Objective → Agentic Organization | เปรียบเทียบ Digital Org (Present) vs Full Agentic Org (Future) |
| `pf1-wbs-master.jpg` | PF1 | WBS Master — Digital Business Process & Operations 2569–2572 |
| `pf2-factory40-slide-a.jpg` | PF2 Tab 1 | Factory 4.0 Overview |
| `pf2-factory40-slide-b.jpg` | PF2 Tab 2 | 4 แกนหลัก (ERP / DBTP-EMS / DE-Factory 4.0 / ICT) + Roadmap 4 ปี |
| `pf2-factory40-slide-c.jpg` | PF2 Tab 3 | Business Impact — 15% Labor / +30% GP / 100% Real-time |
| `pf3-decision-paradigm.png` | PF3 Slide 1 | The Decision Level Paradigm |
| `pf3-infra-roadmap.png` | PF3 Slide 2 | Digital Infrastructure Roadmap — 4 Phase |

---

## บันทึกการจัดโครงสร้างไฟล์

หน้านี้เดิมถูก **ฝังเป็น base64 บรรทัดเดียวขนาด 6.05 MB** (`var _dorgB64 = "..."`)
อยู่ใน `index.html` ของเอกสารกลยุทธ์ชุดใหญ่ ซึ่งทำให้ไฟล์นั้นบวมเป็น 7.28 MB
และ git diff อ่านไม่ได้เลย

การแยกออกมาเป็น repo นี้:

| | ก่อน | หลัง |
|---|---|---|
| หน้า Digital Organization | base64 ใน HTML 6.05 MB | `digital-organization.html` **71 KB** |
| รูป 7 ไฟล์ | data URI | `assets/` 3.19 MB |

### การต่อกลับเข้าเอกสารหลัก

ถ้าจะฝังหน้านี้กลับเข้า `index.html` ให้ใช้ iframe แบบ path ตรง แทนการ decode base64:

```js
document.getElementById("dorg-frame").src = "./digital-organization.html";
```

หน้านี้จะส่ง `postMessage('closeDorg')` กลับไปหา parent เมื่อกดปุ่ม "← กลับหน้าหลัก"
(ปุ่มจะซ่อนอัตโนมัติเมื่อเปิดหน้านี้เดี่ยวๆ)

---

## Known Issues

รายการจากการรีวิว — ยังไม่ได้แก้ในคอมมิตนี้ เพื่อให้ diff มีแต่การแยกไฟล์ล้วนๆ

### ตัวเลขหัวข้อไม่ตรงกับจำนวนจริง

| จุด | เขียนว่า | นับจริง |
|---|---|---|
| Layer 3 header | 14 Systems | **11** (MS1.1–MS4.2) |
| Layer 5 header | 16 Components | **19** |

### อื่นๆ

- `SS3.1 Network Segmentation` และ `SS3.2 Cloud Services` มีบรรทัด `IaaS for ERP hosting` **ซ้ำกัน**
- ขอบเขตทับซ้อน: `MS2.1 Cloud & Data Architecture` (PF2) กับ `MS3.2 Data Center & Cloud` (PF3) ไม่ชัดว่าใครเป็นเจ้าของ
- **ไม่มี `@media` query เลย** — layout 3 คอลัมน์ fixed (`210px 1fr 230px`) พังบน tablet/มือถือ
- Layer 4–7 คลิกไม่ได้ (ไม่มี onclick) ทั้งที่ Layer 2 คลิกได้ → ผู้ใช้จะพยายามคลิก
- Dead reference: กล่อง `do-fallback` ชี้ไปไฟล์ `Digital_Organization_Agentic.png`
  ในโฟลเดอร์ `Strategic PCC 4 Phase/` ที่ไม่มีอยู่
- Timeline ไม่สอดคล้องกัน — PF1/PF2 ใช้ปี พ.ศ. (2569–2572), PF3 ใช้ Phase 1–4 ไม่มีปีกำกับ,
  PF4 ใช้ "ปีที่ 1–3" แบบ relative → map เข้าหากันไม่ได้
- KPI ทุกตัว (99.99% Uptime, 20% OEE, +30% GP, 15% Labor) ไม่มี baseline ปัจจุบัน
  วิธีวัด และผู้รับผิดชอบ
- ยังไม่มี Investment / ROI / Risk Register / Critical Path ในเอกสาร

### เนื้อหาที่ยังขาด

**DBA Roadmap 2026–2029 (Yearly Milestones + KPI รายปี)** ที่อยู่ในเอกสารหลัก
ยังไม่ถูกนำมารวมในหน้านี้ — เป็นเนื้อหาที่ควรเพิ่มเข้ามา
