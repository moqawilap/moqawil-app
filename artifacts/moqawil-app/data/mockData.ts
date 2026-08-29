import type { ImageSourcePropType } from 'react-native';
import type { MarketplaceListing } from '@workspace/api-client-react';

export type ServiceId = 'contractors' | 'consultants' | 'design' | 'building' | 'real-estate' | 'maintenance';

export type Provider = {
  id: string;
  role: 'contractor' | 'consultant' | 'maintenance';
  name: string;
  nameAr: string;
  specialty: string;
  specialtyAr: string;
  rating: number;
  reviews: number;
  distance: string;
  city: string;
  wilayat?: string;
  buildingServices?: string[];
  verified: boolean;
  image: ImageSourcePropType;
  accent: string;
  description: string;
  descriptionAr: string;
  projects: number;
  startingPrice: string;
  contractAmount: string;
  priceOmaniRial?: number | null;
  createdAt?: string;
  phone: string;
};

export type Listing = {
  id: string;
  title: string;
  titleAr: string;
  type: 'For sale' | 'For rent';
  typeAr: string;
  price: string;
  location: string;
  locationAr: string;
  beds: number;
  baths: number;
  area: string;
  image: ImageSourcePropType;
  phone?: string;
  featured?: boolean;
  rating?: number;
  createdAt?: string;
};

export function marketplaceListingToLocal(listing: MarketplaceListing): Listing {
  return {
    id: listing.id,
    title: listing.title,
    titleAr: listing.titleArabic,
    type: listing.type === 'rent' ? 'For rent' : 'For sale',
    typeAr: listing.type === 'rent' ? 'للإيجار' : 'للبيع',
    price: listing.price,
    location: listing.location,
    locationAr: listing.locationArabic,
    beds: listing.bedrooms,
    baths: listing.bathrooms,
    area: listing.area,
    image: listing.imageUrl ? { uri: listing.imageUrl } : images.interior,
    phone: listing.contactPhone ?? undefined,
    rating: listing.rating,
    createdAt: listing.createdAt,
  };
}

export const images = {
  villa: require('@/assets/images/muscat-villa.jpg'),
  contractor: require('@/assets/images/contractor-project.jpg'),
  interior: require('@/assets/images/living-room.jpg'),
};

export const serviceItems: Array<{
  id: ServiceId;
  label: string;
  labelAr: string;
  subtitle: string;
  subtitleAr: string;
  icon: 'hard-hat' | 'compass' | 'home' | 'tool' | 'sparkles';
  color: string;
}> = [
  {
    id: 'contractors',
    label: 'Contractors',
    labelAr: 'المقاولون',
    subtitle: 'Build with confidence',
    subtitleAr: 'ابنِ بثقة',
    icon: 'hard-hat',
    color: '#1E5674',
  },
  {
    id: 'consultants',
    label: 'Consultants',
    labelAr: 'الاستشاريون',
    subtitle: 'Plan it right',
    subtitleAr: 'خطّط بشكل صحيح',
    icon: 'compass',
    color: '#2B7774',
  },
  {
    id: 'design',
    label: 'Design',
    labelAr: 'التصميم',
    subtitle: 'Shape your vision',
    subtitleAr: 'حوّل فكرتك إلى تصميم',
    icon: 'sparkles',
    color: '#8A5A83',
  },
  {
    id: 'building',
    label: 'Building workshops',
    labelAr: 'البناء والورش',
    subtitle: 'Find the right craft',
    subtitleAr: 'اختر ورشتك المناسبة',
    icon: 'hard-hat',
    color: '#A87545',
  },
  {
    id: 'real-estate',
    label: 'Real estate',
    labelAr: 'العقارات',
    subtitle: 'Find your place',
    subtitleAr: 'اعثر على مكانك',
    icon: 'home',
    color: '#7B6451',
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    labelAr: 'الصيانة',
    subtitle: 'Fix it fast',
    subtitleAr: 'أصلحها بسرعة',
    icon: 'tool',
    color: '#566D68',
  },
];

