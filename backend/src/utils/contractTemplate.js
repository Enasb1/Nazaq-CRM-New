// Renders the FULL registration contract as plain text, exactly as the student
// saw and signed it. Stored per-registration so the signed document is preserved
// even if the contract wording changes later. Wording synced to the owner's
// updated استمارة_تسجيل docx (Aug 2026).
function renderContractText({ full_name, id_number, phone, signed_name, signed_at_il }) {
  return `مركز الناصرة للتأهيل
استمارة تسجيل
برنامج «إكسبرس عالجامعة»

عزيزي الطالب / عزيزتي الطالبة،
نرحّب بك في مركز الناصرة للتأهيل، ويسعدنا انضمامك إلى برنامج «إكسبرس عالجامعة». نعتزّ بأن نكون شركاءك في بناء مستقبلك الأكاديمي. يُرجى قراءة التفاصيل التالية، بما فيها الشروط الأكاديمية والمالية، بتمعّن، ثم التوقيع في المكان المخصص.

1. تفاصيل التسجيل
اسم الطالب/ة الكامل: ${full_name || '—'}
رقم الهوية: ${id_number || '—'}
رقم الهاتف: ${phone || '—'}

2. نظرة عامة عن البرنامج
«إكسبرس عالجامعة» هو برنامج تأهيلي وأكاديمي يهدف إلى إعداد الطالب للقبول المباشر في جامعة حيفا للّقب متعدّد التخصّصات (תואר רב תחומי)، بدون امتحان البسيخومتري وبدون امتحان ياعيل.
- مدة البرنامج: ثلاثة فصول تعليمية.
- مكان التعليم: مركز الناصرة للتأهيل.
أهداف البرنامج ومكتسباته:
1) تأهيل الطالب للقبول الأكاديمي المباشر في جامعة حيفا، وإكسابه المهارات المطلوبة للّقب متعدد المجالات.
2) إمكانية الحصول على اعتراف أكاديمي بـ 30 نقطة استحقاق (נקודות זכות) ضمن اللقب الأول.
3) تقوية وتأسيس مكثّف في اللغتين العبرية والإنجليزية الأكاديميتين، لسدّ الفجوات ومنع التسرّب في السنة الأولى.
4) توجيه ومرافقة شخصية لاختيار التخصص الأنسب ضمن مسارات اللقب متعدد المجالات.

3. الرسوم وطريقة الدفع
رسوم التسجيل: 400 شيكل — تُدفع مرة واحدة عند التسجيل، غير قابلة للإرجاع، وغير مشمولة في رسوم السنة التعليمية.
رسوم السنة التعليمية:
- المقدمة: 3,000 شيكل — تُدفع دفعة واحدة (بدون تقسيط) قبل بدء التعليم، وحتى تاريخ 30.9
- باقي رسوم السنة: 12,000 شيكل — تُدفع عند بدء التعليم، مع إمكانية التقسيط حتى 6 دفعات.
- المجموع: 15,000 شيكل — رسوم السنة التعليمية الكاملة.
وسائل الدفع المتاحة: شيكات / بطاقة ائتمان / تحويل بنكي.

4. سياسة الإلغاء والاسترداد
بالتوقيع على هذه الاتفاقية، يقرّ الطالب بموافقته على الترتيبات المالية التالية في حال إلغاء التسجيل:
- في أي وقت: رسوم التسجيل (400 شيكل) غير قابلة للإرجاع في جميع الحالات.
- حتى 14 يوم عمل قبل بدء التعليم: تُرد المقدمة (3,000 شيكل) بالكامل.
- خلال الأسبوع الأول من التعليم: يدفع الطالب 20% من رسوم السنة التعليمية (من 15,000 شيكل)، ويُرد له الباقي.
- خلال الفصل الدراسي الأول: يدفع الطالب 60% من رسوم السنة التعليمية.
- بعد انتهاء الفصل الدراسي الأول: لا يحق للطالب استرداد أي مبلغ.
ملاحظة: يلتزم الطالب بتسديد الدفعة الأولى خلال 30 يومًا من تاريخ التسجيل، وبشرط أن يتم ذلك قبل 14 يوم عمل على الأقل من موعد افتتاح الدورة. في حال الإلغاء، لا تُسترد رسوم التسجيل.

5. توضيح أكاديمي
يعمل مركز الناصرة للتأهيل بشكل مستقل. يتم القبول في جامعة حيفا والاعتراف بالنقاط الأكاديمية وفق شروط الجامعة ومجلس التعليم العالي، وبشكل فردي لكل طالب.

6. الإقرار والتوقيع
أقرّ أنا الموقّع/ة أدناه بأن جميع البيانات الواردة أعلاه صحيحة، وبأنني اطّلعت على تفاصيل البرنامج وشروط الدفع وسياسة الإلغاء الموضّحة أعلاه، وأوافق عليها بالكامل.
توقيع الطالب/ة: ${signed_name || ''} (توقيع إلكتروني مرفق)
التاريخ: ${signed_at_il || ''}

مركز الناصرة للتأهيل · برنامج «إكسبرس عالجامعة»`;
}


