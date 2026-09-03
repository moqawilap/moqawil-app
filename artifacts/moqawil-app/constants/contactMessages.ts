export type ContactCategory = 'property' | 'workshop' | 'design' | 'maintenance' | 'contractor';

const arabicMessageLine: Record<ContactCategory, (name: string) => string> = {
  property: (name) => `أتواصل معكم عبر تطبيق «مقاول» بخصوص العقار المعروض «${name}»، وأرغب في معرفة السعر والتفاصيل وترتيب موعد للمعاينة.`,
  workshop: (name) => `أتواصل معكم عبر تطبيق «مقاول» بخصوص خدمات الورشة «${name}»، وأرغب في معرفة الخدمات المتاحة والتكلفة والمدة المتوقعة.`,
  design: (name) => `أتواصل معكم عبر تطبيق «مقاول» بخصوص خدمات التصميم لدى «${name}»، وأرغب في معرفة الخدمات المتاحة والتكلفة ومدة تنفيذ المشروع.`,
  maintenance: (name) => `أتواصل معكم عبر تطبيق «مقاول» بخصوص خدمة الصيانة المقدمة من «${name}»، وأرغب في معرفة إمكانية الخدمة والتكلفة وأقرب موعد متاح.`,
  contractor: (name) => `أتواصل معكم عبر تطبيق «مقاول» بخصوص خدمات المقاولات المقدمة من «${name}»، وأرغب في معرفة نطاق الخدمات والتكلفة ومدة تنفيذ المشروع.`,
};

const englishMessageLine: Record<ContactCategory, (name: string) => string> = {
  property: (name) => `I found you through the Moqawil app regarding the listed property “${name}”. I would like to know the price and details and arrange a viewing.`,
  workshop: (name) => `I found you through the Moqawil app regarding the services at “${name}”. I would like to know the available services, cost, and expected timeframe.`,
  design: (name) => `I found you through the Moqawil app regarding the design services at “${name}”. I would like to know the available services, cost, and project timeframe.`,
  maintenance: (name) => `I found you through the Moqawil app regarding the maintenance service offered by “${name}”. I would like to know the availability, cost, and earliest appointment.`,
  contractor: (name) => `I found you through the Moqawil app regarding the contracting services offered by “${name}”. I would like to know the scope, cost, and project timeframe.`,
};

function getPageUrl(path: string) {
  const domain = process.env.EXPO_PUBLIC_DOMAIN?.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return domain
    ? `https://${domain}${path}`
    : `moqawil-app://${path.replace(/^\/+/, '')}`;
}

export function getListingUrl(listingId: string) {
  return getPageUrl(`/listing/${encodeURIComponent(listingId)}`);
}

export function getProviderUrl(providerId: string) {
  return getPageUrl(`/provider/${encodeURIComponent(providerId)}`);
}

export function getContactMessage(category: ContactCategory, subjectName: string, isArabic: boolean, subjectUrl?: string) {
  const name = subjectName.trim();
  const linkLine = subjectUrl ? (isArabic ? `رابط الصفحة: ${subjectUrl}` : `Page link: ${subjectUrl}`) : null;
  if (isArabic) {
    return [
      'السلام عليكم ورحمة الله وبركاته،',
      'حياكم الله،',
      '',
      arabicMessageLine[category](name),
      '',
      'أتمنى تزويدي بالتفاصيل المتاحة، وشكرًا لكم.',
      ...(linkLine ? ['', linkLine] : []),
    ].join('\n');
  }
  return [
    'Hello,',
    '',
    englishMessageLine[category](name),
    '',
    'Please share the available information and details. Thank you.',
    ...(linkLine ? ['', linkLine] : []),
  ].join('\n');
}

export function getWhatsAppUrl(phone: string, message: string) {
  const normalizedPhone = phone.replace(/\D/g, '');
  return normalizedPhone ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}` : null;
}