export const providers: Provider[] = [
  {
    id: 'al-burj-builders',
    role: 'contractor',
    name: 'Al Burj Builders',
    nameAr: 'البـرج للمقاولات',
    specialty: 'General contracting',
    specialtyAr: 'مقاولات عامة',
    rating: 4.9,
    reviews: 86,
    distance: '2.4 km',
    city: 'Muscat',
    wilayat: 'Bawshar',
    buildingServices: ['General contracting', 'Home and villa construction'],
    verified: true,
    image: images.contractor,
    accent: '#0F6FB7',
    description: 'A trusted Muscat team for residential builds, renovations, and finishing work.',
    descriptionAr: 'فريق موثوق في مسقط للبناء السكني والتجديد وأعمال التشطيب.',
    projects: 34,
    startingPrice: 'From OMR 1,800',
    contractAmount: 'OMR 42,000',
    phone: '+968 7722 4535',
  },
  {
    id: 'vista-engineering',
    role: 'consultant',
    name: 'Vista Engineering',
    nameAr: 'فيستا للاستشارات الهندسية',
    specialty: 'Structural & design',
    specialtyAr: 'تصميم وإنشاءات',
    rating: 4.8,
    reviews: 54,
    distance: '4.1 km',
    city: 'Muscat',
    wilayat: 'Muscat',
    verified: true,
    image: images.interior,
    accent: '#0B9B8C',
    description: 'Certified engineers helping you turn a property idea into a buildable plan.',
    descriptionAr: 'مهندسون معتمدون يساعدونك على تحويل فكرة العقار إلى مخطط قابل للتنفيذ.',
    projects: 21,
    startingPrice: 'From OMR 120',
    contractAmount: 'OMR 8,500',
    phone: '+968 7722 4535',
  },
  {
    id: 'dar-al-nour',
    role: 'maintenance',
    name: 'Dar Al Nour Services',
    nameAr: 'دار النور للخدمات',
    specialty: 'Home maintenance',
    specialtyAr: 'صيانة منزلية',
    rating: 4.7,
    reviews: 112,
    distance: '5.7 km',
    city: 'Muscat',
    wilayat: 'Al Seeb',
    verified: true,
    image: images.villa,
    accent: '#7D62BE',
    description: 'Fast, dependable help for electrical, plumbing, AC, and home care needs.',
    descriptionAr: 'خدمة سريعة وموثوقة للكهرباء والسباكة والتكييف والعناية بالمنزل.',
    projects: 148,
    startingPrice: 'From OMR 15',
    contractAmount: 'OMR 1,200',
    phone: '+968 7722 4535',
  },
];

export const listings: Listing[] = [
  {
    id: 'al-mouj-townhouse',
    title: 'Light-filled townhouse',
    titleAr: 'منزل تاون هاوس مشرق',
    type: 'For sale',
    typeAr: 'للبيع',
    price: 'OMR 168,000',
    location: 'Al Mouj, Muscat',
    locationAr: 'الموج، مسقط',
    beds: 3,
    baths: 4,
    area: '248 m²',
    image: images.interior,
    featured: true,
  },
  {
    id: 'bosher-villa',
    title: 'Contemporary family villa',
    titleAr: 'فيلا عائلية عصرية',
    type: 'For sale',
    typeAr: 'للبيع',
    price: 'OMR 225,000',
    location: 'Bawshar, Muscat',
    locationAr: 'بوشر، مسقط',
    beds: 5,
    baths: 6,
    area: '420 m²',
    image: images.villa,
  },
  {
    id: 'qurum-apartment',
    title: 'Sea-view apartment',
    titleAr: 'شقة بإطلالة بحرية',
    type: 'For rent',
    typeAr: 'للإيجار',
    price: 'OMR 850 / month',
    location: 'Qurum, Muscat',
    locationAr: 'القرم، مسقط',
    beds: 2,
    baths: 3,
    area: '126 m²',
    image: images.interior,
  },
];

export function mergeMarketplaceListings(remote?: MarketplaceListing[]) {
  const remoteListings = (remote ?? []).map(marketplaceListingToLocal);
  const remoteIds = new Set(remoteListings.map((listing) => listing.id));
  return [...remoteListings, ...listings.filter((listing) => !remoteIds.has(listing.id))];
}

export const maintenanceItems = [
  { id: 'electrical', label: 'Electrical', labelAr: 'كهرباء', icon: 'zap' as const, color: '#E79A4B' },
  { id: 'plumbing', label: 'Plumbing', labelAr: 'سباكة', icon: 'droplet' as const, color: '#418FBA' },
  { id: 'ac', label: 'Air conditioning', labelAr: 'تكييف', icon: 'wind' as const, color: '#6D79C6' },
  { id: 'cleaning', label: 'Cleaning', labelAr: 'تنظيف', icon: 'sparkles' as const, color: '#53A77D' },
];