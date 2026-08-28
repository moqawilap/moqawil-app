export type OmanWilayat = {
  name: string;
  nameAr: string;
};

export type OmanGovernorate = {
  name: string;
  nameAr: string;
  wilayats: OmanWilayat[];
};

export const omanGovernorates: OmanGovernorate[] = [
  {
    name: 'Muscat',
    nameAr: 'مسقط',
    wilayats: [
      { name: 'Muscat', nameAr: 'مسقط' },
      { name: 'Muttrah', nameAr: 'مطرح' },
      { name: 'Bawshar', nameAr: 'بوشر' },
      { name: 'Al Seeb', nameAr: 'السيب' },
      { name: 'Al Amarat', nameAr: 'العامرات' },
      { name: 'Qurayyat', nameAr: 'قريات' },
    ],
  },
  {
    name: 'Dhofar',
    nameAr: 'ظفار',
    wilayats: [
      { name: 'Salalah', nameAr: 'صلالة' },
      { name: 'Taqah', nameAr: 'طاقة' },
      { name: 'Mirbat', nameAr: 'مرباط' },
      { name: 'Thumrait', nameAr: 'ثمريت' },
      { name: 'Muqshin', nameAr: 'مقشن' },
      { name: 'Rakhyut', nameAr: 'رخيوت' },
      { name: 'Dalkut', nameAr: 'ضلكوت' },
      { name: 'Shalim and the Hallaniyat Islands', nameAr: 'شليم وجزر الحلانيات' },
      { name: 'Al Mazyunah', nameAr: 'المزيونة' },
      { name: 'Sadah', nameAr: 'سدح' },
    ],
  },
  {
    name: 'Musandam',
    nameAr: 'مسندم',
    wilayats: [
      { name: 'Khasab', nameAr: 'خصب' },
      { name: 'Bukha', nameAr: 'بخاء' },
      { name: 'Dibba', nameAr: 'دباء' },
      { name: 'Madha', nameAr: 'مدحاء' },
    ],
  },
  {
    name: 'Al Buraimi',
    nameAr: 'البريمي',
    wilayats: [
      { name: 'Al Buraimi', nameAr: 'البريمي' },
      { name: 'Mahdah', nameAr: 'محضة' },
      { name: 'Al Sinainah', nameAr: 'السنينة' },
    ],
  },
  {
    name: 'Ad Dakhiliyah',
    nameAr: 'الداخلية',
    wilayats: [
      { name: 'Nizwa', nameAr: 'نزوى' },
      { name: 'Bahla', nameAr: 'بهلاء' },
      { name: 'Manah', nameAr: 'منح' },
      { name: 'Al Hamra', nameAr: 'الحمراء' },
      { name: 'Adam', nameAr: 'أدم' },
      { name: 'Izki', nameAr: 'إزكي' },
      { name: 'Samail', nameAr: 'سمائل' },
      { name: 'Bidbid', nameAr: 'بدبد' },
    ],
  },
  {
    name: 'North Al Batinah',
    nameAr: 'شمال الباطنة',
    wilayats: [
      { name: 'Sohar', nameAr: 'صحار' },
      { name: 'Shinas', nameAr: 'شناص' },
      { name: 'Liwa', nameAr: 'لوى' },
      { name: 'Saham', nameAr: 'صحم' },
      { name: 'Al Khaburah', nameAr: 'الخابورة' },
      { name: 'Al Suwaiq', nameAr: 'السويق' },
    ],
  },
  {
    name: 'South Al Batinah',
    nameAr: 'جنوب الباطنة',
    wilayats: [
      { name: 'Rustaq', nameAr: 'الرستاق' },
      { name: 'Al Awabi', nameAr: 'العوابي' },
      { name: 'Nakhal', nameAr: 'نخل' },
      { name: 'Wadi Al Maawil', nameAr: 'وادي المعاول' },
      { name: 'Barka', nameAr: 'بركاء' },
      { name: 'Al Musannah', nameAr: 'المصنعة' },
    ],
  },
  {
    name: 'North Ash Sharqiyah',
    nameAr: 'شمال الشرقية',
    wilayats: [
      { name: 'Ibra', nameAr: 'إبراء' },
      { name: 'Al Mudhaibi', nameAr: 'المضيبي' },
      { name: 'Bidiyah', nameAr: 'بدية' },
      { name: 'Al Qabil', nameAr: 'القابل' },
      { name: 'Wadi Bani Khalid', nameAr: 'وادي بني خالد' },
      { name: 'Dima wa At Taaiyin', nameAr: 'دماء والطائيين' },
    ],
  },
  {
    name: 'South Ash Sharqiyah',
    nameAr: 'جنوب الشرقية',
    wilayats: [
      { name: 'Sur', nameAr: 'صور' },
      { name: 'Jalan Bani Bu Hassan', nameAr: 'جعلان بني بو حسن' },
      { name: 'Jalan Bani Bu Ali', nameAr: 'جعلان بني بو علي' },
      { name: 'Al Kamil wal Wafi', nameAr: 'الكامل والوافي' },
      { name: 'Masirah', nameAr: 'مصيرة' },
    ],
  },
  {
    name: 'Ad Dhahirah',
    nameAr: 'الظاهرة',
    wilayats: [
      { name: 'Ibri', nameAr: 'عبري' },
      { name: 'Yanqul', nameAr: 'ينقل' },
      { name: 'Dhank', nameAr: 'ضنك' },
    ],
  },
  {
    name: 'Al Wusta',
    nameAr: 'الوسطى',
    wilayats: [
      { name: 'Haima', nameAr: 'هيماء' },
      { name: 'Mahout', nameAr: 'محوت' },
      { name: 'Duqm', nameAr: 'الدقم' },
      { name: 'Al Jazir', nameAr: 'الجازر' },
    ],
  },
];