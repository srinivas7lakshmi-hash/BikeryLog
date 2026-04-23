export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  username?: string;
  phoneNumber?: string;
  age?: number;
  bio?: string;
  location?: string;
  photoURL?: string;
  customSoundURL?: string;
  drivingLicenseUrl?: string;
  rcBookUrl?: string;
  bikeDocsUrl?: string;
  insuranceUrl?: string;
  dateOfBirth?: string;
  theme?: 'light' | 'dark';
  emergencyFiles?: { name: string, url: string, type: string, uploadedAt: string }[];
}

export interface Bike {
  id: string;
  userId: string;
  brand: string;
  model: string;
  year?: number;
  currentMileage: number;
  lastChainLubeMileage?: number;
  lastWashDate?: string;
  lastServiceDate?: string;
  lastServiceMileage?: number;
  imageUrl?: string;
  gallery?: string[];
}

export interface Reminder {
  id: string;
  bikeId: string;
  userId: string;
  title: string;
  date: string;
  type: 'insurance' | 'registration' | 'maintenance' | 'other';
  isCompleted: boolean;
}

export interface FuelLog {
  id: string;
  bikeId: string;
  userId: string;
  date: string;
  cost: number;
  quantity: number;
  mileage: number;
  location?: string;
  imageUrl?: string;
}

export interface ServiceLog {
  id: string;
  bikeId: string;
  userId: string;
  date: string;
  mileage: number;
  description: string;
  cost?: number;
  type: 'service' | 'repair' | 'modification' | 'chain-lube' | 'wash';
  imageUrl?: string;
}

export interface MileageLog {
  id: string;
  bikeId: string;
  userId: string;
  date: string;
  mileage: number;
  tripDistance?: number;
}