// Renders the contract as a styled standalone HTML document — the SAME design the
// student signed on (logo, yellow bands, tables). Stored per-registration.
// Placeholders __ORIGIN__ and __SIGNATURE_IMG__ are filled at view time.
function esc(x) { return String(x || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function renderContractHtml({ full_name, id_number, phone, signed_name, signed_at_il }) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8"/>
<base href="__ORIGIN__/"/>
<title>استمارة تسجيل موقّعة — ${esc(full_name)}</title>
<style>
body{font-family:'Dubai','Segoe UI',system-ui,sans-serif;background:#fff;color:#1D1D1B;max-width:680px;margin:0 auto;padding:22px;line-height:1.65;}
.logo{display:block;width:74px;height:74px;margin:4px auto 8px;}
.center-name{text-align:center;font-weight:700;font-size:16px;}
h1{font-size:22px;text-align:center;margin:2px 0 8px;}
.band{background:#EEBE50;text-align:center;font-weight:700;font-size:14px;padding:7px;border-radius:8px;margin:8px 0 18px;}
h2{font-size:16px;border-bottom:2px solid #EEBE50;padding-bottom:4px;margin:20px 0 8px;}
.field{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed #E8E0C8;font-size:14px;}
table{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0;}
th{background:#EEBE50;padding:7px 8px;text-align:right;font-size:12px;}
td{padding:7px 8px;border-bottom:1px solid #E8E0C8;vertical-align:top;}
p,li{font-size:14px;} ul{padding-right:18px;} li{margin-bottom:4px;}
.note{font-size:12px;color:#777;margin-top:6px;}
.sigbox{border:1px solid #E8E0C8;border-radius:12px;padding:12px;text-align:center;margin-top:10px;background:#FFFBEE;}
.sigbox img{max-height:130px;max-width:100%;}
.footer{text-align:center;color:#777;font-size:11px;border-top:1px solid #EEBE50;padding:12px 0 4px;margin-top:18px;}
.noprint{text-align:center;margin-bottom:14px;}
@media print{.noprint{display:none;}body{padding:0;}}
</style></head><body>
<div class="noprint"><button onclick="window.print()" style="padding:10px 22px;font-size:14px;font-weight:700;background:#EEBE50;border:none;border-radius:8px;cursor:pointer;font-family:inherit">🖨 اطبع / احفظ PDF</button></div>
<img class="logo" src="/icons/icon-192.png" alt="NazAQ"/>
<div class="center-name">مركز الناصرة للتأهيل</div>
<h1>استمارة تسجيل</h1>
<div class="band">برنامج «إكسبرس عالجامعة»</div>

<p>عزيزي الطالب / عزيزتي الطالبة،<br/>نرحّب بك في مركز الناصرة للتأهيل، ويسعدنا انضمامك إلى برنامج «إكسبرس عالجامعة». نعتزّ بأن نكون شركاءك في بناء مستقبلك الأكاديمي.</p>

<h2>1. تفاصيل التسجيل</h2>
<div class="field"><b>اسم الطالب/ة الكامل:</b><span>${esc(full_name) || '—'}</span></div>
<div class="field"><b>رقم الهوية:</b><span dir="ltr">${esc(id_number) || '—'}</span></div>
<div class="field"><b>رقم الهاتف:</b><span dir="ltr">${esc(phone) || '—'}</span></div>

<h2>2. نظرة عامة عن البرنامج</h2>
<p>«إكسبرس عالجامعة» هو برنامج تأهيلي وأكاديمي يهدف إلى إعداد الطالب للقبول المباشر في جامعة حيفا للّقب متعدّد التخصّصات (תואר רב תחומי)، بدون امتحان البسيخومتري وبدون امتحان ياعيل.</p>
<ul><li>مدة البرنامج: ثلاثة فصول تعليمية.</li><li>مكان التعليم: مركز الناصرة للتأهيل.</li></ul>
<p><b>أهداف البرنامج ومكتسباته:</b></p>
<ul>
<li>تأهيل الطالب للقبول الأكاديمي المباشر في جامعة حيفا، وإكسابه المهارات المطلوبة للّقب متعدد المجالات.</li>
<li>إمكانية الحصول على اعتراف أكاديمي بـ 30 نقطة استحقاق (נקודות זכות) ضمن اللقب الأول.</li>
<li>تقوية وتأسيس مكثّف في اللغتين العبرية والإنجليزية الأكاديميتين، لسدّ الفجوات ومنع التسرّب في السنة الأولى.</li>
<li>توجيه ومرافقة شخصية لاختيار التخصص الأنسب ضمن مسارات اللقب متعدد المجالات.</li>
</ul>

<h2>3. الرسوم وطريقة الدفع</h2>
<p><b>رسوم التسجيل: 400 شيكل</b> — تُدفع مرة واحدة عند التسجيل، غير قابلة للإرجاع، وغير مشمولة في رسوم السنة التعليمية.</p>
<table>
<tr><th>البند</th><th>المبلغ</th><th>ملاحظات</th></tr>
<tr><td><b>المقدمة</b></td><td>3,000 شيكل</td><td>تُدفع دفعة واحدة (بدون تقسيط) قبل بدء التعليم، وحتى تاريخ 30.9</td></tr>
<tr><td><b>باقي رسوم السنة</b></td><td>12,000 شيكل</td><td>تُدفع عند بدء التعليم، مع إمكانية التقسيط حتى 6 دفعات.</td></tr>
<tr><td><b>المجموع</b></td><td><b>15,000 شيكل</b></td><td>رسوم السنة التعليمية الكاملة.</td></tr>
</table>
<p><b>وسائل الدفع المتاحة:</b> شيكات / بطاقة ائتمان / تحويل بنكي.</p>

<h2>4. سياسة الإلغاء والاسترداد</h2>
<table>
<tr><th>موعد الإلغاء</th><th>الترتيبات المالية</th></tr>
<tr><td><b>في أي وقت</b></td><td>رسوم التسجيل (400 شيكل) غير قابلة للإرجاع في جميع الحالات.</td></tr>
<tr><td><b>حتى 14 يوم عمل قبل بدء التعليم</b></td><td>تُرد المقدمة (3,000 شيكل) بالكامل.</td></tr>
<tr><td><b>خلال الأسبوع الأول من التعليم</b></td><td>يدفع الطالب 20% من رسوم السنة التعليمية (من 15,000 شيكل)، ويُرد له الباقي.</td></tr>
<tr><td><b>خلال الفصل الدراسي الأول</b></td><td>يدفع الطالب 60% من رسوم السنة التعليمية.</td></tr>
<tr><td><b>بعد انتهاء الفصل الدراسي الأول</b></td><td>لا يحق للطالب استرداد أي مبلغ.</td></tr>
</table>
<p class="note">ملاحظة: يلتزم الطالب بتسديد الدفعة الأولى خلال 30 يومًا من تاريخ التسجيل، وبشرط أن يتم ذلك قبل 14 يوم عمل على الأقل من موعد افتتاح الدورة. في حال الإلغاء، لا تُسترد رسوم التسجيل.</p>

<h2>5. توضيح أكاديمي</h2>
<p>يعمل مركز الناصرة للتأهيل بشكل مستقل. يتم القبول في جامعة حيفا والاعتراف بالنقاط الأكاديمية وفق شروط الجامعة ومجلس التعليم العالي، وبشكل فردي لكل طالب.</p>

<h2>6. الإقرار والتوقيع</h2>
<p>أقرّ أنا الموقّع/ة أدناه بأن جميع البيانات الواردة أعلاه صحيحة، وبأنني اطّلعت على تفاصيل البرنامج وشروط الدفع وسياسة الإلغاء الموضّحة أعلاه، وأوافق عليها بالكامل.</p>
<div class="sigbox">
  <div style="font-weight:700;margin-bottom:6px">توقيع الطالب/ة: ${esc(signed_name)}</div>
  <img src="__SIGNATURE_IMG__" alt="التوقيع"/>
  <div class="note">التاريخ والوقت: ${esc(signed_at_il)} · توقيع إلكتروني</div>
</div>

<div class="footer">مركز الناصرة للتأهيل · برنامج «إكسبرس عالجامعة»</div>
</body></html>`;
}

module.exports = { renderContractText, renderContractHtml };
