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
  imageUrls?: ImageSourcePropType[];
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
  imageUrls?: ImageSourcePropType[];
  phone?: string;
  featured?: boolean;
  rating?: number;
  createdAt?: string;
  updatedAt?: string;
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
    imageUrls: listing.imageUrls.map((uri) => ({ uri })),
    phone: listing.contactPhone ?? undefined,
    rating: listing.rating,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
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

export const providers: Provider[] = [];

export const listings: Listing[] = [];

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