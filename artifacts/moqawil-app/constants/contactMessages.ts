export type ContactCategory = 'property' | 'workshop' | 'design' | 'maintenance' | 'contractor';

const arabicSubjectLine: Record<ContactCategory, (name: string) => string> = {
  property: (name) => `العقار المعروض «${name}»`,
  workshop: (name) => `خدمات الورشة «${name}»`,
  design: (name) => `خدمات التصميم لدى «${name}»`,
  maintenance: (name) => `خدمة الصيانة المقدمة من «${name}»`,
  contractor: (name) => `خدمات المقاولات المقدمة من «${name}»`,
};

const englishSubjectLine: Record<ContactCategory, (name: string) => string> = {
  property: (name) => `the listed property “${name}”`,
  workshop: (name) => `the workshop services offered by “${name}”`,
  design: (name) => `the design services offered by “${name}”`,
  maintenance: (name) => `the maintenance service offered by “${name}”`,
  contractor: (name) => `the contracting services offered by “${name}”`,
};

export function getContactMessage(category: ContactCategory, subjectName: string, isArabic: boolean) {
  const name = subjectName.trim();
  if (isArabic) {
    return [
      'السلام عليكم ورحمة الله وبركاته،',
      'حياكم الله،',
      '',
      `تواصلت معكم عبر تطبيق «مقاول» بخصوص ${arabicSubjectLine[category](name)}، وأرغب في معرفة المزيد من المعلومات والتفاصيل.`,
      '',
      'أتمنى تزويدي بالتفاصيل المتاحة، وشكرًا لكم.',
    ].join('\n');
  }
  return [
    'Hello,',
    '',
    `I found you through the Moqawil app and would like to learn more about ${englishSubjectLine[category](name)}.`,
    '',
    'Please share the available information and details. Thank you.',
  ].join('\n');
}

export function getWhatsAppUrl(phone: string, message: string) {
  const normalizedPhone = phone.replace(/\D/g, '');
  return normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}` : null;
}
